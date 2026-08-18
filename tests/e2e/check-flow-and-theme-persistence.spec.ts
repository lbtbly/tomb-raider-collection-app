// The slice-1 lines whose mechanisms were built and never measured:
// F7 (reversing an UNCERTAIN pick), F8 (three doors on an unknown
// identifier), F9 (the stale-snapshot age line under all three verdicts),
// F11 (56 px primary controls at 390 px), C27 (theme persistence) and
// C28 (theme following the device).
//
// Four rules shape every measurement here, three of them paid for in this
// run already.
//
//  1. The base URL is a parameter (playwright.config.ts), never a literal.
//     Nothing in this file knows the word localhost.
//  2. Scale is asserted before any box is read. A stray `body { zoom }`
//     once made a declared 44 px compute as 43.99, so zoom, devicePixelRatio
//     and the visual viewport scale are checked at every state that gets
//     measured, and the check runs before the numbers, not after.
//  3. Every capture is a viewport capture. `fullPage: true` widens itself to
//     whatever overflows, and a 560 px PNG under a line that reads
//     "captured at 390 px" is false evidence that nobody would catch.
//  4. The target is asserted to be a production build before anything is
//     trusted (see the first test). A `next start` that lost its port to a
//     dev server answers 200 all the same.
//
// Numbers are recorded as numbers in .forge/evidence/. An assertion that
// throws away the value it measured leaves nothing behind to read.

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Deliberately not serial. playwright.config.ts already pins workers to 1
// and fullyParallel to false, so these run one at a time either way, and
// serial mode would let one failing line skip every line after it. Six
// lines are being measured here; a defect in one is not a reason to leave
// the other five unmeasured.

// ---------------------------------------------------------------------------
// Selectors
//
// section.vslab is the selector the earlier harness used and still the one
// that is certain to exist. data-verdict and data-testid landed since; both
// are read where they are present and neither is depended on to find a node,
// so this file keeps working either way.
const SEL = {
  input: "#check-identifier",
  submit: 'form button[type="submit"]',
  slab: "section.vslab",
  word: "section.vslab .vword",
  recognizedLabel: "section.vslab .vlead.mono",
  addToCollection: 'section.vslab button:has-text("Add to collection")',
  candidate: "section.vslab .candidateRow .btn",
  doorList: "section.vslab .doorList",
  themeGroup: '[role="radiogroup"]',
  themeResolved: ".themeResolved",
};

// Copy read from src/lib/i18n/en.ts and pinned here rather than imported.
// The measurements run against a compiled build; importing the catalogue
// would let a copy edit landing mid-run disagree with the bundle actually
// being measured, and the test would then be describing two builds at once.
const COPY = {
  reverse: "Undo, this is not the one",
  addToCollection: "Add to collection",
  addedConfirm: "Saved to your collection.",
  viewCollection: "View your collection",
  doorSearch: "Search by title",
  doorStart: "Start an entry",
  doorUnfiled: "Add to Unfiled",
  // check.cacheAge, "Catalogue snapshot is {age} old". The prefix is what
  // identifies the age line among the several .vcache lines a slab can hold.
  cacheAgePrefix: "Catalogue snapshot is",
  // check.cacheAge.fresh, "Catalogue snapshot synced {age} ago". Present in
  // the catalogue, never referenced by a component. F9 records whether it
  // renders anywhere rather than assuming.
  cacheAgeFreshPrefix: "Catalogue snapshot synced",
  themeLight: "Light",
  themeDark: "Dark",
  themeSystem: "System",
  themeResolvedLight: "Following the device, Light right now",
  themeResolvedDark: "Following the device, Dark right now",
  catalogueHeading: "Catalogue index",
  collectionHeading: "Your collection",
};

const THEME_STORAGE_KEY = "vitrine:theme";
const LIGHT_CLASS = "lt";

// The two real identifier collisions in the seeded catalogue. Not fixtures:
// SLUS-00152 is the 1996 first pressing against the Greatest Hits reprint,
// SLUS-01311 the retail Chronicles disc against its promo-only twin.
const UNCERTAIN_IDENTIFIERS = ["SLUS-00152", "SLUS-01311"];

// Well formed for a PlayStation catalogue number and in no catalogue
// anywhere. The three-doors path.
const UNKNOWN_IDENTIFIER = "SLUS-99999";

const VIEWPORT = { width: 390, height: 844 };

// 30 hours. Over the 24 hour threshold with room to spare, so a clock skew
// of minutes cannot decide the result.
const STALE_AGE_MS = 30 * 60 * 60 * 1000;
// 1 hour. Under the threshold, used as F9's negative control.
const FRESH_AGE_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Evidence

/** .forge/evidence in the project root, found by walking up from the test
 * directory rather than trusting the shell's cwd. */
function evidenceDir(): string {
  let dir = test.info().config.rootDir;
  while (!existsSync(path.join(dir, "package.json")) && path.dirname(dir) !== dir) {
    dir = path.dirname(dir);
  }
  const out = path.join(dir, ".forge", "evidence");
  mkdirSync(out, { recursive: true });
  return out;
}

function projectRoot(): string {
  let dir = test.info().config.rootDir;
  while (!existsSync(path.join(dir, "package.json")) && path.dirname(dir) !== dir) {
    dir = path.dirname(dir);
  }
  return dir;
}

/** Every path this file records is relative to the project root, never
 * absolute. An earlier evidence pass wrote /Users/<home> paths into files
 * that git tracks, which is a real leak and cost a cleanup; a relative path
 * says the same thing and carries no username. */
function repoRelative(file: string): string {
  return path.relative(projectRoot(), file);
}

function writeEvidence(name: string, body: unknown): string {
  const file = path.join(evidenceDir(), name);
  writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
  return repoRelative(file);
}

/**
 * Waits for the webfonts and for every running animation before anything is
 * read or captured.
 *
 * Both halves were paid for. The verdict slab arrives behind a 220 ms
 * clip-path wipe (.vslabWipe in globals.css), and the first run of this file
 * captured mid-wipe: the PNGs showed the verdict word sliced at 220 px and
 * looked exactly like the 390 px overflow defect this run already fixed.
 * The boxes were right, since clip-path does not move layout, but the
 * evidence read as a defect that was not there. Type metrics are the other
 * half: a control measured before its webfont lands is measured in the
 * fallback face, which is how a 56 px control reads as something else.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const running = document.getAnimations();
    await Promise.race([
      Promise.allSettled(running.map((a) => a.finished)),
      // An animation that never ends must not hang the run.
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))));
  });
}

/** Viewport capture, never fullPage, and never mid-animation. Returns the
 * file path and the size of the image as the browser reported the viewport,
 * so the evidence carries the width it claims. */
async function capture(page: Page, name: string): Promise<{ file: string; widthPx: number; heightPx: number }> {
  await settle(page);
  const file = path.join(evidenceDir(), `${name}.png`);
  await page.screenshot({ path: file });
  const size = page.viewportSize() ?? { width: -1, height: -1 };
  return { file: repoRelative(file), widthPx: size.width, heightPx: size.height };
}

// ---------------------------------------------------------------------------
// Scale, asserted before any box is read

