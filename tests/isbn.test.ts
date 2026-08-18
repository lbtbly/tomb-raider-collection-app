// The ISBN equivalence used at lookup time. Every value here is a real
// catalogue value, taken from the 38 seeded isbn rows across 23 variants,
// except where a case is marked synthetic and says why.
//
// What these tests are actually defending. The GTIN rule is a prefix trick
// and a wrong answer from it looks wrong. This rule is arithmetic: a
// mistaken check digit produces a well-formed identifier that matches
// nothing, which reads as "the rule ran and the book is not in the
// catalogue". So the arithmetic is proved twice over. Once directly, and
// once against the 15 catalogue variants that hold BOTH forms from a cited
// source, where the computed counterpart has to come out equal to the
// number a researcher recorded off Open Library. Those 15 are 15
// independent confirmations that no test author invented.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alternateIsbnForms,
  ean13CheckDigit,
  isbn10CheckChar,
  isbn10ToIsbn13,
  isbn13ToIsbn10,
  isValidIsbn10,
  isValidIsbn13,
} from "../src/lib/identifiers/isbn";
import { identifierLookupForms } from "../src/lib/identifiers/lookup";
import { isValidEan13 } from "../src/lib/identifiers/barcode";
import { normalizeIdentifier } from "../src/lib/identifiers/normalize";

// The 15 catalogue variants holding both forms, each pair exactly as the
// seed files record it. Left is the ISBN-10 as normalized (lowercase x),
// right is the ISBN-13.
const CATALOGUE_PAIRS: [string, string][] = [
  ["0744016908", "9780744016901"], // 20 Years of Tomb Raider
  ["0761556168", "9780761556169"], // Anniversary, Prima
  ["1783299967", "9781783299966"], // Rise of the Tomb Raider
  ["1785659499", "9781785659492"], // Shadow, Official Art Book
  ["184222378x", "9781842223789"], // The Official Tomb Raider Files, X check digit
  ["0761560777", "9780761560777"], // Tomb Raider, Piggyback
  ["0761532358", "9780761532354"], // Chronicles, Prima
  ["0761522719", "9780761522713"], // Tomb Raider II Gold, Prima
  ["0761515194", "9780761515197"], // Tomb Raider III, Prima
  ["1566868483", "9781566868488"], // Tomb Raider III Pocket Guide
  ["190351181x", "9781903511817"], // Legend, Piggyback, X check digit
  ["0744014611", "9780744014617"], // Limited Edition Strategy Guide
  ["0761509313", "9780761509318"], // Game Secrets, Prima
  ["0744014530", "9780744014532"], // Tomb Raider, BradyGames
  ["1566867347", "9781566867344"], // Totally Unauthorized TR II Pocket Guide
];

// The 8 one-sided variants, the reason this rule exists. 4 hold only the
// ISBN-10 (a copyright page number), 4 only the ISBN-13 (a barcode).
const ONLY_ISBN10: [string, string][] = [
  ["0761540393", "9780761540397"], // Lara Croft tomb raider, BW490DS8JX
  ["0761515801", "9780761515807"], // Lara's Book, 0ZFAASNZ74
  ["8882901149", "9788882901141"], // Comix 2000 Supplement, 22BE9SHP3E
  ["0761511067", "9780761511069"], // Tomb Raider II Official Strategy Guide, 1CHW0AJ0J1
];

const ONLY_ISBN13: [string, string][] = [
  ["9780345461711", "0345461711"], // The Amulet of Power, ENXREDVVZQ
  ["9781399002059", "1399002058"], // Making of Tomb Raider, 89688PJDDT
  ["9781785659911", "178565991x"], // Shadow of the Tomb Raider, NHZBWJ0ADR, X check digit
  ["9781506703329", "1506703321"], // Tomb Raider Archives Volume 1, P84WD366EZ
];

