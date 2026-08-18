// ISBN cross-form lookup, proved end to end in a browser.
//
// Why a unit test was not enough. The GTIN half of this equivalence class
// passed its unit tests and still had to be proved through the running app,
// because the rule only helps if the value the collector actually presents
// reaches the engine unchanged: through normalization, through the sync
// route, into the on-device catalogue copy, out of IndexedDB and into
// computeVerdict. Every one of those is a place a form can be dropped. This
// file calls no function from src/lib/identifiers; it types numbers into
// the check screen and reads the verdict.
//
// The two real one-sided rows it uses, both seeded and both cited. Each is
// named by what the object itself carries, never by a variant public id:
//
//   Shadow of the Tomb Raider, UK paperback
//     catalogue holds ISBN-13 9781785659911 and NOTHING ELSE.
//     The copyright page prints 1-78565-991-X. The X is not decoration: it
//     is the mod 11 check character, and a rule that emitted an uppercase X
//     would match nothing, because the catalogue stores normalized values in
//     lower case.
//
//   Tomb Raider II: The Official Strategy Guide, Prima Publishing edition
//     catalogue holds ISBN-10 0761511067 and NOTHING ELSE.
//     The back-cover barcode encodes 978-0-7615-1106-9, which is what a
//     scanner hands over.
//
// Variant public ids are MINTED ON INSERT. An earlier version of this file
// pinned two of them and went red the first time the catalogue was rebuilt
// from empty: the rows were all still there, under new ids. Nothing here
// pins a minted id. The rows are resolved from the served catalogue by
// identifier value, cross-checked against title, and the resolved ids are
// recorded as an observation.
//
// The control that makes the result mean something: before each check, the
// catalogue the server is serving is read and asserted NOT to contain the
// queried form anywhere, on any row. So a match cannot have come from the
// data, and the only thing that can have produced it is the rule.
//
// The base URL is a parameter (playwright.config.ts). Nothing here knows
// the word localhost.

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SEL = {
  input: "#check-identifier",
  submit: 'form button[type="submit"]',
  slab: "section.vslab",
  word: "section.vslab .vword",
  recognizedLabel: "section.vslab .vlead.mono",
  addToCollection: 'section.vslab button:has-text("Add to collection")',
};

// What a collector presents, spelled the way the object spells it.
const PRINTED_ISBN10 = "1-78565-991-X"; // Shadow of the Tomb Raider copyright page
const SCANNED_ISBN13 = "9780761511069"; // TR II strategy guide back cover

// What the catalogue holds for those two variants, and only that.
const HELD_BY_SHADOW = "9781785659911";
const HELD_BY_TR2_GUIDE = "0761511067";

// Titles, the other half of the pin. An identifier value alone would still
// pass if it drifted onto a different object; the pair cannot.
const SHADOW_TITLE = "Shadow of the Tomb Raider";
const TR2_GUIDE_TITLE = "Tomb Raider II: The Official Strategy Guide";

type IndexRow = {
  variantPublicId: string;
  title: string;
  variantName: string;
  normalizedIdentifiers: string[];
  identifiers: { kind: string; normalized: string }[];
};

function projectRoot(): string {
  let dir = test.info().config.rootDir;
  while (!existsSync(path.join(dir, "package.json")) && path.dirname(dir) !== dir) {
    dir = path.dirname(dir);
  }
  return dir;
}

function writeEvidence(name: string, body: unknown): string {
  const out = path.join(projectRoot(), ".forge", "evidence");
  mkdirSync(out, { recursive: true });
  const file = path.join(out, name);
  writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
  // Relative, never absolute: an absolute path names this machine's home
  // directory, and that has already leaked into tracked files once.
  return path.relative(projectRoot(), file);
}

