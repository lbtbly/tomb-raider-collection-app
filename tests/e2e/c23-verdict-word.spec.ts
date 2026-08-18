// C23: "The verdict word is live text and never an image, fitted to width
// between 26 px and 46 px; the rendered font size at 390 px and at 1440 px are
// both recorded and both fall in that range."
//
// Three clauses, and only one of them had ever been measured.
//
//  - 390 px was measured on the build and is re-measured here.
//  - 1440 px had a number on record, 46 px, taken from a 1470 px viewport in
//    the design comps. Wrong viewport, wrong artefact. It is measured here on
//    the built product at exactly 1440.
//  - "live text and never an image" was implied by the fact that somebody had
//    computed a font size, and asserted nowhere. An image-replaced heading
//    also has a computed font size. It is asserted here, with three negative
//    controls that each defeat one way of faking text.
//
// Every verdict kind is measured, because the three slabs carry three
// different clamp() rules (.v-own and .v-unc 6vw + 12px, .v-not 4vw + 12px)
// and a range check that only ever saw one of them proves one third of a line.

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  assertProductionTarget,
  assertScaleOne,
  capture,
  settle,
  writeEvidence,
} from "./harness";

const SEL = {
  input: "#check-identifier",
  submit: 'form button[type="submit"]',
  slab: '[data-testid="verdict"]',
  word: '[data-testid="verdict-word"]',
  recognizedLabel: "section.vslab .vlead.mono",
  addToCollection: 'section.vslab button:has-text("Add to collection")',
};

const MIN_PX = 26;
const MAX_PX = 46;

type IndexRow = {
  variantPublicId: string;
  title: string;
  variantName: string;
  normalizedIdentifiers: string[];
};

const evidence: Record<string, unknown> = {};

/** Identifiers chosen from the catalogue the server is actually serving, never
 * pinned as literals: public ids are minted on insert and this catalogue is
 * rebuilt from empty as it grows. A value carried by exactly one row reaches
 * NOT IN COLLECTION; a value carried by two or more reaches UNCERTAIN. */
async function pickIdentifiers(
  baseURL: string,
  request: APIRequestContext,
): Promise<{ unique: string; colliding: string; rows: number }> {
  const res = await request.get(new URL("/api/sync/index", baseURL).toString());
  expect(res.ok(), `catalogue index unavailable at ${baseURL}`).toBeTruthy();
  const { rows } = (await res.json()) as { rows: IndexRow[] };
  expect(rows.length, "empty catalogue").toBeGreaterThan(0);

  const holders = new Map<string, string[]>();
  for (const row of rows) {
    for (const value of row.normalizedIdentifiers) {
      holders.set(value, [...(holders.get(value) ?? []), row.variantPublicId]);
    }
  }
  const sorted = [...holders.entries()].sort(([a], [b]) => a.localeCompare(b));
  const unique = sorted.find(([, ids]) => new Set(ids).size === 1)?.[0];
  const colliding = sorted.find(([, ids]) => new Set(ids).size > 1)?.[0];
  expect(unique, "no identifier is carried by exactly one variant").toBeTruthy();
  expect(colliding, "no identifier collides, so UNCERTAIN is unreachable").toBeTruthy();
  return { unique: unique!, colliding: colliding!, rows: rows.length };
}

async function loadAndSync(page: Page, probe: string) {
  await page.goto("/");
  await expect(page.locator(SEL.input)).toBeVisible();
  await expect(async () => {
    await page.fill(SEL.input, probe);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.recognizedLabel)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 500, 1000] });
}

async function check(page: Page, identifier: string): Promise<string> {
  await page.fill(SEL.input, identifier);
  await page.click(SEL.submit);
  await expect(page.locator(SEL.slab)).toBeVisible();
  await settle(page);
  return (await page.locator(SEL.slab).getAttribute("data-verdict")) ?? "UNKNOWN";
}

// ---------------------------------------------------------------------------
// The live-text instrument, and the three fakes it has to reject.
//
// It runs inside the page against any node, so the same code that judges the
// real verdict word judges the controls. A checker that only ever sees the
// thing it is supposed to approve cannot fail, and a check that cannot fail is
// not evidence.

type LiveTextReport = {
  ok: boolean;
  failures: string[];
  tagName: string;
  text: string;
  directTextNodeCount: number;
  replacedDescendants: string[];
  textNodeRects: { widthPx: number; heightPx: number }[];
  fontSizePx: number;
  fontFamily: string;
  color: string;
  backgroundImage: string;
  textIndentPx: string;
  pseudoContent: { before: string; after: string };
  boxWidthPx: number;
  boxHeightPx: number;
};

/** Runs inside the page, against any node. Written once and used twice: on
 * the real verdict word, and on the three fakes in the negative-control test
 * below. */
