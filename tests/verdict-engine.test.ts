// Unit tests for the pure verdict engine. No DOM, no IndexedDB, no network:
// exactly the point of separating it from React (.forge/PLAN.md, "The
// verdict engine, pure and testable").
//
// The two identifier-collision rows are the real, currently-seeded catalogue
// cases named by the coordinator: SLUS-00152 (a 1996 first pressing against
// its Greatest Hits reprint) and SLUS-01311 (a retail Chronicles disc
// against its promotional, not-for-resale twin). 5000000000012 stays only
// as a synthetic edge case alongside them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeVerdict, describeDifference, computeDifference } from "../src/lib/verdict/engine";
import type { CatalogueIndexRow } from "../src/lib/device/schema";

function row(partial: Partial<CatalogueIndexRow> & { variantPublicId: string }): CatalogueIndexRow {
  return {
    itemPublicId: "ITEM0000A0",
    title: "Untitled",
    year: null,
    category: "games",
    variantName: "Standard",
    provenanceType: "retail",
    identifiers: [],
    normalizedIdentifiers: [],
    updatedAt: "2026-08-18T00:00:00.000Z",
    ...partial,
  };
}

const trFirstPressing = row({
  variantPublicId: "VARIANT002",
  itemPublicId: "ITEMTOMBRD",
  title: "Tomb Raider",
  year: 1996,
  variantName: "NTSC-U (United States)",
  provenanceType: "retail",
  normalizedIdentifiers: ["slus00152"],
});

const trGreatestHits = row({
  variantPublicId: "VARIANT004",
  itemPublicId: "ITEMTOMBRD",
  title: "Tomb Raider",
  // release_year lives on catalogue_item in the real schema, so both
  // variants of the same item share it; only the variant name differs.
  year: 1996,
  variantName: "Greatest Hits reprint (NTSC-U)",
  provenanceType: "retail",
  normalizedIdentifiers: ["slus00152"],
});

const chroniclesRetail = row({
  variantPublicId: "VARIANT014",
  itemPublicId: "ITEMCHRON1",
  title: "Tomb Raider: Chronicles",
  year: 2000,
  variantName: "NTSC-U (United States)",
  provenanceType: "retail",
  normalizedIdentifiers: ["slus01311"],
});

const chroniclesPromo = row({
  variantPublicId: "VARIANT032",
  itemPublicId: "ITEMCHRONP",
  title: "Tomb Raider: Chronicles (Promo Only)",
  year: 2000,
  variantName: "United States, not-for-resale copy",
  provenanceType: "promotional",
  normalizedIdentifiers: ["slus01311"],
});

const singleMatchRow = row({
  variantPublicId: "VARIANT099",
  title: "Fixture Cartridge, Region Test",
  variantName: "Standard Edition",
  normalizedIdentifiers: ["5000000000005", "fx0001"],
});

const syntheticDup5000 = row({
  variantPublicId: "VARIANTDUPA",
  title: "Fixture Duplicate Alpha",
  variantName: "Print A",
  normalizedIdentifiers: ["5000000000012"],
});
const syntheticDup5001 = row({
  variantPublicId: "VARIANTDUPB",
  title: "Fixture Duplicate Beta",
  variantName: "Print B",
  normalizedIdentifiers: ["5000000000012"],
});

const INDEX: CatalogueIndexRow[] = [
  trFirstPressing,
  trGreatestHits,
  chroniclesRetail,
  chroniclesPromo,
  singleMatchRow,
  syntheticDup5000,
  syntheticDup5001,
];

test("exact identifier matching exactly one variant the user owns is OWNED", () => {
  const owned = new Set(["VARIANT099"]);
  const verdict = computeVerdict("5000000000005", INDEX, owned);
  assert.equal(verdict.kind, "OWNED");
  if (verdict.kind === "OWNED") assert.equal(verdict.candidate.variantPublicId, "VARIANT099");
});

