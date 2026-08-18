// The core verdict loop, measured in a real browser: F1, F2, F3, F4, C15.
//
// Two rules shape every measurement here.
//
// 1. The clock lives in the page. A waitForSelector round trip through the
//    Playwright protocol measures the harness, not the paint. Every latency
//    number below comes from performance.now() read inside the page, on
//    either side of a MutationObserver that was installed before submit.
// 2. The base URL is a parameter (playwright.config.ts). Nothing here knows
//    the word localhost.

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Timing and network counting cannot share a machine with other runs, and
// the C15 aggregate has to see every page the file touched.
test.describe.configure({ mode: "serial" });

// ---------------------------------------------------------------------------
// Selectors
//
// None of these components carry a data-testid and this dispatch is not
// allowed to edit them, so the harness reads the classes the design already
// ships. Requested for the next component pass, in priority order:
//   data-testid="verdict"   on <section class="vslab">
//   data-verdict="OWNED|UNCERTAIN|NOT_IN_COLLECTION" on the same node
//   data-testid="verdict-word" on <p class="vword">
// A class is a styling hook and can be renamed by a designer without anyone
// noticing the harness went blind; a data-verdict attribute would also let
// F4 assert the verdict kind rather than infer it from a modifier class.
const SEL = {
  input: "#check-identifier",
  submit: 'form button[type="submit"]',
  slab: "section.vslab",
  word: "section.vslab .vword",
  recognizedLabel: "section.vslab .vlead.mono",
  addToCollection: 'section.vslab button:has-text("Add to collection")',
  addedConfirm: 'section.vslab :text("Saved to your collection.")',
};

const VERDICT_CLASS = {
  OWNED: "v-own",
  UNCERTAIN: "v-unc",
  NOT_IN_COLLECTION: "v-not",
} as const;

const VERDICT_WORDS = ["OWNED", "UNCERTAIN", "NOT IN COLLECTION"] as const;

// The two real identifier collisions in the seeded catalogue. Not fixtures:
// SLUS-00152 is the 1996 first pressing against the Greatest Hits reprint,
// SLUS-01311 the retail Chronicles disc against its promo-only twin.
const UNCERTAIN_IDENTIFIERS = ["SLUS-00152", "SLUS-01311"];

// Well formed, correct shape for a PlayStation catalogue number, and in no
// catalogue anywhere. The three-doors path.
const UNKNOWN_IDENTIFIER = "SLUS-99999";

// ---------------------------------------------------------------------------
// Evidence collection

type ConsoleFinding = {
  scope: string;
  kind: "console.error" | "pageerror";
  text: string;
  /** First frames of the stack, so a finding names a file instead of a mood. */
  stack?: string[];
  atIso: string;
};
type NetEvent = {
  phase: "request" | "response" | "requestfailed";
  method?: string;
  status?: number;
  url: string;
  atEpochMs: number;
  atIso: string;
};
type Paint = {
  identifier: string;
  /** ms from submit to the DOM carrying the verdict node. */
  domMs: number;
  /** ms from submit to the animation frame that renders it. The number
   * asserted against F1's thresholds, because it is the later of the two. */
  paintMs: number;
  verdictWord: string;
  verdictClass: string;
  submitAtEpochMs: number;
  paintAtEpochMs: number;
};

const consoleFindings: ConsoleFinding[] = [];
const verdictWordsSeen = new Set<string>();
const summary: Record<string, unknown> = {};

/** .forge/evidence in the project root, found by walking up from the test
 * directory rather than trusting the shell's cwd: evidence that lands in a
 * different folder depending on where the command was typed is not evidence
 * anyone will find later. */
function evidenceDir(): string {
  let dir = test.info().config.rootDir;
  while (!existsSync(path.join(dir, "package.json")) && path.dirname(dir) !== dir) {
    dir = path.dirname(dir);
  }
  const out = path.join(dir, ".forge", "evidence");
  mkdirSync(out, { recursive: true });
  return out;
}

function writeEvidence(name: string, body: unknown): string {
  const file = path.join(evidenceDir(), name);
  writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
  return file;
}

/** Every page the file opens goes through here, so C15 counts the whole run
 * and not one convenient screen. Nothing is filtered. */
function watchConsole(page: Page, scope: string) {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    consoleFindings.push({ scope, kind: "console.error", text: msg.text(), atIso: new Date().toISOString() });
  });
  page.on("pageerror", (err) => {
    consoleFindings.push({
      scope,
      kind: "pageerror",
      text: err.message,
      stack: (err.stack ?? "").split("\n").slice(0, 6),
      atIso: new Date().toISOString(),
    });
  });
}