async function catalogueRows(baseURL: string, request: APIRequestContext): Promise<IndexRow[]> {
  const res = await request.get(new URL("/api/sync/index", baseURL).toString());
  expect(res.ok(), `catalogue index unavailable at ${baseURL}`).toBeTruthy();
  const body = (await res.json()) as { rows: IndexRow[] };
  expect(body.rows.length, "empty catalogue").toBeGreaterThan(0);
  return body.rows;
}

/** The one row carrying `held`, found by identifier value and cross-checked
 * against the title printed on the object. Both halves survive a re-seed;
 * the variant public id it returns is an output, never an input.
 *
 * Asserting exactly one match is itself a control: two rows carrying the same
 * ISBN would make every verdict below ambiguous, and the failure would read
 * as an application defect rather than as the data problem it is. */
function rowHolding(rows: IndexRow[], held: string, title: string): IndexRow {
  const matches = rows.filter((r) => r.normalizedIdentifiers.includes(held));
  expect(
    matches.map((r) => `${r.variantPublicId} ${r.title}`),
    `exactly one catalogue row must hold ${held}`,
  ).toHaveLength(1);
  const row = matches[0]!;
  expect(row.title, `the row holding ${held}`).toBe(title);
  return row;
}

/** Loads the app and waits for the background sync, behaviourally: a value
 * the catalogue really holds has to resolve to a recognised variant. */
async function loadAndSync(page: Page, probe: string) {
  await page.goto("/");
  await expect(page.locator(SEL.input)).toBeVisible();
  await expect(async () => {
    await page.fill(SEL.input, probe);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.recognizedLabel)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 500, 1000] });
}

async function check(page: Page, identifier: string) {
  await page.fill(SEL.input, identifier);
  await page.click(SEL.submit);
  await expect(page.locator(SEL.word)).toBeVisible();
  const kind = await page.evaluate((sel) => {
    const slab = document.querySelector(sel);
    if (!slab) return "NONE";
    const attr = slab.getAttribute("data-verdict");
    if (attr) return attr;
    const cls = slab.getAttribute("class") ?? "";
    if (cls.includes("v-own")) return "OWNED";
    if (cls.includes("v-unc")) return "UNCERTAIN";
    if (cls.includes("v-not")) return "NOT_IN_COLLECTION";
    return "UNKNOWN";
  }, SEL.slab);
  const slabText = (await page.locator(SEL.slab).innerText()).replace(/\s+/g, " ").trim();
  return { kind, slabText };
}

const evidence: Record<string, unknown> = {};

test("the target is a production build, not next dev", async ({ request, baseURL }) => {
  const res = await request.get(baseURL!);
  expect(res.status()).toBe(200);
  const html = await res.text();
  const devMarkers = ["hmr-client", "next-devtools", "__nextjs_original-stack-frame", "react-refresh"];
  const found = devMarkers.filter((m) => html.includes(m));

  // Absence of dev markers is not enough. A `next start` whose .next was
  // rebuilt underneath it answers 200 with production headers and serves
  // chunk URLs that 404, so the app never hydrates and the run reads as an
  // application defect. The BUILD_ID on disk appearing in the served HTML is
  // what tells a live server apart from that corpse.
  const buildIdFile = path.join(projectRoot(), ".next", "BUILD_ID");
  const buildIdOnDisk = existsSync(buildIdFile) ? readFileSync(buildIdFile, "utf8").trim() : null;
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(baseURL ?? "");

  evidence.target = {
    baseUrl: baseURL,
    port: baseURL ? new URL(baseURL).port : null,
    status: res.status(),
    devMarkersFound: found,
    buildIdOnDisk,
    buildIdFoundInServedHtml: buildIdOnDisk ? html.includes(buildIdOnDisk) : null,
  };
  expect(found, "dev-server markers in the served HTML").toEqual([]);
  if (isLocal && buildIdOnDisk) {
    expect(
      html.includes(buildIdOnDisk),
      "the served HTML does not reference the BUILD_ID on disk: the server is running a build that no longer exists",
    ).toBe(true);
  }
});

