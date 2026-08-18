// R10's first half: "every catalogue_item, variant, identifier ... carries
// ... a verification row naming a method; count of rows missing any of
// these is 0." Checks the three target tables slice 1 seeds (bundle_component
// is slice 2 scope and does not exist yet).
//
// Run with `npm run check:verification`.

import { db } from "../../src/db";
import { catalogueItem, variant, variantIdentifier, verification } from "../../src/db/schema";
import { eq } from "drizzle-orm";

const TARGETS = [
  { table: "catalogue_item", rows: catalogueItem },
  { table: "variant", rows: variant },
  { table: "variant_identifier", rows: variantIdentifier },
] as const;

async function main() {
  let totalMissing = 0;

  for (const t of TARGETS) {
    const allRows = await db.select({ id: t.rows.id }).from(t.rows);
    const verifiedRows = await db
      .select({ targetId: verification.targetId })
      .from(verification)
      .where(eq(verification.targetTable, t.table));
    const verifiedIds = new Set(verifiedRows.map((v) => v.targetId));

    const missing = allRows.filter((r) => !verifiedIds.has(r.id));
    if (missing.length > 0) {
      totalMissing += missing.length;
      console.error(
        `FAIL ${t.table}: ${missing.length} row(s) with no verification row: ` +
          missing.map((m) => m.id).join(", "),
      );
    } else {
      console.log(`OK ${t.table}: ${allRows.length} row(s), all verified.`);
    }
  }

  console.log(`Total rows missing verification: ${totalMissing}.`);
  process.exit(totalMissing === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
