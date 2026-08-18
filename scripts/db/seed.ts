// Seeds taxonomy (always) and the verified starter catalogue from
// .forge/research/seed-starter.json when it exists. Never fabricates
// catalogue data attributed to the real product, and never substitutes
// fixture data silently:
//
//   - The real seed file, when present, always loads, on any database.
//   - Absent the real file, the loader falls back to
//     tests/fixtures/seed-starter.fixture.json, but ONLY when the resolved
//     DATABASE_URL is judged local by isLocalDatabaseUrl (see
//     src/db/connection.ts: localhost, 127.0.0.1, or the docker-compose
//     service/container name). Every fixture row is tagged created_by
//     "fixture:seed-starter.fixture.json" and lives under its own
//     "fixture-test-franchise" franchise, so it is identifiable by data as
//     well as by name, and scripts/checks/no-fixture-leak.ts fails loudly if
//     any such row is ever found on a database that is not local.
//   - Absent the real file on a database that is NOT judged local, the run
//     exits non-zero with no rows written. A production seed that cannot
//     find real data stops; it does not quietly ship something else.
//
// Run with `npm run db:seed`.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { db } from "../../src/db";
import { resolveDatabaseUrl, isLocalDatabaseUrl } from "../../src/db/connection";
import {
  franchise,
  category,
  provenanceType,
  identifierKind,
} from "../../src/db/schema";
import {
  franchises,
  categories,
  provenanceTypes,
  identifierKinds,
} from "../../src/db/seed/taxonomy";
import { seedDocumentSchema } from "../../src/db/seed/seed-document";
import { loadSeedDocument } from "../../src/db/seed/loader";
import { insertWithFreshPublicId } from "../../src/lib/id/public-id";

async function seedTaxonomy() {
  for (const f of franchises) {
    await insertWithFreshPublicId((publicId) =>
      db
        .insert(franchise)
        .values({ ...f, publicId })
        .onConflictDoNothing({ target: franchise.slug }),
    );
  }
  for (const c of categories) {
    await db.insert(category).values(c).onConflictDoNothing({ target: category.slug });
  }
  for (const p of provenanceTypes) {
    await db
      .insert(provenanceType)
      .values(p)
      .onConflictDoNothing({ target: provenanceType.key });
  }
  for (const i of identifierKinds) {
    await db
      .insert(identifierKind)
      .values(i)
      .onConflictDoNothing({ target: identifierKind.key });
  }
  console.log(
    `Taxonomy seeded: ${franchises.length} franchise(s), ${categories.length} categories, ` +
      `${provenanceTypes.length} provenance types, ${identifierKinds.length} identifier kinds.`,
  );
}

// The fixture's own franchise and category, isolated from the real
// taxonomy on purpose: "fixture-test-franchise" never collides with
// "tomb-raider", so a query scoped to the real franchise never sees it.
//
// Not the same thing as F22's second-franchise checksum proof. F22 asks for
// a real second franchise inserted by row only, with its own categories and
// a new variant axis, to prove the schema generalises; that is slice 2 work
// against real (if minimal) data. This franchise exists only to exercise
// the loader and the UNCERTAIN duplicate-check path locally and is named
// and tagged as a fixture precisely so nobody reaches for it to answer F22.
async function seedFixtureTaxonomy() {
  await insertWithFreshPublicId((publicId) =>
    db
      .insert(franchise)
      .values({
        publicId,
        slug: "fixture-test-franchise",
        name: "Fixture test franchise (dev only, not a real catalogue)",
        summary:
          "Synthetic data for exercising the seed loader and the offline " +
          "duplicate check locally. Never a real franchise, never shipped " +
          "as product content.",
      })
      .onConflictDoNothing({ target: franchise.slug }),
  );
  await db
    .insert(category)
    .values({ slug: "fixture-category", name: "Fixture category (dev only)", parentId: null, sort: 999 })
    .onConflictDoNothing({ target: category.slug });
}