test("exact identifier matching exactly one variant NOT owned is NOT_IN_COLLECTION, recognized", () => {
  const verdict = computeVerdict("5000000000005", INDEX, new Set());
  assert.equal(verdict.kind, "NOT_IN_COLLECTION");
  if (verdict.kind === "NOT_IN_COLLECTION") {
    assert.ok(verdict.recognized);
    assert.equal(verdict.recognized?.variantPublicId, "VARIANT099");
  }
});

test("an identifier with zero matches is NOT_IN_COLLECTION, unrecognized (the 3-doors case)", () => {
  const verdict = computeVerdict("0000000000000", INDEX, new Set());
  assert.equal(verdict.kind, "NOT_IN_COLLECTION");
  if (verdict.kind === "NOT_IN_COLLECTION") assert.equal(verdict.recognized, null);
});

test("SLUS-00152: first pressing vs Greatest Hits reprint is UNCERTAIN, no candidate preselected", () => {
  const verdict = computeVerdict("SLUS-00152", INDEX, new Set());
  assert.equal(verdict.kind, "UNCERTAIN");
  if (verdict.kind !== "UNCERTAIN") return;
  assert.equal(verdict.candidates.length, 2);
  assert.equal(verdict.more.length, 0);
  assert.equal(verdict.matchKind, "identifier");
  const ids = verdict.candidates.map((c) => c.variantPublicId).sort();
  assert.deepEqual(ids, ["VARIANT002", "VARIANT004"]);
  // Same title, so "title" must not be reported as a differing field; the
  // variant name is what actually differs between the two pressings.
  assert.deepEqual(verdict.differingFields.sort(), ["variant"]);
  // The returned difference names the actual pressings, not just the field
  // name "variant": a collector checks this against the case in hand. It is
  // data (kind + the two values), not a rendered sentence -- the caller
  // (VerdictSlab) turns this into words through the message catalogue.
  assert.deepEqual(verdict.difference, {
    kind: "variantName",
    a: "NTSC-U (United States)",
    b: "Greatest Hits reprint (NTSC-U)",
  });
});

test("SLUS-01311: retail vs promotional not-for-resale twin is UNCERTAIN, differs by title and provenance", () => {
  const verdict = computeVerdict("SLUS-01311", INDEX, new Set());
  assert.equal(verdict.kind, "UNCERTAIN");
  if (verdict.kind !== "UNCERTAIN") return;
  const ids = verdict.candidates.map((c) => c.variantPublicId).sort();
  assert.deepEqual(ids, ["VARIANT014", "VARIANT032"]);
  const fields = verdict.differingFields.sort();
  assert.ok(fields.includes("title"), "title should differ: retail item vs (Promo Only) item");
  assert.ok(fields.includes("variant"));
  assert.ok(fields.includes("provenance"), "retail vs promotional must be reported");
  // Provenance leads (it is what actually distinguishes these two, and is
  // checkable on the object), not the redundant title difference the
  // parenthetical "(Promo Only)" already spells out. The engine returns the
  // raw provenance type values, not a phrase: naming them in words is the
  // caller's job (VerdictSlab, through the message catalogue).
  assert.deepEqual(verdict.difference, { kind: "provenance", a: "retail", b: "promotional" });
});

test("UNCERTAIN carries ownership per candidate rather than as the overall verdict", () => {
  const owned = new Set(["VARIANT014"]); // the retail copy is already owned
  const verdict = computeVerdict("SLUS-01311", INDEX, owned);
  assert.equal(verdict.kind, "UNCERTAIN");
  if (verdict.kind !== "UNCERTAIN") return;
  const retail = verdict.candidates.find((c) => c.variantPublicId === "VARIANT014");
  const promo = verdict.candidates.find((c) => c.variantPublicId === "VARIANT032");
  assert.equal(retail?.owned, true);
  assert.equal(promo?.owned, false);
});

