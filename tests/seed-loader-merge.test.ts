// The acceptance test for merge-on-match in src/db/seed/loader.ts, and the
// regression test for the two idempotency defects that came out of this same
// seam. It runs against a REAL Postgres, in a throwaway schema built from the
// real migration files and dropped at the end, because the failure modes here
// are database facts: a unique index the loader has to respect, a generated
// normalized column it has to agree with, and a row count after a second run.
//
// The sequence that matters, in order:
//
//   1. Seed from empty. Record counts.
//   2. Seed the SAME document again. Everything inserted must be 0.
//   3. Seed a document that shares its items but carries one new variant.
//      Exactly one variant inserted, zero items.
//   4. Seed that extended document again. Zero of everything.
//
// Step 4 is the one that catches a naive merge: a merge that finds existing
// rows but re-inserts what it just added passes steps 1 through 3 and fails
// here.
//
// Requires the local Docker Postgres (docker-compose.yml). Skips with a
// message rather than failing red if it is not reachable, matching
// normalize-parity.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import { resolveDatabaseUrl } from "../src/db/connection";
import * as schema from "../src/db/schema";
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
} from "../src/db/schema";
import { provenanceTypes, identifierKinds } from "../src/db/seed/taxonomy";
import { seedDocumentSchema } from "../src/db/seed/seed-document";
import { loadSeedDocument } from "../src/db/seed/loader";
import { mintPublicId } from "../src/lib/id/public-id";

const TEST_SCHEMA = `loader_merge_test_${process.pid}`;
const FRANCHISE = "loader-merge-test-franchise";
const CATEGORY = "loader-merge-test-category";

const DB_SOURCE = {
  kind: "database_entry" as const,
  url: "https://example.com/loader-merge/record",
  retrieved_on: "2026-08-18",
};
const DB_VERIFICATION = {
  method: "two_independent_databases" as const,
  verified_on: "2026-08-18",
  verified_by: "loader-merge-test",
};
const PHOTO_SOURCE = {
  kind: "photograph" as const,
  url: "https://example.com/loader-merge/in-hand.jpg",
  retrieved_on: "2026-08-18",
};
const PHOTO_VERIFICATION = {
  method: "in_hand_photograph" as const,
  verified_on: "2026-08-18",
  verified_by: "loader-merge-test",
};

function identifier(kind: string, value: string) {
  return { kind, value, source: DB_SOURCE, verification: DB_VERIFICATION };
}

// Two items. The first carries two variants that SHARE a barcode, which is
// the UNCERTAIN case and the reason an identifier can never be variant
// identity. The second carries no release year at all, which is the shape
// that once split one Dark Horse statue into two rows.
const BASE_DOC = {
  $schema: "vitrine.seed-starter.v1",
  items: [
    {
      franchise: FRANCHISE,
      category: CATEGORY,
      title: "Merge Harness Alpha",
      subtitle: "Region test",
      release_year: 1999,
      source: DB_SOURCE,
      verification: DB_VERIFICATION,
      variants: [
        {
          name: "Standard Edition",
          provenance_type: "retail",
          source: DB_SOURCE,
          verification: DB_VERIFICATION,
          identifiers: [
            identifier("barcode_ean13", "5000000000005"),
            identifier("catalogue_number", "LMT-0001"),
          ],
        },
        {
          name: "Greatest Hits Reprint",
          provenance_type: "retail",
          source: DB_SOURCE,
          verification: DB_VERIFICATION,
          // Same barcode as the standard edition on purpose.
          identifiers: [identifier("barcode_ean13", "5000000000005")],
        },
      ],
    },
    {
      franchise: FRANCHISE,
      category: CATEGORY,
      title: "Merge Harness Beta",
      source: DB_SOURCE,
      verification: DB_VERIFICATION,
      variants: [
        {
          name: "Press Copy",
          provenance_type: "press",
          source: DB_SOURCE,
          verification: DB_VERIFICATION,
          identifiers: [identifier("catalogue_number", "LMT-0002")],
        },
      ],
    },
  ],
};

// The same two items, deepened. Everything here is either already in the
// database or deliberately new:
//   - Alpha gains "Steelbook Edition", the one genuinely new variant.
//   - Alpha's "standard edition" arrives in lower case with its barcode
//     written with separators. Neither is new information; neither may
//     insert a row.
//   - Beta arrives WITH a release year the stored row does not have, and with
//     an in-hand photograph where the row holds two databases agreeing. The
//     year must not split the item; the photograph must not be dropped.
const EXTENDED_DOC = {
  $schema: "vitrine.seed-starter.v1",
  items: [
    {
      franchise: FRANCHISE,
      category: CATEGORY,
      title: "Merge Harness Alpha",
      subtitle: "Region test",
      release_year: 1999,
      source: DB_SOURCE,
      verification: DB_VERIFICATION,
      variants: [
        {
          name: "standard edition",
          provenance_type: "promotional",
          source: DB_SOURCE,
          verification: DB_VERIFICATION,
          identifiers: [identifier("barcode_ean13", "500-0000-000005")],
        },
        {
          name: "Steelbook Edition",
          provenance_type: "retail",
          source: DB_SOURCE,
          verification: DB_VERIFICATION,
          identifiers: [identifier("catalogue_number", "LMT-0003")],
        },
      ],
    },
    {
      franchise: FRANCHISE,
      category: CATEGORY,
      title: "Merge Harness Beta",
      release_year: 2001,
      source: PHOTO_SOURCE,
      verification: PHOTO_VERIFICATION,
      variants: [
        {
          name: "Press Copy",
          provenance_type: "press",
          source: PHOTO_SOURCE,
          verification: PHOTO_VERIFICATION,
          identifiers: [identifier("catalogue_number", "LMT-0002")],
        },
      ],
    },
  ],
};

