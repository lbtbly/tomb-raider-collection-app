// F58 evidence: a camera scan resolves an identifier on a device with a
// camera, and typed entry reaches the same verdict on a device without one.
// Both halves, one run, printed as numbers.
//
// A camera cannot be tested in headless Chromium without a fake stream, so
// this drives four devices, not one:
//   A  camera present   --use-fake-device-for-media-stream plus a Y4M file
//                       carrying a real printed EAN-13, decoded by the
//                       platform BarcodeDetector. No stub, no injected
//                       result: the browser reads the bars.
//   B  no camera        the same identifier typed. The two verdicts are
//                       compared field by field; a difference fails the run.
//   C  no BarcodeDetector  the API deleted before any app code runs, which
//                       is the state MDN's "Limited availability" describes.
//   D  camera refused   getUserMedia rejects with NotAllowedError.
// C and D both assert the degraded sentence renders AND that typed entry
// still reaches the same verdict, because F56 says no state is a dead end.
//
//   G  UPC-A, owned      the format that is the MAJORITY of this catalogue's
//                       scannable barcodes: 30 barcode_upca rows against 21
//                       barcode_ean13. macOS Vision reports a UPC-A symbol
//                       as format "ean_13" with a leading zero, so the row
//                       stored as 743175952919 scans as 0743175952919 and
//                       missed the on-device lookup entirely. Scanned,
//                       added to the collection, scanned again: OWNED.
//   H  UPC-A, collision  the one cross-form pair the real catalogue holds
//                       (848064011972 as UPC-A on one variant,
//                       0848064011972 as EAN-13 on another). Both spellings
//                       now find both variants, which must render UNCERTAIN
//                       with 2 candidates and never a silent pick.
//
// G and H exist because F58's first pass proved only the format that already
// worked: its fixture was a genuine EAN-13. A unit test does not close this,
// because the two paths that disagreed were the scan path and the lookup
// path, not two branches of one function.
//
// Run:
//   node .forge/evidence/scan/make-barcode-y4m.mjs 5032921014762 /tmp/vitrine-scan-ean13.y4m
//   node .forge/evidence/scan/make-barcode-y4m.mjs 743175952919 /tmp/vitrine-scan-upca.y4m
//   node .forge/evidence/scan/make-barcode-y4m.mjs 848064011972 /tmp/vitrine-scan-upca-collision.y4m
//   VITRINE_BASE_URL=http://localhost:3210 node .forge/evidence/scan/scan-evidence.mjs /tmp/vitrine-scan-ean13.y4m

import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.VITRINE_BASE_URL ?? "http://localhost:3210";
const Y4M = process.argv[2] ?? "/tmp/vitrine-scan-ean13.y4m";
const IDENTIFIER = process.env.VITRINE_SCAN_IDENTIFIER ?? "5032921014762";

// The UPC-A fixtures. Both are real catalogue values, printed on real packs:
// 743175952919 is Tomb Raider NTSC-U (the same variant that carries
// SLUS-00152); 848064011972 is the Record Store Day 2LP that the catalogue
// also holds a second time as the EAN-13 0848064011972.
const UPCA_Y4M = process.env.VITRINE_UPCA_Y4M ?? "/tmp/vitrine-scan-upca.y4m";
const UPCA_PRINTED = "743175952919";
const UPCA_TITLE = "Tomb Raider";
const UPCA_VARIANT = "NTSC-U (United States)";
const COLLISION_Y4M = process.env.VITRINE_UPCA_COLLISION_Y4M ?? "/tmp/vitrine-scan-upca-collision.y4m";
const COLLISION_PRINTED = "848064011972";
const SHOTS = path.join(HERE, "shots");
mkdirSync(SHOTS, { recursive: true });

const VIEWPORT = { width: 390, height: 844 };

// Records every stream getUserMedia hands out, so "the camera stopped" is a
// measured track state and not an assumption about a cleanup function.
const TRACK_PROBE = `
  (() => {
    window.__vitrineTracks = [];
    const md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) return;
    const original = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => {
      const stream = await original(c);
      for (const track of stream.getTracks()) window.__vitrineTracks.push(track);
      return stream;
    };
  })();
`;

function attach(page, sink) {
  page.on("console", (m) => {
    if (m.type() === "error") sink.consoleErrors.push(m.text());
    if (m.type() === "warning") sink.consoleWarnings.push(m.text());
  });
  page.on("pageerror", (e) => sink.pageErrors.push(String(e)));
  page.on("requestfailed", (r) => sink.requestFailures.push(`${r.url()} ${r.failure()?.errorText}`));
}

