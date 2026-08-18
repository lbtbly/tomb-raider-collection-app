// D5: "Single-viewport checking: every screen carries captures at 390, 768,
// and 1440; count of screens with fewer than 3 is 0."
//
// The 768 column did not exist. 70 PNGs were on disk before this file ran: 33
// carried 390 in the name, 3 carried 1440 (all C23), and 0 carried 768. The
// reason it stayed invisible is worth writing down, because it is the exact
// shape of a line that looks covered and is not. `check:ui` DOES audit at 768
// when UI_CHECK_WIDTHS names it, and the C7 sweep did exactly that. But an
// audit emits findings, and D5 asks for captures. A green audit at 768 and a
// missing capture at 768 are compatible facts, and the first was being read as
// covering the second.
//
// This file makes the 768 column real for the screens that are built today.
// It does not close D5 and must not be read as closing it: D5 says every
// screen, the design names seven, and four are routed at slice 1. The JSON
// names the three that are missing and the slice each one arrives in.
//
// Two decisions, both recorded rather than assumed:
//
//   BOTH THEMES, not one. D5 names widths and not themes, so one theme would
//   satisfy it. C1 asks for the same 7 x 3 grid IN THE DARK THEME and is
//   blocked on the same missing column, so capturing dark as well costs one
//   more loop and hands C1 the captures for the four built screens. C1 still
//   needs its own overflow count; captures are a precondition, not the line.
//
//   THE NAME IS THE CLAIM, AND THE PIXELS ARE THE WITNESS. Every file here is
//   named with the width it claims, and every claim is judged against the
//   IHDR chunk of the file itself. A requested viewport is not proof of a
//   captured width: `fullPage: true` produced 560 px images under a line
//   reading "captured at 390 px" earlier in this run. The judge is exercised
//   against a deliberately mismatched capture at the bottom of this file,
//   because a width check that has never rejected anything is not a check.

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { rmSync } from "node:fs";
import path from "node:path";
import {
  assertProductionTarget,
  assertScaleOne,
  capture,
  evidenceDir,
  pngSize,
  repoRelative,
  repoRoot,
  settle,
  writeEvidence,
} from "./harness";
import { THEME_STORAGE_KEY } from "../../src/lib/theme/theme";

const SEL = {
  input: "#check-identifier",
  submit: 'form button[type="submit"]',
  slab: '[data-testid="verdict"]',
  recognizedLabel: "section.vslab .vlead.mono",
  addToCollection: 'section.vslab button:has-text("Add to collection")',
  collectionLink: 'a[href^="/collection/"]',
};

// 844 at the two phone-and-tablet widths and 900 at 1440, matching the heights
// every other spec in this directory uses. A capture set that changed height
// between files could not be compared with the ones already on disk.
const VIEWPORTS = [
  { widthPx: 390, heightPx: 844 },
  { widthPx: 768, heightPx: 844 },
  { widthPx: 1440, heightPx: 900 },
] as const;

const THEMES = ["dark", "light"] as const;
type Theme = (typeof THEMES)[number];

type CaptureRecord = {
  designScreen: string;
  route: string;
  state: string;
  theme: Theme;
  widthRequestedPx: number;
  heightRequestedPx: number;
  file: string;
  claimedWidthPx: number | null;
  ihdrWidthPx: number;
  ihdrHeightPx: number;
  nameAgreesWithPixels: boolean;
};

const evidence: Record<string, unknown> = {};
const captures: CaptureRecord[] = [];
const scaleReadings: Record<string, unknown>[] = [];

// ---------------------------------------------------------------------------
// The instrument. A file name ending in -<digits>.png is a claim about the
// image, and the IHDR chunk is the only thing that can confirm or refute it.

function widthClaimedByName(file: string): number | null {
  const match = path.basename(file).match(/-(\d+)\.png$/);
  return match ? Number(match[1]) : null;
}

function judgeWidth(absoluteFile: string): {
  file: string;
  claimedWidthPx: number | null;
  ihdrWidthPx: number;
  ihdrHeightPx: number;
  nameAgreesWithPixels: boolean;
} {
  const claimedWidthPx = widthClaimedByName(absoluteFile);
  const { widthPx, heightPx } = pngSize(absoluteFile);
  return {
    file: repoRelative(absoluteFile),
    claimedWidthPx,
    ihdrWidthPx: widthPx,
    ihdrHeightPx: heightPx,
    nameAgreesWithPixels: claimedWidthPx !== null && claimedWidthPx === widthPx,
  };
}