function watchNetwork(page: Page, log: NetEvent[]) {
  page.on("request", (r) =>
    log.push({ phase: "request", method: r.method(), url: r.url(), atEpochMs: Date.now(), atIso: new Date().toISOString() }),
  );
  page.on("response", (r) =>
    log.push({ phase: "response", status: r.status(), url: r.url(), atEpochMs: Date.now(), atIso: new Date().toISOString() }),
  );
  page.on("requestfailed", (r) =>
    log.push({ phase: "requestfailed", method: r.method(), url: r.url(), atEpochMs: Date.now(), atIso: new Date().toISOString() }),
  );
}

// ---------------------------------------------------------------------------
// The measurement

/**
 * Types an identifier, then submits and times the verdict from inside the
 * page. The MutationObserver is installed before performance.now() is read,
 * and submit is dispatched in the same task as that read, so the delta spans
 * exactly submit -> verdict node -> next animation frame. No protocol round
 * trip sits inside the measured window.
 */
async function measureVerdict(page: Page, identifier: string): Promise<Paint> {
  await page.fill(SEL.input, identifier);
  // Confirms React's controlled state took the value before the clock starts.
  await expect(page.locator(SEL.input)).toHaveValue(identifier);

  const measured = await page.evaluate(async (sel) => {
    return await new Promise<Omit<Paint, "identifier"> | null>((resolve) => {
      const form = document.querySelector("form");
      if (!form) return resolve(null);
      let submittedAt = 0;
      const timer = window.setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, 10_000);

      const observer = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of Array.from(record.addedNodes)) {
            if (!(node instanceof HTMLElement)) continue;
            const slab = node.matches(sel.slab) ? node : node.querySelector<HTMLElement>(sel.slab);
            if (!slab) continue;
            const domAt = performance.now();
            observer.disconnect();
            window.clearTimeout(timer);
            requestAnimationFrame(() => {
              const paintAt = performance.now();
              resolve({
                domMs: domAt - submittedAt,
                paintMs: paintAt - submittedAt,
                verdictWord: slab.querySelector(".vword")?.textContent?.trim() ?? "",
                verdictClass: slab.className,
                submitAtEpochMs: performance.timeOrigin + submittedAt,
                paintAtEpochMs: performance.timeOrigin + paintAt,
              });
            });
            return;
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      submittedAt = performance.now();
      form.requestSubmit();
    });
  }, SEL);

  expect(measured, `no verdict node appeared for ${identifier}`).not.toBeNull();
  const paint = { identifier, ...measured! };
  verdictWordsSeen.add(paint.verdictWord);
  return paint;
}

/**
 * A clean profile that never synced holds no catalogue and would prove
 * nothing, so every test loads the page, lets the background sync land, and
 * only then measures. Readiness is checked behaviourally: a known identifier
 * resolves to a recognised variant rather than the unknown three-doors path.
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

function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of an empty run set");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid]!;
  return sorted.length % 2 ? upper : (sorted[mid - 1]! + upper) / 2;
}

/** Indexed reads that fail loudly instead of typing an identifier called
 * "undefined" and reporting the verdict for it. */
function at<T>(list: readonly T[], index: number, what: string): T {
  const value = list[index];
  if (value === undefined) throw new Error(`${what} ${index} is missing`);
  return value;
}
const held = (index: number) => at(identifiers, index, "catalogue identifier");
const uncertain = (index: number) => at(UNCERTAIN_IDENTIFIERS, index, "collision identifier");

const round = (n: number) => Math.round(n * 100) / 100;

/** Ten identifiers that each resolve to exactly one variant on the device,
 * read from the catalogue the server is actually serving rather than pinned
 * to strings that a reseed can invalidate. */
async function tenHeldIdentifiers(baseURL: string, request: import("@playwright/test").APIRequestContext) {
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

// ---------------------------------------------------------------------------

let identifiers: string[] = [];

test.beforeAll(async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext();
  identifiers = await tenHeldIdentifiers(baseURL!, request);
  await request.dispose();
});