type Scale = {
  bodyZoom: string;
  devicePixelRatio: number;
  visualViewportScale: number | null;
  innerWidthPx: number;
  documentScrollWidthPx: number;
};

async function assertScaleOne(page: Page, where: string): Promise<Scale> {
  const scale = await page.evaluate(() => ({
    bodyZoom: getComputedStyle(document.body).zoom,
    devicePixelRatio: window.devicePixelRatio,
    visualViewportScale: window.visualViewport ? window.visualViewport.scale : null,
    innerWidthPx: window.innerWidth,
    documentScrollWidthPx: document.documentElement.scrollWidth,
  }));
  expect(["1", "normal"], `body zoom at ${where}`).toContain(scale.bodyZoom);
  expect(scale.devicePixelRatio, `devicePixelRatio at ${where}`).toBe(1);
  if (scale.visualViewportScale !== null) {
    expect(scale.visualViewportScale, `visual viewport scale at ${where}`).toBe(1);
  }
  expect(scale.innerWidthPx, `viewport width at ${where}`).toBe(VIEWPORT.width);
  return scale;
}

// ---------------------------------------------------------------------------
// Flow helpers

async function newCheckContext(
  browser: Browser,
  options: Parameters<Browser["newContext"]>[0] = {},
): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { ...VIEWPORT },
    // Pinned. The whole file measures boxes.
    deviceScaleFactor: 1,
    isMobile: false,
    ...options,
  });
}

/**
 * A clean profile holds no catalogue and would prove nothing, so every test
 * loads the page and lets the background sync land first. Readiness is
 * behavioural: a known identifier has to resolve to a recognised variant
 * rather than falling through to the unknown three-doors path.
 */
async function loadAndSync(page: Page, probeIdentifier: string) {
  await page.goto("/");
  await expect(page.locator(SEL.input)).toBeVisible();
  await expect(async () => {
    await page.fill(SEL.input, probeIdentifier);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.recognizedLabel)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 500, 1000] });
}

/** Submit an identifier and wait for the slab that answers it. */
async function check(page: Page, identifier: string): Promise<string> {
  await page.fill(SEL.input, identifier);
  await page.click(SEL.submit);
  const slab = page.locator(SEL.slab);
  await expect(slab).toHaveCount(1);
  await expect(page.locator(SEL.word)).toBeVisible();
  await settle(page);
  return verdictKind(page);
}

/** The engine's own kind where the attribute is present, the styling class
 * where it is not. Never the word on screen: that is copy. */