test("ISBN-10 gains its ISBN-13: prefix 978, drop the check digit, recompute", () => {
  for (const [ten, thirteen] of [...CATALOGUE_PAIRS, ...ONLY_ISBN10]) {
    assert.equal(isbn10ToIsbn13(ten), thirteen, ten);
    assert.deepEqual(alternateIsbnForms(ten), [thirteen], ten);
  }
});

test("a 978 ISBN-13 gains its ISBN-10: drop prefix and check digit, recompute mod 11", () => {
  for (const [ten, thirteen] of CATALOGUE_PAIRS) {
    assert.equal(isbn13ToIsbn10(thirteen), ten, thirteen);
    assert.deepEqual(alternateIsbnForms(thirteen), [ten], thirteen);
  }
  for (const [thirteen, ten] of ONLY_ISBN13) {
    assert.equal(isbn13ToIsbn10(thirteen), ten, thirteen);
    assert.deepEqual(alternateIsbnForms(thirteen), [ten], thirteen);
  }
});

test("the 15 both-form catalogue variants prove the arithmetic against cited data", () => {
  // Neither side of these pairs was computed. A researcher recorded both
  // numbers from the same source record. If either check digit routine were
  // wrong, 15 pairs would not agree.
  for (const [ten, thirteen] of CATALOGUE_PAIRS) {
    assert.equal(isbn10ToIsbn13(ten), thirteen, `${ten} -> ${thirteen}`);
    assert.equal(isbn13ToIsbn10(thirteen), ten, `${thirteen} -> ${ten}`);
  }
});

test("the two directions are inverses for every ISBN in the catalogue", () => {
  const all = [
    ...CATALOGUE_PAIRS.flat(),
    ...ONLY_ISBN10.flat(),
    ...ONLY_ISBN13.flat(),
  ];
  for (const value of all) {
    const alt = alternateIsbnForms(value)[0];
    assert.ok(alt, value);
    assert.deepEqual(alternateIsbnForms(alt), [value], `${value} -> ${alt} -> back`);
  }
});

test("an X check digit survives in both directions, and is emitted lowercase", () => {
  // Normalization lowercases, so the catalogue stores 184222378X as
  // 184222378x. An alternate form spelled with a capital X would match
  // nothing at all, which is the quiet way this rule could fail.
  assert.equal(isbn10CheckChar("184222378"), "x");
  assert.equal(isbn10CheckChar("178565991"), "x");
  assert.equal(isbn13ToIsbn10("9781842223789"), "184222378x");
  assert.equal(isbn13ToIsbn10("9781785659911"), "178565991x");
  assert.equal(isbn10ToIsbn13("184222378x"), "9781842223789");
  // Uppercase on the way in gives the same answer, since a caller may hold
  // a raw value rather than a normalized one.
  assert.equal(isbn10ToIsbn13("184222378X"), "9781842223789");
  assert.deepEqual(alternateIsbnForms("184222378X"), ["9781842223789"]);
  assert.equal(normalizeIdentifier("1-84222-378-X"), "184222378x");
  assert.deepEqual(alternateIsbnForms(normalizeIdentifier("1-84222-378-X")), ["9781842223789"]);
});

test("a 979 ISBN-13 gains NOTHING, even with a correct check digit", () => {
  // 979 exists because the 10-digit space ran out, so these books have no
  // ISBN-10 anywhere. Dropping the prefix and recomputing would produce a
  // number belonging to a different book or to none. The check digits below
  // are correct, so the refusal is the prefix and not arithmetic.
  const nine79 = ["9791029509766", "9798888888889"];
  for (const value of nine79) {
    assert.ok(isValidEan13(value), `${value} should be a valid EAN-13`);
    assert.equal(isbn13ToIsbn10(value), null, value);
    assert.deepEqual(alternateIsbnForms(value), [], value);
    assert.deepEqual(identifierLookupForms(value), [value], value);
  }
});