test("the seeded fixture pair (two variants sharing 5000000000012) is UNCERTAIN too", () => {
  const verdict = computeVerdict("5000000000012", INDEX, new Set());
  assert.equal(verdict.kind, "UNCERTAIN");
  if (verdict.kind !== "UNCERTAIN") return;
  assert.equal(verdict.candidates.length, 2);
});

test("a scanner-style value and a hand-typed, hyphenated value reach the same verdict", () => {
  const scanned = computeVerdict("SLUS00152", INDEX, new Set());
  const typed = computeVerdict("slus-00152", INDEX, new Set());
  assert.equal(scanned.kind, typed.kind);
});

test("a title fragment resolving to exactly one variant behaves like an identifier match", () => {
  const verdict = computeVerdict("Fixture Cartridge", INDEX, new Set(["VARIANT099"]));
  assert.equal(verdict.kind, "OWNED");
});

test("a title fragment matching multiple variants is UNCERTAIN and never preselects one", () => {
  const verdict = computeVerdict("Tomb Raider", INDEX, new Set());
  assert.equal(verdict.kind, "UNCERTAIN");
});

// describeCandidate (the "Tomb Raider - NTSC-U (United States)" label) no
// longer lives in the engine: composing it is "how to say it", so it moved
// to the message catalogue (verdict.candidateLabel) and is rendered by
// VerdictSlab through t(), the same fix applied to the difference sentence
// (C16/C19 -- no hardcoded English, and no em dash, inside the pure engine).

test("describeDifference reports no fields for a single candidate", () => {
  assert.deepEqual(describeDifference([trFirstPressing]), []);
});

test("computeDifference: provenance outranks a redundant, parenthetical-only title difference", () => {
  const difference = computeDifference(chroniclesRetail, chroniclesPromo);
  // The engine returns the raw provenance type values (data), never a
  // phrase built from them, and never both literal title strings (with the
  // parenthetical): that would be the misleading "titles differ" read the
  // coordinator flagged, when the real, checkable distinction is
  // provenance. Naming the values in words is VerdictSlab's job.
  assert.deepEqual(difference, { kind: "provenance", a: "retail", b: "promotional" });
});

test("computeDifference: variant name leads when provenance and title agree", () => {
  const difference = computeDifference(trFirstPressing, trGreatestHits);
  assert.deepEqual(difference, {
    kind: "variantName",
    a: "NTSC-U (United States)",
    b: "Greatest Hits reprint (NTSC-U)",
  });
});

test("computeDifference: title leads only once provenance, variant and year all agree", () => {
  const a = row({ variantPublicId: "VA", title: "Tomb Raider", variantName: "Standard", year: 1996 });
  const b = row({ variantPublicId: "VB", title: "Tomb Raider II", variantName: "Standard", year: 1996 });
  const difference = computeDifference(a, b);
  assert.deepEqual(difference, { kind: "title", a: "Tomb Raider", b: "Tomb Raider II" });
});

test("computeDifference: release year outranks title when both differ", () => {
  const a = row({ variantPublicId: "VA", title: "Tomb Raider", variantName: "Standard", year: 1996 });
  const b = row({ variantPublicId: "VB", title: "Tomb Raider II", variantName: "Standard", year: 1997 });
  const difference = computeDifference(a, b);
  assert.deepEqual(difference, { kind: "year", a: 1996, b: 1997 });
});

test("computeDifference: an unrecorded year on either side is carried as null, not coerced into a string", () => {
  const a = row({ variantPublicId: "VA", title: "Tomb Raider", variantName: "Standard", year: 1996 });
  const b = row({ variantPublicId: "VB", title: "Tomb Raider", variantName: "Standard", year: null });
  const difference = computeDifference(a, b);
  assert.deepEqual(difference, { kind: "year", a: 1996, b: null });
});

test("computeDifference: identical rows produce no difference rather than a false claim", () => {
  assert.equal(computeDifference(trFirstPressing, trFirstPressing), null);
});