test("F1 verdict paints within 100 ms of submit, 10 runs, max at or under 250 ms", async ({ browser }) => {
  // Clean profile, no account: a context created here shares nothing with
  // any other test's storage.
  const context = await browser.newContext();
  const page = await context.newPage();
  watchConsole(page, "F1");

  await loadAndSync(page, held(0));

  const runs: Paint[] = [];
  for (const identifier of identifiers) {
    runs.push(await measureVerdict(page, identifier));
  }

  const paintMs = runs.map((r) => r.paintMs);
  const domMs = runs.map((r) => r.domMs);
  const result = {
    line: "F1",
    runs: runs.map((r) => ({ identifier: r.identifier, domMs: round(r.domMs), paintMs: round(r.paintMs), verdict: r.verdictWord })),
    domMedianMs: round(median(domMs)),
    domMaxMs: round(Math.max(...domMs)),
    paintMedianMs: round(median(paintMs)),
    paintMaxMs: round(Math.max(...paintMs)),
    measuredWith: "in-page MutationObserver installed before submit, performance.now() either side, one rAF for the frame",
  };
  const file = writeEvidence("f1-verdict-latency.json", result);
  summary.F1 = { ...result, file };
  console.log(`[F1] median ${result.paintMedianMs} ms, max ${result.paintMaxMs} ms over ${runs.length} runs -> ${file}`);

  expect(runs).toHaveLength(10);
  for (const run of runs) expect(run.verdictWord, `run ${run.identifier} painted no verdict word`).not.toBe("");
  // The hard cap in the rubric line.
  expect(result.paintMaxMs).toBeLessThanOrEqual(250);
  // The headline of the same line: a verdict within 100 ms of submit.
  expect(result.paintMedianMs).toBeLessThanOrEqual(100);

  await context.close();
});

test("F2 offline after one sync: 10 verdicts, 0 network requests", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  watchConsole(page, "F2");
  const net: NetEvent[] = [];
  watchNetwork(page, net);

  await loadAndSync(page, held(0));

  // The sync has landed. Everything after this line runs with no network.
  await context.setOffline(true);
  const offlineAtEpochMs = Date.now();

  const runs: Paint[] = [];
  for (const identifier of identifiers) {
    runs.push(await measureVerdict(page, identifier));
  }
  const finishedAtEpochMs = Date.now();

  const duringRuns = net.filter((e) => e.phase === "request" && e.atEpochMs >= offlineAtEpochMs && e.atEpochMs <= finishedAtEpochMs);
  const result = {
    line: "F2",
    offlineAtIso: new Date(offlineAtEpochMs).toISOString(),
    finishedAtIso: new Date(finishedAtEpochMs).toISOString(),
    verdictsReturned: runs.length,
    requestsDuringRuns: duringRuns.length,
    requestsDuringRunsDetail: duringRuns,
    paintMedianMs: round(median(runs.map((r) => r.paintMs))),
    paintMaxMs: round(Math.max(...runs.map((r) => r.paintMs))),
    // Nothing is filtered out of the count above. The full log is here so a
    // reader can see for themselves that no cache hit was quietly dropped.
    fullLog: net,
  };
  const file = writeEvidence("f2-offline-network-log.json", result);
  summary.F2 = {
    line: "F2",
    verdictsReturned: result.verdictsReturned,
    requestsDuringRuns: result.requestsDuringRuns,
    paintMedianMs: result.paintMedianMs,
    paintMaxMs: result.paintMaxMs,
    file,
  };
  console.log(`[F2] ${runs.length} verdicts offline, ${duringRuns.length} requests -> ${file}`);

  expect(runs).toHaveLength(10);
  for (const run of runs) expect(run.verdictWord, `offline run ${run.identifier} painted no verdict`).not.toBe("");
  expect(result.requestsDuringRuns, `requests fired while offline: ${JSON.stringify(duringRuns)}`).toBe(0);

  await context.setOffline(false);
  await context.close();
});

