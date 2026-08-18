// Reports fixture rows (tests/fixtures/seed-starter.fixture.json data, or
// anything tagged the way scripts/db/seed.ts tags it) found in the database
// being checked, and judges whether that is fine or a defect.
//
// Fixture data in a local development database is correct and expected:
// scripts/db/seed.ts loads it there on purpose when the real seed file is
// absent. So this only fails the run when fixture rows are reachable on a
// target that is NOT judged local, or when the target cannot be judged at
// all (fail closed: an unknown target is treated as production). On a local
// target with fixture rows present, it prints the same breakdown prefixed
// INFO and exits 0, because a permanently red check:all on every
// development machine is worse than a check that stays quiet until it
// matters: within a week a red check reads as normal, and the day it fires
// for a real reason nobody looks.
//
// The verdict itself is classifyFixtureLeak (src/db/checks/fixture-leak.ts),
// a pure function of the row count and the connection target, so the
// decision is unit-tested without a database
// (tests/fixture-leak-classifier.test.ts). This script only gathers the
// count and the target and prints the verdict.
//
// Identifies fixture rows two ways, matched with OR so either one alone is
// enough to be counted:
//   1. By lineage: franchise.slug or category.slug starting with "fixture-".
//   2. By label: catalogue_item.created_by / variant.created_by starting
//      with "fixture:" (see loader.ts's originLabel parameter).
// From there it walks down to variants, identifiers, verifications and
// sources reachable from a flagged item or variant.
//
// Run with `npm run check:no-fixture`.

import { db } from "../../src/db";
import { resolveDatabaseUrl, isLocalDatabaseUrl } from "../../src/db/connection";
import { classifyFixtureLeak } from "../../src/db/checks/fixture-leak";
import {
  franchise,
  category,
  catalogueItem,
  variant,
  variantIdentifier,
  verification,
} from "../../src/db/schema";
import { or, and, like, inArray, eq } from "drizzle-orm";

async function main() {
  const fixtureFranchises = await db
    .select({ id: franchise.id, slug: franchise.slug })
    .from(franchise)
    .where(like(franchise.slug, "fixture-%"));
  const fixtureCategories = await db
    .select({ id: category.id, slug: category.slug })
    .from(category)
    .where(like(category.slug, "fixture-%"));

  const franchiseIds = fixtureFranchises.map((f) => f.id);
  const categoryIds = fixtureCategories.map((c) => c.id);

  const itemConditions = [];
  if (franchiseIds.length) itemConditions.push(inArray(catalogueItem.franchiseId, franchiseIds));
  if (categoryIds.length) itemConditions.push(inArray(catalogueItem.categoryId, categoryIds));
  itemConditions.push(like(catalogueItem.createdBy, "fixture:%"));

  const fixtureItems = await db
    .select({ id: catalogueItem.id, title: catalogueItem.title })
    .from(catalogueItem)
    .where(or(...itemConditions));
  const itemIds = fixtureItems.map((i) => i.id);

  const variantConditions = [like(variant.createdBy, "fixture:%")];
  if (itemIds.length) variantConditions.push(inArray(variant.catalogueItemId, itemIds));

  const fixtureVariants = await db
    .select({ id: variant.id, name: variant.name })
    .from(variant)
    .where(or(...variantConditions));
  const variantIds = fixtureVariants.map((v) => v.id);

  const fixtureIdentifiers = variantIds.length
    ? await db
        .select({ id: variantIdentifier.id, sourceId: variantIdentifier.sourceId })
        .from(variantIdentifier)
        .where(inArray(variantIdentifier.variantId, variantIds))
    : [];
  const identifierIds = fixtureIdentifiers.map((i) => i.id);

  const verificationTargets: { table: string; ids: number[] }[] = [
    { table: "catalogue_item", ids: itemIds },
    { table: "variant", ids: variantIds },
    { table: "variant_identifier", ids: identifierIds },
  ].filter((t) => t.ids.length > 0);

  let fixtureVerifications: { id: number; sourceId: number }[] = [];
  for (const t of verificationTargets) {
    const rows = await db
      .select({ id: verification.id, sourceId: verification.sourceId })
      .from(verification)
      .where(and(eq(verification.targetTable, t.table), inArray(verification.targetId, t.ids)));
    fixtureVerifications = fixtureVerifications.concat(rows);
  }

  const sourceIds = new Set<number>();
  for (const idf of fixtureIdentifiers) if (idf.sourceId) sourceIds.add(idf.sourceId);
  for (const v of fixtureVerifications) sourceIds.add(v.sourceId);

  const counts = {
    franchises: fixtureFranchises.length,
    categories: fixtureCategories.length,
    catalogue_items: fixtureItems.length,
    variants: fixtureVariants.length,
    variant_identifiers: fixtureIdentifiers.length,
    verifications: fixtureVerifications.length,
    sources: sourceIds.size,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const url = resolveDatabaseUrl(true);
  const local = isLocalDatabaseUrl(url);
  const verdict = classifyFixtureLeak(total, url);

  const printBreakdown = () => {
    console.log(counts);
    if (fixtureFranchises.length) console.log("  franchises:", fixtureFranchises.map((f) => f.slug).join(", "));
    if (fixtureCategories.length) console.log("  categories:", fixtureCategories.map((c) => c.slug).join(", "));
    if (fixtureItems.length) console.log("  items:", fixtureItems.map((i) => i.title).join(", "));
  };

  if (verdict === "ok") {
    console.log("OK: 0 fixture rows found (franchise, category, catalogue_item, variant, variant_identifier, verification, source).");
  } else if (verdict === "info") {
    console.log(`INFO: fixture data present on a local target (${new URL(url).hostname}). Expected in development.`);
    printBreakdown();
  } else {
    console.error(
      total > 0
        ? `FAIL: fixture data found on a target judged ${local ? "local" : "non-local"} (${(() => {
            try {
              return new URL(url).hostname;
            } catch {
              return "unparseable target";
            }
          })()}).`
        : "FAIL: fixture-leak target could not be judged (absent or unparseable DATABASE_URL); failing closed.",
    );
    printBreakdown();
  }

  process.exit(verdict === "fail" ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