async function verdictKind(page: Page): Promise<string> {
  return page.evaluate((sel) => {
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
}

/** Ten identifiers that each resolve to exactly one variant, read from the
 * catalogue the server is actually serving rather than pinned to strings a
 * reseed can invalidate. */
async function unambiguousIdentifiers(baseURL: string, request: import("@playwright/test").APIRequestContext) {
  const res = await request.get(new URL("/api/sync/index", baseURL).toString());
  expect(res.ok(), `catalogue index unavailable at ${baseURL}`).toBeTruthy();
  const body = (await res.json()) as { rows: { normalizedIdentifiers: string[]; variantPublicId: string }[] };
  const byIdentifier = new Map<string, Set<string>>();
  for (const row of body.rows) {
    for (const id of row.normalizedIdentifiers) {
      if (!byIdentifier.has(id)) byIdentifier.set(id, new Set());
      byIdentifier.get(id)!.add(row.variantPublicId);
    }
  }
  const unique = [...byIdentifier.entries()].filter(([, variants]) => variants.size === 1).map(([id]) => id);
  expect(unique.length, "fewer than 10 unambiguous identifiers in the catalogue").toBeGreaterThanOrEqual(10);
  return unique.slice(0, 10);
}

function at<T>(list: readonly T[], index: number, what: string): T {
  const value = list[index];
  if (value === undefined) throw new Error(`${what} ${index} is missing`);
  return value;
}

let identifiers: string[] = [];
const held = (index: number) => at(identifiers, index, "catalogue identifier");
const uncertainId = (index: number) => at(UNCERTAIN_IDENTIFIERS, index, "collision identifier");

const summary: Record<string, unknown> = {};

test.beforeAll(async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext();
  identifiers = await unambiguousIdentifiers(baseURL!, request);
  await request.dispose();
});

// ---------------------------------------------------------------------------

test("target is a production build, and the port is recorded", async ({ request, baseURL }) => {
  const res = await request.get(baseURL!);
  expect(res.status()).toBe(200);
  const html = await res.text();
  const headers = res.headers();

  // next dev ships its own client: the HMR client and the devtools bundle
  // are in the served HTML and cannot be in a production build.
  const devMarkers = ["hmr-client", "next-devtools", "__nextjs_original-stack-frame", "react-refresh"];
  const devMarkersFound = devMarkers.filter((m) => html.includes(m));

  // A prerendered production route answers with these; next dev answers
  // `no-cache, must-revalidate` and neither header.
  const prerenderHeaderPresent = "x-nextjs-prerender" in headers || "x-nextjs-cache" in headers;
  const cacheControl = headers["cache-control"] ?? null;

  const url = new URL(baseURL!);
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
  // Only meaningful when the target is this machine. A remote deployment's
  // build id is not on this disk and is not claimed to be.
  const localBuildIdPath = path.join(projectRoot(), ".next", "BUILD_ID");
  const localBuildId = isLocal && existsSync(localBuildIdPath) ? readFileSync(localBuildIdPath, "utf8").trim() : null;

  const target = {
    line: "target",
    baseUrl: baseURL,
    host: url.hostname,
    port: url.port || (url.protocol === "https:" ? "443" : "80"),
    httpStatus: res.status(),
    devMarkersFound,
    devMarkerCount: devMarkersFound.length,
    prerenderHeaderPresent,
    cacheControl,
    xNextjsPrerender: headers["x-nextjs-prerender"] ?? null,
    xNextjsCache: headers["x-nextjs-cache"] ?? null,
    localBuildId,
    verdict:
      devMarkersFound.length === 0 && prerenderHeaderPresent
        ? "production build"
        : "NOT a production build",
    measuredAtIso: new Date().toISOString(),
  };
  const file = writeEvidence("slice1-target.json", target);
  summary.target = { ...target, file };
  console.log(`[target] ${target.baseUrl} ${target.verdict}, build ${localBuildId ?? "n/a"} -> ${file}`);

  expect(devMarkersFound, "dev-server markers in the served HTML").toEqual([]);
  expect(prerenderHeaderPresent, "no production prerender headers on the target").toBeTruthy();
});

// ---------------------------------------------------------------------------
// F7. Both outcomes of UNCERTAIN reverse from the item in 2 taps or fewer;
// captured before and after.
//
// "Both outcomes" is read two ways and both are covered: either candidate of
// the pair can be picked, and a pick resolves either to OWNED (the picked
// variant is already held) or to NOT IN COLLECTION (it is not). Every cycle
// below counts real taps: one tap is one click on one control, and setup
// clicks that happen before the item is on screen are not taps toward the
// reversal.

test("F7 every UNCERTAIN pick reverses from the item in 1 tap, both candidates and both outcomes", async ({
  browser,
}) => {
  const context = await newCheckContext(browser);
  const page = await context.newPage();
  await loadAndSync(page, held(0));
  await assertScaleOne(page, "F7 start");

  type Cycle = {
    identifier: string;
    candidateIndex: number;
    candidateLabel: string;
    outcomeVerdict: string;
    tapsToReverse: number;
    reverseControlLabel: string;
    reverseControlVisibleWithoutScroll: boolean;
    verdictBeforePick: string;
    verdictAfterReverse: string;
    candidatesBefore: string[];
    candidatesAfterReverse: string[];
    restoredIdentically: boolean;
    interactiveControlsOnItem: string[];
    captures: Record<string, string>;
  };
  const cycles: Cycle[] = [];

  async function candidateLabels(): Promise<string[]> {
    return page.locator(SEL.candidate).evaluateAll((els) =>
      els.map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim()),
    );
  }

  /** Every visible interactive control inside the verdict area, so "reverse
   * in 2 taps" is measured against what is actually reachable rather than
   * against the one control the test hoped for. */
  async function interactiveControls(): Promise<string[]> {
    return page.evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      return [...main.querySelectorAll("button, a")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
        })
        .map((el) => (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim())
        .filter((label) => label.length > 0);
    });
  }

  async function runCycle(identifier: string, candidateIndex: number, tag: string): Promise<Cycle> {
    const verdictBeforePick = await check(page, identifier);
    expect(verdictBeforePick, `${identifier} is meant to be an UNCERTAIN collision`).toBe("UNCERTAIN");
    const candidatesBefore = await candidateLabels();
    expect(candidatesBefore.length).toBe(2);
    await page.locator(SEL.slab).scrollIntoViewIfNeeded();
    const before = await capture(page, `f7-${tag}-1-before-uncertain`);

    // Tap 1 of the setup: choosing a candidate. This is the action being
    // undone, not part of the undo.
    await page.locator(SEL.candidate).nth(candidateIndex).click();
    const outcomeVerdict = await verdictKind(page);
    expect(["OWNED", "NOT_IN_COLLECTION"]).toContain(outcomeVerdict);
    await page.locator(SEL.slab).scrollIntoViewIfNeeded();
    const afterPick = await capture(page, `f7-${tag}-2-after-pick-${outcomeVerdict.toLowerCase()}`);

    const controlsOnItem = await interactiveControls();
    const reverse = page.getByRole("button", { name: COPY.reverse });
    await expect(reverse, "the reverse control is on the item screen").toBeVisible();
    const reverseControlVisibleWithoutScroll = await reverse.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    });

    // The measurement. One tap, then the state is read.
    let taps = 0;
    await reverse.click();
    taps += 1;
    const verdictAfterReverse = await verdictKind(page);
    const candidatesAfterReverse = await candidateLabels();
    await page.locator(SEL.slab).scrollIntoViewIfNeeded();
    const afterReverse = await capture(page, `f7-${tag}-3-after-reverse-${verdictAfterReverse.toLowerCase()}`);

    expect(verdictAfterReverse, "one tap returns the UNCERTAIN pair").toBe("UNCERTAIN");
    expect(candidatesAfterReverse).toEqual(candidatesBefore);
    expect(taps).toBeLessThanOrEqual(2);

    return {
      identifier,
      candidateIndex,
      candidateLabel: at(candidatesBefore, candidateIndex, "candidate"),
      outcomeVerdict,
      tapsToReverse: taps,
      reverseControlLabel: COPY.reverse,
      reverseControlVisibleWithoutScroll,
      verdictBeforePick,
      verdictAfterReverse,
      candidatesBefore,
      candidatesAfterReverse,
      restoredIdentically: JSON.stringify(candidatesBefore) === JSON.stringify(candidatesAfterReverse),
      interactiveControlsOnItem: controlsOnItem,
      captures: {
        beforePick: before.file,
        afterPick: afterPick.file,
        afterReverse: afterReverse.file,
      },
    };
  }

  // Both collisions, both candidates. With nothing held yet, every pick
  // resolves to NOT IN COLLECTION.
  for (const [i, identifier] of UNCERTAIN_IDENTIFIERS.entries()) {
    for (const candidateIndex of [0, 1]) {
      cycles.push(await runCycle(identifier, candidateIndex, `${identifier.toLowerCase()}-cand${candidateIndex}`));
    }
    void i;
  }

  // The OWNED outcome. Pick a candidate, save that copy, then check the same
  // identifier again: the collision still stands (two variants share the
  // identifier) but the picked candidate is now held, so picking it resolves
  // to OWNED. Saving the copy is setup and is not counted as a tap.
  const ownedId = uncertainId(0);
  await check(page, ownedId);
  await page.locator(SEL.candidate).nth(0).click();
  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.slab).getByText(COPY.addedConfirm)).toBeVisible();
  const ownedCycle = await runCycle(ownedId, 0, `${ownedId.toLowerCase()}-owned-outcome`);
  cycles.push(ownedCycle);

  const outcomes = [...new Set(cycles.map((c) => c.outcomeVerdict))].sort();
  const result = {
    line: "F7",
    viewportPx: VIEWPORT.width,
    cycles: cycles.length,
    maxTapsToReverse: Math.max(...cycles.map((c) => c.tapsToReverse)),
    tapsToReverse: cycles.map((c) => c.tapsToReverse),
    cyclesOverTwoTaps: cycles.filter((c) => c.tapsToReverse > 2).length,
    outcomesCovered: outcomes,
    cyclesNotRestoredIdentically: cycles.filter((c) => !c.restoredIdentically).length,
    detail: cycles,
  };
  const file = writeEvidence("f7-uncertain-reverse.json", result);
  summary.F7 = { ...result, file };
  console.log(
    `[F7] ${cycles.length} pick/reverse cycles, max ${result.maxTapsToReverse} tap(s), outcomes ${outcomes.join(", ")}`,
  );

  expect(result.cyclesOverTwoTaps).toBe(0);
  expect(result.outcomesCovered).toEqual(["NOT_IN_COLLECTION", "OWNED"]);
  await context.close();
});

// ---------------------------------------------------------------------------
// F8. An unknown identifier renders 3 doors: search by title, start an
// entry, add to Unfiled. Count of paths with no next action is 0.
//
// "No next action" is not asked of the label. Each door is walked: the first
// to the screen it links to, the second and third to the state they leave
// behind, and each one has to end somewhere a collector can go on from.

