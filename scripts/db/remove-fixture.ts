// Runs scripts/db/sql/remove-fixture.sql, a single DO block that deletes
// every fixture row in dependency order, so a database used for local
// development can be cleaned before a real seed without a full rebuild.
//
// Refuses on a non-local database for the same reason scripts/db/seed.ts
// refuses to load the fixture there in the first place: this tool exists to
// clean up local-only scaffolding, not to run against anything else.
//
// Run with `npm run db:remove-fixture`.

import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { resolveDatabaseUrl, isLocalDatabaseUrl } from "../../src/db/connection";

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
      `Refusing to run: resolved database host "${host}" is not judged local. ` +
        "This script deletes fixture rows and is meant for local development only.",
    );
    process.exit(1);
  }

  const sqlPath = path.resolve(process.cwd(), "scripts/db/sql/remove-fixture.sql");
  const statement = await readFile(sqlPath, "utf8");

  const sql = postgres(url, {
    max: 1,
    onnotice: (notice) => console.log("NOTICE:", notice.message ?? notice),
  });
  try {
    await sql.unsafe(statement);
    console.log("Executed scripts/db/sql/remove-fixture.sql.");
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
