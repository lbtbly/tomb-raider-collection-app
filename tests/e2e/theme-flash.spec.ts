// C29, measured as frames and not as opinions.
//
// The line: "No flash of the wrong theme on first paint: a cold load captured
// in each of the 3 stored states shows 0 frames rendered in the other theme."
//
// What makes this hard, and the shortcut that is refused here.
//
//   A screenshot taken after `load` proves nothing. By then THEME_INIT_SCRIPT
//   has run, React has hydrated, and <html> carries the right class whether or
//   not a wrong frame was ever put on the screen. The claim is about pixels
//   that were composited, so the measurement has to be about pixels that were
//   composited. This file drives CDP Page.startScreencast, buffers every frame
//   the compositor swaps from before navigation through past load, decodes each
//   one, and classifies it by the colour that covers most of it.
//
// The three stored states are four cases, because "no stored preference" is
// not one state in practice: the OS decides, and the OS has two answers.
//
//   1. stored "light"                          -> expect light
//   2. stored "dark"                           -> expect dark
//   3. nothing stored, prefers-color-scheme: light  -> expect light
//   4. nothing stored, prefers-color-scheme: dark   -> expect dark
//
// Two traps this run already paid for, not re-paid here.
//
//   Scale 1. deviceScaleFactor is pinned to 1, the screencast is capped at the
//   viewport's own 390x844, and every frame's decoded width, height and
//   pageScaleFactor are recorded as numbers. A frame that came back at another
//   size fails the run rather than being quietly measured.
//
//   No fullPage. A screencast is a viewport capture by construction, and the
//   only PNGs written are raw screencast frames, so nothing here can widen
//   itself to the document and file it under "captured at 390 px".
//
// The base URL is a parameter (playwright.config.ts). Nothing here knows the
// word localhost. The run does assert the target is a production build, since
// theme init behaves differently under `next dev` and a dev-server number for
// this line is worthless.

import { expect, test, type Browser } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LIGHT_CLASS, THEME_STORAGE_KEY } from "../../src/lib/theme/theme";

test.describe.configure({ mode: "serial" });

// ---------------------------------------------------------------------------
// Geometry

const VIEWPORT = { width: 390, height: 844 } as const;

// ---------------------------------------------------------------------------
// The palette, lifted from src/app/globals.css. Ground tokens only: the fills
// a frame is mostly made of. Accent tokens (--fmint, --fflare) are shared by
// both scopes and say nothing about which theme painted, so they are absent on
// purpose.

const DARK_GROUND = new Set([
  "#0b1020", // --g
  "#05070e", // --g2
  "#16203a", // --case
  "#1e2b4c", // --case2
  "#070a14", // --drawer
  "#101a31", // --nil
  "#131a2c", // --hovp
]);

const LIGHT_GROUND = new Set([
  "#edf0f7", // --g
  "#e2e7f2", // --g2 and --drawer
  "#f7f9fc", // --case2
  "#e9eef8", // --nil
  "#d6ddec", // --hovp
]);

// --case in the light scope is #ffffff, but a frame that is *almost entirely*
// white is the browser's blank canvas rather than the light theme, and the two
// mean different things. Kept as its own category and counted separately.
const BLANK_WHITE = "#ffffff";
const BLANK_WHITE_SHARE = 0.9;

// The page the tab sits on before the navigation under test. A colour in
// neither palette, so a frame still showing the old document is provably not
// mistaken for a theme. Without it, the pre-navigation white of about:blank
// would be indistinguishable from a genuine light-theme flash.
const SENTINEL = "#ff00ff";

type FrameClass = "sentinel" | "light" | "dark" | "blank-white" | "other";

// ---------------------------------------------------------------------------
// Evidence

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

function writeFrame(name: string, base64: string): string {
  const file = path.join(evidenceDir(), name);
  writeFileSync(file, Buffer.from(base64, "base64"));
  return repoRelative(file);
}

const round = (n: number) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------------------
// Frame decoding
//
// Decoding happens in a second browser context after capture, never during it:
// a decode on the hot path would compete with the renderer being measured and
// cost exactly the frames this file exists to count. During capture the handler
// does two things, buffer the base64 and ack, and nothing else.

