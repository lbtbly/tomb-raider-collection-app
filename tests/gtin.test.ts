// The GTIN equivalence used at lookup time. One test per direction, and the
// negatives that matter more than the positives: a catalogue number, an
// ISBN-13 and a matrix runout must gain nothing, or the widened lookup
// starts inventing matches for identifiers that were never barcodes.
//
// The values here are real catalogue values, not invented ones. 743175952919
// is the UPC-A on Tomb Raider NTSC-U (SLUS-00152). 9780345461711 is a seeded
// ISBN. 848064011972 / 0848064011972 are the pair the catalogue genuinely
// holds twice, once as UPC-A and once as EAN-13, on two different variants.

import { test } from "node:test";
import assert from "node:assert/strict";
import { alternateGtinForms } from "../src/lib/identifiers/gtin";
import { identifierLookupForms } from "../src/lib/identifiers/lookup";
import { normalizeIdentifier } from "../src/lib/identifiers/normalize";

test("12 digits gain the leading-zero EAN-13 form", () => {
  assert.deepEqual(alternateGtinForms("743175952919"), ["0743175952919"]);
  assert.deepEqual(alternateGtinForms("788687301237"), ["0788687301237"]);
  assert.deepEqual(identifierLookupForms("743175952919"), [
    "743175952919",
    "0743175952919",
  ]);
});

test("13 digits beginning with zero gain the 12-digit UPC-A remainder", () => {
  assert.deepEqual(alternateGtinForms("0743175952919"), ["743175952919"]);
  assert.deepEqual(alternateGtinForms("0848064011972"), ["848064011972"]);
  assert.deepEqual(identifierLookupForms("0743175952919"), [
    "0743175952919",
    "743175952919",
  ]);
});

test("the two directions are inverses, so a scan and a keyboard read meet", () => {
  const printed = "743175952919"; // what the pack shows, what the catalogue holds
  const scanned = "0743175952919"; // what macOS Vision reports for that symbol
  assert.ok(identifierLookupForms(printed).includes(scanned));
  assert.ok(identifierLookupForms(scanned).includes(printed));
});

test("a 13-digit EAN-13 with a non-zero first digit gains nothing", () => {
  // A genuine EAN-13 has no UPC-A form. Stripping its first digit would
  // manufacture a 12-digit string that means nothing.
  assert.deepEqual(alternateGtinForms("5032921014762"), []);
  assert.deepEqual(alternateGtinForms("5000000000005"), []);
  assert.deepEqual(identifierLookupForms("5032921014762"), ["5032921014762"]);
});

test("a catalogue number gains no alternate forms", () => {
  // SLUS-00152 normalizes to slus00152: not all digits, so untouched. The
  // normalized form is what the lookup actually holds, so both are asserted.
  assert.deepEqual(alternateGtinForms("SLUS-00152"), []);
  assert.deepEqual(alternateGtinForms(normalizeIdentifier("SLUS-00152")), []);
  assert.deepEqual(identifierLookupForms(normalizeIdentifier("SLUS-00152")), ["slus00152"]);
  assert.deepEqual(alternateGtinForms(normalizeIdentifier("SLES-00024")), []);
  assert.deepEqual(alternateGtinForms(normalizeIdentifier("SLUS-01311")), []);
});

test("an ISBN-13 gains no alternate forms, asserted rather than assumed", () => {
  // An ISBN-13 is 13 digits and would be in range on length alone. It is
  // safe only because the Bookland prefix is 978 or 979, never 0. That is
  // an assumption worth failing loudly on, so it is checked against every
  // 13-digit ISBN seeded in the catalogue.
  const seededIsbn13 = [
    "9780345461711",
    "9781506703329",
    "9781785659911",
    "9780761509318",
    "9780761515197",
    "9780761522713",
    "9780761532354",
    "9780761556169",
    "9780761560777",
    "9780744014532",
  ];
  for (const isbn of seededIsbn13) {
    assert.equal(isbn.length, 13);
    assert.deepEqual(alternateGtinForms(isbn), [], isbn);
    // The lookup DOES widen these now, under the separate ISBN rule added
    // after this test was written (src/lib/identifiers/isbn.ts). What must
    // stay true here is that the GTIN rule contributes nothing to them: an
    // ISBN-13 gains exactly one form, its 10-digit self, and never a
    // 12-digit UPC-A remainder.
    const forms = identifierLookupForms(isbn);
    assert.equal(forms.length, 2, isbn);
    assert.equal(forms[0], isbn, isbn);
    assert.equal(forms[1]?.length, 10, isbn);
    assert.ok(
      !forms.some((f) => f.length === 12),
      isbn,
    );
  }
  // A 10-digit ISBN is out of range on length, including one ending in X,
  // which is not all digits either.
  assert.deepEqual(alternateGtinForms("0761509313"), []);
  assert.deepEqual(alternateGtinForms(normalizeIdentifier("0-7615-0931-X")), []);
});

test("SKUs, part numbers and matrix runouts gain no alternate forms", () => {
  assert.deepEqual(alternateGtinForms(normalizeIdentifier("TR-2021-RSD")), []);
  assert.deepEqual(alternateGtinForms(normalizeIdentifier("EIDOS-0001")), []);
  assert.deepEqual(
    alternateGtinForms(normalizeIdentifier("SLUS-00152 A1 IFPI L903")),
    [],
  );
});

test("lengths outside 12 and 13 gain nothing, and neither does an empty string", () => {
  for (const value of ["", "1", "12345678901", "12345678901234", "00000000000000"]) {
    assert.deepEqual(alternateGtinForms(value), [], JSON.stringify(value));
  }
  assert.deepEqual(identifierLookupForms(""), []);
  assert.deepEqual(identifierLookupForms("12345678901"), ["12345678901"]);
});

test("no form is ever repeated", () => {
  for (const value of ["743175952919", "0743175952919", "5032921014762", "slus00152"]) {
    const forms = identifierLookupForms(value);
    assert.equal(new Set(forms).size, forms.length, value);
  }
});
