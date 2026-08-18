// Empties the catalogue so `npm run db:seed` can rebuild it from the research
// files, which are its source of truth. Taxonomy is left alone: seedTaxonomy()
// runs first in seed.ts and is idempotent, and the category rows are referenced
// by item identity now.
//
// This exists because the loader MERGES and never rewrites an existing row, so
// a correction made in a seed file cannot reach a row that is already there.
// Three corrections needed it: the em-dash titles, the urn: photograph sources,
// and the Record Store Day duplicate whose two entries were aligned so the
// loader would collapse them.
//
// Refuses to run against a database that is not judged local, on the same
// reasoning as scripts/db/seed.ts: a destructive default that depends on an
// environment flag a caller could set is not a safeguard.
//
// Run with `npm run db:reset-catalogue`.

import { db } from "../../src/db";
import { sql } from "drizzle-orm";
import { resolveDatabaseUrl, isLocalDatabaseUrl } from "../../src/db/connection";

const TABLES = [
  "verification",
  "source",
  "variant_identifier",
  "variant",
  "catalogue_item",
  "permalink",
];

async function main() {
  const url = resolveDatabaseUrl(true);
  if (!isLocalDatabaseUrl(url)) {
    let host = "(unparseable url)";
    try {
      host = new URL(url).hostname;
    } catch {
      /* keep placeholder */
    }
    console.error(
      `\nRefusing to empty the catalogue: the resolved database host ("${host}") ` +
        "is not judged local. This command deletes every catalogue row.\n",
    );
    process.exit(1);
  }

  const before = (await db.execute(
    sql.raw(
      "select (select count(*)::int from catalogue_item) items, (select count(*)::int from variant) variants",
    ),
  )) as unknown as Array<Record<string, unknown>>;
  console.log("before:", JSON.stringify(before[0]));

  await db.execute(sql.raw(`truncate ${TABLES.join(", ")} restart identity cascade`));

  const after = (await db.execute(
    sql.raw(
      "select (select count(*)::int from catalogue_item) items, (select count(*)::int from variant) variants",
    ),
  )) as unknown as Array<Record<string, unknown>>;
  console.log("after: ", JSON.stringify(after[0]));
  console.log("\nNow run `npm run db:seed` to rebuild from .forge/research/.");
  process.exit(0);
}

main();