async function readVerdict(page) {
  return page.evaluate(() => {
    const slab = document.querySelector('[data-testid="verdict"]');
    const word = document.querySelector('[data-testid="verdict-word"]');
    const note = document.querySelector('[data-testid="scan-note"]');
    const input = document.querySelector("#check-identifier");
    const scanHeader = document.querySelector(".scanh .mono");
    return {
      kind: slab?.getAttribute("data-verdict") ?? null,
      word: word?.textContent?.trim() ?? null,
      slabText: slab?.innerText?.replace(/\s+/g, " ").trim() ?? null,
      note: note?.textContent?.trim() ?? null,
      inputValue: input instanceof HTMLInputElement ? input.value : null,
      scanHeaderIdentifier: scanHeader?.textContent?.trim() ?? null,
      documentScrollWidth: document.documentElement.scrollWidth,
      devicePixelRatio: window.devicePixelRatio,
      bodyZoom: getComputedStyle(document.body).zoom,
    };
  });
}

async function newDevice({ args = [], init = [], permissions = [], serviceWorkers = "allow" } = {}) {
  const browser = await chromium.launch({ args });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    permissions,
    serviceWorkers,
  });
  for (const script of [TRACK_PROBE, ...init]) await context.addInitScript(script);
  const page = await context.newPage();
  const sink = { consoleErrors: [], consoleWarnings: [], pageErrors: [], requestFailures: [] };
  attach(page, sink);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="scan-control"]', { timeout: 15000 });
  return { browser, context, page, sink };
}

async function typedCheck(page, identifier) {
  await page.fill("#check-identifier", identifier);
  await page.click('form button[type="submit"]');
  await page.waitForSelector('[data-testid="verdict"]', { timeout: 15000 });
  return readVerdict(page);
}