test("the two rows really are one-sided in the catalogue being served", async ({ request, baseURL }) => {
  // This is the premise of the whole file. If a later seed adds the missing
  // form to either row, the tests below would still pass and would prove
  // nothing at all, so the premise is asserted rather than assumed.
  const rows = await catalogueRows(baseURL!, request);
  const shadow = rowHolding(rows, HELD_BY_SHADOW, SHADOW_TITLE);
  const guide = rowHolding(rows, HELD_BY_TR2_GUIDE, TR2_GUIDE_TITLE);

  // One-sided means one-sided: the other form is absent from the row itself,
  // not merely absent from the rest of the catalogue.
  expect(shadow.normalizedIdentifiers, `${SHADOW_TITLE} must not already hold the ISBN-10`).not.toContain(
    "178565991x",
  );
  expect(guide.normalizedIdentifiers, `${TR2_GUIDE_TITLE} must not already hold the ISBN-13`).not.toContain(
    "9780761511069",
  );

  // The queried forms, normalized, are on NO row anywhere. Not on the
  // target row, not on any other. This is the control.
  const everyIdentifier = new Set(rows.flatMap((r) => r.normalizedIdentifiers));
  expect([...everyIdentifier], "178565991x must not be in the catalogue").not.toContain("178565991x");
  expect([...everyIdentifier], "9780761511069 must not be in the catalogue").not.toContain(
    "9780761511069",
  );

  // How many ISBN-carrying variants are one-sided, counted from the served
  // catalogue rather than quoted from a report. Counted by identifier KIND,
  // which the sync route ships alongside each value, not by shape: three
  // record-label catalogue numbers in this catalogue (2061624172,
  // 3020665022, 7559626692) are 10 all-numeric digits and look exactly like
  // an ISBN-10 until their check digit is computed.
  const isbnValues = (r: IndexRow) =>
    r.identifiers.filter((i) => i.kind === "isbn").map((i) => i.normalized);
  const withIsbn = rows.filter((r) => isbnValues(r).length > 0);
  const only10 = withIsbn.filter(
    (r) => isbnValues(r).some((v) => v.length === 10) && !isbnValues(r).some((v) => v.length === 13),
  );
  const only13 = withIsbn.filter(
    (r) => !isbnValues(r).some((v) => v.length === 10) && isbnValues(r).some((v) => v.length === 13),
  );
  evidence.catalogue = {
    resolvedAtRunTime: {
      note: "public ids are minted on insert; recorded as an observation, never pinned",
      [SHADOW_TITLE]: { heldIdentifier: HELD_BY_SHADOW, variantPublicId: shadow.variantPublicId },
      [TR2_GUIDE_TITLE]: {
        heldIdentifier: HELD_BY_TR2_GUIDE,
        variantPublicId: guide.variantPublicId,
      },
    },
    countedBy: "identifier kind, from /api/sync/index",
    variantsCarryingAnIsbn: withIsbn.length,
    holdingOnlyIsbn10: only10.length,
    holdingOnlyIsbn13: only13.length,
    holdingBoth: withIsbn.length - only10.length - only13.length,
    oneSidedVariants: [...only10, ...only13].map((r) => r.variantPublicId).sort(),
    tenDigitNonIsbnValues: [
      ...new Set(
        rows.flatMap((r) =>
          r.identifiers
            .filter((i) => i.kind !== "isbn" && /^[0-9]{10}$/.test(i.normalized))
            .map((i) => `${i.kind}:${i.normalized}`),
        ),
      ),
    ].sort(),
  };
  expect(withIsbn.length).toBe(23);
  expect(only10.length).toBe(4);
  expect(only13.length).toBe(4);
});

