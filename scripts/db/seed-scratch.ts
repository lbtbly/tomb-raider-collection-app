// Seeds the REAL research corpus into a throwaway Postgres schema, counts
// what landed, seeds it a second time to prove the run is idempotent, then
// drops the schema. Nothing it does is visible to the live catalogue.
//
// Why this exists rather than `npm run db:seed` against a scratch database:
// the live local database is the one other agents measure the product
// against, and a re-seed from empty underneath a running end-to-end check
// looks like a product defect rather than a seed run. This gives a from-empty
// count of the corpus at any time, with no coordination.
//
// The trap it inherits, and it is a real one: drizzle-kit writes foreign keys
// qualified as "public"."variant". Applied unchanged into a scratch schema,
// every foreign key would point back at the real public tables and be
// satisfied by whatever rows happen to live there, so the run would appear to
// work while proving nothing about an empty database. The prefix is rewritten
// to the scratch schema before each statement runs, exactly as
// tests/seed-loader-merge.test.ts does it.
//
// Run with: npx tsx scripts/db/seed-scratch.ts

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { resolveDatabaseUrl } from "../../src/db/connection";
import * as schema from "../../src/db/schema";
import {
  franchise,
  category,
  provenanceType,
  identifierKind,
  catalogueItem,
  variant,
  variantIdentifier,
  source,
  verification,
} from "../../src/db/schema";
import {
  franchises,
  categories,
  provenanceTypes,
  identifierKinds,
} from "../../src/db/seed/taxonomy";
import { seedDocumentSchema } from "../../src/db/seed/seed-document";
import { loadSeedDocument, type LoadResult } from "../../src/db/seed/loader";
import { insertWithFreshPublicId } from "../../src/lib/id/public-id";

const SCRATCH = `seed_scratch_${process.pid}`;

async function main() {
  const url = resolveDatabaseUrl(true);
  const admin = postgres(url, { max: 1, connect_timeout: 5 });
  await admin.unsafe(`drop schema if exists "${SCRATCH}" cascade`);
  await admin.unsafe(`create schema "${SCRATCH}"`);

  const client = postgres(url, {
    max: 1,
    connect_timeout: 5,
    connection: { search_path: SCRATCH },
  });
  const db = drizzle(client, { schema }) as unknown as Parameters<
    typeof loadSeedDocument
  >[0];

  try {
    const migrationsDir = path.resolve(process.cwd(), "src/db/migrations");
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const text = (await readFile(path.join(migrationsDir, file), "utf8")).replaceAll(
        '"public".',
        `"${SCRATCH}".`,
      );
      for (const statement of text.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (trimmed.length > 0) await client.unsafe(trimmed);
      }
    }
    console.log(`Scratch schema "${SCRATCH}" built from ${files.length} migration files.`);

    for (const f of franchises) {
      await insertWithFreshPublicId((publicId) =>
        db.insert(franchise).values({ ...f, publicId }),
      );
    }
    await db.insert(category).values([...categories]);
    await db.insert(provenanceType).values([...provenanceTypes]);
    await db.insert(identifierKind).values([...identifierKinds]);

    // Same order scripts/db/seed.ts uses: seed-starter.json first, then the
    // rest by name. The merge is order-independent by design, but a count
    // that is not reproducible is not evidence.
    const researchDir = path.resolve(process.cwd(), ".forge/research");
    const found = (await readdir(researchDir))
      .filter((n) => n.startsWith("seed-") && n.endsWith(".json"))
      .sort();
    const base = "seed-starter.json";
    const ordered = found.includes(base)
      ? [base, ...found.filter((n) => n !== base)]
      : found;

    async function counts() {
      const rows = async (t: typeof catalogueItem | typeof variant | typeof variantIdentifier | typeof source | typeof verification) =>
        (await db.select({ id: t.id }).from(t)).length;
      return {
        items: await rows(catalogueItem),
        variants: await rows(variant),
        identifiers: await rows(variantIdentifier),
        sources: await rows(source),
        verifications: await rows(verification),
      };
    }

    function totalOf(results: LoadResult[]) {
      return results.reduce(
        (a, r) => ({
          itemsInserted: a.itemsInserted + r.itemsInserted,
          itemsSkippedExisting: a.itemsSkippedExisting + r.itemsSkippedExisting,
          variantsInserted: a.variantsInserted + r.variantsInserted,
          identifiersInserted: a.identifiersInserted + r.identifiersInserted,
          sourcesInserted: a.sourcesInserted + r.sourcesInserted,
          verificationsInserted: a.verificationsInserted + r.verificationsInserted,
          verificationsStrengthened:
            a.verificationsStrengthened + r.verificationsStrengthened,
        }),
        {
          itemsInserted: 0,
          itemsSkippedExisting: 0,
          variantsInserted: 0,
          identifiersInserted: 0,
          sourcesInserted: 0,
          verificationsInserted: 0,
          verificationsStrengthened: 0,
        },
      );
    }

    async function pass(label: string) {
      const results: LoadResult[] = [];
      for (const name of ordered) {
        const parsed = seedDocumentSchema.safeParse(
          JSON.parse(await readFile(path.join(researchDir, name), "utf8")),
        );
        if (!parsed.success) {
          console.error(`${name} failed validation.`);
          console.error(parsed.error.format());
          process.exitCode = 1;
          return null;
        }
        const r = await loadSeedDocument(db, parsed.data, `scratch:${name}`);
        results.push(r);
        console.log(
          `  ${name}: +${r.itemsInserted} items, +${r.variantsInserted} variants, ` +
            `+${r.identifiersInserted} identifiers (${r.itemsSkippedExisting} items matched)`,
        );
      }
      const totals = totalOf(results);
      const c = await counts();
      console.log(`${label} totals:`, totals);
      console.log(`${label} counts:`, c);
      return { totals, counts: c };
    }

    console.log(`\nPass 1, ${ordered.length} documents into an empty schema:`);
    const first = await pass("pass 1");
    if (!first) return;

    console.log(`\nPass 2, the same ${ordered.length} documents again:`);
    const second = await pass("pass 2");
    if (!second) return;

    const idempotent =
      second.totals.itemsInserted === 0 &&
      second.totals.variantsInserted === 0 &&
      second.totals.identifiersInserted === 0 &&
      second.totals.sourcesInserted === 0 &&
      second.totals.verificationsInserted === 0 &&
      second.totals.verificationsStrengthened === 0 &&
      JSON.stringify(second.counts) === JSON.stringify(first.counts);

    console.log(
      `\nIdempotent on the real corpus: ${idempotent ? "YES" : "NO"}. ` +
        `${first.counts.items} items, ${first.counts.variants} variants, ` +
        `${first.counts.identifiers} identifiers.`,
    );
    if (!idempotent) process.exitCode = 1;
  } finally {
    await client.end({ timeout: 5 });
    await admin.unsafe(`drop schema if exists "${SCRATCH}" cascade`);
    await admin.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