/** A capture, then the file itself asked what it is. The harness `capture`
 * already refuses a screenshot whose pixels disagree with the live viewport;
 * this adds the second half D5 needs, which is that the NAME the evidence is
 * filed under agrees with the pixels too. */
async function shot(
  page: Page,
  meta: { designScreen: string; route: string; state: string; theme: Theme; viewport: (typeof VIEWPORTS)[number] },
): Promise<CaptureRecord> {
  const name = `d5-${meta.state}-${meta.theme}-${meta.viewport.widthPx}`;
  const written = await capture(page, name);
  const judged = judgeWidth(path.join(repoRoot(), written.file));
  expect(
    judged.nameAgreesWithPixels,
    `${judged.file} is named for ${judged.claimedWidthPx} px and its IHDR reads ${judged.ihdrWidthPx} px`,
  ).toBe(true);
  expect(judged.ihdrHeightPx, `${judged.file} height`).toBe(meta.viewport.heightPx);
  const record: CaptureRecord = {
    designScreen: meta.designScreen,
    route: meta.route,
    state: meta.state,
    theme: meta.theme,
    widthRequestedPx: meta.viewport.widthPx,
    heightRequestedPx: meta.viewport.heightPx,
    ...judged,
  };
  captures.push(record);
  return record;
}

// ---------------------------------------------------------------------------
// Identifiers, taken from the catalogue the server is serving rather than
// pinned as literals. Three are needed and they must not interfere: owning a
// variant changes what its own identifiers answer, so the identifier that has
// to keep answering NOT IN COLLECTION must belong to a different variant from
// the one that gets added, and the colliding identifier must not name the
// added variant either or it would answer OWNED on one of its candidates.

type IndexRow = { variantPublicId: string; normalizedIdentifiers: string[] };

async function pickIdentifiers(page: Page, baseURL: string) {
  const res = await page.request.get(new URL("/api/sync/index", baseURL).toString());
  expect(res.ok(), `catalogue index unavailable at ${baseURL}`).toBeTruthy();
  const { rows } = (await res.json()) as { rows: IndexRow[] };
  expect(rows.length, "empty catalogue").toBeGreaterThan(0);

  const holders = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const value of row.normalizedIdentifiers) {
      holders.set(value, (holders.get(value) ?? new Set()).add(row.variantPublicId));
    }
  }
  const sorted = [...holders.entries()].sort(([a], [b]) => a.localeCompare(b));
  const uniques = sorted.filter(([, ids]) => ids.size === 1);

  const toOwn = uniques[0];
  expect(toOwn, "no identifier is carried by exactly one variant").toBeTruthy();
  const ownedVariant = [...toOwn![1]][0]!;

  const staysUnowned = uniques.find(([, ids]) => [...ids][0] !== ownedVariant);
  expect(staysUnowned, "only one variant carries a unique identifier").toBeTruthy();

  const colliding = sorted.find(([, ids]) => ids.size > 1 && !ids.has(ownedVariant));
  expect(colliding, "no identifier collides without naming the owned variant").toBeTruthy();

  return {
    toOwn: toOwn![0],
    ownedVariant,
    staysUnowned: staysUnowned![0],
    colliding: colliding![0],
    catalogueRows: rows.length,
    distinctIdentifierValues: sorted.length,
  };
}

// ---------------------------------------------------------------------------

async function openContext(browser: Browser, theme: Theme, viewport: (typeof VIEWPORTS)[number]) {
  const context = await browser.newContext({
    viewport: { width: viewport.widthPx, height: viewport.heightPx },
    // Pinned rather than defaulted. A zoomed viewport produced a false
    // positive earlier in this project, and a deviceScaleFactor of 2 would
    // double every IHDR width while every name stayed honest-looking.
    deviceScaleFactor: 1,
    colorScheme: theme,
    isMobile: false,
  });
  // The stored choice, not the OS hint alone: "system" resolves through
  // prefers-color-scheme and an explicit choice is the reproducible one.
  await context.addInitScript(
    ([key, value]: [string, string]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Asserted below by reading the resolved theme off the document.
      }
    },
    [THEME_STORAGE_KEY, theme] as [string, string],
  );
  return context;
}