test("a wrong check digit gains nothing, in either form", () => {
  // The dangerous failure is not a miss, it is a plausible-looking
  // alternate form computed from a number that was never an ISBN.
  assert.deepEqual(alternateIsbnForms("9780345461712"), []); // last digit off by one
  assert.deepEqual(alternateIsbnForms("9780345461701"), []); // digit transposed inside
  assert.deepEqual(alternateIsbnForms("0761515802"), []); // ISBN-10 check off by one
  assert.deepEqual(alternateIsbnForms("076151580x"), []); // wrong X
  assert.equal(isValidIsbn13("9780345461712"), false);
  assert.equal(isValidIsbn10("0761515802"), false);
  assert.deepEqual(identifierLookupForms("9780345461712"), ["9780345461712"]);
});

test("a catalogue number gains no ISBN form", () => {
  assert.deepEqual(alternateIsbnForms("SLUS-00152"), []);
  assert.deepEqual(alternateIsbnForms(normalizeIdentifier("SLUS-00152")), []);
  assert.deepEqual(identifierLookupForms(normalizeIdentifier("SLUS-00152")), ["slus00152"]);
  assert.deepEqual(alternateIsbnForms(normalizeIdentifier("SLES-00024")), []);
  assert.deepEqual(alternateIsbnForms(normalizeIdentifier("SLUS-01311")), []);
  assert.deepEqual(alternateIsbnForms(normalizeIdentifier("MOVATM205")), []);
});

test("a 10-digit record-label catalogue number gains nothing, and this is the narrowest case", () => {
  // The one place this rule could plausibly misfire. These three are real
  // catalogue values on real variants: Elektra and Warner CD catalogue
  // numbers, 10 characters, all digits, structurally indistinguishable from
  // an ISBN-10 until the mod 11 sum is computed. All three fail it, so all
  // three gain nothing. Roughly 1 in 11 arbitrary 10-digit numbers would
  // pass by chance, so this is checked against the catalogue rather than
  // reasoned about, and re-checked whenever the catalogue grows.
  const labelCatalogueNumbers = [
    "2061624172", // Lara Croft Tomb Raider: The Cradle Of Life, CD (US), 6AA34511B0
    "3020665022", // Cradle Of Life Original Motion Picture Score, CD (US), 80XRZ7EWWR
    "7559626692", // Lara Croft: Tomb Raider (Music From The Motion Picture), CD (Europe), AT3SQC79JQ
  ];
  for (const value of labelCatalogueNumbers) {
    assert.equal(isValidIsbn10(value), false, value);
    assert.deepEqual(alternateIsbnForms(value), [], value);
    assert.deepEqual(identifierLookupForms(value), [value], value);
  }
});

test("a plain GTIN gains no ISBN form, at either length", () => {
  // Real catalogue barcodes. None is Bookland, so none is a book number.
  for (const value of ["743175952919", "788687301237", "848064011972"]) {
    assert.deepEqual(alternateIsbnForms(value), [], value); // 12 digits, wrong length
  }
  for (const value of ["5032921014762", "0743175952919", "0848064011972", "5024545871111"]) {
    assert.deepEqual(alternateIsbnForms(value), [], value); // 13 digits, not 978
  }
});

test("lengths and shapes outside the two ISBN forms gain nothing", () => {
  for (const value of [
    "",
    "9",
    "978034546171", // 12 digits, one short
    "97803454617110", // 14 digits, one long
    "076151580", // 9 characters
    "07615158011", // 11 characters
    "x345461711", // x anywhere but last
    "978034546171x", // x in a 13-digit position
  ]) {
    assert.deepEqual(alternateIsbnForms(value), [], JSON.stringify(value));
  }
});