test("F8 an unknown identifier renders 3 doors and every door leads somewhere", async ({ browser }) => {
  const context = await newCheckContext(browser);
  const page = await context.newPage();
  await loadAndSync(page, held(0));

  const verdict = await check(page, UNKNOWN_IDENTIFIER);
  expect(verdict).toBe("NOT_IN_COLLECTION");
  await assertScaleOne(page, "F8 doors");

  const doors = await page.evaluate((sel) => {
    const list = document.querySelector(sel);
    if (!list) return null;
    return [...list.querySelectorAll("a, button")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        label: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
        href: el.getAttribute("href"),
        widthPx: Math.round(r.width * 100) / 100,
        heightPx: Math.round(r.height * 100) / 100,
      };
    });
  }, SEL.doorList);
  expect(doors, "no .doorList rendered for an unknown identifier").not.toBeNull();
  const doorLabels = (doors ?? []).map((d) => d.label);
  const shot = await capture(page, "f8-three-doors-390");

  type DoorWalk = {
    door: string;
    kind: "link" | "in-place";
    nextAction: string;
    landedOn: string;
    evidence: Record<string, unknown>;
    hasNextAction: boolean;
  };
  const walks: DoorWalk[] = [];

  // Door 1, search by title. A link, so it is walked by following it.
  const searchDoor = (doors ?? []).find((d) => d.label === COPY.doorSearch);
  expect(searchDoor, "the search-by-title door is missing").toBeTruthy();
  const searchHref = searchDoor?.href ?? "";
  expect(searchHref).toContain("/catalogue?q=");
  await page.getByRole("link", { name: COPY.doorSearch }).click();
  await page.waitForURL(/\/catalogue\?q=/);
  const catalogueHeading = (await page.locator("h1").first().textContent())?.trim() ?? "";
  const catalogueSearchValue = await page.locator("main input").first().inputValue();
  const catalogueControls = await page.locator("main button, main a, main input").count();
  walks.push({
    door: COPY.doorSearch,
    kind: "link",
    nextAction: "the catalogue index, searchable, with the identifier carried into the query",
    landedOn: page.url(),
    evidence: {
      href: searchHref,
      heading: catalogueHeading,
      searchInputValue: catalogueSearchValue,
      interactiveControlsOnScreen: catalogueControls,
    },
    hasNextAction: catalogueHeading === COPY.catalogueHeading && catalogueControls > 0,
  });
  const catalogueShot = await capture(page, "f8-door1-catalogue-search-390");

  // Door 2, start an entry. Stays on the screen: open the form, name the
  // entry, save it, and read the draft back out of IndexedDB.
  await page.goBack();
  await expect(page.locator(SEL.input)).toBeVisible();
  await check(page, UNKNOWN_IDENTIFIER);
  await page.getByRole("button", { name: COPY.doorStart }).click();
  const draftInput = page.locator("#draft-title");
  await expect(draftInput).toBeVisible();
  const draftValue = await draftInput.inputValue();
  await draftInput.fill("Tomb Raider, unlisted copy");
  await page.getByRole("button", { name: COPY.addToCollection }).click();
  await expect(page.locator(SEL.doorList).getByText(COPY.addedConfirm)).toBeVisible();
  const drafts = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const req = indexedDB.open("vitrine");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const rows: unknown[] = await new Promise((resolve, reject) => {
      const tx = db.transaction("draftEntries", "readonly");
      const req = tx.objectStore("draftEntries").getAll();
      req.onsuccess = () => resolve(req.result as unknown[]);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows as { title: string; identifier: string | null }[];
  });
  const draftShot = await capture(page, "f8-door2-draft-saved-390");
  walks.push({
    door: COPY.doorStart,
    kind: "in-place",
    nextAction: "a titled draft entry saved on this device, confirmed on screen",
    landedOn: page.url(),
    evidence: {
      inputPrefilledWith: draftValue,
      confirmation: COPY.addedConfirm,
      draftRowsOnDevice: drafts.length,
      draftTitles: drafts.map((d) => d.title),
      draftIdentifiers: drafts.map((d) => d.identifier),
    },
    hasNextAction: drafts.length > 0,
  });

  // Door 3, add to Unfiled. Saves a copy with no resolved variant, then
  // offers the collection. Walked as far as the collection screen.
  await check(page, UNKNOWN_IDENTIFIER);
  await page.getByRole("button", { name: COPY.doorUnfiled }).click();
  const viewCollection = page.getByRole("link", { name: COPY.viewCollection });
  await expect(viewCollection).toBeVisible();
  const unfiledShot = await capture(page, "f8-door3-unfiled-saved-390");
  const unfiledCopies = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const req = indexedDB.open("vitrine");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const rows: unknown[] = await new Promise((resolve, reject) => {
      const tx = db.transaction("userCopies", "readonly");
      const req = tx.objectStore("userCopies").getAll();
      req.onsuccess = () => resolve(req.result as unknown[]);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return (rows as { unfiledIdentifier: string | null; itemTitle: string }[]).filter(
      (r) => r.unfiledIdentifier !== null,
    );
  });
  await viewCollection.click();
  await page.waitForURL(/\/collection/);
  const collectionHeading = (await page.locator("h1").first().textContent())?.trim() ?? "";
  const collectionMentionsUnfiled = await page.getByText(UNKNOWN_IDENTIFIER).count();
  const collectionShot = await capture(page, "f8-door3-collection-390");
  walks.push({
    door: COPY.doorUnfiled,
    kind: "in-place",
    nextAction: "an Unfiled copy saved on this device, and a link into the collection that lists it",
    landedOn: page.url(),
    evidence: {
      unfiledCopiesOnDevice: unfiledCopies.length,
      unfiledIdentifiers: unfiledCopies.map((c) => c.unfiledIdentifier),
      collectionHeading,
      identifierVisibleInCollection: collectionMentionsUnfiled,
    },
    hasNextAction: unfiledCopies.length > 0 && collectionHeading === COPY.collectionHeading,
  });

  const result = {
    line: "F8",
    viewportPx: VIEWPORT.width,
    identifier: UNKNOWN_IDENTIFIER,
    doorCount: doorLabels.length,
    doorLabels,
    doorBoxes: doors,
    pathsWithNoNextAction: walks.filter((w) => !w.hasNextAction).length,
    walks,
    captures: {
      doors: shot.file,
      door1Catalogue: catalogueShot.file,
      door2Draft: draftShot.file,
      door3Unfiled: unfiledShot.file,
      door3Collection: collectionShot.file,
    },
  };
  const file = writeEvidence("f8-three-doors.json", result);
  summary.F8 = { ...result, file };
  console.log(`[F8] ${result.doorCount} doors, ${result.pathsWithNoNextAction} with no next action`);

  expect(doorLabels).toEqual([COPY.doorSearch, COPY.doorStart, COPY.doorUnfiled]);
  expect(result.doorCount).toBe(3);
  expect(result.pathsWithNoNextAction).toBe(0);
  await context.close();
});

// ---------------------------------------------------------------------------
// F9. When the on-device copy is older than 24 hours its age prints under
// the verdict in the same position on all 3 verdicts; captured for each.
//
// The hard half is the fixture. Nobody waits 24 hours, so the sync cursor's
// lastSyncedAt is written back into IndexedDB 30 hours in the past and the
// next sync is blocked at the network, which is exactly the state a device
// that has not seen a network in 30 hours is in. Blocking matters: the check
// screen kicks off a background sync on mount, and an unblocked one would
// rewrite lastSyncedAt to now before a single verdict rendered.
//
// "Same position" is a geometry claim, so it is measured rather than looked
// at: the age line's insets from the verdict slab on all four sides, and its
// gap under the verdict word, for each of the three verdicts.