/** Puts the catalogue index on the device and leaves one copy saved, which is
 * what the collection list and the collection item screen need before they
 * have anything to render. Returns the saved copy's id, read off the list's
 * own link rather than invented. */
async function warmUp(page: Page, ids: Awaited<ReturnType<typeof pickIdentifiers>>): Promise<string> {
  await page.goto("/");
  await expect(page.locator(SEL.input)).toBeVisible();
  await expect(async () => {
    await page.fill(SEL.input, ids.toOwn);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.recognizedLabel)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 500, 1000] });

  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.slab)).toContainText("Saved to your collection.");

  await page.goto("/collection");
  await expect(page.locator("body")).toContainText(/\d+ (copy|copies) saved/);
  const href = await page.locator(SEL.collectionLink).first().getAttribute("href");
  expect(href, "the collection list rendered no link to a copy").toBeTruthy();
  const copyId = href!.replace("/collection/", "");
  expect(copyId.length, "empty copy id").toBeGreaterThan(0);
  return copyId;
}

async function verdict(page: Page, identifier: string, kind: string) {
  await page.goto("/");
  await expect(page.locator(SEL.input)).toBeVisible();
  await expect(async () => {
    await page.fill(SEL.input, identifier);
    await page.click(SEL.submit);
    // The kind is part of the wait, not a read taken after it. A slab left
    // over from a previous check is visible immediately and would be
    // photographed as if it were this one.
    await expect(page.locator(`${SEL.slab}[data-verdict="${kind}"]`)).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 500, 1000] });
}

async function captureEveryBuiltScreen(
  browser: Browser,
  baseURL: string,
  theme: Theme,
  ids: Awaited<ReturnType<typeof pickIdentifiers>>,
) {
  for (const viewport of VIEWPORTS) {
    // A context per width rather than a resized page. The on-device stores are
    // rebuilt for each one, so every width starts from the same device state
    // instead of inheriting whatever the previous width left behind.
    const context: BrowserContext = await openContext(browser, theme, viewport);
    const page = await context.newPage();
    const copyId = await warmUp(page, ids);

    const at = { theme, viewport };

    // 01 Aisle check, resting.
    await page.goto("/");
    await expect(page.locator(SEL.input)).toBeVisible();
    await expect(page.locator(SEL.slab)).toHaveCount(0);
    const scale = await assertScaleOne(page, viewport.widthPx, `${theme} ${viewport.widthPx} aisle check`);
    const resolvedTheme = await page.evaluate((key) => ({
      storedChoice: window.localStorage.getItem(key),
      rootClasses: document.documentElement.className,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
    }), THEME_STORAGE_KEY);
    scaleReadings.push({ theme, widthPx: viewport.widthPx, ...scale, ...resolvedTheme });
    await shot(page, { designScreen: "01 Aisle check", route: "/", state: "01-aisle-check-resting", ...at });

    // 01 Aisle check, all three verdicts. C23 has these at 390 and 1440
    // already; 768 is the column PLAN.md slice 1 asks for and nothing had.
    await verdict(page, ids.toOwn, "OWNED");
    await shot(page, { designScreen: "01 Aisle check", route: "/", state: "01-verdict-owned", ...at });

    await verdict(page, ids.staysUnowned, "NOT_IN_COLLECTION");
    await shot(page, { designScreen: "01 Aisle check", route: "/", state: "01-verdict-not-in-collection", ...at });

    await verdict(page, ids.colliding, "UNCERTAIN");
    await shot(page, { designScreen: "01 Aisle check", route: "/", state: "01-verdict-uncertain", ...at });

    // 02 Catalogue. The count line, not the lead: the lead carries the same
    // words and renders with an empty device.
    await page.goto("/catalogue");
    await expect(page.locator("body")).toContainText(/\d+ variants? cached on this device/);
    await assertScaleOne(page, viewport.widthPx, `${theme} ${viewport.widthPx} catalogue`);
    await shot(page, { designScreen: "02 Catalogue", route: "/catalogue", state: "02-catalogue", ...at });

    // 04 My collection, slice 1's list.
    await page.goto("/collection");
    await expect(page.locator("body")).toContainText(/\d+ (copy|copies) saved/);
    await assertScaleOne(page, viewport.widthPx, `${theme} ${viewport.widthPx} collection`);
    await shot(page, { designScreen: "04 My collection", route: "/collection", state: "04-collection-list", ...at });

    // The saved copy's own page. This is a detail view inside screen 04's
    // territory and NOT design screen 05: the route is keyed by the on-device
    // copy id, it reads one anonymous copy off this device, and it has no
    // notion of another collector. Screen 05 is a public profile and arrives
    // in slice 6.
    await page.goto(`/collection/${copyId}`);
    await expect(page.locator("h1.pageh1")).toBeVisible();
    await assertScaleOne(page, viewport.widthPx, `${theme} ${viewport.widthPx} collection item`);
    await shot(page, {
      designScreen: "04 My collection (saved copy detail)",
      route: "/collection/[publicId]",
      state: "04-collection-item",
      ...at,
    });

    await context.close();
  }
}

