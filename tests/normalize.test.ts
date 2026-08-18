import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeIdentifier } from "../src/lib/identifiers/normalize";

test("normalizeIdentifier lowercases and strips separators, matching the Postgres generated column", () => {
  assert.equal(normalizeIdentifier("5000000000005"), "5000000000005");
  assert.equal(normalizeIdentifier("500-0000-000005"), "5000000000005");
  assert.equal(normalizeIdentifier("FX-0001"), "fx0001");
  assert.equal(normalizeIdentifier("  FX 0001  "), "fx0001");
});

test("normalizeIdentifier makes a scanner read and a keyboard read collide", () => {
  // A barcode scanner emits digits only; a human might type it with the
  // publisher's printed hyphenation. Both must normalize identically or the
  // offline duplicate check would miss a real match.
  const scanned = "5000000000012";
  const typed = "5-00000-00000-12";
  assert.equal(scanned, typed.replace(/-/g, ""), "fixture sanity check: same digits, different punctuation");
  assert.equal(normalizeIdentifier(scanned), normalizeIdentifier(typed));
});

test("normalizeIdentifier is a pure lowercase-alphanumeric filter", () => {
  assert.equal(normalizeIdentifier("Ab!@#12 3"), "ab123");
});