type AgeLineGeometry = {
  verdict: string;
  identifier: string;
  ageLineFound: boolean;
  ageLineText: string | null;
  freshLineFound: boolean;
  slab: { widthPx: number; heightPx: number };
  /** Insets of the age line from the slab's outer edge. Each verdict slab
   * carries its own padding by design (v-own 24/20/20, v-unc 0 with a 2 px
   * dashed border and a 20 px inner column, v-not 20/16/16 with a 1 px
   * border), so these are recorded as the strict reading of "same position"
   * and are not the reading the assertion is made on. */
  insetLeftPx: number | null;
  insetRightPx: number | null;
  /** The reading the assertion is made on: where the age line's glyphs
   * start against where the verdict word's glyphs start, in the same slab.
   * 0 means the age line sits on the verdict's own text column. Measured
   * with a Range over the text, not the element box, because the element
   * boxes carry padding that the reader never sees. */
  ageTextLeftPx: number | null;
  wordTextLeftPx: number | null;
  ageTextLeftMinusWordTextLeftPx: number | null;
  gapAboveFromWordBottomPx: number | null;
  gapBelowToSlabBottomPx: number | null;
  isLastElementInSlab: boolean | null;
  isBelowVerdictWord: boolean | null;
  fontSizePx: string | null;
  fontFamily: string | null;
  marginTop: string | null;
  vcacheLinesInSlab: number;
  documentScrollWidthPx: number;
  capture: string | null;
};

async function readAgeLine(page: Page, prefixes: { age: string; fresh: string }): Promise<Omit<AgeLineGeometry, "verdict" | "identifier" | "capture">> {
  return page.evaluate(({ slabSel, wordSel, age, fresh }) => {
    const slab = document.querySelector(slabSel);
    const word = document.querySelector(wordSel);
    const empty = {
      ageLineFound: false,
      ageLineText: null as string | null,
      freshLineFound: false,
      slab: { widthPx: 0, heightPx: 0 },
      insetLeftPx: null as number | null,
      insetRightPx: null as number | null,
      ageTextLeftPx: null as number | null,
      wordTextLeftPx: null as number | null,
      ageTextLeftMinusWordTextLeftPx: null as number | null,
      gapAboveFromWordBottomPx: null as number | null,
      gapBelowToSlabBottomPx: null as number | null,
      isLastElementInSlab: null as boolean | null,
      isBelowVerdictWord: null as boolean | null,
      fontSizePx: null as string | null,
      fontFamily: null as string | null,
      marginTop: null as string | null,
      vcacheLinesInSlab: 0,
      documentScrollWidthPx: document.documentElement.scrollWidth,
    };
    if (!slab || !word) return empty;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const slabRect = slab.getBoundingClientRect();
    const wordRect = word.getBoundingClientRect();
    const cacheLines = [...slab.querySelectorAll(".vcache")];
    const texts = cacheLines.map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim());
    const ageIndex = texts.findIndex((t) => t.startsWith(age));
    const freshFound = document.body.innerText.includes(fresh);
    const base = {
      ...empty,
      freshLineFound: freshFound,
      slab: { widthPx: r2(slabRect.width), heightPx: r2(slabRect.height) },
      vcacheLinesInSlab: cacheLines.length,
    };
    if (ageIndex < 0) return base;
    const el = cacheLines[ageIndex]!;
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const descendants = [...slab.querySelectorAll("*")];
    // Where the glyphs actually start, not where the box does.
    const textLeft = (node: Element) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      range.detach();
      return r.left;
    };
    const ageTextLeft = textLeft(el);
    const wordTextLeft = textLeft(word);
    return {
      ...base,
      ageLineFound: true,
      ageLineText: texts[ageIndex] ?? null,
      insetLeftPx: r2(rect.left - slabRect.left),
      insetRightPx: r2(slabRect.right - rect.right),
      ageTextLeftPx: r2(ageTextLeft - slabRect.left),
      wordTextLeftPx: r2(wordTextLeft - slabRect.left),
      ageTextLeftMinusWordTextLeftPx: r2(ageTextLeft - wordTextLeft),
      gapAboveFromWordBottomPx: r2(rect.top - wordRect.bottom),
      gapBelowToSlabBottomPx: r2(slabRect.bottom - rect.bottom),
      isLastElementInSlab: descendants[descendants.length - 1] === el,
      isBelowVerdictWord: rect.top >= wordRect.bottom,
      fontSizePx: cs.fontSize,
      fontFamily: cs.fontFamily,
      marginTop: cs.marginTop,
    };
  }, { slabSel: SEL.slab, wordSel: SEL.word, age: prefixes.age, fresh: prefixes.fresh });
}

/** Rewrites the sync cursor's lastSyncedAt to a chosen age and reads back
 * what it wrote. Returns the value before and after, so the fixture is
 * itself evidence rather than an assumption. */
async function ageTheOnDeviceCopy(page: Page, ageMs: number) {
  return page.evaluate(async (ms) => {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const req = indexedDB.open("vitrine");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const read = (): Promise<Record<string, unknown> | undefined> =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("meta", "readonly");
        const req = tx.objectStore("meta").get("sync");
        req.onsuccess = () => resolve(req.result as Record<string, unknown> | undefined);
        req.onerror = () => reject(req.error);
      });
    const before = await read();
    if (!before) {
      db.close();
      return { ok: false, before: null, after: null, reason: "no sync row on the device" };
    }
    const agedIso = new Date(Date.now() - ms).toISOString();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("meta", "readwrite");
      const req = tx.objectStore("meta").put({ ...before, key: "sync", lastSyncedAt: agedIso });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    const after = await read();
    db.close();
    return {
      ok: true,
      before: (before.lastSyncedAt as string | null) ?? null,
      after: (after?.lastSyncedAt as string | null) ?? null,
      wroteIso: agedIso,
    };
  }, ageMs);
}