// ---------------------------------------------------------------------------

test.describe("D5, the 768 column", () => {
  for (const theme of THEMES) {
    test(`every built screen at 390, 768 and 1440 in the ${theme} theme`, async ({
      browser,
      request,
      baseURL,
    }) => {
      // Twenty-one captures across three contexts, each with its own warm-up
      // sync. The file-wide 180 s is a per-test budget for a single flow.
      test.setTimeout(600_000);
      if (!evidence.target) evidence.target = await assertProductionTarget(request, baseURL!);
      const context = await browser.newContext();
      const probe = await context.newPage();
      const ids = await pickIdentifiers(probe, baseURL!);
      await context.close();
      evidence.identifiers = {
        addedToCollection: ids.toOwn,
        staysUnowned: ids.staysUnowned,
        colliding: ids.colliding,
        catalogueRows: ids.catalogueRows,
        distinctIdentifierValues: ids.distinctIdentifierValues,
      };
      await captureEveryBuiltScreen(browser, baseURL!, theme, ids);
    });
  }
});

test("the width judge rejects a capture whose pixels disagree with its name", async ({
  browser,
  baseURL,
}) => {
  // The negative control. Every assertion above passed, and a judge that has
  // only ever passed proves nothing about the 63 files it approved. This one
  // is captured at 1024 px and filed under a name claiming 768, which is the
  // precise failure D5 is exposed to: a capture pass that renames rather than
  // re-measures.
  const context = await browser.newContext({
    viewport: { width: 1024, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(baseURL!);
  await settle(page);

  const controlFile = path.join(evidenceDir(), "d5-negative-control-claims-768.png");
  await page.screenshot({ path: controlFile });
  const judged = judgeWidth(controlFile);
  await context.close();

  expect(judged.claimedWidthPx, "the control's name claims 768").toBe(768);
  expect(judged.ihdrWidthPx, "the control's pixels are 1024 wide").toBe(1024);
  expect(
    judged.nameAgreesWithPixels,
    "the width judge accepted a 1024 px image filed as 768 px",
  ).toBe(false);

  // A control PNG left in the evidence directory is indistinguishable from
  // real evidence at a glance, and it is named for a width it does not have.
  // Its numbers go in the JSON; the file does not stay.
  rmSync(controlFile);

  evidence.negativeControl = {
    what: "a viewport capture taken at 1024 px and filed under a name claiming 768 px",
    file: judged.file,
    claimedWidthPx: judged.claimedWidthPx,
    ihdrWidthPx: judged.ihdrWidthPx,
    ihdrHeightPx: judged.ihdrHeightPx,
    nameAgreesWithPixels: judged.nameAgreesWithPixels,
    judgeVerdict: "REJECTED",
    pngRemovedAfterMeasurement: true,
    why: "a width check that has never rejected anything is not a check",
  };
});

// ---------------------------------------------------------------------------

test.afterAll(() => {
  const perScreen = new Map<string, { designScreen: string; route: string; state: string; theme: Theme; widths: number[] }>();
  for (const c of captures) {
    const key = `${c.state}|${c.theme}`;
    const entry = perScreen.get(key) ?? {
      designScreen: c.designScreen,
      route: c.route,
      state: c.state,
      theme: c.theme,
      widths: [],
    };
    entry.widths.push(c.ihdrWidthPx);
    perScreen.set(key, entry);
  }
  const coverage = [...perScreen.values()].map((e) => ({
    ...e,
    widths: [...e.widths].sort((a, b) => a - b),
    widthCount: new Set(e.widths).size,
  }));

  evidence.line =
    "D5. Single-viewport checking: every screen carries captures at 390, 768, and 1440; count of screens with fewer than 3 is 0.";
  evidence.widthsRequested = VIEWPORTS.map((v) => v.widthPx);
  evidence.viewports = VIEWPORTS;
  evidence.themesCaptured = THEMES;
  evidence.themeNote =
    "Both themes. D5 names widths only, so one would satisfy it. C1 asks for the same 7 x 3 grid in the dark theme and is blocked on the same missing 768 column, so the dark set is captured here to feed it. C1 still needs its own zero overflow count and is not closed by these files.";
  evidence.captures = captures;
  evidence.coverageByScreenAndTheme = coverage;
  evidence.capturesWithFewerThanThreeWidths = coverage.filter((e) => e.widthCount < 3);
  evidence.totalCaptures = captures.length;
  evidence.capturesWhoseNameDisagreesWithPixels = captures.filter((c) => !c.nameAgreesWithPixels);
  evidence.scaleReadings = scaleReadings;

  // The screens the design names and the routes that answer them today.
  // Verified with `find src/app -name page.tsx` and by reading each file, not
  // taken from a list.
  evidence.designScreens = [
    { number: "01", name: "Aisle check", route: "/", built: true, capturedHere: true, slice: 1 },
    { number: "02", name: "Catalogue", route: "/catalogue", built: true, capturedHere: true, slice: 2 },
    {
      number: "03",
      name: "Specimen sheet",
      route: null,
      built: false,
      capturedHere: false,
      slice: 2,
      note: "no route under src/app answers a catalogue specimen sheet; slice 2 brings it with static generation of every sheet",
    },
    { number: "04", name: "My collection", route: "/collection", built: true, capturedHere: true, slice: 1, note: "slice 1 ships the list; the dense table, saved views and money arrive in slice 4" },
    {
      number: "05",
      name: "Public profile",
      route: null,
      built: false,
      capturedHere: false,
      slice: 6,
      note: "/collection/[publicId] is NOT this screen. That route is keyed by the on-device copy id, reads one anonymous copy off this device, and has no notion of another collector. Screen 05 is another collector's shelf browsed signed out, and slice 6 brings it.",
    },
    { number: "06", name: "Contributor", route: null, built: false, capturedHere: false, slice: 7 },
    { number: "07", name: "Landing", route: null, built: false, capturedHere: false, slice: 9, note: "the root is the aisle check, not the landing" },
  ];
  evidence.extraRouteCaptured = {
    route: "/collection/[publicId]",
    what: "the saved copy detail page, a detail view inside screen 04",
    builtInSlice: 1,
    capturedHere: true,
  };

  evidence.verdict = {
    d5: "STILL FAILS",
    whatThisPassFixed:
      "the 768 column, which held 0 captures before this run, now exists for every screen routed today, at IHDR-verified pixel widths, in both themes",
    whatRemains: [
      "screen 03 Specimen sheet is not routed; slice 2",
      "screen 05 Public profile is not routed; slice 6",
      "screen 06 Contributor is not routed; slice 7",
      "screen 07 Landing is not routed; slice 9",
    ],
    earliestClose:
      "slice 9. D5, C1 and C17 all read all 7 screens at 390, 768 and 1440, and the last of the seven arrives with the landing in slice 9. No amount of capture work on the built routes can close any of the three before then.",
    siblingLinesUnblockedByTheSameColumn: [
      "C1. All 7 screens captured at 390, 768, and 1440 in the dark theme; count of clipped or overflowing elements is 0. The dark captures here cover the built screens; the overflow count is a separate measurement.",
      "C17. At 40 percent text expansion, the 7 screens at 390, 768, and 1440 show 0 clipped or overflowing strings. Not addressed here; needs a pseudo-locale pass at all three widths.",
    ],
  };
  evidence.recordedAt = new Date().toISOString();
  writeEvidence("d5-three-width-captures.json", evidence);
});