const report = {};
let failures = 0;
const say = (s) => process.stdout.write(s + "\n");
const check = (label, ok, detail) => {
  if (!ok) failures++;
  say(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
};

// ---------------------------------------------------------------------
// A. A device with a camera
// ---------------------------------------------------------------------
{
  say("");
  say("A  camera present, real BarcodeDetector decode of a printed EAN-13");
  const dev = await newDevice({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-video-capture=${Y4M}`,
    ],
    permissions: ["camera"],
  });
  const { page, sink } = dev;

  const support = await page.evaluate(async () => ({
    hasDetector: typeof window.BarcodeDetector === "function",
    formats: typeof window.BarcodeDetector === "function"
      ? await window.BarcodeDetector.getSupportedFormats()
      : null,
    secureContext: window.isSecureContext,
  }));
  say(`   BarcodeDetector ${support.hasDetector}, secureContext ${support.secureContext}`);
  say(`   formats reported by the device: ${JSON.stringify(support.formats)}`);

  const t0 = Date.now();
  await page.click('[data-testid="scan-toggle"]');
  await page.waitForSelector('[data-testid="scan-view"]', { timeout: 5000 });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="scan-toggle"]')?.getAttribute("data-scan-phase") === "live",
    null,
    { timeout: 15000 },
  );
  const liveAt = Date.now() - t0;
  const liveShape = await page.evaluate(() => {
    const view = document.querySelector('[data-testid="scan-view"]');
    const video = view?.querySelector("video");
    const r = view?.getBoundingClientRect();
    const cs = view ? getComputedStyle(view) : null;
    return {
      viewBox: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
      videoSize: video ? { w: video.videoWidth, h: video.videoHeight } : null,
      videoPaused: video?.paused ?? null,
      borderRadius: cs?.borderRadius ?? null,
      clipPath: cs?.clipPath ?? null,
      scrollWidth: document.documentElement.scrollWidth,
      note: document.querySelector('[data-testid="scan-note"]')?.textContent?.trim() ?? null,
      tracks: window.__vitrineTracks.map((t) => t.readyState),
    };
  });
  say(`   camera live in ${liveAt} ms, view ${JSON.stringify(liveShape.viewBox)}, frame ${JSON.stringify(liveShape.videoSize)}`);
  say(`   live note: ${JSON.stringify(liveShape.note)}`);
  await page.screenshot({ path: path.join(SHOTS, "a1-camera-live.png") });

  await page.waitForSelector('[data-testid="verdict"]', { timeout: 20000 });
  const decodeMs = Date.now() - t0;
  const scanned = await readVerdict(page);
  const after = await page.evaluate(() => ({
    tracks: window.__vitrineTracks.map((t) => t.readyState),
    viewStillOpen: !!document.querySelector('[data-testid="scan-view"]'),
    toggleLabel: document.querySelector('[data-testid="scan-toggle"]')?.textContent?.trim() ?? null,
  }));
  // The verdict slab wipes in over 220ms; a capture taken the instant it
  // mounts shows a half-revealed word and reads as a clipping defect it is
  // not. Let the motion finish before the evidence frame.
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, "a2-scan-verdict.png") });

  say(`   decode to verdict in ${decodeMs} ms`);
  say(`   scanned value in the input: ${JSON.stringify(scanned.inputValue)}`);
  say(`   verdict: ${scanned.kind} / ${JSON.stringify(scanned.word)}`);
  say(`   note after decode: ${JSON.stringify(scanned.note)}`);

  check("camera view opened and played", liveShape.videoPaused === false && liveShape.videoSize?.w > 0);
  check("scanned identifier equals the printed one", scanned.inputValue === IDENTIFIER, `${scanned.inputValue}`);
  check("scan header carries the identifier", scanned.scanHeaderIdentifier === IDENTIFIER);
  check("a verdict rendered", !!scanned.kind, scanned.kind ?? "");
  check("camera view closed itself after the decode", after.viewStillOpen === false);
  check("every media track ended after the decode", after.tracks.length > 0 && after.tracks.every((s) => s === "ended"), JSON.stringify(after.tracks));
  check("radius 0 on the camera surface (C9)", liveShape.borderRadius === "0px", liveShape.borderRadius ?? "");
  check("the 45 degree cut carries the corner (C9)", /polygon/.test(liveShape.clipPath ?? ""), (liveShape.clipPath ?? "").slice(0, 40));
  check("scrollWidth 390 with the camera open", liveShape.scrollWidth === 390, String(liveShape.scrollWidth));
  check("scrollWidth 390 after the verdict", scanned.documentScrollWidth === 390, String(scanned.documentScrollWidth));
  check("measured at scale 1", scanned.devicePixelRatio === 1 && (scanned.bodyZoom === "1" || scanned.bodyZoom === "normal"));

  // A stale confirmation is a lie the next check would carry: type a
  // different identifier and the camera line must be gone.
  const afterTypingSomethingElse = await typedCheck(page, "SLUS-99999");
  check(
    "the camera confirmation clears when a typed check replaces the verdict",
    afterTypingSomethingElse.note === null,
    JSON.stringify(afterTypingSomethingElse.note),
  );

  report.A = { support, liveAt, decodeMs, scanned, after, liveShape, sink };
  await dev.browser.close();
}

// ---------------------------------------------------------------------
// B. A device with no camera, the same identifier typed
// ---------------------------------------------------------------------
{
  say("");
  say("B  no camera, the same identifier typed");
  const dev = await newDevice({
    init: [
      `Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });`,
    ],
  });
  const { page, sink } = dev;
  const seen = await page.evaluate(() => ({
    mediaDevices: typeof navigator.mediaDevices,
    toggleRendered: !!document.querySelector('[data-testid="scan-toggle"]'),
  }));
  const typed = await typedCheck(page, IDENTIFIER);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, "b1-typed-verdict.png") });
  say(`   navigator.mediaDevices is ${seen.mediaDevices}`);
  say(`   verdict: ${typed.kind} / ${JSON.stringify(typed.word)}`);

  const a = report.A.scanned;
  check("same verdict kind as the scan", typed.kind === a.kind, `${typed.kind} vs ${a.kind}`);
  check("same verdict word as the scan", typed.word === a.word, `${JSON.stringify(typed.word)} vs ${JSON.stringify(a.word)}`);
  check("same rendered verdict body as the scan", typed.slabText === a.slabText);
  check("scrollWidth 390", typed.documentScrollWidth === 390, String(typed.documentScrollWidth));
  report.B = { seen, typed, sink };
  await dev.browser.close();
}

// ---------------------------------------------------------------------
// C. A browser with no BarcodeDetector
// ---------------------------------------------------------------------
{
  say("");
  say("C  no BarcodeDetector, the state MDN's limited availability describes");
  const dev = await newDevice({
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    permissions: ["camera"],
    init: [`delete window.BarcodeDetector;`],
  });
  const { page, sink } = dev;
  const gone = await page.evaluate(() => typeof window.BarcodeDetector);
  // Nothing is clicked here on purpose. The product does not offer a scan
  // control it cannot honour: detection runs on mount and the sentence is
  // already on screen, so a collector on such a browser never reaches for a
  // button that does nothing.
  await page.waitForSelector('[data-testid="scan-note"]', { timeout: 5000 });
  const state = await page.evaluate(() => ({
    note: document.querySelector('[data-testid="scan-note"]')?.textContent?.trim() ?? null,
    unsettled: document.querySelector('[data-testid="scan-note"]')?.className ?? null,
    toggleStillThere: !!document.querySelector('[data-testid="scan-toggle"]'),
    viewOpened: !!document.querySelector('[data-testid="scan-view"]'),
    inputEnabled: !document.querySelector("#check-identifier")?.disabled,
    tracks: window.__vitrineTracks.length,
  }));
  await page.screenshot({ path: path.join(SHOTS, "c1-unsupported.png") });
  say(`   window.BarcodeDetector is ${gone}`);
  say(`   note: ${JSON.stringify(state.note)}`);
  const typed = await typedCheck(page, IDENTIFIER);
  say(`   typed verdict after the refusal: ${typed.kind}`);
  check("the unsupported sentence rendered", state.note === "This browser cannot scan a barcode with the camera. Type the identifier above instead.");
  check("no scan control is offered on a browser that cannot honour it", state.toggleStillThere === false);
  check("no camera was ever opened", state.tracks === 0);
  check("no camera view opened", state.viewOpened === false);
  check("typed entry still reaches the same verdict (F56, not a dead end)", typed.kind === report.A.scanned.kind && typed.slabText === report.A.scanned.slabText);
  report.C = { gone, state, typed, sink };
  await dev.browser.close();
}

// ---------------------------------------------------------------------
// D. The camera is refused
// ---------------------------------------------------------------------
{
  say("");
  say("D  camera refused, NotAllowedError from getUserMedia");
  const dev = await newDevice({
    init: [
      `(() => {
         const md = navigator.mediaDevices;
         md.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
       })();`,
    ],
  });
  const { page, sink } = dev;
  await page.click('[data-testid="scan-toggle"]');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="scan-toggle"]')?.getAttribute("data-scan-phase") === "error",
    null,
    { timeout: 10000 },
  );
  const state = await page.evaluate(() => ({
    note: document.querySelector('[data-testid="scan-note"]')?.textContent?.trim() ?? null,
    noteClass: document.querySelector('[data-testid="scan-note"]')?.className ?? null,
    toggleLabel: document.querySelector('[data-testid="scan-toggle"]')?.textContent?.trim() ?? null,
    viewOpen: !!document.querySelector('[data-testid="scan-view"]'),
    scrollWidth: document.documentElement.scrollWidth,
  }));
  await page.screenshot({ path: path.join(SHOTS, "d1-camera-refused.png") });
  say(`   note: ${JSON.stringify(state.note)}`);
  say(`   the control is offered again as: ${JSON.stringify(state.toggleLabel)}`);
  const typed = await typedCheck(page, IDENTIFIER);
  say(`   typed verdict after the refusal: ${typed.kind}`);
  check("the error sentence rendered", state.note === "The camera could not be read. Type the identifier above instead.");
  check("the unsettled marker is on the note (C30)", /\bbad\b/.test(state.noteClass ?? ""));
  check("the camera view is closed", state.viewOpen === false);
  check("the scan control is offered again", state.toggleLabel === "Scan with camera");
  check("typed entry still reaches the same verdict (F56, not a dead end)", typed.kind === report.A.scanned.kind && typed.slabText === report.A.scanned.slabText);
  check("scrollWidth 390", state.scrollWidth === 390, String(state.scrollWidth));
  report.D = { state, typed, sink };
  await dev.browser.close();
}

// ---------------------------------------------------------------------
// E. The camera stops on close and on a hidden tab
// ---------------------------------------------------------------------
{
  say("");
  say("E  the stream stops on close, on a hidden tab, and on unmount");
  const dev = await newDevice({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-video-capture=${Y4M}`,
    ],
    permissions: ["camera"],
    // A detector that finds nothing, installed before any app code runs.
    // The real one would end the stream by decoding on the first frame,
    // which is the happy path; this measures the three stop paths that are
    // not the happy one, so the camera has to keep running until something
    // deliberately stops it.
    init: [
      `window.BarcodeDetector = class {
         static async getSupportedFormats() { return ["ean_13"]; }
         async detect() { return []; }
       };`,
    ],
  });
  const { page, sink } = dev;

  const openAndConfirm = async () => {
    await page.click('[data-testid="scan-toggle"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="scan-toggle"]')?.getAttribute("data-scan-phase") === "live",
      null,
      { timeout: 15000 },
    );
    return page.evaluate(() => window.__vitrineTracks.map((t) => t.readyState));
  };

  const live1 = await openAndConfirm();
  await page.click('[data-testid="scan-toggle"]');
  await page.waitForSelector('[data-testid="scan-view"]', { state: "detached", timeout: 5000 });
  const afterClose = await page.evaluate(() => window.__vitrineTracks.map((t) => t.readyState));
  say(`   close button: tracks ${JSON.stringify(live1)} -> ${JSON.stringify(afterClose)}`);
  check("the close button ends every track", afterClose.length > 0 && afterClose.every((s) => s === "ended"));

  const live2 = await openAndConfirm();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForSelector('[data-testid="scan-view"]', { state: "detached", timeout: 5000 });
  const afterHide = await page.evaluate(() => window.__vitrineTracks.map((t) => t.readyState));
  say(`   hidden tab: tracks ${JSON.stringify(live2)} -> ${JSON.stringify(afterHide)}`);
  check("a hidden tab ends every track", afterHide.every((s) => s === "ended"));

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const live3 = await openAndConfirm();
  await page.click('a[href="/catalogue"]');
  await page.waitForURL("**/catalogue", { timeout: 15000 });
  // The URL changes inside the transition; React commits the unmount after.
  // Waiting on the control leaving the DOM measures the cleanup, not the
  // router.
  await page.waitForSelector('[data-testid="scan-control"]', { state: "detached", timeout: 10000 });
  const afterNav = await page.evaluate(() => window.__vitrineTracks.map((t) => t.readyState));
  say(`   navigation away: tracks ${JSON.stringify(live3)} -> ${JSON.stringify(afterNav)}`);
  check("unmounting the screen ends every track", afterNav.every((s) => s === "ended"));

  report.E = { live1, afterClose, live2, afterHide, live3, afterNav, sink };
  await dev.browser.close();
}