async function readLastSyncedAt(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const req = indexedDB.open("vitrine");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const row: Record<string, unknown> | undefined = await new Promise((resolve, reject) => {
      const tx = db.transaction("meta", "readonly");
      const req = tx.objectStore("meta").get("sync");
      req.onsuccess = () => resolve(req.result as Record<string, unknown> | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return (row?.lastSyncedAt as string | null) ?? null;
  });
}

test("F9 a 30-hour-old snapshot prints its age under all three verdicts, and a 1-hour-old one prints nothing", async ({
  browser,
}) => {
  // The service worker is blocked in this context for one reason: the
  // background sync has to be stoppable at the network, and a request a
  // service worker has already taken over is not reliably interceptable.
  // Nothing in F9 depends on the offline shell.
  const context = await newCheckContext(browser, { serviceWorkers: "block" });
  const page = await context.newPage();

  await loadAndSync(page, held(0));
  // An OWNED verdict needs a held copy. Saved before the clock is moved.
  await check(page, held(2));
  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.slab).getByText(COPY.addedConfirm)).toBeVisible();

  const syncedForReal = await readLastSyncedAt(page);
  expect(syncedForReal, "the device never recorded a sync, so there is no age to make stale").not.toBeNull();

  // From here the device cannot refresh its snapshot.
  let blockedSyncRequests = 0;
  await context.route("**/api/sync/index**", (route) => {
    blockedSyncRequests += 1;
    return route.abort("failed");
  });

  type Case = { key: string; identifier: string; expected: string };
  const CASES: Case[] = [
    { key: "owned", identifier: held(2), expected: "OWNED" },
    { key: "uncertain", identifier: uncertainId(0), expected: "UNCERTAIN" },
    { key: "not-in-collection", identifier: held(3), expected: "NOT_IN_COLLECTION" },
  ];

  async function measureAll(ageMs: number, tag: string): Promise<AgeLineGeometry[]> {
    const fixture = await ageTheOnDeviceCopy(page, ageMs);
    expect(fixture.ok, "could not write an aged lastSyncedAt").toBeTruthy();
    await page.reload();
    await expect(page.locator(SEL.input)).toBeVisible();
    // The aged value has to survive the mount. If a sync slipped through,
    // the whole fixture is void and the numbers below would be measuring a
    // fresh snapshot while claiming a stale one.
    await page.waitForTimeout(1200);
    const afterMount = await readLastSyncedAt(page);
    expect(afterMount, "the background sync overwrote the aged timestamp").toBe(fixture.wroteIso);
    await assertScaleOne(page, `F9 ${tag}`);

    const out: AgeLineGeometry[] = [];
    for (const c of CASES) {
      const verdict = await check(page, c.identifier);
      expect(verdict, `${c.identifier} was expected to render ${c.expected}`).toBe(c.expected);
      const geometry = await readAgeLine(page, { age: COPY.cacheAgePrefix, fresh: COPY.cacheAgeFreshPrefix });
      await page.locator(SEL.slab).scrollIntoViewIfNeeded();
      const shot = await capture(page, `f9-${tag}-${c.key}-390`);
      out.push({ verdict, identifier: c.identifier, ...geometry, capture: shot.file });
    }
    return out;
  }

  const stale = await measureAll(STALE_AGE_MS, "stale-30h");
  // The negative control. The same instrument, the same three verdicts, a
  // snapshot one hour old. If it still reports an age line, the detector is
  // matching something that is always there and the stale run above proves
  // nothing.
  const fresh = await measureAll(FRESH_AGE_MS, "fresh-1h");

  const insetLeft = stale.map((s) => s.insetLeftPx);
  const insetRight = stale.map((s) => s.insetRightPx);
  const gapBelow = stale.map((s) => s.gapBelowToSlabBottomPx);
  const gapAbove = stale.map((s) => s.gapAboveFromWordBottomPx);
  const alignedToWord = stale.map((s) => s.ageTextLeftMinusWordTextLeftPx);

  const result = {
    line: "F9",
    viewportPx: VIEWPORT.width,
    fixture: {
      method:
        "lastSyncedAt in the on-device meta store rewritten to a chosen age, then /api/sync/index blocked at the network so the mount-time background sync cannot refresh it",
      staleAgeHours: STALE_AGE_MS / 3_600_000,
      freshAgeHours: FRESH_AGE_MS / 3_600_000,
      realLastSyncedAt: syncedForReal,
      blockedSyncRequests,
    },
    stale: {
      verdictsMeasured: stale.map((s) => s.verdict),
      ageLinesFound: stale.filter((s) => s.ageLineFound).length,
      insetLeftPx: insetLeft,
      insetRightPx: insetRight,
      gapAboveFromWordBottomPx: gapAbove,
      gapBelowToSlabBottomPx: gapBelow,
      distinctInsetLeftPx: [...new Set(insetLeft)],
      distinctInsetRightPx: [...new Set(insetRight)],
      distinctGapBelowToSlabBottomPx: [...new Set(gapBelow)],
      ageTextLeftMinusWordTextLeftPx: alignedToWord,
      allBelowVerdictWord: stale.every((s) => s.isBelowVerdictWord === true),
      allLastElementInSlab: stale.every((s) => s.isLastElementInSlab === true),
      sameFontSize: [...new Set(stale.map((s) => s.fontSizePx))],
      sameMarginTop: [...new Set(stale.map((s) => s.marginTop))],
      // Two readings of "the same position on all 3 verdicts", both
      // recorded, because they disagree and the difference is the finding.
      //
      // Strict: identical insets from the slab's own outer edge. This is
      // false, and it is false by design: the three slabs carry different
      // padding (v-own 20, v-unc 20 inside a 2 px border, v-not 16 inside a
      // 1 px border), so identical insets here would require the three
      // slabs to share one padding.
      //
      // Text column: the age line starts exactly where the verdict word
      // starts, is the last element in the slab, sits below the word, and
      // carries the same type and the same 12 px top margin in all three.
      // That is what a collector sees as "the same position", and it is
      // what the assertion below is made on.
      samePositionBySlabEdgeInsets:
        new Set(insetLeft).size === 1 && new Set(insetRight).size === 1 && new Set(gapBelow).size === 1,
      samePositionByTextColumn:
        alignedToWord.every((d) => d === 0) &&
        stale.every((s) => s.isLastElementInSlab === true && s.isBelowVerdictWord === true) &&
        new Set(stale.map((s) => s.fontSizePx)).size === 1 &&
        new Set(stale.map((s) => s.marginTop)).size === 1,
      detail: stale,
    },
    negativeControl: {
      what: "the same three verdicts with a 1-hour-old snapshot",
      ageLinesFound: fresh.filter((f) => f.ageLineFound).length,
      freshMessageRenderedAnywhere: fresh.some((f) => f.freshLineFound) || stale.some((s) => s.freshLineFound),
      detail: fresh,
    },
  };
  const file = writeEvidence("f9-cache-age-line.json", result);
  summary.F9 = { ...result, file };
  console.log(
    `[F9] stale age lines ${result.stale.ageLinesFound}/3, slab-edge insets L${JSON.stringify(insetLeft)} R${JSON.stringify(insetRight)} below${JSON.stringify(gapBelow)} (same: ${result.stale.samePositionBySlabEdgeInsets}), text-column delta ${JSON.stringify(alignedToWord)} (same: ${result.stale.samePositionByTextColumn}), fresh control ${result.negativeControl.ageLinesFound}/3`,
  );

  // The instrument must be able to fail before its passes count.
  expect(result.negativeControl.ageLinesFound, "the detector reports an age line on a fresh snapshot").toBe(0);
  expect(result.stale.ageLinesFound, "the age line is missing on at least one verdict").toBe(3);
  expect(result.stale.allBelowVerdictWord, "the age line is not under the verdict word").toBeTruthy();
  expect(result.stale.allLastElementInSlab, "the age line is not the last thing in the slab").toBeTruthy();
  expect(
    result.stale.samePositionByTextColumn,
    `the age line is not on the verdict's own text column in all three: deltas ${JSON.stringify(alignedToWord)}, font sizes ${JSON.stringify(result.stale.sameFontSize)}, top margins ${JSON.stringify(result.stale.sameMarginTop)}`,
  ).toBeTruthy();

  await context.close();
});

// ---------------------------------------------------------------------------
// F11. Every primary control in the check flow measures at least 56 px on
// its shortest side at 390 px width; count under 56 px is 0.
//
// Measured once already by another pass and asserted by npm run check:ui on
// every run. This is an independent confirmation from a second instrument,
// across every state the check flow reaches, with a negative control so a
// zero here means the measurement looked.

type ControlBox = {
  state: string;
  tag: string;
  classes: string;
  label: string;
  widthPx: number;
  heightPx: number;
  shortestSidePx: number;
  isPrimary: boolean;
  disabled: boolean;
};