test("an owned candidate is never truncated into `more`, even sitting last in index order", () => {
  // Three variants sharing one identifier; the owned one is deliberately
  // last in index order, which is exactly the case a naive rows.slice(0, 2)
  // would drop, and dropping it would tell an owner they own nothing.
  const thirdPrinting = row({
    variantPublicId: "VARIANT005",
    itemPublicId: "ITEMTOMBRD",
    title: "Tomb Raider",
    year: 1996,
    variantName: "Platinum reprint (NTSC-U)",
    provenanceType: "retail",
    normalizedIdentifiers: ["slus00152"],
  });
  const threeWay = [trFirstPressing, trGreatestHits, thirdPrinting];
  const owned = new Set(["VARIANT005"]); // last in array order

  const verdict = computeVerdict("SLUS-00152", threeWay, owned);
  assert.equal(verdict.kind, "UNCERTAIN");
  if (verdict.kind !== "UNCERTAIN") return;

  assert.equal(verdict.candidates.length, 2);
  assert.ok(
    verdict.candidates.some((c) => c.variantPublicId === "VARIANT005"),
    "the owned candidate must be shown, not truncated into `more`",
  );
  assert.ok(
    !verdict.more.some((c) => c.variantPublicId === "VARIANT005"),
    "the owned candidate must not appear in `more`",
  );
  assert.equal(verdict.more.length, 1);
});

test("UNCERTAIN from a title fragment is tagged matchKind 'title', not 'identifier'", () => {
  const verdict = computeVerdict("Tomb Raider", INDEX, new Set());
  assert.equal(verdict.kind, "UNCERTAIN");
  if (verdict.kind !== "UNCERTAIN") return;
  assert.equal(verdict.matchKind, "title");
});

// ---------------------------------------------------------------------
// GTIN equivalence at lookup: the UPC-A / EAN-13 leading zero.
//
// 30 of the 51 scannable barcodes in this catalogue are barcode_upca at 12
// digits. macOS Vision, which backs BarcodeDetector in Chromium on that
// platform, reports a UPC-A symbol as format "ean_13" with a leading zero,
// so the object stored as 743175952919 scans as 0743175952919. Before this,
// the two normalized to different strings and a collector was told they did
// not own something they own. Fixed at the lookup, never in
// normalizeIdentifier, which mirrors a Postgres generated column.
// ---------------------------------------------------------------------

// The real seeded row: Tomb Raider NTSC-U, public_id 2FPFHX8B3Z, holding
// UPC-A 743175952919 and catalogue number SLUS-00152.
const trNtscUpc = row({
  variantPublicId: "2FPFHX8B3Z",
  itemPublicId: "ITEMTOMBRD",
  title: "Tomb Raider",
  year: 1996,
  variantName: "NTSC-U (United States)",
  normalizedIdentifiers: ["slus00152", "743175952919"],
});

// The other real case, stored the other way round: an EAN-13 that carries
// the leading zero in the catalogue.
const rsdEan13 = row({
  variantPublicId: "Y06VKB564M",
  itemPublicId: "ITEMLCTRST",
  title: "Lara Croft: Tomb Raider (Music From The Motion Picture)",
  year: 2021,
  variantName: "2LP gold vinyl, Record Store Day reissue",
  normalizedIdentifiers: ["0848064011972"],
});

const rsdUpcA = row({
  variantPublicId: "XHHA2C9ZS3",
  itemPublicId: "ITEMLCTRSU",
  title: "Lara Croft: Tomb Raider (Music From the Motion Picture)",
  year: 2021,
  variantName: "RSD Drops 2021 exclusive, 2LP",
  normalizedIdentifiers: ["848064011972"],
});