async function loadFixtureCatalogue() {
  const fixturePath = path.resolve(
    process.cwd(),
    "tests/fixtures/seed-starter.fixture.json",
  );
  const raw = await readFile(fixturePath, "utf8");
  const parsed = seedDocumentSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    console.error("seed-starter.fixture.json failed validation against the documented shape:");
    console.error(parsed.error.format());
    process.exitCode = 1;
    return;
  }

  await seedFixtureTaxonomy();
  const result = await loadSeedDocument(
    db,
    parsed.data,
    "fixture:seed-starter.fixture.json",
  );
  console.log(
    "\n*** FIXTURE DATA LOADED, NOT THE REAL CATALOGUE ***\n" +
      "Loaded tests/fixtures/seed-starter.fixture.json under franchise " +
      '"fixture-test-franchise" because .forge/research/seed-starter.json ' +
      "does not exist yet. Every row is tagged created_by " +
      '"fixture:seed-starter.fixture.json". Re-run `npm run db:seed` once ' +
      "the research agent's file lands; it takes priority automatically.\n",
  );
  console.log("Fixture load result:", result);
}

// Every research batch under .forge/research/, not just the first one.
// The loader merges rather than skipping, so a later batch can deepen an item
// an earlier batch created; before that was true this had to be one file.
//
// Order is fixed rather than whatever readdir returns: seed-starter.json is
// the base catalogue and goes first, then the rest by name. The loader's
// merge is order-independent by design (the strongest verification wins
// whichever pass it arrives on), so this is for reproducible output, not for
// correctness. A run that is not reproducible is not evidence.
async function listSeedDocuments(): Promise<string[]> {
  const dir = path.resolve(process.cwd(), ".forge/research");
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const found = entries
    .filter((name) => name.startsWith("seed-") && name.endsWith(".json"))
    .sort();
  const base = "seed-starter.json";
  const ordered = found.includes(base)
    ? [base, ...found.filter((n) => n !== base)]
    : found;
  return ordered.map((name) => path.join(dir, name));
}

async function seedCatalogue() {
  const seedPaths = await listSeedDocuments();

  if (seedPaths.length > 0) {
    for (const seedPath of seedPaths) {
      const rel = path.relative(process.cwd(), seedPath);
      const parsed = seedDocumentSchema.safeParse(
        JSON.parse(await readFile(seedPath, "utf8")),
      );
      if (!parsed.success) {
        // One bad file fails the run rather than loading the others and
        // leaving a half-seeded catalogue that looks complete.
        console.error(`${rel} failed validation against the documented shape:`);
        console.error(parsed.error.format());
        process.exitCode = 1;
        return;
      }
      const result = await loadSeedDocument(db, parsed.data);
      console.log(`Catalogue seeded from ${rel}:`, result);
    }
    return;
  }

  // No real seed file. Fixture data is a local-development convenience,
  // never a production substitute: check the actual connection target, not
  // an environment flag a caller could set, before loading it.
  const url = resolveDatabaseUrl(true);
  if (!isLocalDatabaseUrl(url)) {
    let host = "(unparseable url)";
    try {
      host = new URL(url).hostname;
    } catch {
      /* keep placeholder */
    }
    console.error(
      "\nRefusing to seed: .forge/research/seed-starter.json does not exist " +
        `and the resolved database host ("${host}") is not judged local. ` +
        "A production seed run that cannot find the real catalogue stops " +
        "here rather than silently loading tests/fixtures/seed-starter.fixture.json. " +
        "Provide the real seed file, or point DATABASE_URL at the local " +
        "Docker Postgres from docker-compose.yml if this is meant to be a " +
        "local development run.\n",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "No .forge/research/seed-starter.json yet, and the database is local: " +
      "loading tests/fixtures/seed-starter.fixture.json instead of " +
      "fabricating catalogue data.",
  );
  await loadFixtureCatalogue();
}

async function main() {
  await seedTaxonomy();
  await seedCatalogue();
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
