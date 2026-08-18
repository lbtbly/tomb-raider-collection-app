// Check-digit routines for the two barcode identifier kinds slice 1 seeds:
// barcode_ean13 and barcode_upca. Both are pure functions over a digit
// string so scripts/checks/barcode-check-digit.ts can run them against the
// live database and the check screen can run the same routine offline,
// on-device, with no network call.

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

// EAN-13: sum odd positions (1-indexed, from the left, excluding the check
// digit) at weight 1 and even positions at weight 3; the check digit makes
// the total a multiple of 10.
export function isValidEan13(value: string): boolean {
  const d = digitsOnly(value);
  if (d.length !== 13) return false;
  const digits = d.split("").map(Number);
  const check = digits[12];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = digits[i];
    if (digit === undefined) return false;
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === check;
}

// UPC-A: sum odd positions (1-indexed from the left, excluding the check
// digit) at weight 3 and even positions at weight 1; same multiple-of-10 rule.
// UPC-A is EAN-13 with a leading zero, but is validated on its own 12-digit
// form because that is the form printed on the pack.
export function isValidUpcA(value: string): boolean {
  const d = digitsOnly(value);
  if (d.length !== 12) return false;
  const digits = d.split("").map(Number);
  const check = digits[11];
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const digit = digits[i];
    if (digit === undefined) return false;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === check;
}

export function isValidBarcode(
  kind: "barcode_ean13" | "barcode_upca",
  value: string,
): boolean {
  return kind === "barcode_ean13" ? isValidEan13(value) : isValidUpcA(value);
}