test("a UPC-A scanned as a leading-zero EAN-13 resolves to the variant that holds the 12-digit form", () => {
  const index = [trNtscUpc, ...INDEX];
  const owned = new Set(["2FPFHX8B3Z"]);
  const verdict = computeVerdict("0743175952919", index, owned);
  assert.equal(verdict.kind, "OWNED");
  if (verdict.kind === "OWNED") assert.equal(verdict.candidate.variantPublicId, "2FPFHX8B3Z");
});

test("the scanned 13-digit form and the printed 12-digit form reach the same verdict", () => {
  const index = [trNtscUpc, ...INDEX];
  const owned = new Set(["2FPFHX8B3Z"]);
  const scanned = computeVerdict("0743175952919", index, owned);
  const printed = computeVerdict("743175952919", index, owned);
  assert.deepEqual(scanned, printed);
});

test("a 12-digit query resolves a catalogue value stored with the leading zero", () => {
  const index = [rsdEan13, ...INDEX];
  const verdict = computeVerdict("848064011972", index, new Set());
  assert.equal(verdict.kind, "NOT_IN_COLLECTION");
  if (verdict.kind === "NOT_IN_COLLECTION") {
    assert.equal(verdict.recognized?.variantPublicId, "Y06VKB564M");
  }
});

test("a variant carrying both spellings of one barcode is counted once, not twice", () => {
  // Otherwise the widened lookup would manufacture an UNCERTAIN out of a
  // single row and ask a collector to choose between a variant and itself.
  const bothForms = row({
    variantPublicId: "VARIANTBOTH",
    title: "Fixture Both Spellings",
    normalizedIdentifiers: ["743175952919", "0743175952919"],
  });
  const owned = new Set(["VARIANTBOTH"]);
  assert.equal(computeVerdict("743175952919", [bothForms], owned).kind, "OWNED");
  assert.equal(computeVerdict("0743175952919", [bothForms], owned).kind, "OWNED");
});

test("two DIFFERENT variants reached through the two spellings stay UNCERTAIN, never a silent pick", () => {
  // The catalogue really holds 848064011972 as a UPC-A on one variant and
  // 0848064011972 as an EAN-13 on another. Both spellings name the same
  // number, so both queries now find both variants. Two matches is two
  // matches: the collector chooses, the engine does not.
  const index = [rsdEan13, rsdUpcA];
  for (const query of ["848064011972", "0848064011972"]) {
    const verdict = computeVerdict(query, index, new Set());
    assert.equal(verdict.kind, "UNCERTAIN", query);
    if (verdict.kind !== "UNCERTAIN") continue;
    assert.equal(verdict.matchKind, "identifier");
    assert.equal(verdict.candidates.length, 2);
    assert.deepEqual(
      verdict.candidates.map((c) => c.variantPublicId).sort(),
      ["XHHA2C9ZS3", "Y06VKB564M"],
      query,
    );
    assert.equal(verdict.more.length, 0);
  }
});

test("a genuine EAN-13 does not reach a 12-digit row by dropping its first digit", () => {
  const trap = row({
    variantPublicId: "VARIANTTRAP",
    title: "Fixture Trap",
    normalizedIdentifiers: ["032921014762"],
  });
  const verdict = computeVerdict("5032921014762", [trap], new Set());
  assert.equal(verdict.kind, "NOT_IN_COLLECTION");
  if (verdict.kind === "NOT_IN_COLLECTION") assert.equal(verdict.recognized, null);
});

test("a catalogue number gains no alternate forms at lookup either", () => {
  // SLUS-00152 still resolves exactly as it did: two variants, UNCERTAIN,
  // matchKind identifier. Nothing about the widening touches it.
  const verdict = computeVerdict("SLUS-00152", INDEX, new Set());
  assert.equal(verdict.kind, "UNCERTAIN");
  if (verdict.kind !== "UNCERTAIN") return;
  assert.equal(verdict.matchKind, "identifier");
  assert.equal(verdict.candidates.length, 2);
});

