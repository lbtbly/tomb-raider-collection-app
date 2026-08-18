// R9 / the check-digit machine check named in .forge/PLAN.md slice 1:
// "every barcode_ean13 and barcode_upca value passes its check digit."
// Reads live variant_identifier rows for the two barcode kinds and runs the
// same pure check-digit routine the offline check screen uses, so the
// server-side proof and the on-device verdict logic never diverge.
//
// Run with `npm run check:barcode`.

import { db } from "../../src/db";
import { variantIdentifier, identifierKind } from "../../src/db/schema";
import { inArray } from "drizzle-orm";
import { isValidBarcode } from "../../src/lib/identifiers/barcode";

async function main() {
  const kinds = await db
    .select({ id: identifierKind.id, key: identifierKind.key })
    .from(identifierKind)
    .where(inArray(identifierKind.key, ["barcode_ean13", "barcode_upca"]));

  const kindIds = kinds.map((k) => k.id);
  if (kindIds.length === 0) {
    console.log(
      "identifier_kind rows for barcode_ean13 / barcode_upca not seeded yet. " +
        "Run `npm run db:seed` first.",
    );
    process.exit(1);
  }

  const rows = await db
    .select({
      id: variantIdentifier.id,
      value: variantIdentifier.value,
      kindId: variantIdentifier.identifierKindId,
    })
    .from(variantIdentifier)
    .where(inArray(variantIdentifier.identifierKindId, kindIds));

  const kindById = new Map(kinds.map((k) => [k.id, k.key as "barcode_ean13" | "barcode_upca"]));

  let failures = 0;
  for (const row of rows) {
    const kind = kindById.get(row.kindId);
    if (!kind) continue;
    if (!isValidBarcode(kind, row.value)) {
      failures++;
      console.error(`FAIL variant_identifier.id=${row.id} kind=${kind} value=${row.value}`);
    }
  }

  console.log(
    `Checked ${rows.length} barcode row(s) (${kinds
      .map((k) => k.key)
      .join(", ")}). Failures: ${failures}.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