test("seed loader merges into existing items and stays idempotent", async () => {
  const url = resolveDatabaseUrl(true);
  const admin = postgres(url, { max: 1, connect_timeout: 3 });
  try {
    await admin`select 1`;
  } catch (err) {
    await admin.end({ timeout: 1 });
    console.log(
      `Skipping seed-loader-merge: local Postgres not reachable at ${url} ` +
        `(${(err as Error).message}). Run \`docker compose up -d\` first.`,
    );
    return;
  }

  await admin.unsafe(`drop schema if exists "${TEST_SCHEMA}" cascade`);
  await admin.unsafe(`create schema "${TEST_SCHEMA}"`);

  const client = postgres(url, {
    max: 1,
    connect_timeout: 3,
    connection: { search_path: TEST_SCHEMA },
  });
  const db = drizzle(client, { schema }) as unknown as Parameters<
    typeof loadSeedDocument
  >[0];

  try {
    // Build the throwaway schema from the real migration files, so the test
    // runs against the indexes production actually has: the unique index on
    // (catalogue_item_id, name) and the unique verification per target.
    const dir = path.resolve(process.cwd(), "src/db/migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      // drizzle-kit writes foreign keys qualified as "public"."variant".
      // Left alone, every FK in the throwaway schema would point at the real
      // public tables and be satisfied by whatever row ids happen to live
      // there, so the test would pass for the wrong reason and fail on an
      // empty database. Point them at the throwaway schema instead.
      const sqlText = (await readFile(path.join(dir, file), "utf8")).replaceAll(
        '"public".',
        `"${TEST_SCHEMA}".`,
      );
      for (const statement of sqlText.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (trimmed.length > 0) await client.unsafe(trimmed);
      }
    }

    await db.insert(franchise).values({
      publicId: mintPublicId(),
      slug: FRANCHISE,
      name: "Loader merge test franchise",
      summary: "Throwaway schema, dropped at the end of this test.",
    });
    await db
      .insert(category)
      .values({ slug: CATEGORY, name: "Loader merge test category", sort: 999 });
    await db.insert(provenanceType).values([...provenanceTypes]);
    await db.insert(identifierKind).values([...identifierKinds]);

    const baseDoc = seedDocumentSchema.parse(BASE_DOC);
    const extendedDoc = seedDocumentSchema.parse(EXTENDED_DOC);

    async function counts() {
      const items = (await db.select({ id: catalogueItem.id }).from(catalogueItem)).length;
      const variants = (await db.select({ id: variant.id }).from(variant)).length;
      const identifiers = (await db.select({ id: variantIdentifier.id }).from(variantIdentifier))
        .length;
      const sources = (await db.select({ id: source.id }).from(source)).length;
      const verifications = (await db.select({ id: verification.id }).from(verification)).length;
      return { items, variants, identifiers, sources, verifications };
    }

    // --- Step 1: seed from empty --------------------------------------
    const step1 = await loadSeedDocument(db, baseDoc, "test:loader-merge");
    const after1 = await counts();
    console.log("step 1, seed from empty:", step1, after1);

    assert.equal(step1.itemsInserted, 2, "step 1 items inserted");
    assert.equal(step1.variantsInserted, 3, "step 1 variants inserted");
    assert.equal(step1.identifiersInserted, 4, "step 1 identifiers inserted");
    assert.deepEqual(after1, {
      items: 2,
      variants: 3,
      identifiers: 4,
      sources: 1,
      verifications: 9,
    });

    // --- Step 2: seed the same document again -------------------------
    const step2 = await loadSeedDocument(db, baseDoc, "test:loader-merge");
    const after2 = await counts();
    console.log("step 2, same document again:", step2, after2);

    assert.equal(step2.itemsInserted, 0, "step 2 items inserted");
    assert.equal(step2.variantsInserted, 0, "step 2 variants inserted");
    assert.equal(step2.identifiersInserted, 0, "step 2 identifiers inserted");
    assert.equal(step2.sourcesInserted, 0, "step 2 sources inserted");
    assert.equal(step2.verificationsInserted, 0, "step 2 verifications inserted");
    assert.equal(step2.verificationsStrengthened, 0, "step 2 verifications strengthened");
    assert.deepEqual(after2, after1, "step 2 left every count identical to step 1");

    // --- Step 3: an extended document, one new variant ----------------
    const step3 = await loadSeedDocument(db, extendedDoc, "test:loader-merge");
    const after3 = await counts();
    console.log("step 3, extended document:", step3, after3);

    assert.equal(step3.itemsInserted, 0, "step 3 items inserted");
    assert.equal(step3.variantsInserted, 1, "step 3 variants inserted");
    assert.equal(step3.identifiersInserted, 1, "step 3 identifiers inserted");
    assert.equal(after3.items, 2, "step 3 left the item count alone");
    assert.equal(after3.variants, 4, "step 3 added exactly one variant row");
    assert.equal(after3.identifiers, 5, "step 3 added exactly one identifier row");

    // The lower-case "standard edition" matched, so no second row and no
    // rewrite of the stored name or its provenance.
    const alpha = await db
      .select()
      .from(catalogueItem)
      .where(eq(catalogueItem.title, "Merge Harness Alpha"));
    assert.equal(alpha.length, 1, "one Alpha row");
    const alphaVariants = await db
      .select({ id: variant.id, name: variant.name, provenanceTypeId: variant.provenanceTypeId })
      .from(variant)
      .where(eq(variant.catalogueItemId, alpha[0]!.id));
    assert.deepEqual(
      alphaVariants.map((v) => v.name).sort(),
      ["Greatest Hits Reprint", "Standard Edition", "Steelbook Edition"],
      "the lower-case name merged instead of inserting a second variant",
    );
    const retail = await db
      .select({ id: provenanceType.id })
      .from(provenanceType)
      .where(eq(provenanceType.key, "retail"));
    const standard = alphaVariants.find((v) => v.name === "Standard Edition")!;
    assert.equal(
      standard.provenanceTypeId,
      retail[0]!.id,
      "the existing variant row was not rewritten by the merging document",
    );

    // "500-0000-000005" normalizes onto the stored barcode, so it merged.
    const standardIdentifiers = await db
      .select({ value: variantIdentifier.value })
      .from(variantIdentifier)
      .where(eq(variantIdentifier.variantId, standard.id));
    assert.deepEqual(
      standardIdentifiers.map((r) => r.value).sort(),
      ["5000000000005", "LMT-0001"],
      "the separator-carrying barcode merged on normalized value",
    );

    // The two variants sharing a barcode are still two rows: that is the
    // UNCERTAIN case, and merging must never collapse it.
    const sharedBarcode = await db
      .select({ id: variantIdentifier.id })
      .from(variantIdentifier)
      .where(eq(variantIdentifier.value, "5000000000005"));
    assert.equal(sharedBarcode.length, 2, "two variants still share one barcode");

    // Beta arrived with a year the row does not carry: still one item.
    const beta = await db
      .select()
      .from(catalogueItem)
      .where(eq(catalogueItem.title, "Merge Harness Beta"));
    assert.equal(beta.length, 1, "an absent year did not split the item");
    assert.equal(beta[0]!.releaseYear, null, "the existing item row was not rewritten");

    // The in-hand photograph beat the two-databases verification instead of
    // being dropped. This is the Dark Horse statue defect.
    const [betaVerification] = await db
      .select({ method: verification.method, sourceId: verification.sourceId })
      .from(verification)
      .where(
        and(
          eq(verification.targetTable, "catalogue_item"),
          eq(verification.targetId, beta[0]!.id),
        ),
      );
    assert.equal(
      betaVerification!.method,
      "in_hand_photograph",
      "the stronger verification survived the merge",
    );
    const [photoSource] = await db
      .select({ kind: source.kind })
      .from(source)
      .where(eq(source.id, betaVerification!.sourceId));
    assert.equal(photoSource!.kind, "photograph", "and its source came with it");
    // Two rows were strengthened: the Beta item and its Press Copy variant,
    // both of which arrived carrying the photograph. Beta's identifier came
    // with the same two-databases verification it already held, so nothing
    // there changed, which is the point: only stronger evidence writes.
    assert.equal(step3.verificationsStrengthened, 2, "the item and its variant were strengthened");

    // --- Step 4: the extended document again --------------------------
    const step4 = await loadSeedDocument(db, extendedDoc, "test:loader-merge");
    const after4 = await counts();
    console.log("step 4, extended document again:", step4, after4);

    assert.equal(step4.itemsInserted, 0, "step 4 items inserted");
    assert.equal(step4.variantsInserted, 0, "step 4 variants inserted");
    assert.equal(step4.identifiersInserted, 0, "step 4 identifiers inserted");
    assert.equal(step4.sourcesInserted, 0, "step 4 sources inserted");
    assert.equal(step4.verificationsInserted, 0, "step 4 verifications inserted");
    assert.equal(step4.verificationsStrengthened, 0, "step 4 verifications strengthened");
    assert.deepEqual(after4, after3, "step 4 left every count identical to step 3");

    // R10 on the merged result: every catalogue row still carries exactly one
    // verification, and every verification resolves to a source.
    const rows = after4.items + after4.variants + after4.identifiers;
    assert.equal(after4.verifications, rows, "one verification per catalogue row, no orphans");
  } finally {
    await client.end({ timeout: 5 });
    await admin.unsafe(`drop schema if exists "${TEST_SCHEMA}" cascade`);
    await admin.end({ timeout: 5 });
  }
});
