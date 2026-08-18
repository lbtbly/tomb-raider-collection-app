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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  /** The resource the browser was complaining about, and the address the tab
   * was on. Without these, "Failed to load resource" names nothing and cannot
   * be told apart from a real application error. */
  locationUrl?: string;
  pageUrl?: string;
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
function repoRoot(): string {
  let dir = test.info().config.rootDir;
  while (!existsSync(path.join(dir, "package.json")) && path.dirname(dir) !== dir) {
    dir = path.dirname(dir);
  }
  return dir;
}

/** Evidence records the repo-relative path, never an absolute one. An absolute
 * path embeds the machine and its owner into a file that travels with the
 * repository, which check:no-local-paths now fails on, and it is meaningless
 * to anyone reading the evidence on a different machine. */
function repoRelative(file: string): string {
  return path.relative(repoRoot(), file);
}

function evidenceDir(): string {
  const out = path.join(repoRoot(), ".forge", "evidence");
  mkdirSync(out, { recursive: true });
  return out;
}

function writeEvidence(name: string, body: unknown): string {
  const file = path.join(evidenceDir(), name);
  writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
  return repoRelative(file);
}

/** Every page the file opens goes through here, so C15 counts the whole run
 * and not one convenient screen. Nothing is filtered. */
function watchConsole(page: Page, scope: string) {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    consoleFindings.push({
      scope,
      kind: "console.error",
      text: msg.text(),
      locationUrl: msg.location()?.url ?? undefined,
      pageUrl: page.url(),
      atIso: new Date().toISOString(),
    });
  });
  page.on("pageerror", (err) => {
    consoleFindings.push({
      scope,
      kind: "pageerror",
      text: err.message,
      pageUrl: page.url(),
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

/**
 * Everything that has to be true before a pixel is worth reading.
 *
 * The verdict slab arrives behind a 220 ms clip-path wipe (`vslab-wipe` in
 * globals.css). A capture taken the moment the node exists lands mid-wipe and
 * produces an image that looks exactly like the 390 px overflow defect while
 * every measured number is already correct. So: fonts resolved, every running
 * animation finished, then two frames. The race guard is there so a future
 * infinite animation parks the run for a second instead of forever.
 */
async function settle(page: Page) {
  return await page.evaluate(async () => {
    await document.fonts.ready;
    const running = document.getAnimations().filter((a) => a.playState === "running");
    await Promise.race([
      Promise.all(running.map((a) => a.finished.catch(() => undefined))),
      new Promise((r) => setTimeout(r, 1000)),
    ]);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    return {
      fontsStatus: document.fonts.status,
      animationsWaitedFor: running.length,
      animationsStillRunning: document.getAnimations().filter((a) => a.playState === "running").length,
    };
  });
}

/**
 * Scale 1, asserted before any box is read. A stray `body{zoom}` once made a
 * 44 px target compute as 43.99, and a scaled viewport would make a document
 * width of 390 mean something other than 390 CSS pixels.
 */
async function assertScaleOne(page: Page) {
  const scale = await page.evaluate(() => ({
    bodyZoom: getComputedStyle(document.body).zoom,
    devicePixelRatio: window.devicePixelRatio,
    visualViewportScale: window.visualViewport?.scale ?? null,
    innerWidthPx: window.innerWidth,
  }));
  expect(scale.bodyZoom === "1" || scale.bodyZoom === "normal", `body zoom is ${scale.bodyZoom}`).toBe(true);
  expect(scale.devicePixelRatio).toBe(1);
  expect(scale.visualViewportScale).toBe(1);
  return scale;
}

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

test("the target is a production build, recorded before a single number is trusted", async ({
  baseURL,
  playwright,
}) => {
  const request = await playwright.request.newContext();
  const response = await request.get(baseURL!);
  expect(response.ok(), `no response from ${baseURL}`).toBeTruthy();
  const html = await response.text();
  const headers = response.headers();

  // next dev ships the refresh runtime and the dev overlay in every document.
  // A production build ships neither.
  const devMarkers = [
    "react-refresh",
    "__nextjs_original-stack-frame",
    "/_next/static/chunks/webpack.js",
    "__next_devtools",
  ].filter((marker) => html.includes(marker));

  // The other half of the trap this run paid for: a `next start` whose .next
  // was rebuilt underneath it answers 200 with genuine production headers
  // while every chunk URL 404s and nothing hydrates. The served document
  // carries the build id in its asset paths, so comparing it against the
  // BUILD_ID on disk tells a live server apart from a corpse.
  const buildIdFile = path.join(repoRoot(), ".next", "BUILD_ID");
  const buildIdOnDisk = existsSync(buildIdFile) ? readFileSync(buildIdFile, "utf8").trim() : null;
  const target = new URL(baseURL!);
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(target.hostname);

  const evidence = {
    line: "F1 F2 F3 F4 C15 target",
    baseURL,
    hostname: target.hostname,
    port: Number(target.port || (target.protocol === "https:" ? 443 : 80)),
    httpStatus: response.status(),
    devMarkersFound: devMarkers,
    buildIdOnDisk,
    buildIdFoundInServedHtml: buildIdOnDisk ? html.includes(buildIdOnDisk) : null,
    xNextjsPrerender: headers["x-nextjs-prerender"] ?? null,
    xNextjsCache: headers["x-nextjs-cache"] ?? null,
    capturedAtIso: new Date().toISOString(),
  };
  const file = writeEvidence("f1-f4-target.json", evidence);
  summary.target = { ...evidence, file };
  console.log(
    `[target] ${baseURL} port ${evidence.port}, dev markers ${devMarkers.length}, build id in html ${evidence.buildIdFoundInServedHtml} -> ${file}`,
  );

  expect(devMarkers, `dev-server markers in the HTML at ${baseURL}: ${devMarkers.join(", ")}`).toEqual([]);
  if (isLocal && buildIdOnDisk) {
    expect(
      evidence.buildIdFoundInServedHtml,
      "the served HTML does not reference the BUILD_ID on disk: the server is running a build that no longer exists",
    ).toBe(true);
  }

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

  // A service worker exists in this build, which changes what "0 requests"
  // is allowed to mean. Page-level events alone cannot tell a fetch that was
  // never made apart from a fetch the worker answered out of Cache Storage,
  // so three independent counters run at once:
  //
  //   1. page requests, as before;
  //   2. context requests, which include anything the service worker itself
  //      puts on the wire (r.serviceWorker() names the owner);
  //   3. PerformanceResourceTiming entries created inside the page during the
  //      offline window. A cache hit served by a worker still writes an entry,
  //      with workerStart > 0 and transferSize 0. A fetch never attempted
  //      writes nothing at all.
  //
  // Zero on all three is "no fetch happened". Zero on (1) and (2) with entries
  // in (3) would be "served from cache", and would be reported as such.
  const contextNet: (NetEvent & { fromServiceWorker: boolean })[] = [];
  context.on("request", (r) =>
    contextNet.push({
      phase: "request",
      method: r.method(),
      url: r.url(),
      atEpochMs: Date.now(),
      atIso: new Date().toISOString(),
      fromServiceWorker: r.serviceWorker() !== null,
    }),
  );

  await loadAndSync(page, held(0));

  // Let the worker install and take control before the network is cut, so
  // the offline window is measured against the state a returning collector
  // actually has, not against a page that never met a worker.
  const swBefore = await page.evaluate(async () => {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg && !navigator.serviceWorker.controller) {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((r) => setTimeout(r, 5000)),
      ]);
    }

    // Calibration for the discriminator, run here rather than during the
    // measured window. A resource-timing counter that reports zero because it
    // is blind reads exactly like one that reports zero because nothing was
    // fetched, so one fetch is made on purpose and the same counter is asked
    // whether it saw it. The target is a precached shell URL, so the service
    // worker answers it out of Cache Storage: this is the exact signature
    // ("a request that never touched the network") the offline window has to
    // be able to detect, proved on a request that really is served from cache.
    //
    // It runs online and before the cut deliberately. The first version fired
    // it while offline, where the rejected fetch logged
    // "net::ERR_INTERNET_DISCONNECTED" and C15 counted the harness's own noise
    // as an application error.
    const controlSince = performance.now();
    try {
      await fetch("/icon.svg", { cache: "no-store" });
    } catch {
      // A failure here still leaves a timing entry, which is all the
      // calibration needs.
    }
    await new Promise((r) => setTimeout(r, 250));
    const controlEntries = performance
      .getEntriesByType("resource")
      .filter((e) => e.startTime >= controlSince) as PerformanceResourceTiming[];

    return {
      serviceWorkerSupported: "serviceWorker" in navigator,
      registrationCount: "serviceWorker" in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0,
      controlled: "serviceWorker" in navigator && navigator.serviceWorker.controller !== null,
      cacheStorageKeys: "caches" in self ? await caches.keys() : [],
      resourceEntriesSoFar: performance.getEntriesByType("resource").length,
      calibration: {
        deliberateFetchesMade: 1,
        url: "/icon.svg",
        entriesSeen: controlEntries.length,
        detail: controlEntries.map((e) => ({
          name: e.name,
          transferSizeBytes: e.transferSize,
          workerStartMs: Math.round(e.workerStart * 100) / 100,
        })),
      },
      markNowMs: performance.now(),
    };
  });

  // The sync has landed. Everything after this line runs with no network.
  await context.setOffline(true);
  const offlineAtEpochMs = Date.now();
  const offlineAtPerfMs = swBefore.markNowMs;

  const runs: Paint[] = [];
  for (const identifier of identifiers) {
    runs.push(await measureVerdict(page, identifier));
  }
  const finishedAtEpochMs = Date.now();

  const resourceTiming = await page.evaluate((since: number) => {
    const entries = performance
      .getEntriesByType("resource")
      .filter((e) => e.startTime >= since) as PerformanceResourceTiming[];
    return {
      newEntryCount: entries.length,
      entries: entries.map((e) => ({
        name: e.name,
        initiatorType: e.initiatorType,
        startTimeMs: Math.round(e.startTime * 100) / 100,
        durationMs: Math.round(e.duration * 100) / 100,
        transferSizeBytes: e.transferSize,
        encodedBodySizeBytes: e.encodedBodySize,
        // > 0 means a service worker handled it, which is the difference
        // between "no request" and "a request answered from cache".
        workerStartMs: Math.round(e.workerStart * 100) / 100,
        deliveryType: (e as PerformanceResourceTiming & { deliveryType?: string }).deliveryType ?? null,
      })),
      controlledAtEnd: "serviceWorker" in navigator && navigator.serviceWorker.controller !== null,
    };
  }, offlineAtPerfMs);

  const duringRuns = net.filter((e) => e.phase === "request" && e.atEpochMs >= offlineAtEpochMs && e.atEpochMs <= finishedAtEpochMs);
  const contextDuringRuns = contextNet.filter((e) => e.atEpochMs >= offlineAtEpochMs && e.atEpochMs <= finishedAtEpochMs);
  const servedFromCache = resourceTiming.entries.filter((e) => e.workerStartMs > 0 || e.transferSizeBytes === 0);
  const result = {
    line: "F2",
    offlineAtIso: new Date(offlineAtEpochMs).toISOString(),
    finishedAtIso: new Date(finishedAtEpochMs).toISOString(),
    verdictsReturned: runs.length,
    requestsDuringRuns: duringRuns.length,
    requestsDuringRunsDetail: duringRuns,
    contextRequestsDuringRuns: contextDuringRuns.length,
    contextRequestsDuringRunsDetail: contextDuringRuns,
    serviceWorker: {
      ...swBefore,
      controlledAtEnd: resourceTiming.controlledAtEnd,
    },
    // The discriminator, stated as a number rather than as a claim.
    resourceTimingEntriesDuringRuns: resourceTiming.newEntryCount,
    resourceTimingEntriesDetail: resourceTiming.entries,
    entriesServedByServiceWorkerOrCache: servedFromCache.length,
    negativeControl: {
      ...swBefore.calibration,
      when: "before the network was cut",
      why: "One deliberate fetch at a precached shell URL, answered by the service worker out of Cache Storage. The same counter has to see it, or its zero during the offline window means nothing.",
    },
    requestsAbsentNotCached:
      duringRuns.length === 0 && contextDuringRuns.length === 0 && resourceTiming.newEntryCount === 0,
    howDistinguished:
      "Three counters over the same window: page requests, context requests (including any owned by the service worker), " +
      "and PerformanceResourceTiming entries created in the page. A cache hit served by a worker still writes a timing " +
      "entry with workerStart > 0 and transferSize 0; a fetch that was never made writes nothing. All three at zero " +
      "means no fetch was attempted, not that one was answered quietly.",
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
    contextRequestsDuringRuns: result.contextRequestsDuringRuns,
    resourceTimingEntriesDuringRuns: result.resourceTimingEntriesDuringRuns,
    requestsAbsentNotCached: result.requestsAbsentNotCached,
    serviceWorkerControlled: result.serviceWorker.controlled,
    paintMedianMs: result.paintMedianMs,
    paintMaxMs: result.paintMaxMs,
    file,
  };
  console.log(
    `[F2] ${runs.length} verdicts offline, ${duringRuns.length} page requests, ${contextDuringRuns.length} context requests, ` +
      `${resourceTiming.newEntryCount} resource-timing entries, service worker controlled ${result.serviceWorker.controlled} -> ${file}`,
  );

  expect(runs).toHaveLength(10);
  for (const run of runs) expect(run.verdictWord, `offline run ${run.identifier} painted no verdict`).not.toBe("");
  expect(result.requestsDuringRuns, `requests fired while offline: ${JSON.stringify(duringRuns)}`).toBe(0);
  expect(
    result.resourceTimingEntriesDuringRuns,
    `fetches happened while offline and were answered from cache: ${JSON.stringify(resourceTiming.entries)}`,
  ).toBe(0);
  expect(
    swBefore.calibration.entriesSeen,
    "the resource-timing counter did not see a deliberate fetch, so its zero above proves nothing",
  ).toBeGreaterThan(0);

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
    viewportWidthPx: number;
    settled: { fontsStatus: string; animationsWaitedFor: number; animationsStillRunning: number };
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
    // Fonts resolved, the 220 ms slab wipe finished, then two frames. A
    // mid-wipe frame reads as a clipped verdict word and invents the exact
    // defect this capture exists to disprove.
    const settled = await settle(page);
    expect(settled.animationsStillRunning, "an animation was still running at capture time").toBe(0);
    // Scale 1 before any box is read.
    const scale = await assertScaleOne(page);
    // How wide the document actually is at a 390 px viewport. Recorded as a
    // number because a fullPage capture silently widens itself to whatever
    // overflows, and a screenshot 560 px across is not evidence of anything
    // rendered at 390.
    const documentScrollWidthPx = await page.evaluate(() => document.documentElement.scrollWidth);
    observed.push({
      name,
      word,
      slabCount: 1,
      verdictClass,
      documentScrollWidthPx,
      viewportWidthPx: scale.innerWidthPx,
      settled,
    });
    await slabs.scrollIntoViewIfNeeded();
    const file = path.join(dir, `f4-${name}-390.png`);
    // Viewport capture, not fullPage: exactly 390 px wide, which is what the
    // line asks for.
    await page.screenshot({ path: file });
    // Repo-relative in the record: an absolute path embeds the machine and
      // its owner into evidence that travels with the repository.
      shots[name] = repoRelative(file);
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

  // The PNGs on disk, measured from their own IHDR rather than trusted. A
  // fullPage capture widens itself to the document, so a file 560 px across
  // filed under "captured at 390 px" is caught here and not by eye.
  const pngWidths = Object.entries(shots).map(([name, rel]) => {
    const bytes = readFileSync(path.join(repoRoot(), rel));
    return { name, file: rel, pngWidthPx: bytes.readUInt32BE(16), pngHeightPx: bytes.readUInt32BE(20) };
  });

  const result = {
    line: "F4",
    viewportPx: 390,
    // Every entry above 390 is horizontal overflow at the design's own
    // width. Left in the evidence, not smoothed over.
    documentScrollWidthPx: observed.map((o) => o.documentScrollWidthPx),
    verdictsObserved: observed,
    distinctVerdictWords: [...new Set(observed.map((o) => o.word))].sort(),
    capturedPngDimensions: pngWidths,
    screenshots: shots,
  };
  const file = writeEvidence("f4-verdicts.json", result);
  summary.F4 = { ...result, file };
  console.log(
    `[F4] ${Object.values(shots).length} captures at 390 px, document scroll widths ${result.documentScrollWidthPx.join(", ")} -> ${dir}`,
  );

  expect(result.distinctVerdictWords).toEqual(["NOT IN COLLECTION", "OWNED", "UNCERTAIN"]);
  // The overflow fix, guarded. 560 at a 390 px viewport was the defect.
  for (const o of observed) {
    expect(o.viewportWidthPx, `${o.name} rendered at ${o.viewportWidthPx} px, not 390`).toBe(390);
    expect(o.documentScrollWidthPx, `${o.name} overflows: document is ${o.documentScrollWidthPx} px at a 390 px viewport`).toBe(390);
  }
  for (const png of pngWidths) {
    expect(png.pngWidthPx, `${png.name} was written ${png.pngWidthPx} px wide, so it is not a 390 px viewport capture`).toBe(390);
  }

  await context.close();
});

test("C15 console errors across every screen the harness touches number 0", async ({ browser, baseURL }) => {
  const context: BrowserContext = await browser.newContext();
  const page = await context.newPage();
  watchConsole(page, "C15");

  // Every route this build produces is walked, not just the one screen the
  // slice started with. A route that 404s cannot log a console error and must
  // never be counted as clean, so the candidates are probed first and the
  // unbuilt ones are recorded as unbuilt.
  //
  // The unmatched address is deliberately in the list: not-found.tsx answers
  // 404 by design, which is a built screen rather than a missing one, so it is
  // walked and its status recorded rather than being dropped as "not ok".
  const anyCopyId = "probe-no-such-copy";
  const UNMATCHED_PATH = "/no-such-route-exists";
  const unmatchedUrl = new URL(UNMATCHED_PATH, baseURL!).toString();
  const candidates = [
    { name: "01 aisle check", path: "/" },
    { name: "collection", path: "/collection" },
    { name: "catalogue", path: "/catalogue" },
    { name: "collection item, unknown id (client-side not found)", path: `/collection/${anyCopyId}` },
    { name: "unmatched address (not-found.tsx)", path: UNMATCHED_PATH, expectStatus: 404 },
  ];

  const screens: { name: string; path: string; status: number }[] = [];
  const notYetBuilt: { path: string; status: number }[] = [];
  for (const probe of candidates) {
    const res = await page.request.get(new URL(probe.path, baseURL!).toString());
    const status = res.status();
    if (res.ok() || status === probe.expectStatus) {
      screens.push({ name: probe.name, path: probe.path, status });
    } else {
      notYetBuilt.push({ path: probe.path, status });
    }
  }

  for (const screen of screens) {
    await page.goto(screen.path);
    await expect(page.locator("main")).toBeVisible();
    // Let each screen finish arriving before moving on, so an error thrown
    // during a late effect is attributed to the screen that threw it.
    await settle(page);
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

  // Negative control for the console watcher itself. A zero from a listener
  // that was never wired up reads exactly like a zero from a clean app, so the
  // same two handlers are pointed at a throwaway page which is made to log an
  // error and to throw one. Its findings go to a local array and never near
  // the C15 count.
  const controlFindings: ConsoleFinding[] = [];
  const controlContext = await browser.newContext();
  const controlPage = await controlContext.newPage();
  controlPage.on("console", (msg) => {
    if (msg.type() === "error") {
      controlFindings.push({ scope: "control", kind: "console.error", text: msg.text(), atIso: new Date().toISOString() });
    }
  });
  controlPage.on("pageerror", (err) => {
    controlFindings.push({ scope: "control", kind: "pageerror", text: err.message, atIso: new Date().toISOString() });
  });
  await controlPage.goto("/");
  await controlPage.evaluate(() => {
    console.error("vitrine harness negative control: a deliberate console error");
    setTimeout(() => {
      throw new Error("vitrine harness negative control: a deliberate uncaught throw");
    }, 0);
  });
  await controlPage.waitForTimeout(500);
  const control = {
    consoleErrorsCaught: controlFindings.filter((f) => f.kind === "console.error").length,
    pageErrorsCaught: controlFindings.filter((f) => f.kind === "pageerror").length,
    findings: controlFindings.map((f) => f.text),
  };
  await controlContext.close();
  expect(control.consoleErrorsCaught, "the console watcher missed a deliberate console.error").toBeGreaterThan(0);
  expect(control.pageErrorsCaught, "the console watcher missed a deliberate uncaught throw").toBeGreaterThan(0);

  // One finding is the browser reporting the HTTP status of a navigation this
  // test made on purpose: an unmatched address must answer 404, and Chromium
  // logs "Failed to load resource ... 404" for the document itself whenever it
  // does. That is the product behaving correctly, so it is separated out by an
  // exact rule (this status, this address, this test's own navigation) and
  // counted in its own field rather than waved away. Everything else counts.
  const isDeliberate404 = (f: ConsoleFinding) =>
    f.kind === "console.error" &&
    f.locationUrl === unmatchedUrl &&
    f.text.includes("Failed to load resource") &&
    f.text.includes("404");
  const deliberate404s = consoleFindings.filter(isDeliberate404);
  const applicationErrors = consoleFindings.filter((f) => !isDeliberate404(f));

  const result = {
    line: "C15",
    screensMeasuredCount: screens.length,
    screensMeasured: screens,
    screensNotYetBuilt: notYetBuilt,
    scopesWatched: ["F1", "F2", "F3", "F4", "C15"],
    negativeControl: control,
    applicationConsoleErrorCount: applicationErrors.length,
    applicationConsoleErrors: applicationErrors,
    deliberate404StatusReports: {
      count: deliberate404s.length,
      address: UNMATCHED_PATH,
      why: "Chromium logs a console error for the document's own 404 status. The address is unmatched by design and not-found.tsx renders on it, so this is the 404 contract working, not an application error.",
      findings: deliberate404s,
    },
    consoleErrorCount: consoleFindings.length,
    consoleErrors: consoleFindings,
    distinctVerdictWordsSeenAcrossRun: [...verdictWordsSeen].sort(),
  };
  const file = writeEvidence("c15-console-errors.json", result);
  summary.C15 = { ...result, file };
  writeEvidence("core-loop-summary.json", summary);
  console.log(
    `[C15] ${applicationErrors.length} application console errors (${consoleFindings.length} total, ${deliberate404s.length} deliberate 404 status reports) ` +
      `across ${screens.length} screen(s) (${screens.map((s) => s.path).join(", ")}) and the core loop -> ${file}`,
  );

  // Three verdicts, never a fourth, across everything this file ran.
  expect([...verdictWordsSeen].sort()).toEqual(["NOT IN COLLECTION", "OWNED", "UNCERTAIN"]);
  expect(applicationErrors, JSON.stringify(applicationErrors, null, 2)).toHaveLength(0);

  await context.close();
});