test("F3 throttled to 30 kbit/s and 2000 ms latency: the verdict paints before any response arrives", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  watchConsole(page, "F3");
  const net: NetEvent[] = [];
  watchNetwork(page, net);

  // Sync once at full speed so the device holds the catalogue, exactly as a
  // collector's phone would before it walked into a shop with no signal.
  await loadAndSync(page, held(0));

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  const conditions = {
    offline: false,
    latency: 2000,
    // 30 kbit/s in bytes per second, which is the unit CDP takes.
    downloadThroughput: (30 * 1000) / 8,
    uploadThroughput: (30 * 1000) / 8,
    connectionType: "cellular2g" as const,
  };
  await cdp.send("Network.emulateNetworkConditions", conditions);
  const throttledAtEpochMs = Date.now();

  // Reload the whole screen under the throttle and wait for the app's own
  // background sync to leave the device. The request under test is the
  // app's, not one the harness invented, and it is genuinely in flight when
  // the identifier is typed: at 2,000 ms of latency its response cannot
  // possibly have come back yet.
  const syncFired = page.waitForRequest((r) => r.url().includes("/api/sync/index"), { timeout: 150_000 });
  // "commit", not "load": awaiting a full load under 30 kbit/s would park
  // the harness past the moment being measured.
  await page.goto("/", { waitUntil: "commit" });
  await syncFired;

  const paint = await measureVerdict(page, held(1));
  // Proves the verdict was computed against the synced catalogue and not
  // against an index that had not finished loading, which would paint a
  // fast but empty answer.
  await expect(page.locator(SEL.recognizedLabel)).toBeVisible();

  // Let the throttled sync land after the fact, so the ordering is recorded
  // as two real timestamps rather than as one timestamp and an absence.
  await page
    .waitForResponse((r) => r.url().includes("/api/sync/index"), { timeout: 120_000 })
    .catch(() => null);

  // What the line actually claims: at the moment the verdict painted, a
  // request was in flight and no response had come back yet.
  const responsesAfterSubmit = net
    .filter((e) => e.phase === "response" && e.atEpochMs >= paint.submitAtEpochMs)
    .sort((a, b) => a.atEpochMs - b.atEpochMs);
  const inFlightAtPaint = net.filter(
    (req) =>
      req.phase === "request" &&
      req.atEpochMs <= paint.paintAtEpochMs &&
      !net.some((res) => res.phase === "response" && res.url === req.url && res.atEpochMs <= paint.paintAtEpochMs),
  );
  const firstResponseAfterSubmit = responsesAfterSubmit[0];

  const result = {
    line: "F3",
    conditions,
    throttledAtIso: new Date(throttledAtEpochMs).toISOString(),
    submitAtIso: new Date(paint.submitAtEpochMs).toISOString(),
    paintAtIso: new Date(paint.paintAtEpochMs).toISOString(),
    paintMs: round(paint.paintMs),
    verdict: paint.verdictWord,
    inFlightAtPaint: inFlightAtPaint.map((r) => ({ url: r.url, atIso: r.atIso })),
    firstResponseAfterSubmit: firstResponseAfterSubmit ?? null,
    paintBeforeFirstResponseMs: firstResponseAfterSubmit
      ? round(firstResponseAfterSubmit.atEpochMs - paint.paintAtEpochMs)
      : null,
    fullLog: net,
  };
  const file = writeEvidence("f3-throttled-network-log.json", result);
  summary.F3 = {
    line: "F3",
    paintMs: result.paintMs,
    paintAtIso: result.paintAtIso,
    firstResponseAfterSubmitIso: firstResponseAfterSubmit?.atIso ?? null,
    paintBeforeFirstResponseMs: result.paintBeforeFirstResponseMs,
    inFlightCount: inFlightAtPaint.length,
    file,
  };
  console.log(
    `[F3] paint ${result.paintAtIso} (+${result.paintMs} ms), first response after submit ${firstResponseAfterSubmit?.atIso ?? "none"} -> ${file}`,
  );

  expect(paint.verdictWord).not.toBe("");
  // A run where nothing was in flight would pass the ordering check while
  // proving nothing, so the in-flight request is asserted too.
  expect(inFlightAtPaint.length, "no request was in flight when the verdict painted").toBeGreaterThan(0);
  if (firstResponseAfterSubmit) {
    expect(paint.paintAtEpochMs).toBeLessThan(firstResponseAfterSubmit.atEpochMs);
  }

  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await context.close();
});