test("the check-digit generator agrees with the independent EAN-13 validator", () => {
  // ean13CheckDigit computes, isValidEan13 (src/lib/identifiers/barcode.ts,
  // written for the R9 machine check) verifies. Two routines, one rule: if
  // they ever disagree this rule is manufacturing bad identifiers.
  const thirteens = [
    ...CATALOGUE_PAIRS.map(([, t]) => t),
    ...ONLY_ISBN10.map(([, t]) => t),
    ...ONLY_ISBN13.map(([t]) => t),
  ];
  for (const value of thirteens) {
    assert.equal(ean13CheckDigit(value.slice(0, 12)), value[12], value);
    assert.ok(isValidEan13(value), value);
    assert.ok(isValidIsbn13(value), value);
  }
  // And on every ISBN-13 this rule constructs from an ISBN-10.
  for (const [ten] of [...CATALOGUE_PAIRS, ...ONLY_ISBN10]) {
    const built = isbn10ToIsbn13(ten);
    assert.ok(built && isValidEan13(built), ten);
  }
});

test("the ISBN-10 check character closes the mod 11 sum, including the X case", () => {
  for (const [ten] of [...CATALOGUE_PAIRS, ...ONLY_ISBN10]) {
    assert.ok(isValidIsbn10(ten), ten);
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const char = ten[i]!;
      sum += (char === "x" ? 10 : Number(char)) * (10 - i);
    }
    assert.equal(sum % 11, 0, ten);
  }
});

// ---------------------------------------------------------------------
// The overlap with the GTIN rule. Both rules look at 13-digit values, and
// this is where a careless combination would produce nonsense: an ISBN-13
// stripped of a leading digit, or a UPC-A widened into a book number.
// ---------------------------------------------------------------------

test("a 978 value gains its ISBN-10 and no 12-digit GTIN form", () => {
  for (const [, thirteen] of CATALOGUE_PAIRS) {
    const forms = identifierLookupForms(thirteen);
    assert.equal(forms.length, 2, thirteen);
    assert.equal(forms[0], thirteen, thirteen);
    assert.equal(forms[1]?.length, 10, thirteen);
    assert.ok(
      !forms.some((f) => f.length === 12),
      thirteen,
    );
  }
});

test("a leading-zero 13-digit value gains its GTIN form and no ISBN form", () => {
  assert.deepEqual(identifierLookupForms("0848064011972"), [
    "0848064011972",
    "848064011972",
  ]);
  assert.deepEqual(identifierLookupForms("0743175952919"), [
    "0743175952919",
    "743175952919",
  ]);
});

test("a 12-digit UPC-A gains its EAN-13 form and no ISBN form", () => {
  assert.deepEqual(identifierLookupForms("743175952919"), [
    "743175952919",
    "0743175952919",
  ]);
  assert.deepEqual(identifierLookupForms("848064011972"), [
    "848064011972",
    "0848064011972",
  ]);
});

test("a 13-digit EAN that is neither Bookland nor zero-prefixed gains nothing at all", () => {
  assert.deepEqual(identifierLookupForms("5032921014762"), ["5032921014762"]);
  assert.deepEqual(identifierLookupForms("5024545871111"), ["5024545871111"]);
});

test("no value ever gains two alternates, and no form is ever repeated", () => {
  const everything = [
    ...CATALOGUE_PAIRS.flat(),
    ...ONLY_ISBN10.flat(),
    ...ONLY_ISBN13.flat(),
    "743175952919",
    "0743175952919",
    "5032921014762",
    "9791029509766",
    "slus00152",
    "",
  ];
  for (const value of everything) {
    const forms = identifierLookupForms(value);
    assert.ok(forms.length <= 2, `${value} produced ${forms.length} forms`);
    assert.equal(new Set(forms).size, forms.length, value);
    if (value.length > 0) assert.equal(forms[0], value, value);
  }
});

test("an ISBN-10 widened to a 978 value is not widened again into a GTIN", () => {
  // Alternates are computed from the given value only. The 13-digit form of
  // an ISBN-10 has no leading zero, so nothing further would fire anyway,
  // and this asserts the set stays at two rather than growing.
  const forms = identifierLookupForms("0761509313");
  assert.deepEqual(forms, ["0761509313", "9780761509318"]);
});