test("an ISBN-13 is never widened into a GTIN form, so it cannot collide with a 12-digit barcode", () => {
  // The ISBN rule (src/lib/identifiers/isbn.ts) gives this query its
  // 10-digit counterpart and nothing else. The 12-digit decoy below is what
  // the GTIN rule would have produced by dropping the leading 9, and it
  // must stay unreachable: a 978 value is a book, never a UPC-A.
  const book = row({
    variantPublicId: "VARIANTBOOK",
    title: "Tomb Raider: The Official Strategy Guide",
    normalizedIdentifiers: ["9780345461711"],
  });
  const decoy = row({
    variantPublicId: "VARIANTDECOY",
    title: "Fixture Decoy",
    normalizedIdentifiers: ["780345461711"],
  });
  const verdict = computeVerdict("9780345461711", [book, decoy], new Set());
  assert.equal(verdict.kind, "NOT_IN_COLLECTION");
  if (verdict.kind === "NOT_IN_COLLECTION") {
    assert.equal(verdict.recognized?.variantPublicId, "VARIANTBOOK");
  }
});

// ---------------------------------------------------------------------
// ISBN equivalence through the engine (src/lib/identifiers/isbn.ts).
//
// The shipping defect: 23 catalogue variants carry an ISBN and 8 of them
// carry only one of the two forms. A scanned book barcode encodes the
// ISBN-13; a copyright page prints the ISBN-10. So a collector holding the
// book and reading the number off the page missed 4 variants, and a
// collector scanning the back cover missed 4 others. The catalogue is not
// repaired, because a computed ISBN appears in no cited source and R11
// re-opens sampled identifiers against theirs.
//
// Every row below is a real seeded row, named by its public_id.
// ---------------------------------------------------------------------

// Holds ONLY the ISBN-13. The collector typing the copyright page number
// 1-78565-991-X found nothing before this rule.
const shadowUkPaperback = row({
  variantPublicId: "NHZBWJ0ADR",
  itemPublicId: "ITEMSHADOW",
  title: "Shadow of the Tomb Raider",
  year: 2018,
  variantName: "UK paperback",
  normalizedIdentifiers: ["9781785659911"],
});

// Holds ONLY the ISBN-10. The collector scanning the back cover, which
// encodes 978-0-7615-1106-9, found nothing before this rule.
const tr2StrategyGuide = row({
  variantPublicId: "1CHW0AJ0J1",
  itemPublicId: "ITEMTR2GDE",
  title: "Tomb Raider II: The Official Strategy Guide",
  year: 1997,
  variantName: "Prima Publishing edition",
  normalizedIdentifiers: ["0761511067"],
});

// Holds both, as 15 of the 23 do.
const gameSecretsBothForms = row({
  variantPublicId: "RAF8T184BW",
  itemPublicId: "ITEMTRSECR",
  title: "Tomb Raider: Game Secrets",
  year: 1996,
  variantName: "Prima Games edition",
  normalizedIdentifiers: ["0761509313", "9780761509318"],
});

test("a book holding only its ISBN-13 resolves from the ISBN-10 printed on the copyright page", () => {
  const index = [shadowUkPaperback, ...INDEX];
  const owned = new Set(["NHZBWJ0ADR"]);
  // Typed as it is printed, hyphens and a capital X. Normalization handles
  // the punctuation and the case; the ISBN rule handles the encoding.
  const verdict = computeVerdict("1-78565-991-X", index, owned);
  assert.equal(verdict.kind, "OWNED");
  if (verdict.kind === "OWNED") assert.equal(verdict.candidate.variantPublicId, "NHZBWJ0ADR");
});

test("a book holding only its ISBN-10 resolves from the ISBN-13 its barcode encodes", () => {
  const index = [tr2StrategyGuide, ...INDEX];
  const verdict = computeVerdict("9780761511069", index, new Set());
  assert.equal(verdict.kind, "NOT_IN_COLLECTION");
  if (verdict.kind === "NOT_IN_COLLECTION") {
    assert.equal(verdict.recognized?.variantPublicId, "1CHW0AJ0J1");
  }
});

