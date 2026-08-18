// GTIN equivalence at lookup time, and nowhere else.
//
// The failure this exists to prevent: a collector in an aisle scans a
// UPC-A they own and is told they do not own it. UPC-A is the majority of
// scannable barcodes in this catalogue -- 30 barcode_upca rows at 12 digits
// against 21 barcode_ean13 at 13 -- and macOS Vision, which backs
// BarcodeDetector in Chromium on this platform, reports a UPC-A symbol as
// format "ean_13" with a leading zero. The object stored as 743175952919
// scans as 0743175952919. Android and ChromeOS may report the same symbol
// as a distinct 12-digit upc_a. Same object, same catalogue, opposite
// results per device, which is worse than a flat failure because a bug
// report cannot be reproduced.
//
// Why the equivalence lives here and NOT in normalizeIdentifier: that
// function mirrors the Postgres generated column
// `lower(regexp_replace(value, '[^a-zA-Z0-9]', '', 'g'))` byte for byte,
// because the offline check matches on-device with no server round trip and
// the two routines must never drift. tests/normalize-parity.test.ts guards
// it against a live database. Widening it would break parity and would also
// rewrite what is stored, which is not what is wanted: the catalogue should
// keep the digits printed on the pack. So normalization stays exact and the
// query is widened at the moment of the lookup instead.
//
// The rule, in full:
//
//   A normalized value gains alternate forms only if it is all digits and
//   either 12 or 13 characters long.
//     13 digits beginning with "0"  ->  also try the trailing 12 digits
//     12 digits                     ->  also try "0" prepended
//   Everything else gains nothing.
//
// Both directions are required because the catalogue holds both kinds and a
// device may report either.
//
// What the length-and-digits constraint protects. A catalogue number
// (SLUS-00152 -> "slus00152") is not all digits and is untouched. An
// ISBN-13 is 13 digits, but every ISBN begins with the 978 or 979 Bookland
// prefix, so the leading-zero branch cannot fire on one; tests assert that
// against the real catalogue values rather than assuming it. SKUs, part
// numbers and matrix runouts are either the wrong length or not all digits.
// A 13-digit EAN with a non-zero first digit is a genuine EAN-13 that has
// no UPC-A form, and correctly gains nothing.
//
// This module owns ONE rule. The ISBN rule lives in ./isbn.ts and the two
// are combined in ./lookup.ts, which is what the verdict engine calls. They
// overlap on 13-digit values and cannot both fire: the leading-zero branch
// here and the Bookland 978 branch there are mutually exclusive.

const ALL_DIGITS = /^[0-9]+$/;

/**
 * The GTIN-equivalent forms of an already-normalized value, excluding the
 * value itself. Empty for anything that is not a 12 or 13 digit all-digit
 * string.
 */
export function alternateGtinForms(normalized: string): string[] {
  if (!ALL_DIGITS.test(normalized)) return [];
  if (normalized.length === 13) {
    return normalized.startsWith("0") ? [normalized.slice(1)] : [];
  }
  if (normalized.length === 12) {
    return [`0${normalized}`];
  }
  return [];
}