async function measureControls(page: Page, state: string): Promise<ControlBox[]> {
  const boxes = await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    const nodes = [...main.querySelectorAll("button, a, input, select, textarea")];
    const r2 = (n: number) => Math.round(n * 100) / 100;
    return nodes
      .map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const classes = el.getAttribute("class") ?? "";
        const tag = el.tagName.toLowerCase();
        const label = (
          el.getAttribute("aria-label") ||
          el.textContent ||
          el.getAttribute("placeholder") ||
          el.getAttribute("id") ||
          ""
        )
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 70);
        const hidden = cs.display === "none" || cs.visibility === "hidden" || r.width === 0 || r.height === 0;
        return {
          tag,
          classes,
          label,
          widthPx: r2(r.width),
          heightPx: r2(r.height),
          shortestSidePx: r2(Math.min(r.width, r.height)),
          // A primary control in the check flow: the buttons and links the
          // design styles as controls (.btn) and the form fields a collector
          // types into. Plain prose links inside the slab are not controls
          // and are recorded below without being counted.
          isPrimary: classes.split(/\s+/).includes("btn") || ["input", "select", "textarea"].includes(tag),
          disabled: (el as HTMLButtonElement).disabled === true,
          hidden,
        };
      })
      .filter((c) => !c.hidden);
  });
  return boxes.map((b) => ({ state, ...b }));
}

test("F11 no primary control in the check flow measures under 56 px at 390 px", async ({ browser }) => {
  const context = await newCheckContext(browser);
  const page = await context.newPage();
  await loadAndSync(page, held(0));

  const all: ControlBox[] = [];
  const scales: Record<string, Scale> = {};

  async function measureState(state: string) {
    await settle(page);
    scales[state] = await assertScaleOne(page, `F11 ${state}`);
    all.push(...(await measureControls(page, state)));
  }

  // Every state the check flow reaches, not the one that was convenient.
  await page.goto("/");
  await expect(page.locator(SEL.input)).toBeVisible();
  await measureState("initial");

  await check(page, held(4));
  await measureState("not-in-collection-recognized");

  await check(page, UNKNOWN_IDENTIFIER);
  await measureState("not-in-collection-unknown-doors");

  await page.getByRole("button", { name: COPY.doorStart }).click();
  await expect(page.locator("#draft-title")).toBeVisible();
  await measureState("doors-draft-form-open");

  await check(page, uncertainId(1));
  await measureState("uncertain");

  await page.locator(SEL.candidate).nth(0).click();
  await measureState("uncertain-picked-with-undo");

  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.slab).getByText(COPY.addedConfirm)).toBeVisible();
  await check(page, held(4));
  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.slab).getByText(COPY.addedConfirm)).toBeVisible();
  await check(page, held(4));
  expect(await verdictKind(page)).toBe("OWNED");
  await measureState("owned");

  const primary = all.filter((c) => c.isPrimary);
  const under56 = primary.filter((c) => c.shortestSidePx < 56);

  // The negative control. A zero from an instrument that cannot report
  // anything else is worth nothing, so one control is deliberately shrunk to
  // 40 px and the same measurement is re-run.
  await page.goto("/");
  await expect(page.locator(SEL.input)).toBeVisible();
  await page.addStyleTag({ content: `form button[type="submit"]{height:40px !important;}` });
  await page.waitForTimeout(50);
  const injected = await measureControls(page, "negative-control-40px-submit");
  const injectedUnder56 = injected.filter((c) => c.isPrimary && c.shortestSidePx < 56);

  const result = {
    line: "F11",
    viewportPx: VIEWPORT.width,
    statesMeasured: [...new Set(all.map((c) => c.state))],
    scaleAtEachState: scales,
    primaryControlsMeasured: primary.length,
    primaryUnder56: under56.length,
    under56Detail: under56,
    smallestPrimaryShortestSidePx: primary.length ? Math.min(...primary.map((c) => c.shortestSidePx)) : null,
    primaryControls: primary,
    nonPrimaryControlsRecorded: all.filter((c) => !c.isPrimary),
    negativeControl: {
      what: "the submit button forced to 40 px, then measured with the same function",
      primaryUnder56: injectedUnder56.length,
      shortestSidesPx: injectedUnder56.map((c) => c.shortestSidePx),
      instrumentCanFail: injectedUnder56.length > 0,
    },
  };
  const file = writeEvidence("f11-primary-control-sizes.json", result);
  summary.F11 = { ...result, file };
  console.log(
    `[F11] ${primary.length} primary controls over ${result.statesMeasured.length} states, ${under56.length} under 56 px, smallest ${result.smallestPrimaryShortestSidePx}`,
  );

  expect(result.negativeControl.instrumentCanFail, "the 56 px measurement cannot report a violation").toBeTruthy();
  expect(under56).toEqual([]);
  await context.close();
});

// ---------------------------------------------------------------------------
// C27. The theme choice persists across a reload and across a new session on
// the same device; captured before and after each.
//
// A word about "new session". Playwright cannot restart a browser the way a
// collector restarts a phone. What it can do, and what is done here, is open
// a second browser context carrying the first one's storageState, which
// includes this origin's localStorage and IndexedDB. That is a fresh
// session, fresh JS heap, fresh service worker registration lookup, reading
// the same on-device storage. It is not a literal browser restart, and this
// file does not claim it is.

type ThemeReading = {
  storedChoice: string | null;
  htmlClass: string;
  htmlColorScheme: string;
  bodyBackground: string;
  segmentChecked: string | null;
  resolvedLabel: string | null;
  themeColorMeta: string[];
};

async function readTheme(page: Page): Promise<ThemeReading> {
  return page.evaluate(
    ({ key, groupSel, resolvedSel }) => {
      const group = document.querySelector(groupSel);
      const checked = group
        ? [...group.querySelectorAll('[role="radio"]')].find((el) => el.getAttribute("aria-checked") === "true")
        : null;
      const resolved = document.querySelector(resolvedSel);
      return {
        storedChoice: window.localStorage.getItem(key),
        htmlClass: document.documentElement.className,
        htmlColorScheme: document.documentElement.style.colorScheme,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        segmentChecked: checked ? (checked.textContent ?? "").trim() : null,
        resolvedLabel: resolved ? (resolved.textContent ?? "").replace(/\s+/g, " ").trim() : null,
        themeColorMeta: [...document.querySelectorAll('meta[name="theme-color"]')].map(
          (m) => m.getAttribute("content") ?? "",
        ),
      };
    },
    { key: THEME_STORAGE_KEY, groupSel: SEL.themeGroup, resolvedSel: SEL.themeResolved },
  );
}