test("the scanned ISBN-13 and the printed ISBN-10 reach the same verdict", () => {
  const index = [shadowUkPaperback, tr2StrategyGuide, ...INDEX];
  const owned = new Set(["NHZBWJ0ADR"]);
  assert.deepEqual(
    computeVerdict("9781785659911", index, owned),
    computeVerdict("178565991X", index, owned),
  );
  assert.deepEqual(
    computeVerdict("0761511067", index, owned),
    computeVerdict("9780761511069", index, owned),
  );
});

test("a variant carrying both ISBN forms is counted once, not twice", () => {
  // Otherwise the widened lookup would manufacture an UNCERTAIN out of a
  // single row for 15 of the 23 books in the catalogue.
  const owned = new Set(["RAF8T184BW"]);
  const index = [gameSecretsBothForms, ...INDEX];
  assert.equal(computeVerdict("0761509313", index, owned).kind, "OWNED");
  assert.equal(computeVerdict("9780761509318", index, owned).kind, "OWNED");
});

test("two DIFFERENT variants holding the two ISBN forms stay UNCERTAIN, never a silent pick", () => {
  // SYNTHETIC, and deliberately so: measured against the seeded catalogue
  // the ISBN rule creates 0 cross-form collisions, so there is no real pair
  // to use. The behaviour still has to hold, because the catalogue grows
  // and the same book entered twice from two sources is exactly how the
  // Record Store Day duplicate happened on the barcode side.
  const printedSide = row({
    variantPublicId: "VARIANTBK10",
    itemPublicId: "ITEMBOOKA0",
    title: "Fixture Guide, First Print",
    variantName: "First print",
    normalizedIdentifiers: ["0761509313"],
  });
  const scannedSide = row({
    variantPublicId: "VARIANTBK13",
    itemPublicId: "ITEMBOOKB0",
    title: "Fixture Guide, Second Print",
    variantName: "Second print",
    normalizedIdentifiers: ["9780761509318"],
  });
  for (const query of ["0761509313", "9780761509318"]) {
    const verdict = computeVerdict(query, [printedSide, scannedSide], new Set());
    assert.equal(verdict.kind, "UNCERTAIN", query);
    if (verdict.kind !== "UNCERTAIN") continue;
    assert.equal(verdict.matchKind, "identifier");
    assert.equal(verdict.candidates.length, 2, query);
    assert.deepEqual(
      verdict.candidates.map((c) => c.variantPublicId).sort(),
      ["VARIANTBK10", "VARIANTBK13"],
      query,
    );
    assert.equal(verdict.more.length, 0, query);
  }
});

test("an ISBN with a wrong check digit reaches nothing, rather than a plausible neighbour", () => {
  // 9780761511069 is the real ISBN-13 of the guide. One digit off must not
  // widen into anything: a computed alternate from a bad number is a
  // well-formed identifier that quietly matches the wrong book.
  const index = [tr2StrategyGuide, ...INDEX];
  const verdict = computeVerdict("9780761511060", index, new Set());
  assert.equal(verdict.kind, "NOT_IN_COLLECTION");
  if (verdict.kind === "NOT_IN_COLLECTION") assert.equal(verdict.recognized, null);
});

test("a 979 ISBN-13 invents no ISBN-10 to match on", () => {
  // 979 books have no 10-digit form in existence. The decoy below is what
  // dropping the prefix and recomputing would produce.
  const decoy = row({
    variantPublicId: "VARIANT979D",
    title: "Fixture 979 Decoy",
    normalizedIdentifiers: ["1029509762"],
  });
  const verdict = computeVerdict("9791029509766", [decoy, ...INDEX], new Set());
  assert.equal(verdict.kind, "NOT_IN_COLLECTION");
  if (verdict.kind === "NOT_IN_COLLECTION") assert.equal(verdict.recognized, null);
});