function liveTextProbe(node: Element): LiveTextReport {
  const failures: string[] = [];
  const replacedTags = ["IMG", "SVG", "CANVAS", "VIDEO", "PICTURE", "OBJECT", "EMBED", "IFRAME"];
  if (replacedTags.includes(node.tagName.toUpperCase())) {
    failures.push(`the node itself is a replaced element: ${node.tagName}`);
  }

  const replacedDescendants = [...node.querySelectorAll("*")]
    .map((el) => el.tagName.toUpperCase())
    .filter((tag) => replacedTags.includes(tag));
  if (replacedDescendants.length > 0) {
    failures.push(`replaced descendants: ${replacedDescendants.join(",")}`);
  }

  const directTextNodes = [...node.childNodes].filter(
    (n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 0,
  );
  if (directTextNodes.length === 0) failures.push("no direct text node with content");

  // Laid-out text has client rects. Text hidden behind an image replacement
  // has been pushed out of its box or collapsed to nothing.
  const rects: { widthPx: number; heightPx: number }[] = [];
  for (const textNode of directTextNodes) {
    const range = document.createRange();
    range.selectNodeContents(textNode);
    for (const r of range.getClientRects()) {
      rects.push({
        widthPx: Math.round(r.width * 100) / 100,
        heightPx: Math.round(r.height * 100) / 100,
      });
    }
  }
  if (rects.length === 0) failures.push("the text node lays out no client rects");
  if (rects.some((r) => r.widthPx <= 0 || r.heightPx <= 0)) failures.push("a text rect has no area");

  const box = node.getBoundingClientRect();
  const cs = getComputedStyle(node);
  const before = getComputedStyle(node, "::before").content;
  const after = getComputedStyle(node, "::after").content;
  if (cs.backgroundImage !== "none") failures.push(`background-image on the word: ${cs.backgroundImage}`);
  if (parseFloat(cs.fontSize) <= 0) failures.push("font-size is zero");
  if (/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(cs.color)) {
    failures.push("the text colour is fully transparent");
  }
  if (parseFloat(cs.textIndent) !== 0) {
    failures.push(`text-indent moves the text out of the box: ${cs.textIndent}`);
  }
  for (const [name, content] of [
    ["::before", before],
    ["::after", after],
  ]) {
    if (content && content !== "none" && content !== "normal" && content.includes("url(")) {
      failures.push(`${name} injects an image: ${content}`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    tagName: node.tagName,
    text: (node.textContent ?? "").trim(),
    directTextNodeCount: directTextNodes.length,
    replacedDescendants,
    textNodeRects: rects,
    fontSizePx: Math.round(parseFloat(cs.fontSize) * 100) / 100,
    fontFamily: cs.fontFamily,
    color: cs.color,
    backgroundImage: cs.backgroundImage,
    textIndentPx: cs.textIndent,
    pseudoContent: { before, after },
    boxWidthPx: Math.round(box.width * 100) / 100,
    boxHeightPx: Math.round(box.height * 100) / 100,
  };
}

async function liveTextReport(page: Page, selector: string): Promise<LiveTextReport> {
  return page.$eval(selector, liveTextProbe);
}

async function measureWord(page: Page, viewportWidth: number, label: string) {
  await assertScaleOne(page, viewportWidth, label);
  const report = await liveTextReport(page, SEL.word);
  const fit = await page.$eval(SEL.slab, (slab, wordSel) => {
    const word = slab.querySelector(wordSel as string)!;
    const slabBox = slab.getBoundingClientRect();
    const wordBox = word.getBoundingClientRect();
    const cs = getComputedStyle(word);
    return {
      slabWidthPx: Math.round(slabBox.width * 100) / 100,
      wordBoxWidthPx: Math.round(wordBox.width * 100) / 100,
      // scrollWidth beyond clientWidth is the word overflowing its own box,
      // which is what "fitted to width" forbids.
      wordScrollWidthPx: word.scrollWidth,
      wordClientWidthPx: word.clientWidth,
      lineHeightPx: cs.lineHeight,
      documentScrollWidthPx: document.documentElement.scrollWidth,
    };
  }, SEL.word);
  return { ...report, ...fit };
}

async function runViewport(page: Page, request: APIRequestContext, baseURL: string, width: number) {
  const { unique, colliding, rows } = await pickIdentifiers(baseURL, request);
  await loadAndSync(page, unique);

  const measurements: Record<string, unknown> = {};

  const notKind = await check(page, unique);
  expect(notKind, `${unique} should be recognised and not owned yet`).toBe("NOT_IN_COLLECTION");
  measurements.NOT_IN_COLLECTION = {
    identifier: unique,
    ...(await measureWord(page, width, `NOT_IN_COLLECTION at ${width}`)),
    capture: await capture(page, `c23-not-in-collection-${width}`),
  };

  const uncertainKind = await check(page, colliding);
  expect(uncertainKind, `${colliding} is carried by more than one variant`).toBe("UNCERTAIN");
  measurements.UNCERTAIN = {
    identifier: colliding,
    ...(await measureWord(page, width, `UNCERTAIN at ${width}`)),
    capture: await capture(page, `c23-uncertain-${width}`),
  };

  await check(page, unique);
  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.slab)).toContainText("Saved to your collection.");
  const ownedKind = await check(page, unique);
  expect(ownedKind, "after adding, the same identifier answers OWNED").toBe("OWNED");
  measurements.OWNED = {
    identifier: unique,
    ...(await measureWord(page, width, `OWNED at ${width}`)),
    capture: await capture(page, `c23-owned-${width}`),
  };

  // The clause, on every verdict the product can show.
  for (const [kind, m] of Object.entries(measurements)) {
    const measured = m as LiveTextReport & { wordScrollWidthPx: number; wordClientWidthPx: number };
    expect(measured.ok, `${kind} at ${width}px is not live text: ${measured.failures.join("; ")}`).toBe(true);
    expect(measured.fontSizePx, `${kind} font size at ${width}px`).toBeGreaterThanOrEqual(MIN_PX);
    expect(measured.fontSizePx, `${kind} font size at ${width}px`).toBeLessThanOrEqual(MAX_PX);
    expect(
      measured.wordScrollWidthPx,
      `${kind} at ${width}px: the verdict word overflows its own box`,
    ).toBeLessThanOrEqual(measured.wordClientWidthPx);
  }

  return { viewportWidthPx: width, catalogueRows: rows, measurements };
}

test.describe("the verdict word at 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("live text, fitted, and inside the range", async ({ page, request, baseURL }) => {
    evidence.target = await assertProductionTarget(request, baseURL!);
    evidence.at390 = await runViewport(page, request, baseURL!, 390);
  });
});

