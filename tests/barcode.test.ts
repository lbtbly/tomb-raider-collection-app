import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidEan13, isValidUpcA, isValidBarcode } from "../src/lib/identifiers/barcode";

test("EAN-13: known-valid values pass", () => {
  // 4006381333931 is the canonical example printed in the GS1 EAN-13
  // specification worksheet.
  assert.equal(isValidEan13("4006381333931"), true);
  // Computed fixture value used in tests/fixtures/seed-starter.fixture.json.
  assert.equal(isValidEan13("5000000000005"), true);
  assert.equal(isValidEan13("5000000000012"), true);
});

test("EAN-13: known-invalid values fail", () => {
  assert.equal(isValidEan13("4006381333930"), false); // wrong check digit
  assert.equal(isValidEan13("5000000000001"), false); // wrong check digit
  assert.equal(isValidEan13("500000000000"), false); // 12 digits, too short
  assert.equal(isValidEan13("50000000000055"), false); // 14 digits, too long
  assert.equal(isValidEan13("not-a-barcode"), false);
});

test("EAN-13: separators are stripped before validation", () => {
  assert.equal(isValidEan13("4-006381-333931"), true);
  assert.equal(isValidEan13(" 4006381333931 "), true);
});

test("UPC-A: known-valid values pass", () => {
  // 036000291452 is the canonical example printed in the GS1 UPC-A
  // specification worksheet.
  assert.equal(isValidUpcA("036000291452"), true);
  // Computed fixture value used in tests/fixtures/seed-starter.fixture.json.
  assert.equal(isValidUpcA("000000000215"), true);
});

test("UPC-A: known-invalid values fail", () => {
  assert.equal(isValidUpcA("036000291453"), false); // wrong check digit
  assert.equal(isValidUpcA("00000000021"), false); // 11 digits, too short
  assert.equal(isValidUpcA("0000000002155"), false); // 13 digits, too long
});

test("isValidBarcode dispatches on kind", () => {
  assert.equal(isValidBarcode("barcode_ean13", "4006381333931"), true);
  assert.equal(isValidBarcode("barcode_upca", "036000291452"), true);
  assert.equal(isValidBarcode("barcode_ean13", "036000291452"), false); // wrong length for EAN-13
});