type RawFrame = {
  index: number;
  base64: string;
  /** Frame swap time, seconds since epoch, straight from CDP. */
  timestampEpochS: number;
  deviceWidth: number;
  deviceHeight: number;
  pageScaleFactor: number;
};

type DecodedFrame = {
  index: number;
  timestampEpochMs: number;
  /** ms after the navigation's first paint. Negative means the frame swapped
   * before this document painted anything, so it still showed the old page. */
  msAfterFirstPaint: number | null;
  widthPx: number;
  heightPx: number;
  pageScaleFactor: number;
  dominantHex: string;
  dominantShare: number;
  meanLuminance: number;
  classification: FrameClass;
};

type FrameAnalysis = {
  widthPx: number;
  heightPx: number;
  dominantHex: string;
  dominantShare: number;
  meanLuminance: number;
};

/**
 * Reads every frame's pixels through createImageBitmap in a throwaway page.
 * A grid sample (every 3rd pixel each way) over a 390x844 frame is ~36,000
 * pixels, which is far more than enough to find the colour that covers the
 * screen and cheap enough to run over a hundred frames.
 */
async function analyseFrames(browser: Browser, frames: RawFrame[]): Promise<FrameAnalysis[]> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("about:blank");

  const out: FrameAnalysis[] = [];
  const CHUNK = 8;
  for (let i = 0; i < frames.length; i += CHUNK) {
    const chunk = frames.slice(i, i + CHUNK).map((f) => f.base64);
    const analysed = await page.evaluate(async (batch: string[]) => {
      const results: FrameAnalysis[] = [];
      for (const b64 of batch) {
        const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(bitmap, 0, 0);
        const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

        const counts = new Map<string, number>();
        let sampled = 0;
        let luminanceSum = 0;
        const hex = (n: number) => n.toString(16).padStart(2, "0");
        for (let y = 0; y < bitmap.height; y += 3) {
          for (let x = 0; x < bitmap.width; x += 3) {
            const p = (y * bitmap.width + x) * 4;
            const r = data[p]!;
            const g = data[p + 1]!;
            const b = data[p + 2]!;
            const key = `#${hex(r)}${hex(g)}${hex(b)}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
            // Rec. 709 relative luminance on 0..1, gamma left alone: this is a
            // tie-breaker for colours outside both palettes, not a colorimetry
            // claim.
            luminanceSum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            sampled += 1;
          }
        }
        let dominantHex = "#000000";
        let dominantCount = 0;
        for (const [key, count] of counts) {
          if (count > dominantCount) {
            dominantCount = count;
            dominantHex = key;
          }
        }
        // Read before close(). A closed ImageBitmap reports 0x0, which would
        // have turned the scale-1 check into a check on nothing.
        const widthPx = bitmap.width;
        const heightPx = bitmap.height;
        bitmap.close();
        results.push({
          widthPx,
          heightPx,
          dominantHex,
          dominantShare: dominantCount / sampled,
          meanLuminance: luminanceSum / sampled,
        });
      }
      return results;
    }, chunk);
    out.push(...analysed);
  }

  await context.close();
  return out;
}

function classify(a: FrameAnalysis): FrameClass {
  if (a.dominantHex === SENTINEL) return "sentinel";
  if (a.dominantHex === BLANK_WHITE && a.dominantShare >= BLANK_WHITE_SHARE) return "blank-white";
  if (LIGHT_GROUND.has(a.dominantHex)) return "light";
  if (DARK_GROUND.has(a.dominantHex)) return "dark";
  // A colour in neither table. Not silently dropped: luminance decides, so a
  // frame painted in some ground token this file has not heard of still lands
  // on a side instead of vanishing into "other".
  if (a.meanLuminance < 0.15) return "dark";
  if (a.meanLuminance > 0.55) return "light";
  return "other";
}

// ---------------------------------------------------------------------------
// The probe injected ahead of every document
//
// requestAnimationFrame registered at document-start runs before this
// document's first paint, so what it reads is the state that went into frame
// one. This is corroboration for the screencast, not a substitute: it says
// what the DOM was, the screencast says what the screen was.

const PROBE = `
window.__c29 = {
  timeOrigin: performance.timeOrigin,
  rafClassName: null,
  rafColorScheme: null,
  rafBodyBackground: null,
  rafAtMs: null,
  paints: [],
};
requestAnimationFrame(function () {
  var r = document.documentElement;
  window.__c29.rafClassName = r.className;
  window.__c29.rafColorScheme = r.style.colorScheme;
  window.__c29.rafBodyBackground = document.body ? getComputedStyle(document.body).backgroundColor : null;
  window.__c29.rafAtMs = performance.now();
});
try {
  new PerformanceObserver(function (list) {
    for (const entry of list.getEntries()) {
      window.__c29.paints.push({ name: entry.name, startTimeMs: entry.startTime });
    }
  }).observe({ type: 'paint', buffered: true });
} catch (e) {}
`;

type Probe = {
  timeOrigin: number;
  rafClassName: string | null;
  rafColorScheme: string | null;
  rafBodyBackground: string | null;
  rafAtMs: number | null;
  paints: { name: string; startTimeMs: number }[];
};

// ---------------------------------------------------------------------------

type Case = {
  id: string;
  /** What a collector did. */
  storedChoice: "light" | "dark" | null;
  osScheme: "light" | "dark";
  expected: "light" | "dark";
  description: string;
  /** Load the app once and wait for the service worker to activate before
   * capturing, so the navigation under test is served from the offline shell
   * rather than from the network. */
  warmUpServiceWorker?: boolean;
};

const CASES: Case[] = [
  {
    id: "stored-light",
    storedChoice: "light",
    osScheme: "dark",
    expected: "light",
    description:
      "Explicit light preference against an OS set to dark, so the stored value has to beat the media query rather than agree with it.",
  },
  {
    id: "stored-dark",
    storedChoice: "dark",
    osScheme: "light",
    expected: "dark",
    description:
      "Explicit dark preference against an OS set to light, the mirror of the case above.",
  },
  {
    id: "no-preference-os-light",
    storedChoice: null,
    osScheme: "light",
    expected: "light",
    description: "Nothing stored. prefers-color-scheme: light decides.",
  },
  {
    id: "no-preference-os-dark",
    storedChoice: null,
    osScheme: "dark",
    expected: "dark",
    description: "Nothing stored. prefers-color-scheme: dark decides.",
  },
];

type CaseResult = {
  case: string;
  storedChoice: string | null;
  osPrefersColorScheme: string;
  expectedTheme: string;
  framesExamined: number;
  framesInWrongTheme: number;
  documentFrames: number;
  framesByClass: Record<FrameClass, number>;
  wrongThemeFrameIndexes: number[];
  firstPaintEpochMs: number | null;
  firstContentfulPaintMs: number | null;
  captureWindowMs: number;
  htmlClassAtFirstRaf: string | null;
  colorSchemeAtFirstRaf: string | null;
  bodyBackgroundAtFirstRaf: string | null;
  htmlClassAfterLoad: string;
  storedValueAfterLoad: string | null;
  serviceWorkerControlled: boolean | null;
  frames: DecodedFrame[];
  savedFrames: Record<string, string>;
};

const results: CaseResult[] = [];

/**
 * One cold load, captured.
 *
 * Cold means what it says: a brand new context, so no cache, no service
 * worker, no session. The stored preference is written by an init script that
 * runs at document-start, ahead of THEME_INIT_SCRIPT, which puts localStorage
 * in exactly the state a returning collector's would be in at the moment the
 * theme script reads it, without spending a prior page load to get there.
 * A prior load would warm the HTTP cache and register the service worker,
 * and then the thing measured would no longer be a cold load.
 */
async function captureCase(
  browser: Browser,
  testCase: Case,
  baseURL: string,
  extraInitScript?: string,
): Promise<CaseResult> {
  const context = await browser.newContext({
    viewport: { ...VIEWPORT },
    // Trap paid for once already: a stray scale makes 44 px compute as 43.99.
    // Pinned, and every frame's own scale factor is recorded below.
    deviceScaleFactor: 1,
    colorScheme: testCase.osScheme,
    // The verdict-loop harness runs at 390 px on desktop Chrome; matched here
    // so both files describe the same device.
    isMobile: false,
  });

  if (testCase.storedChoice) {
    await context.addInitScript(
      ([key, value]: [string, string]) => {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // Nothing to do. The assertion on storedValueAfterLoad catches it.
        }
      },
      [THEME_STORAGE_KEY, testCase.storedChoice] as [string, string],
    );
  }
  await context.addInitScript(PROBE);
  if (extraInitScript) await context.addInitScript(extraInitScript);

  const page = await context.newPage();

  if (testCase.warmUpServiceWorker) {
    await page.goto(baseURL, { waitUntil: "load" });
    await page.waitForFunction(
      () => navigator.serviceWorker.getRegistration().then((r) => !!r?.active),
      undefined,
      { timeout: 30_000 },
    );
  }

  // Paint the tab a colour in neither palette. Every frame the compositor
  // swaps before the new document paints is then self-evidently the old page.
  await page.goto("about:blank");
  await page.evaluate((colour) => {
    document.documentElement.style.background = colour;
    if (document.body) document.body.style.background = colour;
  }, SENTINEL);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Page.enable");

  const raw: RawFrame[] = [];
  cdp.on("Page.screencastFrame", (event) => {
    raw.push({
      index: raw.length,
      base64: event.data,
      timestampEpochS: event.metadata.timestamp ?? 0,
      deviceWidth: event.metadata.deviceWidth,
      deviceHeight: event.metadata.deviceHeight,
      pageScaleFactor: event.metadata.pageScaleFactor,
    });
    // Frames stop arriving until the previous one is acked, so this is the one
    // thing that must not wait on anything.
    void cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
  });

  await cdp.send("Page.startScreencast", {
    format: "png", // Lossless. A jpeg would smear the exact token colours the
    // classifier matches on and turn #0b1020 into a near miss.
    everyNthFrame: 1,
    maxWidth: VIEWPORT.width,
    maxHeight: VIEWPORT.height,
  });

  // Let the sentinel land so the log opens on a frame that is provably not a
  // theme, rather than on whatever the first navigation frame happened to be.
  await page.waitForTimeout(400);

  const captureStartEpochMs = Date.now();
  await page.goto(baseURL, { waitUntil: "load" });
  // Past load, because a flash can also arrive late: hydration re-running the
  // theme, or a client effect flipping the class after the shell painted.
  await page.waitForTimeout(1500);
  const captureEndEpochMs = Date.now();

  await cdp.send("Page.stopScreencast");

  const probe = (await page.evaluate(() => (window as unknown as { __c29: Probe }).__c29)) as Probe;
  const htmlClassAfterLoad = await page.evaluate(() => document.documentElement.className);
  // Recorded rather than assumed: a warm-up that failed to hand control to the
  // service worker would silently turn the offline-shell case back into an
  // ordinary network load and prove nothing about the shell.
  const serviceWorkerControlled = testCase.warmUpServiceWorker
    ? await page.evaluate(() => navigator.serviceWorker.controller !== null)
    : null;
  const storedValueAfterLoad = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    THEME_STORAGE_KEY,
  );

  const firstPaint = probe.paints.find((p) => p.name === "first-paint") ?? probe.paints[0];
  const firstContentful = probe.paints.find((p) => p.name === "first-contentful-paint");
  const firstPaintEpochMs = firstPaint ? probe.timeOrigin + firstPaint.startTimeMs : null;

  const analysed = await analyseFrames(browser, raw);
  expect(analysed.length, "a frame failed to decode").toBe(raw.length);

  const frames: DecodedFrame[] = raw.map((frame, i) => {
    const a = analysed[i]!;
    const timestampEpochMs = frame.timestampEpochS * 1000;
    return {
      index: frame.index,
      timestampEpochMs: round(timestampEpochMs),
      msAfterFirstPaint:
        firstPaintEpochMs === null ? null : round(timestampEpochMs - firstPaintEpochMs),
      widthPx: a.widthPx,
      heightPx: a.heightPx,
      pageScaleFactor: frame.pageScaleFactor,
      dominantHex: a.dominantHex,
      dominantShare: round(a.dominantShare),
      meanLuminance: round(a.meanLuminance),
      classification: classify(a),
    };
  });

  const wrongTheme = testCase.expected === "light" ? "dark" : "light";
  const framesByClass: Record<FrameClass, number> = {
    sentinel: 0,
    light: 0,
    dark: 0,
    "blank-white": 0,
    other: 0,
  };
  for (const f of frames) framesByClass[f.classification] += 1;

  // What counts as a frame in the wrong theme.
  //
  //   - a frame whose ground is the opposite scope's ground: the flash itself.
  //   - a near-total white frame when dark was expected: the classic unstyled
  //     first paint. It is not the light *theme*, but on a dark-theme cold
  //     load it is a white flash on the screen, which is the thing the line
  //     forbids. Counted here and also broken out under framesByClass so the
  //     two are never confused.
  //
  // A white frame on a light-theme load is not counted: white is where that
  // load is going, so there is nothing wrong about arriving early.
  const wrongFrames = frames.filter(
    (f) =>
      f.classification === wrongTheme ||
      (testCase.expected === "dark" && f.classification === "blank-white"),
  );

  const savedFrames: Record<string, string> = {};
  const firstDocumentFrame = frames.find((f) => f.classification !== "sentinel");
  if (firstDocumentFrame) {
    savedFrames.firstDocumentFrame = writeFrame(
      `c29-${testCase.id}-frame-${firstDocumentFrame.index}-first-document.png`,
      raw[firstDocumentFrame.index]!.base64,
    );
  }
  const lastFrame = frames[frames.length - 1];
  if (lastFrame) {
    savedFrames.lastFrame = writeFrame(
      `c29-${testCase.id}-frame-${lastFrame.index}-last.png`,
      raw[lastFrame.index]!.base64,
    );
  }
  // Every wrong frame is written out, capped at five, so a failure comes with
  // the picture and not just the count.
  for (const f of wrongFrames.slice(0, 5)) {
    savedFrames[`wrongTheme-${f.index}`] = writeFrame(
      `c29-${testCase.id}-frame-${f.index}-WRONG-THEME.png`,
      raw[f.index]!.base64,
    );
  }

  const result: CaseResult = {
    case: testCase.id,
    storedChoice: testCase.storedChoice,
    osPrefersColorScheme: testCase.osScheme,
    expectedTheme: testCase.expected,
    framesExamined: frames.length,
    framesInWrongTheme: wrongFrames.length,
    documentFrames: frames.filter((f) => f.classification !== "sentinel").length,
    framesByClass,
    wrongThemeFrameIndexes: wrongFrames.map((f) => f.index),
    firstPaintEpochMs: firstPaintEpochMs === null ? null : round(firstPaintEpochMs),
    firstContentfulPaintMs: firstContentful ? round(firstContentful.startTimeMs) : null,
    captureWindowMs: captureEndEpochMs - captureStartEpochMs,
    htmlClassAtFirstRaf: probe.rafClassName,
    colorSchemeAtFirstRaf: probe.rafColorScheme,
    bodyBackgroundAtFirstRaf: probe.rafBodyBackground,
    htmlClassAfterLoad,
    storedValueAfterLoad,
    serviceWorkerControlled,
    frames,
    savedFrames,
  };

  await context.close();
  return result;
}

// ---------------------------------------------------------------------------

test("C29 the target is a production build, recorded before a single frame is trusted", async ({
  baseURL,
  playwright,
}) => {
  const request = await playwright.request.newContext();
  const response = await request.get(baseURL!);
  expect(response.ok(), `no response from ${baseURL}`).toBeTruthy();
  const html = await response.text();
  const headers = response.headers();

  // next dev ships the refresh runtime and the dev overlay in every document.
  // A production build ships neither. This is not a nicety: the theme init
  // script lands in a different place under dev, and this run once had a
  // silent EADDRINUSE hand every check to a dev server on another port.
  const devMarkers = [
    "react-refresh",
    "__nextjs_original-stack-frame",
    "/_next/static/chunks/webpack.js",
    "__next_devtools",
  ].filter((marker) => html.includes(marker));

  // A `next start` whose .next was rebuilt underneath it answers 200 with
  // genuine production headers while every chunk URL 404s and nothing
  // hydrates, which reads as an application defect. The served document
  // carries the build id in its asset paths, so comparing it against the
  // BUILD_ID on disk tells a live server apart from that corpse.
  const buildIdFile = path.join(repoRoot(), ".next", "BUILD_ID");
  const buildIdOnDisk = existsSync(buildIdFile) ? readFileSync(buildIdFile, "utf8").trim() : null;

  const target = new URL(baseURL!);
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(target.hostname);
  const evidence = {
    line: "C29",
    baseURL,
    hostname: target.hostname,
    buildIdOnDisk,
    buildIdFoundInServedHtml: buildIdOnDisk ? html.includes(buildIdOnDisk) : null,
    // Recorded as a number, because "which port did that run actually hit" is
    // the question this whole preamble exists to answer.
    port: Number(target.port || (target.protocol === "https:" ? 443 : 80)),
    httpStatus: response.status(),
    devMarkersFound: devMarkers,
    xNextjsPrerender: headers["x-nextjs-prerender"] ?? null,
    xNextjsCache: headers["x-nextjs-cache"] ?? null,
    cacheControl: headers["cache-control"] ?? null,
    themeInitScriptInlinedInHtml: html.includes(THEME_STORAGE_KEY),
    stylesheetLinksInHtml: (html.match(/<link[^>]+rel="stylesheet"[^>]*>/g) ?? []).length,
    capturedAtIso: new Date().toISOString(),
  };
  const file = writeEvidence("c29-target.json", evidence);
  console.log(
    `[C29] target ${baseURL} port ${evidence.port}, dev markers ${devMarkers.length}, build id in html ${evidence.buildIdFoundInServedHtml} -> ${file}`,
  );

  expect(devMarkers, `dev-server markers in the HTML at ${baseURL}: ${devMarkers.join(", ")}`).toEqual([]);
  if (isLocal && buildIdOnDisk) {
    expect(
      evidence.buildIdFoundInServedHtml,
      "the served HTML does not reference the BUILD_ID on disk: the server is running a build that no longer exists",
    ).toBe(true);
  }
  // If the head script is not in the document, the mechanism under test is not
  // deployed and every frame count below would be measuring something else.
  expect(evidence.themeInitScriptInlinedInHtml, "THEME_INIT_SCRIPT is not inlined in the served HTML").toBe(true);

  await request.dispose();
});

for (const testCase of CASES) {
  test(`C29 ${testCase.id}: 0 frames in the ${testCase.expected === "light" ? "dark" : "light"} theme on a cold load`, async ({
    browser,
    baseURL,
  }) => {
    const result = await captureCase(browser, testCase, baseURL!);
    results.push(result);
    writeEvidence(`c29-${testCase.id}.json`, { line: "C29", ...testCase, ...result });

    console.log(
      `[C29] ${testCase.id}: ${result.framesExamined} frames examined, ` +
        `${result.framesInWrongTheme} in the wrong theme ` +
        `(sentinel ${result.framesByClass.sentinel}, light ${result.framesByClass.light}, ` +
        `dark ${result.framesByClass.dark}, blank-white ${result.framesByClass["blank-white"]}, ` +
        `other ${result.framesByClass.other})`,
    );

    // A run that captured nothing would pass every check below while proving
    // nothing at all, so the frames themselves are asserted first.
    expect(result.framesExamined, "no screencast frames were captured").toBeGreaterThan(0);
    expect(result.documentFrames, "no frame of the document under test was captured").toBeGreaterThan(0);
    expect(
      result.framesByClass.sentinel,
      "no pre-navigation sentinel frame: frames before the load cannot be told apart from theme frames",
    ).toBeGreaterThan(0);

    // Scale 1, verified per frame rather than assumed from the context option.
    for (const f of result.frames) {
      expect(f.widthPx, `frame ${f.index} decoded at ${f.widthPx} px`).toBe(VIEWPORT.width);
      expect(f.heightPx, `frame ${f.index} decoded at ${f.heightPx} px`).toBe(VIEWPORT.height);
      expect(f.pageScaleFactor, `frame ${f.index} came back at scale ${f.pageScaleFactor}`).toBe(1);
    }

    // The stored state really was the stored state.
    expect(result.storedValueAfterLoad).toBe(testCase.storedChoice);

    // Corroboration from the DOM going into frame one. Not the measurement,
    // but if this disagreed with the frames one of the two would be lying.
    const expectLightClass = testCase.expected === "light";
    expect(result.htmlClassAtFirstRaf?.includes(LIGHT_CLASS) ?? false).toBe(expectLightClass);
    expect(result.colorSchemeAtFirstRaf).toBe(testCase.expected);
    expect(result.htmlClassAfterLoad.includes(LIGHT_CLASS)).toBe(expectLightClass);

    // The line.
    expect(
      result.framesInWrongTheme,
      `frames in the wrong theme at indexes ${result.wrongThemeFrameIndexes.join(", ")}; ` +
        `see .forge/evidence/c29-${testCase.id}-frame-*-WRONG-THEME.png`,
    ).toBe(0);
  });
}

// ---------------------------------------------------------------------------
// Supplementary: the load that is actually cold for a returning collector
//
// The four cases above run in a brand new context, so nothing is cached and no
// service worker exists. That is the strictest reading of "cold load" and it is
// the one C29 is scored on. It is not the load a collector who has opened the
// app before will get: theirs comes out of the offline shell. The theme is
// inlined in the document head, so a shell that ever cached a document without
// it would flash on every launch and none of the four cases would notice.
// Measured here rather than assumed. Reported separately, because a
// service-worker-served navigation is by definition not a first visit.

let offlineShell: CaseResult | null = null;

test("C29 supplementary: the service-worker-served load shows 0 frames in the wrong theme", async ({
  browser,
  baseURL,
}) => {
  offlineShell = await captureCase(
    browser,
    {
      id: "service-worker-shell",
      storedChoice: "light",
      osScheme: "dark",
      expected: "light",
      description:
        "The app opened once so the service worker activates, then navigated again. The measured navigation is served by the offline shell, not by the network.",
      warmUpServiceWorker: true,
    },
    baseURL!,
  );
  writeEvidence("c29-service-worker-shell.json", { line: "C29", supplementary: true, ...offlineShell });

  console.log(
    `[C29] service-worker shell: ${offlineShell.framesExamined} frames examined, ` +
      `${offlineShell.framesInWrongTheme} in the wrong theme, ` +
      `controlled by the service worker: ${offlineShell.serviceWorkerControlled}`,
  );

  // A run where the service worker never took control would be an ordinary
  // network load wearing this test's name.
  expect(
    offlineShell.serviceWorkerControlled,
    "the measured navigation was not served by the service worker, so this proves nothing about the offline shell",
  ).toBe(true);
  expect(offlineShell.framesExamined).toBeGreaterThan(0);
  expect(offlineShell.framesByClass.sentinel).toBeGreaterThan(0);
  expect(offlineShell.htmlClassAtFirstRaf).toContain(LIGHT_CLASS);
  expect(offlineShell.framesInWrongTheme).toBe(0);
});

// ---------------------------------------------------------------------------
// Negative control
//
// A run that reports zero is only worth reading if the same run can report
// one. Four clean cases with a handful of frames each could equally mean "no
// flash" or "the capture was blind". So the same capture is run once more with
// a deliberate one-frame flash injected ahead of first paint, from the test
// side only: an init script strips the light scope in the first animation
// frame callback, which lands before this document's first paint, and puts it
// back in the next. If the harness counts zero here it is not measuring
// anything and the four numbers above mean nothing.
//
// The injection is a test-side init script. No application code is touched.

const CONTROL_FLASH = `
(function () {
  if (!location.protocol.startsWith('http')) return;
  requestAnimationFrame(function () {
    var r = document.documentElement;
    var wasLight = r.classList.contains('${LIGHT_CLASS}');
    r.classList.remove('${LIGHT_CLASS}');
    r.style.colorScheme = 'dark';
    requestAnimationFrame(function () {
      if (wasLight) r.classList.add('${LIGHT_CLASS}');
      r.style.colorScheme = 'light';
    });
  });
})();
`;

let control: CaseResult | null = null;

test("C29 negative control: an injected one-frame flash is counted, so zero means zero", async ({
  browser,
  baseURL,
}) => {
  const base = CASES.find((c) => c.id === "stored-light")!;
  control = await captureCase(browser, { ...base, id: "control-injected-flash" }, baseURL!, CONTROL_FLASH);
  writeEvidence("c29-control-injected-flash.json", { line: "C29", control: true, ...control });

  console.log(
    `[C29] control: ${control.framesExamined} frames examined, ` +
      `${control.framesInWrongTheme} in the wrong theme ` +
      `(sentinel ${control.framesByClass.sentinel}, light ${control.framesByClass.light}, ` +
      `dark ${control.framesByClass.dark})`,
  );

  expect(
    control.framesInWrongTheme,
    "the harness did not see a flash that was deliberately painted, so its zeroes prove nothing",
  ).toBeGreaterThan(0);
});

test("C29 summary across all four cases", async () => {
  expect(results, "not every case ran").toHaveLength(CASES.length);
  expect(control, "the negative control did not run").not.toBeNull();
  expect(offlineShell, "the service-worker case did not run").not.toBeNull();

  const summary = {
    line: "C29",
    claim:
      "No flash of the wrong theme on first paint: a cold load captured in each of the 3 stored states shows 0 frames rendered in the other theme.",
    method:
      "CDP Page.startScreencast at everyNthFrame 1, png, capped at the 390x844 viewport with deviceScaleFactor 1. " +
      "Frames are buffered and acked on the hot path and decoded afterwards through createImageBitmap in a separate " +
      "context. Each frame is classified by the colour covering most of it, matched against the ground tokens in " +
      "src/app/globals.css. The tab is painted #ff00ff before navigation so frames still showing the old document " +
      "cannot be mistaken for a theme.",
    storedStatesCovered:
      "3 stored states, 4 cases: 'no stored preference' is measured under both prefers-color-scheme: light and dark, " +
      "because the OS gives that state two different answers.",
    totalFramesExamined: results.reduce((n, r) => n + r.framesExamined, 0),
    totalFramesInWrongTheme: results.reduce((n, r) => n + r.framesInWrongTheme, 0),
    // The instrument, calibrated. A deliberate one-frame flash injected from
    // the test side on the stored-light case, counted by the same classifier.
    negativeControl: {
      framesExamined: control!.framesExamined,
      framesInWrongTheme: control!.framesInWrongTheme,
      framesByClass: control!.framesByClass,
    },
    // Outside the four scored cases on purpose: a service-worker-served
    // navigation is not a first visit. Reported because it is the load a
    // returning collector actually gets.
    supplementaryServiceWorkerShell: {
      framesExamined: offlineShell!.framesExamined,
      framesInWrongTheme: offlineShell!.framesInWrongTheme,
      framesByClass: offlineShell!.framesByClass,
      serviceWorkerControlled: offlineShell!.serviceWorkerControlled,
    },
    cases: results.map((r) => ({
      case: r.case,
      storedChoice: r.storedChoice,
      osPrefersColorScheme: r.osPrefersColorScheme,
      expectedTheme: r.expectedTheme,
      framesExamined: r.framesExamined,
      framesInWrongTheme: r.framesInWrongTheme,
      documentFrames: r.documentFrames,
      framesByClass: r.framesByClass,
      firstContentfulPaintMs: r.firstContentfulPaintMs,
      htmlClassAtFirstRaf: r.htmlClassAtFirstRaf,
      colorSchemeAtFirstRaf: r.colorSchemeAtFirstRaf,
    })),
  };
  const file = writeEvidence("c29-theme-flash.json", summary);
  console.log(
    `[C29] ${summary.totalFramesExamined} frames examined across ${results.length} cases, ` +
      `${summary.totalFramesInWrongTheme} in the wrong theme -> ${file}`,
  );

  expect(summary.totalFramesInWrongTheme).toBe(0);
});