test("C27 the theme choice survives a reload and a new session reusing the same on-device storage", async ({
  browser,
}) => {
  // The device is set to dark, and the collector will choose light. Choosing
  // the theme the device already resolves to would prove nothing: the value
  // has to beat the media query for its persistence to be visible.
  const context = await newCheckContext(browser, { colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(SEL.themeGroup)).toBeVisible();
  await assertScaleOne(page, "C27 first load");

  const beforeChoice = await readTheme(page);
  const beforeChoiceShot = await capture(page, "c27-1-before-choice-device-dark-390");

  await page.getByRole("radio", { name: COPY.themeLight, exact: true }).click();
  await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${LIGHT_CLASS}\\b`));
  const afterChoice = await readTheme(page);
  const afterChoiceShot = await capture(page, "c27-2-after-choosing-light-390");

  // Reload.
  await page.reload();
  await expect(page.locator(SEL.themeGroup)).toBeVisible();
  const afterReload = await readTheme(page);
  const afterReloadShot = await capture(page, "c27-3-after-reload-390");

  // New session on the same device: a second context built from the first
  // context's storageState. Same stored data, new session.
  const state = await context.storageState({ indexedDB: true });
  const originEntry = state.origins.find((o) => o.origin === new URL(page.url()).origin);
  const sessionContext = await newCheckContext(browser, { colorScheme: "dark", storageState: state });
  const sessionPage = await sessionContext.newPage();
  await sessionPage.goto("/");
  await expect(sessionPage.locator(SEL.themeGroup)).toBeVisible();
  await assertScaleOne(sessionPage, "C27 new session");
  const inNewSession = await readTheme(sessionPage);
  const newSessionShot = await capture(sessionPage, "c27-4-new-session-same-storage-390");

  // The control that makes the two above mean something: a context with no
  // storage at all, same browser, same device setting. If this one were also
  // light, the persistence measured above would be an artifact of the
  // browser rather than of the stored choice.
  const cleanContext = await newCheckContext(browser, { colorScheme: "dark" });
  const cleanPage = await cleanContext.newPage();
  await cleanPage.goto("/");
  await expect(cleanPage.locator(SEL.themeGroup)).toBeVisible();
  const cleanSession = await readTheme(cleanPage);
  const cleanShot = await capture(cleanPage, "c27-5-control-fresh-profile-no-storage-390");

  const result = {
    line: "C27",
    viewportPx: VIEWPORT.width,
    devicePrefersColorScheme: "dark",
    choiceMade: "light",
    newSessionMethod:
      "a second browser context created with the first context's storageState (localStorage plus IndexedDB for this origin). Same on-device storage, new session and new JS heap. NOT a literal browser process restart, which Playwright cannot perform.",
    localStorageCarriedIntoNewSession: originEntry?.localStorage ?? [],
    readings: {
      beforeChoice,
      afterChoice,
      afterReload,
      inNewSession,
      controlFreshProfile: cleanSession,
    },
    persistedAcrossReload:
      afterReload.storedChoice === "light" &&
      afterReload.htmlClass.includes(LIGHT_CLASS) &&
      afterReload.segmentChecked === COPY.themeLight,
    persistedAcrossNewSession:
      inNewSession.storedChoice === "light" &&
      inNewSession.htmlClass.includes(LIGHT_CLASS) &&
      inNewSession.segmentChecked === COPY.themeLight,
    controlProvesItIsTheStoredChoice:
      cleanSession.storedChoice === null && !cleanSession.htmlClass.includes(LIGHT_CLASS),
    captures: {
      beforeChoice: beforeChoiceShot.file,
      afterChoice: afterChoiceShot.file,
      afterReload: afterReloadShot.file,
      newSession: newSessionShot.file,
      controlFreshProfile: cleanShot.file,
    },
  };
  const file = writeEvidence("c27-theme-persistence.json", result);
  summary.C27 = { ...result, file };
  console.log(
    `[C27] reload ${result.persistedAcrossReload}, new session ${result.persistedAcrossNewSession}, control ${result.controlProvesItIsTheStoredChoice}`,
  );

  expect(beforeChoice.storedChoice, "a first load must not write a choice").toBeNull();
  expect(afterChoice.storedChoice).toBe("light");
  expect(result.persistedAcrossReload).toBeTruthy();
  expect(result.persistedAcrossNewSession).toBeTruthy();
  expect(result.controlProvesItIsTheStoredChoice).toBeTruthy();

  await cleanContext.close();
  await sessionContext.close();
  await context.close();
});

// ---------------------------------------------------------------------------
// C28. With no explicit choice stored, the theme follows the device setting
// and the control names which mode it resolved to; captured with the device
// set to light and again set to dark.
//
// Two halves, and the second is the one that is easy to skip: .themeResolved
// renders only while the stored choice is "system", which is exactly this
// case, so a run that never checks it never checks the half of the line that
// says "names which mode it resolved to".

test("C28 with nothing stored the theme follows the device and the control names the resolved mode", async ({
  browser,
}) => {
  type Reading = ThemeReading & { device: string; expectedResolved: string; capture: string };
  const readings: Reading[] = [];

  for (const device of ["light", "dark"] as const) {
    const context = await newCheckContext(browser, { colorScheme: device });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(SEL.themeGroup)).toBeVisible();
    await assertScaleOne(page, `C28 device ${device}`);
    const reading = await readTheme(page);
    const shot = await capture(page, `c28-device-${device}-no-stored-choice-390`);
    readings.push({ device, expectedResolved: device, capture: shot.file, ...reading });

    expect(reading.storedChoice, "nothing may be stored for this line to mean anything").toBeNull();
    expect(reading.htmlClass.includes(LIGHT_CLASS), `html.lt with the device set to ${device}`).toBe(
      device === "light",
    );
    expect(reading.htmlColorScheme).toBe(device);
    expect(reading.segmentChecked, "System is the active segment with nothing stored").toBe(COPY.themeSystem);
    expect(reading.resolvedLabel, `the control does not name the resolved mode on a ${device} device`).toBe(
      device === "light" ? COPY.themeResolvedLight : COPY.themeResolvedDark,
    );
    await context.close();
  }

  const light = readings.find((r) => r.device === "light")!;
  const dark = readings.find((r) => r.device === "dark")!;

  const result = {
    line: "C28",
    viewportPx: VIEWPORT.width,
    method: "two contexts with Playwright's colorScheme option and no stored preference in either",
    readings,
    followsDevice:
      light.htmlClass.includes(LIGHT_CLASS) &&
      !dark.htmlClass.includes(LIGHT_CLASS) &&
      light.bodyBackground !== dark.bodyBackground,
    controlNamesResolvedMode: light.resolvedLabel !== null && dark.resolvedLabel !== null,
    // A label that printed the same words on both devices would be a
    // decoration, not a report of what resolved.
    resolvedLabelDiffersByDevice: light.resolvedLabel !== dark.resolvedLabel,
    bodyBackgroundLight: light.bodyBackground,
    bodyBackgroundDark: dark.bodyBackground,
    themeColorMetaLight: light.themeColorMeta,
    themeColorMetaDark: dark.themeColorMeta,
    captures: { deviceLight: light.capture, deviceDark: dark.capture },
  };
  const file = writeEvidence("c28-theme-follows-device.json", result);
  summary.C28 = { ...result, file };
  console.log(
    `[C28] light "${light.resolvedLabel}" bg ${light.bodyBackground}; dark "${dark.resolvedLabel}" bg ${dark.bodyBackground}`,
  );

  expect(result.followsDevice).toBeTruthy();
  expect(result.controlNamesResolvedMode).toBeTruthy();
  expect(result.resolvedLabelDiffersByDevice).toBeTruthy();
});

test.afterAll(() => {
  const file = writeEvidence("slice1-uncovered-lines-summary.json", {
    lines: ["F7", "F8", "F9", "F11", "C27", "C28"],
    measuredAtIso: new Date().toISOString(),
    summary,
  });
  console.log(`[summary] ${file}`);
});