test("a book holding only its ISBN-13 answers to the ISBN-10 on its copyright page", async ({
  page,
  request,
  baseURL,
}) => {
  const rows = await catalogueRows(baseURL!, request);
  const shadow = rowHolding(rows, HELD_BY_SHADOW, SHADOW_TITLE);
  await loadAndSync(page, HELD_BY_SHADOW);

  const printed = await check(page, PRINTED_ISBN10);
  expect(printed.kind, `typed ${PRINTED_ISBN10}`).toBe("NOT_IN_COLLECTION");
  expect(printed.slabText).toContain(shadow.title);

  // The number the catalogue actually holds reaches the same answer, so the
  // two presentations of one book have converged.
  const scanned = await check(page, HELD_BY_SHADOW);
  expect(scanned.kind).toBe("NOT_IN_COLLECTION");
  expect(scanned.slabText).toBe(printed.slabText);

  // And through the whole loop: add it, then present the printed number
  // again and be told OWNED.
  await check(page, PRINTED_ISBN10);
  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.slab)).toContainText("Saved to your collection.");
  const owned = await check(page, PRINTED_ISBN10);
  expect(owned.kind, "after adding, the printed ISBN-10 must answer OWNED").toBe("OWNED");

  evidence.isbn10ToIsbn13 = {
    variant: shadow.variantPublicId,
    title: shadow.title,
    variantName: shadow.variantName,
    catalogueHolds: shadow.normalizedIdentifiers,
    queried: PRINTED_ISBN10,
    verdictBeforeAdding: printed.kind,
    verdictAfterAdding: owned.kind,
    identicalToHeldFormVerdict: scanned.slabText === printed.slabText,
  };
});

test("a book holding only its ISBN-10 answers to the ISBN-13 its barcode encodes", async ({
  page,
  request,
  baseURL,
}) => {
  const rows = await catalogueRows(baseURL!, request);
  const guide = rowHolding(rows, HELD_BY_TR2_GUIDE, TR2_GUIDE_TITLE);
  await loadAndSync(page, HELD_BY_TR2_GUIDE);

  const scanned = await check(page, SCANNED_ISBN13);
  expect(scanned.kind, `scanned ${SCANNED_ISBN13}`).toBe("NOT_IN_COLLECTION");
  expect(scanned.slabText).toContain(guide.title);

  const printed = await check(page, HELD_BY_TR2_GUIDE);
  expect(printed.slabText).toBe(scanned.slabText);

  evidence.isbn13ToIsbn10 = {
    variant: guide.variantPublicId,
    title: guide.title,
    variantName: guide.variantName,
    catalogueHolds: guide.normalizedIdentifiers,
    queried: SCANNED_ISBN13,
    verdict: scanned.kind,
    identicalToHeldFormVerdict: printed.slabText === scanned.slabText,
  };
});

test("a wrong check digit and a 979 prefix still find nothing", async ({ page }) => {
  // The negative half. A rule that widened everything would answer these
  // too, and an alternate form computed off a bad number is a well-formed
  // identifier pointing at the wrong book.
  await loadAndSync(page, HELD_BY_SHADOW);
  const wrongCheck = await check(page, "9781785659912");
  const nine79 = await check(page, "9791029509766");
  const notABook = await check(page, "SLUS-99999");
  expect(wrongCheck.kind).toBe("NOT_IN_COLLECTION");
  expect(wrongCheck.slabText).not.toContain("Shadow of the Tomb Raider");
  expect(nine79.kind).toBe("NOT_IN_COLLECTION");
  expect(notABook.kind).toBe("NOT_IN_COLLECTION");
  evidence.negatives = {
    wrongCheckDigit: { queried: "9781785659912", verdict: wrongCheck.kind },
    prefix979: { queried: "9791029509766", verdict: nine79.kind },
    unknownCatalogueNumber: { queried: "SLUS-99999", verdict: notABook.kind },
  };
});

test.afterAll(() => {
  evidence.recordedAt = new Date().toISOString();
  writeEvidence("isbn-cross-form-lookup.json", evidence);
});