test("F4 three verdicts and never two, each captured at 390 px", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  watchConsole(page, "F4");

  const dir = evidenceDir();
  const shots: Record<string, string> = {};
  const observed: {
    name: string;
    word: string;
    slabCount: number;
    verdictClass: string;
    documentScrollWidthPx: number;
  }[] = [];

  async function capture(name: string, expectedWord: (typeof VERDICT_WORDS)[number], expectedClass: string) {
    const slabs = page.locator(SEL.slab);
    // "Never two": one verdict on screen at a time, never a pair.
    await expect(slabs).toHaveCount(1);
    const word = (await page.locator(SEL.word).textContent())?.trim() ?? "";
    const verdictClass = (await slabs.getAttribute("class")) ?? "";
    expect(word).toBe(expectedWord);
    expect(VERDICT_WORDS).toContain(word);
    expect(verdictClass).toContain(expectedClass);
    verdictWordsSeen.add(word);
    // How wide the document actually is at a 390 px viewport. Recorded as a
    // number because a fullPage capture silently widens itself to whatever
    // overflows, and a screenshot 560 px across is not evidence of anything
    // rendered at 390.
    const documentScrollWidthPx = await page.evaluate(() => document.documentElement.scrollWidth);
    observed.push({ name, word, slabCount: 1, verdictClass, documentScrollWidthPx });
    await slabs.scrollIntoViewIfNeeded();
    const file = path.join(dir, `f4-${name}-390.png`);
    // Viewport capture, not fullPage: exactly 390 px wide, which is what the
    // line asks for.
    await page.screenshot({ path: file });
    shots[name] = file;
  }

  await loadAndSync(page, held(0));

  // NOT IN COLLECTION, recognised: the identifier is in the catalogue and no
  // copy is held yet.
  await measureVerdict(page, held(2));
  await capture("not-in-collection", "NOT IN COLLECTION", VERDICT_CLASS.NOT_IN_COLLECTION);

  // NOT IN COLLECTION, unrecognised: well formed, in no catalogue.
  await measureVerdict(page, UNKNOWN_IDENTIFIER);
  await capture("not-in-collection-unknown", "NOT IN COLLECTION", VERDICT_CLASS.NOT_IN_COLLECTION);

  // UNCERTAIN, both real collisions in the seeded catalogue.
  await measureVerdict(page, uncertain(0));
  await capture("uncertain-slus00152", "UNCERTAIN", VERDICT_CLASS.UNCERTAIN);
  await measureVerdict(page, uncertain(1));
  await capture("uncertain-slus01311", "UNCERTAIN", VERDICT_CLASS.UNCERTAIN);

  // OWNED: add the copy in this same context, then check the identifier again.
  await measureVerdict(page, held(2));
  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.addedConfirm)).toBeVisible();
  await measureVerdict(page, held(2));
  await capture("owned", "OWNED", VERDICT_CLASS.OWNED);

  const result = {
    line: "F4",
    viewportPx: 390,
    // Every entry above 390 is horizontal overflow at the design's own
    // width. Left in the evidence, not smoothed over.
    documentScrollWidthPx: observed.map((o) => o.documentScrollWidthPx),
    verdictsObserved: observed,
    distinctVerdictWords: [...new Set(observed.map((o) => o.word))].sort(),
    screenshots: shots,
  };
  const file = writeEvidence("f4-verdicts.json", result);
  summary.F4 = { ...result, file };
  console.log(`[F4] ${Object.values(shots).length} captures at 390 px -> ${dir}`);

  expect(result.distinctVerdictWords).toEqual(["NOT IN COLLECTION", "OWNED", "UNCERTAIN"]);

  await context.close();
});

test("C15 console errors across every screen the harness touches number 0", async ({ browser, baseURL }) => {
  const context: BrowserContext = await browser.newContext();
  const page = await context.newPage();
  watchConsole(page, "C15");

  // Only screen 01 (the aisle check) exists in this slice. The other six are
  // recorded as unbuilt rather than counted as clean, because a route that
  // 404s cannot log a console error and must never be read as evidence.
  const screens = [{ name: "01 aisle check", path: "/" }];
  const notYetBuilt: { path: string; status: number }[] = [];
  for (const probe of ["/collection", "/catalogue"]) {
    const res = await page.request.get(new URL(probe, baseURL!).toString());
    if (!res.ok()) notYetBuilt.push({ path: probe, status: res.status() });
  }

  for (const screen of screens) {
    await page.goto(screen.path);
    await expect(page.locator("main")).toBeVisible();
  }

  // The core loop end to end on a fresh profile, once more under this watch.
  await loadAndSync(page, held(0));
  await measureVerdict(page, held(3));
  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.addedConfirm)).toBeVisible();
  await measureVerdict(page, held(3));
  await measureVerdict(page, uncertain(0));
  await measureVerdict(page, UNKNOWN_IDENTIFIER);
  await page.waitForTimeout(500);

  const result = {
    line: "C15",
    screensMeasured: screens.map((s) => s.path),
    screensNotYetBuilt: notYetBuilt,
    scopesWatched: ["F1", "F2", "F3", "F4", "C15"],
    consoleErrorCount: consoleFindings.length,
    consoleErrors: consoleFindings,
    distinctVerdictWordsSeenAcrossRun: [...verdictWordsSeen].sort(),
  };
  const file = writeEvidence("c15-console-errors.json", result);
  summary.C15 = { ...result, file };
  writeEvidence("core-loop-summary.json", summary);
  console.log(`[C15] ${consoleFindings.length} console errors across ${screens.length} screen(s) and the core loop -> ${file}`);

  // Three verdicts, never a fourth, across everything this file ran.
  expect([...verdictWordsSeen].sort()).toEqual(["NOT IN COLLECTION", "OWNED", "UNCERTAIN"]);
  expect(consoleFindings, JSON.stringify(consoleFindings, null, 2)).toHaveLength(0);

  await context.close();
});
