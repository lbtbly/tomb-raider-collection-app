// ISBN equivalence at lookup time, and nowhere else. The second and last
// member of the identifier-equivalence class the GTIN rule opened.
//
// The failure this exists to prevent: a collector holding a book presents
// one of its two legitimate numbers and is told they do not own it. The
// catalogue holds 23 variants carrying an ISBN. 15 hold both forms and
// match either way. 4 hold only the ISBN-10 and 4 hold only the ISBN-13, so
// 8 of 23 miss depending on which number the collector has to hand. Which
// number that is is not random: a scanned book barcode encodes the ISBN-13,
// while the number printed on a copyright page is usually the ISBN-10. The
// two presentations diverge systematically, so the miss lands on whole
// classes of use rather than on the odd row.
//
// Why the catalogue is not repaired instead. Computing the missing form
// into the data is the obvious fix and it is forbidden. R11 re-opens 20
// sampled variants against their cited source and requires the identifier
// to match; a computed ISBN-13 appears in no source. Batch 02 recorded what
// each Open Library record actually carried and noted at the time that
// several carried one form only. The data is right. The lookup is narrow.
//
// Why not in normalizeIdentifier: same reason as the GTIN rule. That
// function mirrors the Postgres generated column byte for byte and
// tests/normalize-parity.test.ts guards it against a live database.
//
// The rule, in full:
//
//   A normalized value gains an ISBN counterpart only if it is a
//   well-formed ISBN whose own check digit is correct.
//     10 characters, 9 digits then a digit or x  ->  also try 978 + the
//       first 9 digits + a recomputed EAN-13 check digit
//     13 digits beginning 978                    ->  also try the 9 digits
//       after the prefix + a recomputed ISBN-10 check digit, mod 11, which
//       can be x
//   Everything else gains nothing.
//
// Three guards carry the weight, and each one is load-bearing.
//
// 1. The check digit of the GIVEN value must be correct. This is not the
//    prefix trick the GTIN rule uses; it is arithmetic, and arithmetic run
//    on a value that was never an ISBN produces a plausible identifier that
//    matches nothing. That is worse than no alternate form, because it
//    looks like the rule worked.
// 2. 979 gains NOTHING. A 979 ISBN-13 has no ISBN-10 at all: the 979 range
//    was opened precisely because the 10-digit space ran out. Dropping its
//    prefix and recomputing would invent a number that belongs to a
//    different book or to no book.
// 3. The forms are the two ISBN encodings and nothing else. A catalogue
//    number is not all digits. A 12-digit GTIN is the wrong length. A
//    13-digit GTIN that is not Bookland fails the 978 test.
//
// The one residual risk, measured rather than argued away. An ISBN-10 is
// 10 digits with a mod 11 check character and nothing else distinguishes it
// from any other 10-digit number, so a 10-digit catalogue number that
// happens to close mod 11 would gain a counterpart that is not its own.
// Roughly 1 in 11 arbitrary ones would. This catalogue holds three such
// numbers, all record-label CD catalogue numbers (2061624172, 3020665022,
// 7559626692) and NONE of them closes mod 11, so none gains anything;
// tests/isbn.test.ts pins all three so a future catalogue is re-measured
// rather than assumed. The cost if one ever did is bounded by the engine:
// an alternate form that matches nothing changes no verdict, and one that
// matches something makes 2 matches, which renders UNCERTAIN and asks
// rather than answers.
//
// The overlap with the GTIN rule, stated rather than left to chance. Both
// rules see 13-digit values, and they do not collide: the GTIN rule fires
// only on a leading 0 and the ISBN rule only on a leading 978, which are
// mutually exclusive. So a 978 value gains exactly its ISBN-10 and no
// 12-digit GTIN, a 0-prefixed value gains exactly its 12-digit GTIN and no
// ISBN-10, and a 13-digit EAN that is neither gains nothing at all. The
// combination is assembled in ./lookup.ts, which owns the ordering.

import { isValidEan13 } from "./barcode";

// Normalized shapes. normalizeIdentifier lowercases, so a stored
// "0-7615-0931-X" reaches this module as "076150931x" and the alternate
// form this module RETURNS must be lowercase too, or it would never match
// a normalized row. Uppercase is accepted on input anyway, since a caller
// holding a raw value should not get a silently different answer.
const ISBN10_FORM = /^[0-9]{9}[0-9xX]$/;
const ISBN13_FORM = /^[0-9]{13}$/;

// The only ISBN-13 prefix with a 10-digit equivalent. See guard 2 above.
const BOOKLAND_978 = "978";

/**
 * The ISBN-10 check character for the 9 digits that precede it. Weights run
 * 10 down to 2 and the total is closed to a multiple of 11, so the result
 * is a digit or "x" for 10. Returned lowercase because normalized values
 * are lowercase.
 */
export function isbn10CheckChar(first9: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(first9[i]) * (10 - i);
  }
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? "x" : String(check);
}

/**
 * The EAN-13 check digit for the 12 digits that precede it. Alternating
 * weights 1 and 3, total closed to a multiple of 10. The mirror of
 * isValidEan13 in ./barcode, which stays the only validator; the two are
 * cross-checked against every ISBN-13 in the catalogue in tests/isbn.test.ts.
 */
export function ean13CheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

/** True for 10 characters, 9 digits then a digit or x, whose check character is correct. */
export function isValidIsbn10(value: string): boolean {
  if (!ISBN10_FORM.test(value)) return false;
  return isbn10CheckChar(value.slice(0, 9)) === value[9]?.toLowerCase();
}

/** True for 13 digits carrying a correct EAN-13 check digit and a Bookland prefix. */
export function isValidIsbn13(value: string): boolean {
  if (!ISBN13_FORM.test(value)) return false;
  if (!value.startsWith("978") && !value.startsWith("979")) return false;
  return isValidEan13(value);
}

/**
 * The ISBN-13 for a valid ISBN-10, or null. Prefix 978, drop the ISBN-10
 * check character, recompute the EAN-13 check digit.
 */
export function isbn10ToIsbn13(value: string): string | null {
  if (!isValidIsbn10(value)) return null;
  const first12 = BOOKLAND_978 + value.slice(0, 9);
  return first12 + ean13CheckDigit(first12);
}

/**
 * The ISBN-10 for a valid 978 ISBN-13, or null. Drop the prefix and the
 * EAN-13 check digit, recompute the ISBN-10 check character mod 11. Null
 * for 979, which has no ISBN-10 in existence.
 */
export function isbn13ToIsbn10(value: string): string | null {
  if (!ISBN13_FORM.test(value)) return null;
  if (!value.startsWith(BOOKLAND_978)) return null;
  if (!isValidEan13(value)) return null;
  const first9 = value.slice(3, 12);
  return first9 + isbn10CheckChar(first9);
}

/**
 * The ISBN-equivalent forms of an already-normalized value, excluding the
 * value itself. Empty for anything that is not a well-formed ISBN with a
 * correct check digit, and empty for a 979 ISBN-13.
 */
export function alternateIsbnForms(normalized: string): string[] {
  if (ISBN13_FORM.test(normalized)) {
    const ten = isbn13ToIsbn10(normalized);
    return ten ? [ten] : [];
  }
  if (ISBN10_FORM.test(normalized)) {
    const thirteen = isbn10ToIsbn13(normalized.toLowerCase());
    return thirteen ? [thirteen] : [];
  }
  return [];
}