test.describe("the verdict word at 1440 px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("live text, fitted, and inside the range", async ({ page, request, baseURL }) => {
    evidence.at1440 = await runViewport(page, request, baseURL!, 1440);
  });
});

test("the live-text instrument rejects three ways of faking text", async ({ page, baseURL }) => {
  // Negative controls. Without these the "live text" clause is asserted by an
  // instrument nobody has ever seen fail, which is the same as not asserting
  // it. Each control is a real technique for shipping a word as a picture.
  await page.goto(baseURL!);
  const controls = await page.evaluate((probeSource) => {
    // The same source that judged the real verdict word, rebuilt in the page.
    const probe = new Function(`return ${probeSource}`)() as (node: Element) => {
      ok: boolean;
      failures: string[];
    };
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;width:400px";
    document.body.appendChild(host);

    // 1. The word shipped as a bitmap.
    const asImage = document.createElement("img");
    asImage.alt = "OWNED";
    asImage.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    asImage.style.cssText = "width:200px;height:46px";
    host.appendChild(asImage);

    // 2. Classic image replacement: real text pushed off the box, picture
    //    behind it. It has a computed font size, which is exactly why a font
    //    size alone never proved this clause.
    const replaced = document.createElement("p");
    replaced.textContent = "OWNED";
    replaced.style.cssText =
      "font-size:46px;text-indent:-9999px;background-image:url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7);width:200px;height:46px;overflow:hidden";
    host.appendChild(replaced);

    // 3. The word drawn as vector outlines inside an <svg>, with no text node.
    const asSvg = document.createElement("p");
    asSvg.innerHTML =
      '<svg width="200" height="46" viewBox="0 0 200 46"><path d="M0 0h20v46H0z" fill="currentColor"/></svg>';
    host.appendChild(asSvg);

    const result = {
      wordAsImage: probe(asImage),
      wordAsImageReplacement: probe(replaced),
      wordAsSvgOutlines: probe(asSvg),
    };
    host.remove();
    return result;
  }, liveTextProbe.toString());

  expect(controls.wordAsImage.ok, "an <img> passed the live-text probe").toBe(false);
  expect(controls.wordAsImageReplacement.ok, "an image-replaced <p> passed the live-text probe").toBe(false);
  expect(controls.wordAsSvgOutlines.ok, "SVG outlines passed the live-text probe").toBe(false);
  evidence.negativeControls = controls;
});

test.afterAll(() => {
  evidence.range = { minPx: MIN_PX, maxPx: MAX_PX };
  evidence.recordedAt = new Date().toISOString();
  writeEvidence("c23-verdict-word.json", evidence);
});
