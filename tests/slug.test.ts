import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/lib/id/slug";

test("slugify lowercases and hyphenates", () => {
  assert.equal(slugify("Tomb Raider III: Adventures of Lara Croft"), "tomb-raider-iii-adventures-of-lara-croft");
});

test("slugify collapses repeated separators and trims edges", () => {
  assert.equal(slugify("  --Fixture   Item--  "), "fixture-item");
});

test("slugify strips diacritics", () => {
  assert.equal(slugify("Édition Française"), "edition-francaise");
});

test("slugify handles a purely numeric or symbolic title without throwing", () => {
  assert.equal(slugify("2001: A Space Odyssey"), "2001-a-space-odyssey");
  assert.equal(slugify("!!!"), "");
});

test("slugify caps length at 120 characters", () => {
  const long = "a".repeat(200);
  assert.equal(slugify(long).length, 120);
});
