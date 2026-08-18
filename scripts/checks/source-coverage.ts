// R10's second half: "every source has a URL and a retrieved_on date."
// The schema makes url and retrieved_on NOT NULL already, so this check is
// a live-data assertion of that constraint plus a check that every
// verification row's source_id actually resolves, which the schema's
// foreign key also guarantees but this makes visible as evidence rather
// than as an invisible constraint.
//
// Run with `npm run check:sources`.

import { db } from "../../src/db";
import { source, verification } from "../../src/db/schema";
import { isNull, or, eq } from "drizzle-orm";

async function main() {
  const badSources = await db
    .select({ id: source.id, url: source.url, retrievedOn: source.retrievedOn })
    .from(source)
    .where(or(isNull(source.url), eq(source.url, ""), isNull(source.retrievedOn)));

  const allSources = await db.select({ id: source.id }).from(source);
  const sourceIds = new Set(allSources.map((s) => s.id));

  const verifications = await db
    .select({ id: verification.id, sourceId: verification.sourceId })
    .from(verification);
  const orphanVerifications = verifications.filter((v) => !sourceIds.has(v.sourceId));

  if (badSources.length > 0) {
    console.error(
      `FAIL: ${badSources.length} source row(s) missing a URL or a retrieved_on date: ` +
        badSources.map((s) => s.id).join(", "),
    );
  } else {
    console.log(`OK: ${allSources.length} source row(s), all carry a URL and a retrieved_on date.`);
  }

  if (orphanVerifications.length > 0) {
    console.error(
      `FAIL: ${orphanVerifications.length} verification row(s) with no resolving source: ` +
        orphanVerifications.map((v) => v.id).join(", "),
    );
  } else {
    console.log(`OK: ${verifications.length} verification row(s), every source_id resolves.`);
  }

  const failures = badSources.length + orphanVerifications.length;
  console.log(`Total failures: ${failures}.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