// ---------------------------------------------------------------------
// F. The standing guard, with the camera open
// ---------------------------------------------------------------------
// check:ui audits every built route, but it never opens the camera, so the
// live state would be the one surface in the product no guard has ever
// looked at. Same instrument (scripts/ui-audit.js), same rules, run against
// the camera view itself in both themes at 390 and 1440, and once more
// under the pseudo-locale where every string is 40 percent longer.
{
  say("");
  say("F  scripts/ui-audit.js against the open camera view");
  const auditSrc = readFileSync(path.join(HERE, "..", "..", "..", "scripts", "ui-audit.js"), "utf8");
  const dev = await newDevice({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-video-capture=${Y4M}`,
    ],
    permissions: ["camera"],
    serviceWorkers: "block",
    init: [
      `window.BarcodeDetector = class {
         static async getSupportedFormats() { return ["ean_13"]; }
         async detect() { return []; }
       };`,
    ],
  });
  const { page, sink } = dev;
  const rows = [];
  for (const locale of ["en", "pseudo"]) {
    for (const theme of ["dark", "light"]) {
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
        await page.addInitScript(`localStorage.setItem("vitrine:theme", ${JSON.stringify(theme)});`);
        await page.goto(locale === "pseudo" ? `${BASE}/?locale=pseudo` : BASE, { waitUntil: "networkidle" });
        // Same injection the standing guard uses (scripts/checks/ui.mjs),
        // so this measures with the same instrument, not a copy of it.
        await page.addScriptTag({ content: auditSrc });
        await page.click('[data-testid="scan-toggle"]');
        await page.waitForFunction(
          () => document.querySelector('[data-testid="scan-toggle"]')?.getAttribute("data-scan-phase") === "live",
          null,
          { timeout: 15000 },
        );
        const r = await page.evaluate(() => window.uiAudit({ primarySelector: 'form button[type="submit"]' }));
        const toggle = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="scan-toggle"]');
          const box = el.getBoundingClientRect();
          const note = document.querySelector('[data-testid="scan-note"]');
          return {
            w: Math.round(box.width),
            h: Math.round(box.height),
            label: el.textContent.trim(),
            note: note?.textContent?.trim() ?? null,
          };
        });
        rows.push({ locale, theme, width, r, toggle });
        if (width === 390 && locale === "en") {
          await page.screenshot({ path: path.join(SHOTS, `f-camera-${theme}-390.png`) });
        }
        if (width === 390 && locale === "pseudo") {
          await page.screenshot({ path: path.join(SHOTS, `f-camera-pseudo-${theme}-390.png`) });
        }
      }
    }
  }
  const sum = (pick) => rows.reduce((n, row) => n + pick(row.r), 0);
  const overflow = sum((r) => r.overflowCount);
  const contrast = sum((r) => r.contrastFailures.length);
  const tap = sum((r) => r.tapUnder44);
  const primary = sum((r) => r.primaryUnder56.length);
  const radii = sum((r) => r.nonZeroRadii);
  const offScale = sum((r) => r.offScaleSpacing.length);
  const emDash = sum((r) => r.copy.emDash);
  const emoji = sum((r) => r.copy.emoji);
  const banned = sum((r) => r.copy.banned.length);
  const dimOverPhoto = sum((r) => r.dimTextOverPhotograph.length);
  const widest390 = Math.max(
    ...rows.filter((row) => row.width === 390).map((row) => row.r.viewport.w),
  );
  const scrollWidths390 = await page.evaluate(() => document.documentElement.scrollWidth);
  for (const row of rows) {
    say(
      `   ${row.locale.padEnd(6)} ${row.theme.padEnd(5)} ${String(row.width).padEnd(5)} ` +
        `overflow ${row.r.overflowCount}  contrast ${row.r.contrastFailures.length}  ` +
        `tap<44 ${row.r.tapUnder44}  primary<56 ${row.r.primaryUnder56.length}  ` +
        `radii ${row.r.nonZeroRadii}  scan control ${row.toggle.w}x${row.toggle.h}`,
    );
    if (row.r.overflow.length) say(`      ${JSON.stringify(row.r.overflow.slice(0, 3))}`);
    if (row.r.contrastFailures.length) say(`      ${JSON.stringify(row.r.contrastFailures.slice(0, 3))}`);
    if (row.r.tapSample.length) say(`      ${JSON.stringify(row.r.tapSample.slice(0, 3))}`);
  }
  const pseudoRow = rows.find((row) => row.locale === "pseudo");
  say(`   pseudo-locale scan control label: ${JSON.stringify(pseudoRow.toggle.label)}`);
  say(`   pseudo-locale live note: ${JSON.stringify(pseudoRow.toggle.note)}`);

  check("0 overflow with the camera open, 16 combinations", overflow === 0, String(overflow));
  check("0 contrast failures with the camera open", contrast === 0, String(contrast));
  check("0 targets under 44 with the camera open (C7)", tap === 0, String(tap));
  check("0 primary controls under 56 (F11)", primary === 0, String(primary));
  check("the scan control is at least 56 on its shortest side", rows.every((row) => Math.min(row.toggle.w, row.toggle.h) >= 56), `${rows[0].toggle.w}x${rows[0].toggle.h}`);
  check("0 non-zero radii with the camera open (C9)", radii === 0, String(radii));
  check("0 off-scale spacing values (C8)", offScale === 0, String(offScale));
  check("0 em dashes, 0 emoji, 0 banned words (C19)", emDash + emoji + banned === 0, `${emDash}/${emoji}/${banned}`);
  check("no dim text over the camera image (C25)", dimOverPhoto === 0, String(dimOverPhoto));
  check("scrollWidth 390 stays 390", widest390 === 390 && scrollWidths390 > 0, String(widest390));
  check(
    "every scan string transforms under the pseudo-locale (C16)",
    rows.filter((row) => row.locale === "pseudo").every((row) => /^⟦.*⟧$/.test(row.toggle.label) && /^⟦.*⟧$/.test(row.toggle.note ?? "")),
    JSON.stringify(pseudoRow.toggle.label),
  );
  report.F = { rows: rows.map((row) => ({ locale: row.locale, theme: row.theme, width: row.width, toggle: row.toggle })), sink };
  await dev.browser.close();
}

// ---------------------------------------------------------------------
// G. A UPC-A, the format that is the majority of this catalogue
// ---------------------------------------------------------------------
// 30 of the 51 scannable barcodes here are barcode_upca at 12 digits. macOS
// Vision, which backs BarcodeDetector in Chromium on this platform, reports
// a UPC-A symbol as format "ean_13" with a leading zero restored, so
// 743175952919 arrives as 0743175952919. 29 of those 30 rows resolved to
// NOTHING before the lookup was widened, which is precisely the failure the
// product exists to prevent: a collector holding the object, being told they
// do not own it.
//
// Scanned once, added to the collection, scanned again. The second scan is
// the one that matters: it is the aisle.
{
  say("");
  say("G  UPC-A, the majority format, decoded and resolved end to end");
  const dev = await newDevice({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-video-capture=${UPCA_Y4M}`,
    ],
    permissions: ["camera"],
  });
  const { page, sink } = dev;

  // Marks the slab on screen before scanning, then waits for an UNMARKED
  // one. Waiting on [data-testid="verdict"] alone would return instantly on
  // the second scan, because the previous verdict is still mounted, and the
  // harness would read a stale answer as a fresh one. VerdictSlab remounts
  // per result (its key carries the check sequence number), so the mark
  // cannot survive a real new verdict.
  const scanOnce = async () => {
    await page.evaluate(() =>
      document.querySelector('[data-testid="verdict"]')?.setAttribute("data-stale", "1"),
    );
    await page.click('[data-testid="scan-toggle"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="scan-toggle"]')?.getAttribute("data-scan-phase") === "live",
      null,
      { timeout: 15000 },
    );
    await page.waitForSelector('[data-testid="verdict"]:not([data-stale])', { timeout: 20000 });
    return readVerdict(page);
  };

  const first = await scanOnce();
  const detail = await page.evaluate(() => ({
    monoLines: [...document.querySelectorAll('[data-testid="verdict"] .vlead.mono')].map((el) =>
      el.textContent.trim(),
    ),
    hasDoors: !!document.querySelector('[data-testid="verdict"] .doorList'),
    nothingFoundLead: /No entry found for this identifier/i.test(
      document.querySelector('[data-testid="verdict"]')?.innerText ?? "",
    ),
    addLabel:
      document.querySelector('[data-testid="verdict"] button.pri')?.textContent?.trim() ?? null,
  }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, "g1-upca-recognized.png") });

  say(`   printed on the pack:      ${UPCA_PRINTED}  (12 digits, barcode_upca)`);
  say(`   what the decoder returned: ${JSON.stringify(first.inputValue)}`);
  say(`   digits returned: ${String(first.inputValue ?? "").length}, ` +
      `leading zero: ${String(first.inputValue ?? "").startsWith("0")}`);
  say(`   verdict: ${first.kind} / ${JSON.stringify(first.word)}`);
  say(`   the row it resolved to: ${JSON.stringify(detail.monoLines)}`);

  // The decoder is allowed to report either spelling; the point of the fix
  // is that BOTH resolve. Which one it reported is recorded, not assumed.
  const returned = String(first.inputValue ?? "");
  const isThirteen = returned === `0${UPCA_PRINTED}`;
  check(
    "the decoder returned one of the two legitimate spellings of the printed UPC-A",
    returned === UPCA_PRINTED || isThirteen,
    returned,
  );
  check(
    "the platform reported the 13-digit EAN-13 form, the read that used to miss",
    isThirteen,
    isThirteen ? "0" + UPCA_PRINTED : `reported ${returned}, so this platform hands back 12 digits`,
  );
  check("a verdict rendered", !!first.kind, first.kind ?? "");
  check(
    "the scan RESOLVED to a catalogue row rather than finding nothing",
    detail.monoLines.length > 0 && detail.monoLines.some((l) => l.includes(UPCA_TITLE)),
    JSON.stringify(detail.monoLines),
  );
  check(
    "it resolved to the right variant, not merely to something",
    detail.monoLines.some((l) => l.includes(UPCA_VARIANT)),
    JSON.stringify(detail.monoLines),
  );
  check(
    "not the nothing-found state: the three doors are not on screen",
    detail.hasDoors === false,
  );
  check(
    'not the nothing-found state: "No entry found for this identifier." is absent',
    detail.nothingFoundLead === false,
  );
  check("scrollWidth 390 after the UPC-A verdict", first.documentScrollWidth === 390, String(first.documentScrollWidth));

  // Now own it, and scan it again. This is the aisle: the object is in the
  // collection, the barcode is on the pack, and the answer has to be OWNED.
  //
  // Guarded rather than clicked blind: with the alternate-form lookup
  // removed (the negative control for this section) the scan finds nothing,
  // so there is no "Add to collection" button and a bare click would throw
  // and take the whole run down instead of reporting the failure it found.
  const addable = await page.$('[data-testid="verdict"] button.pri');
  check("the recognized row offers an add control to own it", !!addable);
  if (!addable) {
    say("   no add control, so the OWNED half of G cannot be exercised");
    check("scanning the UPC-A of an owned object answers OWNED", false, "not reached");
    check("the printed 12 digits typed by hand reach the same verdict as the scan", false, "not reached");
    report.G = { first, detail, returned, sink };
    await dev.browser.close();
  } else {
  await addable.click();
  await page.waitForFunction(
    () => /Saved to your collection/i.test(document.querySelector('[data-testid="verdict"]')?.innerText ?? ""),
    null,
    { timeout: 10000 },
  );
  const second = await scanOnce();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, "g2-upca-owned.png") });
  say(`   after adding the copy, the same scan reads: ${second.kind} / ${JSON.stringify(second.word)}`);

  check(
    "scanning the UPC-A of an owned object answers OWNED",
    second.kind === "OWNED",
    second.kind ?? "",
  );

  // And the typed 12-digit form, the digits a collector reads off the pack
  // when the camera will not focus, reaches the same verdict.
  const typed = await typedCheck(page, UPCA_PRINTED);
  say(`   the same 12 digits typed by hand read: ${typed.kind}`);
  check(
    "the printed 12 digits typed by hand reach the same verdict as the scan",
    typed.kind === second.kind && typed.slabText === second.slabText,
    `${typed.kind} vs ${second.kind}`,
  );

  report.G = { first, second, typed, detail, returned, sink };
  await dev.browser.close();
  }
}

// ---------------------------------------------------------------------
// H. The one cross-form collision the real catalogue holds
// ---------------------------------------------------------------------
// 848064011972 is a barcode_upca on variant XHHA2C9ZS3; 0848064011972 is a
// barcode_ean13 on variant Y06VKB564M. Two spellings of one number on two
// different variants. Widening the lookup makes them collide, and a
// collision is what UNCERTAIN is for: 2 candidates of identical weight,
// never a silent pick. The duplicate is a catalogue correction, not a
// lookup change, and is deliberately not special-cased here.
{
  say("");
  say("H  the cross-form collision, which must stay UNCERTAIN and never pick");
  const dev = await newDevice({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-video-capture=${COLLISION_Y4M}`,
    ],
    permissions: ["camera"],
  });
  const { page, sink } = dev;

  await page.click('[data-testid="scan-toggle"]');
  await page.waitForSelector('[data-testid="verdict"]', { timeout: 20000 });
  const scanned = await readVerdict(page);
  const cands = await page.evaluate(() => ({
    labels: [...document.querySelectorAll('[data-testid="verdict"] .candLabel')].map((el) =>
      el.textContent.trim(),
    ),
    badges: [...document.querySelectorAll('[data-testid="verdict"] .candBadge')].map((el) =>
      el.textContent.trim(),
    ),
    buttonClasses: [...document.querySelectorAll('[data-testid="verdict"] .candidateRow button')].map(
      (el) => el.className,
    ),
    moreLine: [...document.querySelectorAll('[data-testid="verdict"] .vcache')]
      .map((el) => el.textContent.trim())
      .find((t) => /also match/i.test(t)) ?? null,
  }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, "h1-crossform-uncertain.png") });

  say(`   printed on the pack:       ${COLLISION_PRINTED}  (barcode_upca on XHHA2C9ZS3)`);
  say(`   the same number as EAN-13: 0${COLLISION_PRINTED}  (barcode_ean13 on Y06VKB564M)`);
  say(`   what the decoder returned: ${JSON.stringify(scanned.inputValue)}`);
  say(`   verdict: ${scanned.kind} / ${JSON.stringify(scanned.word)}`);
  say(`   candidates: ${JSON.stringify(cands.labels)}`);
  say(`   badges: ${JSON.stringify(cands.badges)}`);
  say(`   overflow line: ${JSON.stringify(cands.moreLine)}`);

  check("the cross-form collision renders UNCERTAIN", scanned.kind === "UNCERTAIN", scanned.kind ?? "");
  check("exactly 2 candidates are offered", cands.labels.length === 2, String(cands.labels.length));
  check(
    "both spellings' variants are named, so neither was silently dropped",
    cands.labels.some((l) => /RSD Drops 2021/i.test(l)) &&
      cands.labels.some((l) => /gold vinyl/i.test(l)),
    JSON.stringify(cands.labels),
  );
  check(
    "the 2 candidates carry identical weight, neither promoted",
    cands.buttonClasses.length === 2 &&
      new Set(cands.buttonClasses).size === 1 &&
      cands.buttonClasses.every((c) => !/\bpri\b/.test(c)),
    JSON.stringify(cands.buttonClasses),
  );
  check("no phantom overflow count", cands.moreLine === null, JSON.stringify(cands.moreLine));
  check("scrollWidth 390 on the UNCERTAIN slab", scanned.documentScrollWidth === 390, String(scanned.documentScrollWidth));

  // The 12-digit spelling typed by hand has to reach the same 2 candidates:
  // the equivalence runs in both directions or a device that reports 12
  // digits gets a different answer from one that reports 13.
  const typed = await typedCheck(page, COLLISION_PRINTED);
  const typedCands = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="verdict"] .candLabel')].map((el) => el.textContent.trim()),
  );
  say(`   typed ${COLLISION_PRINTED}: ${typed.kind}, candidates ${JSON.stringify(typedCands)}`);
  check(
    "the 12-digit spelling typed by hand reaches the same 2 candidates",
    typed.kind === "UNCERTAIN" && JSON.stringify(typedCands) === JSON.stringify(cands.labels),
    `${typed.kind} ${JSON.stringify(typedCands)}`,
  );

  report.H = { scanned, cands, typed, typedCands, sink };
  await dev.browser.close();
}

// ---------------------------------------------------------------------
say("");
say("console health");
let consoleErrors = 0;
let pageErrors = 0;
for (const [name, r] of Object.entries(report)) {
  const s = r.sink;
  consoleErrors += s.consoleErrors.length;
  pageErrors += s.pageErrors.length;
  say(
    `  ${name}: console errors ${s.consoleErrors.length}, page errors ${s.pageErrors.length}, failed requests ${s.requestFailures.length}`,
  );
  for (const line of [...s.consoleErrors, ...s.pageErrors].slice(0, 5)) say(`      ${line.slice(0, 160)}`);
}
check("0 console errors across all seven devices", consoleErrors === 0, String(consoleErrors));
check("0 uncaught page errors across all seven devices", pageErrors === 0, String(pageErrors));

say("");
say(failures === 0 ? `F58 SCAN EVIDENCE: PASS, 0 failures` : `F58 SCAN EVIDENCE: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
