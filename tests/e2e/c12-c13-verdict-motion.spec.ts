// C12 and C13, the halves that were never captured.
//
// C12. "The verdict slab arrives at full width in 220 ms with 0 opacity
//       change; captured as a frame sequence with the measured duration
//       recorded. Every other transition measures 140 ms on
//       cubic-bezier(.2,.8,.2,1); count of transitions off that duration or
//       curve is 0."
// C13. "With reduced motion requested, the verdict slab arrives with 0 travel
//       and 0 scale while the slab, its colour and its cut remain; captured."
//
// Both lines end in a capture. Both were previously recorded from the
// stylesheet: globals.css:387 declares `vslab-wipe 220ms
// cubic-bezier(0.2, 0.8, 0.2, 1) both`, and reading that declaration is not
// measuring the arrival. This file measures the arrival.
//
// Two independent instruments, because one instrument that has never been
// seen to fail is not an instrument:
//
//   1. A per-animation-frame sampler inside the page (requestAnimationFrame),
//      reading the wrapper's and the slab's computed clip-path, opacity,
//      transform and box on every frame the browser draws.
//   2. A CDP screencast, decoded pixel by pixel in Node from each frame's own
//      PNG bytes. This is the only one of the two that measures what a
//      collector sees: the wipe is a clip-path, so the element's LAYOUT BOX is
//      full width from the first frame while the PAINTED region is not. Both
//      widths are reported per frame and named.
//
// Four controls, because a frame counter that reports "no change" on a static
// element and on a moving one is measuring nothing:
//
//   A. a moving element, recorded by the same pixel instrument, must show
//      frames that differ and travel greater than 0;
//   B. a static element, same instrument, must show 0 differing frames;
//   C. a fading element, same sampler, must show more than one distinct
//      opacity and a changing pixel, so "0 opacity change" is a reading and
//      not a blindness;
//   D. reduced motion must be proven applied in the page
//      (matchMedia(...).matches) AND proven to reach CSS animation, by
//      neutralising control A's motion.

import { expect, test, type APIRequestContext, type CDPSession, type Page } from "@playwright/test";
import { inflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  assertScaleOne,
  assertServedBuildId,
  assertSubjectInCapture,
  capture,
  evidenceDir,
  pngSize,
  repoRelative,
  settle,
  writeEvidence,
} from "./harness";

const EXPECTED_BUILD_ID = process.env.VITRINE_EXPECTED_BUILD_ID ?? "YzDsr6hHAGTXS-1fwnrSm";

const DECLARED_SLAB_MS = 220;
const REQUIRED_OTHER_MS = 140;
const REQUIRED_CURVE = { x1: 0.2, y1: 0.8, x2: 0.2, y2: 1 };

const SEL = {
  input: "#check-identifier",
  submit: 'form button[type="submit"]',
  wipe: ".vslabWipe",
  slab: '[data-testid="verdict"]',
  word: '[data-testid="verdict-word"]',
  recognizedLabel: "section.vslab .vlead.mono",
  addToCollection: 'section.vslab button:has-text("Add to collection")',
};

// Well formed, in no catalogue. Reaches NOT IN COLLECTION with the three
// doors, needs no catalogue row, and carries the 18 px cut.
const UNKNOWN_IDENTIFIER = "SLUS-99999";

/** Resolved inside a test, never at module scope: repoRoot() reads
 * test.info(), which does not exist while Playwright is only collecting
 * files. */
function frameDir(): string {
  const dir = path.join(evidenceDir(), "motion-frames");
  mkdirSync(dir, { recursive: true });
  return dir;
}

const evidence: Record<string, unknown> = {};

// ---------------------------------------------------------------------------
// PNG, decoded here rather than trusted.
//
// pngSize reads the IHDR and answers how big the file says it is. Measuring a
// painted region needs the pixels. Written out in full, with no dependency, so
// the decoding is auditable alongside the numbers it produces.

type Raster = { width: number; height: number; channels: number; data: Uint8Array };

function decodePng(buf: Buffer): Raster {
  expect(buf.subarray(0, 8).toString("hex"), "not a PNG").toBe("89504e470d0a1a0a");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
    const body = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8]!;
      colorType = body[9]!;
      interlace = body[12]!;
    } else if (type === "IDAT") {
      idat.push(Buffer.from(body));
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  expect(bitDepth, "PNG bit depth this decoder handles").toBe(8);
  expect(interlace, "interlaced PNG").toBe(0);
  const channelsFor: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };
  const channels = channelsFor[colorType];
  expect(channels, `PNG colour type ${colorType} this decoder handles`).toBeTruthy();

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = channels!;
  const stride = width * bpp;
  const out = new Uint8Array(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prior = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp]! : 0;
      const b = prior ? prior[i]! : 0;
      const c = prior && i >= bpp ? prior[i - bpp]! : 0;
      const x = line[i]!;
      let value: number;
      switch (filter) {
        case 0:
          value = x;
          break;
        case 1:
          value = x + a;
          break;
        case 2:
          value = x + b;
          break;
        case 3:
          value = x + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`unknown PNG filter ${filter} on row ${y}`);
      }
      cur[i] = value & 0xff;
    }
  }
  return { width, height, channels: bpp, data: out };
}

function pixel(r: Raster, x: number, y: number): [number, number, number] {
  const xi = Math.max(0, Math.min(r.width - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(r.height - 1, Math.round(y)));
  const i = yi * r.width * r.channels + xi * r.channels;
  if (r.channels >= 3) return [r.data[i]!, r.data[i + 1]!, r.data[i + 2]!];
  return [r.data[i]!, r.data[i]!, r.data[i]!];
}

function pixelDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

/** Scans one row rightward from `left` and answers where this frame stops
 * agreeing with the finished frame. The wipe reveals left to right, so the
 * agreeing prefix IS the painted region. Measured against the final frame
 * rather than against a guessed background colour, so no colour token is
 * hardcoded here. */
function paintedWidthOnRow(frame: Raster, final: Raster, left: number, right: number, y: number, tolerance = 12): number {
  for (let x = Math.round(left); x < Math.round(right); x++) {
    if (pixelDistance(pixel(frame, x, y), pixel(final, x, y)) > tolerance) {
      return x - Math.round(left);
    }
  }
  return Math.round(right) - Math.round(left);
}

// ---------------------------------------------------------------------------
// cubic-bezier, inverted. Used only for the second, sub-frame estimate of the
// duration; the primary number is bracketed off the frames themselves.

function bezierX(t: number, x1: number, x2: number): number {
  const u = 1 - t;
  return 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t;
}
function bezierY(t: number, y1: number, y2: number): number {
  const u = 1 - t;
  return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
}
/** Given an eased output f, the normalised time that produced it. */
function easingInverse(f: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (bezierY(mid, REQUIRED_CURVE.y1, REQUIRED_CURVE.y2) < f) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  return bezierX(t, REQUIRED_CURVE.x1, REQUIRED_CURVE.x2);
}

/** Least squares through the origin-free line t = duration * p + offset. */
function fitDuration(points: { p: number; t: number }[]): { durationMs: number; offsetMs: number; n: number } | null {
  if (points.length < 3) return null;
  const n = points.length;
  const sp = points.reduce((s, q) => s + q.p, 0);
  const st = points.reduce((s, q) => s + q.t, 0);
  const spp = points.reduce((s, q) => s + q.p * q.p, 0);
  const spt = points.reduce((s, q) => s + q.p * q.t, 0);
  const denom = n * spp - sp * sp;
  if (Math.abs(denom) < 1e-9) return null;
  const slope = (n * spt - sp * st) / denom;
  const offset = (st - slope * sp) / n;
  return { durationMs: Math.round(slope * 100) / 100, offsetMs: Math.round(offset * 100) / 100, n };
}

// ---------------------------------------------------------------------------
// The in-page per-frame sampler.

type ElementSample = {
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
  opacity: string;
  clipPath: string;
  transform: string;
  scale: string;
  translate: string;
  rotate: string;
  backgroundColor: string;
  border: string;
  visibility: string;
} | null;

type FrameSample = {
  tMs: number;
  els: Record<string, ElementSample>;
  animations: {
    name: string;
    currentTimeMs: number | null;
    playState: string;
    computedDurationMs: number | string;
    computedEasing: string;
    targetClass: string;
    keyframeProperties: string[];
  }[];
};

const SAMPLER_SOURCE = `(selectors) => {
  const out = [];
  const t0 = performance.now();
  window.__mo = { out: out, stop: false, t0: t0 };
  function read(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const round = (n) => Math.round(n * 100) / 100;
    return {
      xPx: round(r.x), yPx: round(r.y), widthPx: round(r.width), heightPx: round(r.height),
      opacity: cs.opacity, clipPath: cs.clipPath, transform: cs.transform,
      scale: cs.scale, translate: cs.translate, rotate: cs.rotate,
      backgroundColor: cs.backgroundColor,
      border: cs.borderTopWidth + " " + cs.borderTopStyle + " " + cs.borderTopColor,
      visibility: cs.visibility,
    };
  }
  function frame() {
    const rec = { tMs: Math.round((performance.now() - t0) * 100) / 100, els: {}, animations: [] };
    for (const name of Object.keys(selectors)) {
      rec.els[name] = read(document.querySelector(selectors[name]));
    }
    for (const a of document.getAnimations()) {
      let timing = null;
      try { timing = a.effect ? a.effect.getComputedTiming() : null; } catch (e) { timing = null; }
      let props = [];
      try {
        props = a.effect && a.effect.getKeyframes
          ? Array.from(new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k))))
          : [];
      } catch (e) { props = []; }
      const target = a.effect && a.effect.target ? a.effect.target : null;
      rec.animations.push({
        name: a.animationName || a.transitionProperty || a.id || "",
        currentTimeMs: a.currentTime === null || a.currentTime === undefined ? null : Math.round(Number(a.currentTime) * 100) / 100,
        playState: a.playState,
        computedDurationMs: timing ? timing.duration : "unreadable",
        computedEasing: timing ? String(timing.easing) : "unreadable",
        targetClass: target ? String(target.className || target.tagName) : "",
        keyframeProperties: props,
      });
    }
    out.push(rec);
    if (window.__mo.stop) return;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}`;

async function startSampler(page: Page, selectors: Record<string, string>): Promise<void> {
  await page.evaluate(
    ([source, sel]) => {
      const fn = new Function(`return ${source}`)() as (s: Record<string, string>) => void;
      fn(sel as Record<string, string>);
    },
    [SAMPLER_SOURCE, selectors] as const,
  );
}

async function stopSampler(page: Page): Promise<FrameSample[]> {
  return page.evaluate(() => {
    const mo = (window as unknown as { __mo: { out: unknown[]; stop: boolean } }).__mo;
    mo.stop = true;
    return mo.out as never;
  });
}

// ---------------------------------------------------------------------------
// The CDP screencast.

type RawFrame = { tMs: number; buffer: Buffer };

class Screencast {
  private frames: RawFrame[] = [];
  private base: number | null = null;
  constructor(private client: CDPSession) {}

  static async start(page: Page, width: number, height: number): Promise<Screencast> {
    const client = await page.context().newCDPSession(page);
    const cast = new Screencast(client);
    client.on("Page.screencastFrame", (frame: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
      const seconds = frame.metadata?.timestamp ?? 0;
      cast.push(seconds * 1000, Buffer.from(frame.data, "base64"));
      client.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => {});
    });
    await client.send("Page.startScreencast", {
      format: "png",
      everyNthFrame: 1,
      maxWidth: width,
      maxHeight: height,
    });
    return cast;
  }

  private push(tMs: number, buffer: Buffer) {
    if (this.base === null) this.base = tMs;
    this.frames.push({ tMs: Math.round((tMs - this.base) * 100) / 100, buffer });
  }

  /** Frames are timestamped by the compositor, so rebase them on a marker
   * taken at the trigger instead of on the first frame the cast happened to
   * deliver while the page was still idle. */
  rebaseFrom(index: number) {
    const zero = this.frames[index]?.tMs ?? 0;
    this.frames = this.frames.map((f) => ({ ...f, tMs: Math.round((f.tMs - zero) * 100) / 100 }));
  }

  count(): number {
    return this.frames.length;
  }

  all(): RawFrame[] {
    return this.frames;
  }

  async stop(): Promise<void> {
    await this.client.send("Page.stopScreencast").catch(() => {});
    await this.client.detach().catch(() => {});
  }
}

function saveFrames(prefix: string, frames: RawFrame[]): { file: string; tMs: number; widthPx: number; heightPx: number }[] {
  return frames.map((frame, i) => {
    const file = path.join(frameDir(), `${prefix}-${String(i).padStart(2, "0")}.png`);
    writeFileSync(file, frame.buffer);
    const size = pngSize(file); // read back from the file's own IHDR, never from what we believe we wrote
    return { file: repoRelative(file), tMs: frame.tMs, ...size };
  });
}

// ---------------------------------------------------------------------------
// The verdict flow.

type IndexRow = { variantPublicId: string; title: string; variantName: string; normalizedIdentifiers: string[] };

async function pickIdentifiers(baseURL: string, request: APIRequestContext) {
  const res = await request.get(new URL("/api/sync/index", baseURL).toString());
  expect(res.ok(), `catalogue index unavailable at ${baseURL}`).toBeTruthy();
  const { rows } = (await res.json()) as { rows: IndexRow[] };
  const holders = new Map<string, string[]>();
  for (const row of rows) {
    for (const value of row.normalizedIdentifiers) {
      holders.set(value, [...(holders.get(value) ?? []), row.variantPublicId]);
    }
  }
  const sorted = [...holders.entries()].sort(([a], [b]) => a.localeCompare(b));
  const unique = sorted.find(([, ids]) => new Set(ids).size === 1)?.[0];
  expect(unique, "no identifier is carried by exactly one variant").toBeTruthy();
  return { unique: unique!, rows: rows.length };
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

// ---------------------------------------------------------------------------
// One arrival, measured twice.

type Arrival = {
  label: string;
  verdictKind: string;
  reducedMotion: boolean;
  matchMediaReduce: boolean;
  resolvedThemeClass: string;
  viewport: { widthPx: number; heightPx: number };
  slabAtRest: { xPx: number; yPx: number; widthPx: number; heightPx: number; backgroundColor: string; clipPath: string; border: string; borderStyle: string; opacity: string; color: string };
  runtimeKeyframes: unknown;
  sampler: {
    frameCount: number;
    arrivalStartIndex: number;
    perFrame: {
      tMs: number;
      animationCurrentTimeMs: number | null;
      layoutBoxWidthPx: number;
      clipPath: string;
      paintedFraction: number | null;
      paintedWidthPx: number | null;
      wrapperOpacity: string;
      slabOpacity: string;
      wrapperTransform: string;
      slabTransform: string;
      slabXPx: number;
      slabYPx: number;
      slabWidthPx: number;
      slabHeightPx: number;
    }[];
    distinctWrapperOpacities: string[];
    distinctSlabOpacities: string[];
    opacityChangeCount: number;
    distinctLayoutBoxWidths: number[];
    animationKeyframeProperties: string[];
    animationComputedDurationMs: (number | string)[];
    animationEffectEasing: string[];
    firstFullFrame: { tMs: number; animationCurrentTimeMs: number | null } | null;
    lastPartialFrame: { tMs: number; animationCurrentTimeMs: number | null } | null;
    frameIntervalMs: number | null;
  };
  pixels: {
    frameCount: number;
    analysedFromIndex: number;
    rowY: number;
    scanLeftPx: number;
    scanRightPx: number;
    probeXPx: number;
    perFrame: { index: number; tMs: number; file: string; widthPx: number; heightPx: number; paintedWidthPx: number; paintedFraction: number; probeRgb: [number, number, number]; probeDistanceFromFinal: number }[];
    firstPaintedFrame: { index: number; tMs: number } | null;
    firstFullFrame: { index: number; tMs: number } | null;
    lastPartialFrame: { index: number; tMs: number } | null;
    frameIntervalMs: number | null;
    probeFramesDifferingAfterReveal: number;
    /** Captured frames showing the slab part-painted. Under reduced motion
     * this is 0: the slab is absent on one frame and whole on the next, so
     * there is no arrival to time and the bracket below is only the idle gap
     * between the two, never a duration. */
    transitionalFrameCount: number;
  };
  measuredDuration: {
    fromPixelBracketMs: number | null;
    fromSamplerBracketMs: number | null;
    fromSamplerBezierFit: { durationMs: number; offsetMs: number; n: number } | null;
    fromPixelBezierFit: { durationMs: number; offsetMs: number; n: number } | null;
    fromAnimationClockMs: number | null;
    declaredMs: number;
  };
  travelAndScale: {
    maxTravelXPx: number;
    maxTravelYPx: number;
    maxWidthDeltaPx: number;
    maxHeightDeltaPx: number;
    nonNoneTransformFrames: number;
    nonNoneScaleFrames: number;
    nonNoneTranslateFrames: number;
  };
  capture: { file: string; widthPx: number; heightPx: number };
  subject: unknown;
};

/** The painted fraction of the wrapper, from its computed clip-path.
 *
 * Chrome resolves the right inset of an ANIMATING inset() to a percentage
 * (`inset(0px 43.5805% 0px 0px)`), not to px. The first version of this read
 * only px, returned null on every frame of a perfectly healthy wipe, and left
 * the duration fit with nothing to fit. Both forms are handled and the form
 * that was actually seen is recorded with the numbers. */
function paintedFractionFromClipPath(clipPath: string, boxWidthPx: number): number | null {
  const m = clipPath.match(/^inset\(([^)]*)\)$/);
  if (!m) return null;
  const parts = m[1]!.trim().split(/\s+/);
  const right = parts.length >= 2 ? parts[1]! : parts[0]!;
  const value = parseFloat(right);
  if (Number.isNaN(value)) return null;
  if (/%$/.test(right)) return Math.round((1 - value / 100) * 1e6) / 1e6;
  if (boxWidthPx <= 0) return null;
  return Math.round(((boxWidthPx - value) / boxWidthPx) * 1e6) / 1e6;
}

async function measureArrival(
  page: Page,
  opts: { label: string; identifier: string; reducedMotion: boolean; viewportWidth: number; viewportHeight: number },
): Promise<Arrival> {
  // A fresh document for every arrival. The first run of this recorded TWO
  // wipes in one sequence, because the previous verdict's 220 ms animation was
  // still in flight when the screencast opened, and the analysis then bracketed
  // the wrong one. One arrival per document removes the class of error rather
  // than the instance.
  await page.goto("/");
  await expect(page.locator(SEL.input)).toBeVisible();
  await settle(page);
  await expect(page.locator(SEL.slab)).toHaveCount(0);

  const matchMediaReduce = await page.evaluate(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const resolvedThemeClass = await page.evaluate(() => document.documentElement.className);

  await assertScaleOne(page, opts.viewportWidth, opts.label);
  await page.fill(SEL.input, opts.identifier);

  const cast = await Screencast.start(page, opts.viewportWidth, opts.viewportHeight);
  await page.waitForTimeout(300); // let the cast deliver an idle frame or two
  const triggerIndex = cast.count();

  await startSampler(page, { wrapper: SEL.wipe, slab: SEL.slab, word: SEL.word });
  await page.waitForTimeout(60);

  await page.click(SEL.submit);
  await expect(page.locator(SEL.slab)).toBeVisible();
  await page.waitForTimeout(700); // well past 220 ms, so the tail is in the record

  const samples = await stopSampler(page);
  await page.waitForTimeout(80);
  await cast.stop();
  cast.rebaseFrom(Math.max(0, triggerIndex - 1));

  await settle(page);
  const verdictKind = (await page.locator(SEL.slab).getAttribute("data-verdict")) ?? "UNKNOWN";
  const slabAtRest = await page.$eval(SEL.slab, (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      xPx: round(r.x),
      yPx: round(r.y),
      widthPx: round(r.width),
      heightPx: round(r.height),
      backgroundColor: cs.backgroundColor,
      clipPath: cs.clipPath,
      border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
      borderStyle: cs.borderTopStyle,
      opacity: cs.opacity,
      color: cs.color,
    };
  });

  // -------------------------------------------------------------- sampler
  // The arrival starts at the first frame carrying the wipe wrapper. On a
  // fresh document there is no earlier wrapper to confuse it with, and the
  // assertion above proved there was no slab before the click.
  const firstWrapper = samples.findIndex((s) => s.els.wrapper !== null);
  const active = firstWrapper < 0 ? [] : samples.slice(firstWrapper);
  const t0 = active[0]?.tMs ?? 0;

  const perFrame = active.map((s) => {
    const wrapper = s.els.wrapper;
    const slab = s.els.slab;
    const box = wrapper?.widthPx ?? 0;
    const fraction = wrapper ? paintedFractionFromClipPath(wrapper.clipPath, box) : null;
    const wipe = s.animations.find((a) => a.name === "vslab-wipe");
    return {
      tMs: Math.round((s.tMs - t0) * 100) / 100,
      animationCurrentTimeMs: wipe?.currentTimeMs ?? null,
      layoutBoxWidthPx: box,
      clipPath: wrapper?.clipPath ?? "",
      paintedFraction: fraction,
      paintedWidthPx: fraction === null ? null : Math.round(fraction * box * 100) / 100,
      wrapperOpacity: wrapper?.opacity ?? "",
      slabOpacity: slab?.opacity ?? "",
      wrapperTransform: wrapper?.transform ?? "",
      slabTransform: slab?.transform ?? "",
      slabXPx: slab?.xPx ?? 0,
      slabYPx: slab?.yPx ?? 0,
      slabWidthPx: slab?.widthPx ?? 0,
      slabHeightPx: slab?.heightPx ?? 0,
    };
  });

  const distinctWrapperOpacities = [...new Set(perFrame.map((f) => f.wrapperOpacity).filter(Boolean))];
  const distinctSlabOpacities = [...new Set(perFrame.map((f) => f.slabOpacity).filter(Boolean))];
  const distinctLayoutBoxWidths = [...new Set(perFrame.map((f) => f.layoutBoxWidthPx))];
  let opacityChangeCount = 0;
  for (let i = 1; i < perFrame.length; i++) {
    if (perFrame[i]!.wrapperOpacity !== perFrame[i - 1]!.wrapperOpacity) opacityChangeCount++;
    if (perFrame[i]!.slabOpacity !== perFrame[i - 1]!.slabOpacity) opacityChangeCount++;
  }

  const wipeAnims = active.flatMap((s) => s.animations.filter((a) => a.name === "vslab-wipe"));
  const animationKeyframeProperties = [...new Set(wipeAnims.flatMap((a) => a.keyframeProperties))];
  const animationComputedDurationMs = [...new Set(wipeAnims.map((a) => a.computedDurationMs))];
  const animationEffectEasing = [...new Set(wipeAnims.map((a) => a.computedEasing))];

  const samplerIntervals: number[] = [];
  for (let i = 1; i < perFrame.length; i++) samplerIntervals.push(perFrame[i]!.tMs - perFrame[i - 1]!.tMs);
  const samplerIntervalMs = samplerIntervals.length
    ? Math.round((samplerIntervals.slice(0, 20).reduce((a, b) => a + b, 0) / Math.min(20, samplerIntervals.length)) * 100) / 100
    : null;

  const samplerFullIdx = perFrame.findIndex((f) => f.paintedFraction !== null && f.paintedFraction >= 0.999999);
  const fromSamplerBracketMs =
    samplerFullIdx > 0 ? Math.round((perFrame[samplerFullIdx]!.tMs - perFrame[0]!.tMs) * 100) / 100 : null;

  const samplerFit = fitDuration(
    perFrame
      .filter((f) => f.paintedFraction !== null && f.paintedFraction > 0.02 && f.paintedFraction < 0.98)
      .map((f) => ({ p: easingInverse(f.paintedFraction!), t: f.tMs })),
  );

  // The animation's own clock against the wall clock: the wall-clock interval
  // over which currentTime travelled from its minimum to its maximum.
  const clockFrames = perFrame.filter((f) => f.animationCurrentTimeMs !== null);
  const clockMin = clockFrames.length ? Math.min(...clockFrames.map((f) => f.animationCurrentTimeMs!)) : null;
  const clockMax = clockFrames.length ? Math.max(...clockFrames.map((f) => f.animationCurrentTimeMs!)) : null;
  const fromAnimationClockMs =
    clockMin !== null && clockMax !== null && clockMax > clockMin
      ? Math.round((clockMax - clockMin) * 100) / 100
      : null;

  // -------------------------------------------------------------- pixels
  const rawFrames = cast.all();
  const saved = saveFrames(opts.label, rawFrames);
  const rasters = rawFrames.map((f) => decodePng(f.buffer));
  const final = rasters[rasters.length - 1]!;

  const rowY = Math.round(slabAtRest.yPx + Math.min(28, slabAtRest.heightPx / 2));
  const scanLeft = Math.round(slabAtRest.xPx);
  const scanRight = Math.round(slabAtRest.xPx + slabAtRest.widthPx);
  const probeX = Math.round(slabAtRest.xPx + 6);
  const finalProbe = pixel(final, probeX, rowY);

  const pixelAll = rasters.map((raster, i) => {
    const painted = paintedWidthOnRow(raster, final, scanLeft, scanRight, rowY);
    const probeRgb = pixel(raster, probeX, rowY);
    return {
      index: i,
      tMs: rawFrames[i]!.tMs,
      file: saved[i]!.file,
      widthPx: saved[i]!.widthPx,
      heightPx: saved[i]!.heightPx,
      paintedWidthPx: painted,
      paintedFraction: Math.round((painted / (scanRight - scanLeft)) * 10000) / 10000,
      probeRgb,
      probeDistanceFromFinal: pixelDistance(probeRgb, finalProbe),
    };
  });

  // Only frames from the trigger onward describe THIS arrival. Everything
  // before it is the idle page.
  const analysedFrom = Math.max(0, triggerIndex - 1);
  const pixelPerFrame = pixelAll.slice(analysedFrom);

  const firstPaintedRel = pixelPerFrame.findIndex((f) => f.paintedWidthPx > 0);
  const firstFullRel = pixelPerFrame.findIndex((f) => f.paintedFraction >= 0.999);
  const lastPartialRel = (() => {
    if (firstFullRel <= 0) return -1;
    for (let i = firstFullRel - 1; i >= 0; i--) if (pixelPerFrame[i]!.paintedFraction < 0.999) return i;
    return -1;
  })();
  const arrivalStartRel = firstPaintedRel > 0 ? firstPaintedRel - 1 : firstPaintedRel;

  const fromPixelBracketMs =
    firstFullRel >= 0 && arrivalStartRel >= 0
      ? Math.round((pixelPerFrame[firstFullRel]!.tMs - pixelPerFrame[arrivalStartRel]!.tMs) * 100) / 100
      : null;

  const pixelIntervals: number[] = [];
  for (let i = Math.max(1, arrivalStartRel + 1); i <= Math.max(1, firstFullRel); i++) {
    if (pixelPerFrame[i] && pixelPerFrame[i - 1]) pixelIntervals.push(pixelPerFrame[i]!.tMs - pixelPerFrame[i - 1]!.tMs);
  }
  const pixelIntervalMs = pixelIntervals.length
    ? Math.round((pixelIntervals.reduce((a, b) => a + b, 0) / pixelIntervals.length) * 100) / 100
    : null;

  const pixelFit = fitDuration(
    pixelPerFrame
      .filter((f) => f.paintedFraction > 0.02 && f.paintedFraction < 0.98)
      .map((f) => ({ p: easingInverse(f.paintedFraction), t: f.tMs })),
  );

  // Opacity at the pixel: a point revealed early must not keep changing colour
  // once it is revealed. A fade would ramp it; a wipe leaves it alone.
  const revealedFrom = pixelPerFrame.findIndex((f) => f.paintedWidthPx > probeX - scanLeft);
  const probeFramesDifferingAfterReveal =
    revealedFrom < 0 ? -1 : pixelPerFrame.slice(revealedFrom).filter((f) => f.probeDistanceFromFinal > 12).length;

  // -------------------------------------------------------- travel and scale
  const first = perFrame[0];
  const travel = {
    maxTravelXPx: first ? Math.max(...perFrame.map((f) => Math.abs(f.slabXPx - first.slabXPx))) : 0,
    maxTravelYPx: first ? Math.max(...perFrame.map((f) => Math.abs(f.slabYPx - first.slabYPx))) : 0,
    maxWidthDeltaPx: first ? Math.max(...perFrame.map((f) => Math.abs(f.slabWidthPx - first.slabWidthPx))) : 0,
    maxHeightDeltaPx: first ? Math.max(...perFrame.map((f) => Math.abs(f.slabHeightPx - first.slabHeightPx))) : 0,
    nonNoneTransformFrames: perFrame.filter((f) => f.wrapperTransform !== "none" || f.slabTransform !== "none").length,
    nonNoneScaleFrames: active.filter(
      (s) => (s.els.wrapper && s.els.wrapper.scale !== "none") || (s.els.slab && s.els.slab.scale !== "none"),
    ).length,
    nonNoneTranslateFrames: active.filter(
      (s) => (s.els.wrapper && s.els.wrapper.translate !== "none") || (s.els.slab && s.els.slab.translate !== "none"),
    ).length,
  };

  // The keyframes the browser is running, read once from the live effect. This
  // is the runtime answer to "does the wipe touch opacity" and to "what curve",
  // and it is not the stylesheet text.
  const runtimeKeyframes = await page.evaluate(() => {
    const style = document.createElement("style");
    document.head.appendChild(style);
    document.head.removeChild(style);
    const sheets = Array.from(document.styleSheets);
    for (const sheet of sheets) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if ((rule as CSSKeyframesRule).name === "vslab-wipe") {
          const kf = rule as CSSKeyframesRule;
          return {
            source: sheet.href ?? "(inline <style>)",
            name: kf.name,
            frames: Array.from(kf.cssRules).map((f) => {
              const frame = f as CSSKeyframeRule;
              const declarations: Record<string, string> = {};
              for (let i = 0; i < frame.style.length; i++) {
                const prop = frame.style[i]!;
                declarations[prop] = frame.style.getPropertyValue(prop);
              }
              return { keyText: frame.keyText, declarations };
            }),
          };
        }
      }
    }
    return null;
  });

  const shot = await capture(page, `${opts.label}-settled`);
  const subject = await assertSubjectInCapture(page, SEL.slab, shot, `${opts.label} verdict slab`);

  return {
    label: opts.label,
    verdictKind,
    reducedMotion: opts.reducedMotion,
    matchMediaReduce,
    resolvedThemeClass,
    viewport: { widthPx: opts.viewportWidth, heightPx: opts.viewportHeight },
    slabAtRest,
    runtimeKeyframes,
    sampler: {
      frameCount: samples.length,
      arrivalStartIndex: firstWrapper,
      perFrame,
      distinctWrapperOpacities,
      distinctSlabOpacities,
      opacityChangeCount,
      distinctLayoutBoxWidths,
      animationKeyframeProperties,
      animationComputedDurationMs,
      animationEffectEasing,
      firstFullFrame:
        samplerFullIdx >= 0
          ? { tMs: perFrame[samplerFullIdx]!.tMs, animationCurrentTimeMs: perFrame[samplerFullIdx]!.animationCurrentTimeMs }
          : null,
      lastPartialFrame:
        samplerFullIdx > 0
          ? { tMs: perFrame[samplerFullIdx - 1]!.tMs, animationCurrentTimeMs: perFrame[samplerFullIdx - 1]!.animationCurrentTimeMs }
          : null,
      frameIntervalMs: samplerIntervalMs,
    },
    pixels: {
      frameCount: pixelPerFrame.length,
      analysedFromIndex: analysedFrom,
      rowY,
      scanLeftPx: scanLeft,
      scanRightPx: scanRight,
      probeXPx: probeX,
      perFrame: pixelPerFrame,
      firstPaintedFrame: firstPaintedRel >= 0 ? { index: pixelPerFrame[firstPaintedRel]!.index, tMs: pixelPerFrame[firstPaintedRel]!.tMs } : null,
      firstFullFrame: firstFullRel >= 0 ? { index: pixelPerFrame[firstFullRel]!.index, tMs: pixelPerFrame[firstFullRel]!.tMs } : null,
      lastPartialFrame: lastPartialRel >= 0 ? { index: pixelPerFrame[lastPartialRel]!.index, tMs: pixelPerFrame[lastPartialRel]!.tMs } : null,
      frameIntervalMs: pixelIntervalMs,
      probeFramesDifferingAfterReveal,
      transitionalFrameCount: pixelPerFrame.filter((f) => f.paintedFraction > 0 && f.paintedFraction < 0.999).length,
    },
    measuredDuration: {
      fromPixelBracketMs,
      fromSamplerBracketMs,
      fromSamplerBezierFit: samplerFit,
      fromPixelBezierFit: pixelFit,
      fromAnimationClockMs,
      declaredMs: DECLARED_SLAB_MS,
    },
    travelAndScale: travel,
    capture: shot,
    subject,
  };
}

// ---------------------------------------------------------------------------
// Tests. Order matters: build id first, build id last.

test.describe.configure({ mode: "serial" });

test("build id, before the first measurement", async ({ request, baseURL }) => {
  evidence.buildIdBefore = await assertServedBuildId(request, baseURL!, EXPECTED_BUILD_ID, "before the first measurement");
});

// 390 is the width the design was drawn for and the width every other
// capture in this run uses. The height is 1200 rather than 844 because the
// NOT IN COLLECTION slab with its three doors is 319 px tall and starts at
// y 596: at 844 the capture would cut it off, and a capture that does not
// contain its subject is not evidence for it. The wipe is horizontal, so the
// height changes nothing about what is being measured.
const ARRIVAL_VIEWPORT = { width: 390, height: 1200 };

test.describe("C12, the arrival", () => {
  test.use({ viewport: ARRIVAL_VIEWPORT });

  test("the verdict slab's arrival, captured as a frame sequence", async ({ page, request, baseURL }) => {
    const { unique, rows } = await pickIdentifiers(baseURL!, request);
    evidence.catalogueRows = rows;
    await loadAndSync(page, unique);

    const notInCollection = await measureArrival(page, {
      label: "c12-not-in-collection",
      identifier: UNKNOWN_IDENTIFIER,
      reducedMotion: false,
      viewportWidth: ARRIVAL_VIEWPORT.width,
      viewportHeight: ARRIVAL_VIEWPORT.height,
    });
    expect(notInCollection.verdictKind, "unknown identifier reaches NOT IN COLLECTION").toBe("NOT_IN_COLLECTION");

    // OWNED is the mint slab: the one where a fade would be most visible and the
    // one whose colour C13 is about. Reached by adding the recognised copy.
    await page.fill(SEL.input, unique);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.slab)).toBeVisible();
    const addButton = page.locator(SEL.addToCollection);
    if (await addButton.count()) {
      await addButton.click();
      await expect(page.locator(SEL.slab)).toContainText("Saved to your collection.");
    }
    const owned = await measureArrival(page, {
      label: "c12-owned",
      identifier: unique,
      reducedMotion: false,
      viewportWidth: ARRIVAL_VIEWPORT.width,
      viewportHeight: ARRIVAL_VIEWPORT.height,
    });

    evidence.c12 = { notInCollection, owned };

    for (const arrival of [notInCollection, owned]) {
      const where = arrival.label;
      // The instrument saw the wipe at all.
      expect(arrival.sampler.frameCount, `${where}: sampler produced no frames`).toBeGreaterThan(5);
      expect(arrival.pixels.frameCount, `${where}: screencast produced no frames`).toBeGreaterThan(3);
      // Full width, at the end.
      expect(arrival.pixels.firstFullFrame, `${where}: the slab never reached full painted width`).not.toBeNull();
      // 0 opacity change, measured across the sequence rather than read off the keyframes.
      expect(arrival.sampler.opacityChangeCount, `${where}: computed opacity changed during the arrival`).toBe(0);
      expect(arrival.sampler.distinctWrapperOpacities, `${where}: wrapper opacity values seen`).toEqual(["1"]);
      expect(arrival.sampler.distinctSlabOpacities, `${where}: slab opacity values seen`).toEqual(["1"]);
      expect(
        arrival.sampler.animationKeyframeProperties.map((p) => p.toLowerCase()),
        `${where}: the running animation's own keyframes carry opacity`,
      ).not.toContain("opacity");
      expect(
        arrival.pixels.probeFramesDifferingAfterReveal,
        `${where}: a revealed pixel kept changing colour after it was revealed, which is a fade`,
      ).toBe(0);
      // Three derivations of the duration, from three different readings.
      //
      // 1. The frame bracket. Coarse by construction: it can only ever be a
      //    whole number of compositor frames, so it carries roughly a frame of
      //    uncertainty either side and is checked with that slack.
      // 2. The bezier fit on the painted fraction. Sub-frame, because it uses
      //    every frame's painted geometry rather than only the two endpoints.
      //    This is the number reported as the measured duration.
      // 3. The animation's own clock, which is a cross-check on 1 and 2 rather
      //    than an independent measurement.
      const bracket = arrival.measuredDuration.fromPixelBracketMs;
      expect(bracket, `${where}: no measurable duration from the frames`).not.toBeNull();
      const slack = (arrival.pixels.frameIntervalMs ?? 17) * 1.5 + 8;
      expect(
        Math.abs(bracket! - DECLARED_SLAB_MS),
        `${where}: frame bracket ${bracket} ms against the declared ${DECLARED_SLAB_MS} ms, slack ${slack.toFixed(1)} ms`,
      ).toBeLessThanOrEqual(slack);

      const fitted = arrival.measuredDuration.fromSamplerBezierFit;
      expect(fitted, `${where}: the painted fraction produced no fit`).not.toBeNull();
      expect(fitted!.n, `${where}: too few frames inside the wipe to fit`).toBeGreaterThanOrEqual(6);
      expect(
        Math.abs(fitted!.durationMs - DECLARED_SLAB_MS),
        `${where}: fitted ${fitted!.durationMs} ms against the declared ${DECLARED_SLAB_MS} ms`,
      ).toBeLessThanOrEqual(6);

      const pixelFitted = arrival.measuredDuration.fromPixelBezierFit;
      expect(pixelFitted, `${where}: the pixel series produced no fit`).not.toBeNull();
      expect(
        Math.abs(pixelFitted!.durationMs - DECLARED_SLAB_MS),
        `${where}: pixel fit ${pixelFitted!.durationMs} ms against the declared ${DECLARED_SLAB_MS} ms`,
      ).toBeLessThanOrEqual(20);

      // The layout box was full width the whole time. This is the half of
      // "arrives at full width" that a box measurement alone would have
      // answered wrongly: the box never grows, the painted region does.
      expect(
        arrival.sampler.distinctLayoutBoxWidths.length,
        `${where}: the wrapper's layout box changed width during the wipe`,
      ).toBe(1);
      expect(
        arrival.pixels.perFrame[0]?.paintedFraction,
        `${where}: the first frame of the arrival already showed painted pixels`,
      ).toBe(0);
    }
  });
});

test("C12: the transition sweep, from the served stylesheets", async ({ page }) => {
  // Every route the build produced that renders an interface, plus the one
  // state that is not a route: the verdict slab itself. A sweep that only ever
  // sees resting pages never looks at the elements the wipe lands on.
  const routes = ["/", "/catalogue", "/collection", "/collection/no-such-copy", "/no-such-route-c12"];
  const perRoute: unknown[] = [];

  const sweepHere = () => page.evaluate(() => {
      type Hit = {
        sheet: string;
        selector: string;
        condition: string;
        transitionShorthand: string;
        transitionProperty: string;
        transitionDuration: string;
        transitionTimingFunction: string;
        transitionDelay: string;
      };
      const declared: Hit[] = [];
      const animationRules: { sheet: string; selector: string; condition: string; animation: string }[] = [];
      const keyframes: { sheet: string; name: string; properties: string[] }[] = [];
      const sheets: { href: string | null; ruleCount: number; readable: boolean }[] = [];
      const transformRules: { sheet: string; selector: string; condition: string; property: string; value: string }[] = [];
      let rulesWalked = 0;

      const walk = (rules: CSSRuleList, sheetName: string, condition: string) => {
        for (const rule of Array.from(rules)) {
          const asGroup = rule as CSSRule & { cssRules?: CSSRuleList; conditionText?: string; name?: string };
          if (rule.constructor.name === "CSSKeyframesRule" || (rule as CSSRule).type === 7) {
            const kf = rule as unknown as CSSKeyframesRule;
            const props = new Set<string>();
            for (const frame of Array.from(kf.cssRules) as CSSKeyframeRule[]) {
              for (let i = 0; i < frame.style.length; i++) props.add(frame.style[i]!);
            }
            keyframes.push({ sheet: sheetName, name: kf.name, properties: [...props] });
            continue;
          }
          rulesWalked++;
          const style = (rule as CSSStyleRule).style;
          if (style) {
            const selector = (rule as CSSStyleRule).selectorText ?? "(no selector)";
            for (const prop of ["transform", "scale", "rotate", "translate"]) {
              const value = style.getPropertyValue(prop).trim();
              if (value && value !== "none") {
                transformRules.push({ sheet: sheetName, selector, condition, property: prop, value });
              }
            }
            const shorthand = style.getPropertyValue("transition").trim();
            const duration = style.getPropertyValue("transition-duration").trim();
            const property = style.getPropertyValue("transition-property").trim();
            const timing = style.getPropertyValue("transition-timing-function").trim();
            const delay = style.getPropertyValue("transition-delay").trim();
            if (shorthand || duration || property || timing || delay) {
              declared.push({
                sheet: sheetName,
                selector,
                condition,
                transitionShorthand: shorthand,
                transitionProperty: property,
                transitionDuration: duration,
                transitionTimingFunction: timing,
                transitionDelay: delay,
              });
            }
            const animation = style.getPropertyValue("animation").trim() || style.getPropertyValue("animation-name").trim();
            if (animation) animationRules.push({ sheet: sheetName, selector, condition, animation });
          }
          if (asGroup.cssRules) {
            const nextCondition = [condition, asGroup.conditionText ?? ""].filter(Boolean).join(" AND ");
            walk(asGroup.cssRules, sheetName, nextCondition);
          }
        }
      };

      for (const sheet of Array.from(document.styleSheets)) {
        const name = sheet.href ?? "(inline <style>)";
        try {
          const rules = sheet.cssRules;
          sheets.push({ href: name, ruleCount: rules.length, readable: true });
          walk(rules, name, "");
        } catch {
          sheets.push({ href: name, ruleCount: -1, readable: false });
        }
      }

      // Second instrument: what every element in the document actually
      // computes. Catches inline styles and anything JS set, which the CSSOM
      // rule walk above cannot see.
      const computed: { tag: string; className: string; duration: string; property: string; timing: string }[] = [];
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const cs = getComputedStyle(el);
        const durations = cs.transitionDuration.split(",").map((s) => s.trim());
        const live = durations.some((d) => parseFloat(d) > 0);
        if (live && cs.transitionProperty !== "none") {
          computed.push({
            tag: el.tagName,
            className: String((el as HTMLElement).className || ""),
            duration: cs.transitionDuration,
            property: cs.transitionProperty,
            timing: cs.transitionTimingFunction,
          });
        }
      }

      // C13 says the slab arrives with 0 travel and 0 scale. The 09:53 entry
      // claimed both are 0 BY CONSTRUCTION rather than only under reduced
      // motion. That claim is either true of every element in the product or
      // it is not a claim about construction, so every element is read.
      const geometricTransforms: { tag: string; className: string; transform: string; scale: string; rotate: string; translate: string }[] = [];
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const cs = getComputedStyle(el);
        if (cs.transform !== "none" || cs.scale !== "none" || cs.rotate !== "none" || cs.translate !== "none") {
          geometricTransforms.push({
            tag: el.tagName,
            className: String((el as HTMLElement).className || ""),
            transform: cs.transform,
            scale: cs.scale,
            rotate: cs.rotate,
            translate: cs.translate,
          });
        }
      }

      return {
        sheets,
        declared,
        animationRules,
        keyframes,
        computed,
        geometricTransforms,
        transformRules,
        rulesWalked,
        elementsExamined: document.querySelectorAll("*").length,
      };
    });

  for (const route of routes) {
    const response = await page.goto(route, { waitUntil: "load" });
    const status = response?.status() ?? 0;
    await page.waitForSelector("main", { state: "attached", timeout: 20_000 }).catch(() => {});
    perRoute.push({ route, state: "resting", status, ...(await sweepHere()) });
  }

  // The verdict state, which no resting route shows.
  await page.goto("/");
  await page.fill(SEL.input, UNKNOWN_IDENTIFIER);
  await page.click(SEL.submit);
  await expect(page.locator(SEL.slab)).toBeVisible();
  await settle(page);
  perRoute.push({ route: "/", state: "verdict slab present", status: 200, ...(await sweepHere()) });

  // Fold the routes together and classify.
  type Hit = { sheet: string; selector: string; condition: string; transitionShorthand: string; transitionProperty: string; transitionDuration: string; transitionTimingFunction: string; transitionDelay: string };
  const allDeclared: Hit[] = perRoute.flatMap((r) => (r as { declared: Hit[] }).declared);
  const uniqueDeclared = [...new Map(allDeclared.map((h) => [`${h.sheet}|${h.condition}|${h.selector}|${h.transitionShorthand}|${h.transitionDuration}`, h])).values()];

  const durationMs = (raw: string): number | null => {
    const value = raw.split(",")[0]?.trim() ?? "";
    if (!value) return null;
    if (value.endsWith("ms")) return parseFloat(value);
    if (value.endsWith("s")) return parseFloat(value) * 1000;
    return null;
  };

  // A declaration ESTABLISHES a transition when it names a property to
  // transition and gives it a duration a person can see. The
  // prefers-reduced-motion override sets transition-duration: 0.001ms on *,
  // which does not establish a transition; it kills any that exist. Counting
  // that as "a transition off 140 ms" would be counting the safety net as the
  // hazard, so it is classified and reported, not silently dropped.
  const established = uniqueDeclared.filter((h) => {
    const d = durationMs(h.transitionDuration) ?? durationMs(h.transitionShorthand.match(/(\d*\.?\d+m?s)/)?.[0] ?? "");
    return d !== null && d >= 1 && h.transitionProperty !== "none";
  });
  const neutralising = uniqueDeclared.filter((h) => !established.includes(h));

  const offSpec = established.filter((h) => {
    const d = durationMs(h.transitionDuration);
    const curve = h.transitionTimingFunction.replace(/\s+/g, "");
    return d !== REQUIRED_OTHER_MS || curve !== "cubic-bezier(0.2,0.8,0.2,1)";
  });

  const allComputed = perRoute.flatMap((r) => (r as { computed: unknown[] }).computed);
  const unreadableSheets = perRoute.flatMap((r) =>
    (r as { sheets: { href: string; readable: boolean }[] }).sheets.filter((s) => !s.readable),
  );
  const allGeometric = perRoute.flatMap((r) =>
    (r as { route: string; state: string; geometricTransforms: unknown[] }).geometricTransforms.map((g) => ({
      route: (r as { route: string }).route,
      state: (r as { state: string }).state,
      ...(g as object),
    })),
  );
  const allTransformRules = perRoute.flatMap((r) => (r as { transformRules: unknown[] }).transformRules);
  const rulesWalked = Math.max(...perRoute.map((r) => (r as { rulesWalked: number }).rulesWalked));
  const keyframeBlocks = [
    ...new Map(
      perRoute
        .flatMap((r) => (r as { keyframes: { name: string; properties: string[] }[] }).keyframes)
        .map((k) => [k.name, k]),
    ).values(),
  ];
  const elementsExamined = perRoute.reduce<number>((n, r) => n + (r as { elementsExamined: number }).elementsExamined, 0);

  evidence.c12TransitionSweep = {
    routesSwept: routes,
    statesSwept: perRoute.map((r) => `${(r as { route: string }).route} [${(r as { state: string }).state}]`),
    cssRulesWalkedIncludingNested: rulesWalked,
    elementsExaminedAcrossAllStates: elementsExamined,
    keyframeBlocks,
    keyframeBlockCount: keyframeBlocks.length,
    geometricTransformsOnLiveElements: allGeometric,
    geometricTransformCount: allGeometric.length,
    transformDeclarationsInStyleSheets: allTransformRules,
    transformDeclarationCount: allTransformRules.length,
    perRoute,
    uniqueDeclaredTransitionRules: uniqueDeclared,
    establishedTransitions: established,
    establishedTransitionCount: established.length,
    neutralisingTransitionRules: neutralising,
    transitionsOffDurationOrCurve: offSpec,
    transitionsOffDurationOrCurveCount: offSpec.length,
    computedTransitionsOnLiveElements: allComputed,
    computedTransitionCount: allComputed.length,
    unreadableStyleSheets: unreadableSheets,
    requiredMs: REQUIRED_OTHER_MS,
    requiredCurve: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  };

  expect(unreadableSheets, "a stylesheet whose rules could not be read is an unswept stylesheet").toEqual([]);
  expect(offSpec, "transitions off 140 ms or off cubic-bezier(.2,.8,.2,1)").toEqual([]);
  expect(allComputed, "elements computing a live transition that the rule sweep did not account for").toEqual([]);
  // The 09:53 claim, tested rather than repeated: 0 travel and 0 scale by
  // construction, not merely under reduced motion.
  expect(allGeometric, "elements computing a geometric transform anywhere in the product").toEqual([]);
  expect(allTransformRules, "stylesheet rules setting transform, scale, rotate or translate").toEqual([]);
});

test.describe("C13, with reduced motion requested", () => {
  // The context option, not page.emulateMedia: the whole context is created
  // with the preference in force, so nothing renders even once without it.
  test.use({ contextOptions: { reducedMotion: "reduce" }, viewport: ARRIVAL_VIEWPORT });

  test("the slab arrives with 0 travel and 0 scale, and keeps slab, colour and cut", async ({ page, request, baseURL }) => {
    const applied = await (async () => {
      await page.goto("/");
      return page.evaluate(() => ({
        reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        noPreference: window.matchMedia("(prefers-reduced-motion: no-preference)").matches,
      }));
    })();
    evidence.c13ReducedMotionApplied = applied;
    expect(applied.reduce, "reduced motion was not applied to the page").toBe(true);
    expect(applied.noPreference, "the page still reports no-preference").toBe(false);

    const { unique } = await pickIdentifiers(baseURL!, request);
    await loadAndSync(page, unique);

    const notInCollection = await measureArrival(page, {
      label: "c13-reduced-not-in-collection",
      identifier: UNKNOWN_IDENTIFIER,
      reducedMotion: true,
      viewportWidth: ARRIVAL_VIEWPORT.width,
      viewportHeight: ARRIVAL_VIEWPORT.height,
    });

    await page.fill(SEL.input, unique);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.slab)).toBeVisible();
    const addButton = page.locator(SEL.addToCollection);
    if (await addButton.count()) {
      await addButton.click();
      await expect(page.locator(SEL.slab)).toContainText("Saved to your collection.");
    }
    const owned = await measureArrival(page, {
      label: "c13-reduced-owned",
      identifier: unique,
      reducedMotion: true,
      viewportWidth: ARRIVAL_VIEWPORT.width,
      viewportHeight: ARRIVAL_VIEWPORT.height,
    });

    evidence.c13 = { notInCollection, owned };

    for (const arrival of [notInCollection, owned]) {
      const where = arrival.label;
      expect(arrival.matchMediaReduce, `${where}: reduced motion not in force at measurement time`).toBe(true);
      expect(arrival.sampler.frameCount, `${where}: no frames`).toBeGreaterThan(3);
      expect(arrival.travelAndScale.maxTravelXPx, `${where}: horizontal travel`).toBe(0);
      expect(arrival.travelAndScale.maxTravelYPx, `${where}: vertical travel`).toBe(0);
      expect(arrival.travelAndScale.maxWidthDeltaPx, `${where}: width change (scale)`).toBe(0);
      expect(arrival.travelAndScale.maxHeightDeltaPx, `${where}: height change (scale)`).toBe(0);
      expect(arrival.travelAndScale.nonNoneTransformFrames, `${where}: frames with a non-none transform`).toBe(0);
      expect(arrival.travelAndScale.nonNoneScaleFrames, `${where}: frames with a non-none scale`).toBe(0);
      expect(arrival.travelAndScale.nonNoneTranslateFrames, `${where}: frames with a non-none translate`).toBe(0);
      // The arrival has no in-between: the slab is absent on one captured
      // frame and whole on the next.
      expect(
        arrival.pixels.transitionalFrameCount,
        `${where}: captured frames showing the slab part-painted under reduced motion`,
      ).toBe(0);
      expect(
        arrival.sampler.perFrame[0]?.paintedFraction,
        `${where}: the slab's first sampled frame was not already at full painted width`,
      ).toBe(1);
      // The slab, its colour and its cut, still there.
      expect(arrival.slabAtRest.backgroundColor, `${where}: slab background`).not.toBe("rgba(0, 0, 0, 0)");
      expect(arrival.slabAtRest.widthPx, `${where}: slab width`).toBeGreaterThan(0);
      expect(arrival.slabAtRest.heightPx, `${where}: slab height`).toBeGreaterThan(0);
      expect(arrival.slabAtRest.opacity, `${where}: slab opacity`).toBe("1");
    }
    // The cut, named. NOT IN COLLECTION carries .cut18, OWNED carries .cut20.
    expect(notInCollection.slabAtRest.clipPath, "NOT IN COLLECTION lost its cut under reduced motion").toContain("polygon");
    expect(owned.slabAtRest.clipPath, "OWNED lost its cut under reduced motion").toContain("polygon");

    // "The slab, its colour and its cut remain" is a comparison, so it is
    // measured as one: the reduced-motion resting state against the same
    // slab's resting state with motion allowed. Asserting only that a
    // background is non-transparent would pass a slab that arrived in the
    // wrong colour. Every property is diffed and the count of differences is
    // the number reported.
    const withMotion = evidence.c12 as { notInCollection: Arrival; owned: Arrival };
    const properties = ["backgroundColor", "clipPath", "border", "borderStyle", "opacity", "color", "widthPx", "heightPx", "xPx", "yPx"] as const;
    const comparison = [
      { kind: "NOT_IN_COLLECTION", motion: withMotion.notInCollection.slabAtRest, reduced: notInCollection.slabAtRest },
      { kind: "OWNED", motion: withMotion.owned.slabAtRest, reduced: owned.slabAtRest },
    ].map(({ kind, motion, reduced }) => {
      const differences = properties
        .filter((prop) => String(motion[prop]) !== String(reduced[prop]))
        .map((prop) => ({ property: prop, withMotion: motion[prop], reducedMotion: reduced[prop] }));
      return { kind, withMotion: motion, reducedMotion: reduced, differences, differenceCount: differences.length };
    });
    evidence.c13RetainedAgainstMotionAllowed = { propertiesCompared: properties, comparison };
    for (const row of comparison) {
      expect(row.differences, `${row.kind}: reduced motion changed the resting slab`).toEqual([]);
    }
  });

  test("control D: reduced motion reaches CSS animation, not only matchMedia", async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const host = document.createElement("div");
      host.id = "rm-control";
      host.style.cssText =
        "position:fixed;left:0;top:0;width:40px;height:40px;background:#ff00ff;z-index:99999;animation:rm-move 220ms linear both";
      const style = document.createElement("style");
      style.textContent = "@keyframes rm-move { from { transform: translateX(0px); } to { transform: translateX(300px); } }";
      document.head.appendChild(style);
      document.body.appendChild(host);
      const samples: { tMs: number; xPx: number; transform: string }[] = [];
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          const r = host.getBoundingClientRect();
          samples.push({
            tMs: Math.round((performance.now() - t0) * 100) / 100,
            xPx: Math.round(r.x * 100) / 100,
            transform: getComputedStyle(host).transform,
          });
          if (performance.now() - t0 > 400) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const durations = document.getAnimations().map((a) => {
        try {
          return String(a.effect?.getComputedTiming().duration);
        } catch {
          return "unreadable";
        }
      });
      host.remove();
      style.remove();
      const xs = samples.map((s) => s.xPx);
      return {
        sampleCount: samples.length,
        distinctXPositions: [...new Set(xs)],
        maxTravelPx: Math.max(...xs) - Math.min(...xs),
        animationDurationsWhileRunning: durations,
        firstSamples: samples.slice(0, 5),
      };
    });
    evidence.c13ControlD = result;
    // Under reduced motion, the * override collapses the animation to 0.001ms,
    // so the control element is at its end position on the first sampled frame
    // and never travels. That is the proof the emulation reaches the
    // stylesheet, not just the media query string.
    expect(result.maxTravelPx, "the moving control still travelled under reduced motion").toBe(0);
  });
});

test("controls A, B and C: the instruments can see motion, stillness and a fade", async ({ page }) => {
  await page.goto("/");
  await assertScaleOne(page, 390, "controls");

  // --------------------------------------------------------------- control C
  // A fade, sampled by the SAME per-frame sampler that read the slab's
  // opacity. If it reports one opacity here, its "0 opacity change" on the
  // slab means nothing.
  const fade = await page.evaluate(async () => {
    const el = document.createElement("div");
    el.id = "fade-control";
    el.style.cssText =
      "position:fixed;left:0;top:0;width:120px;height:60px;background:#00ffcc;z-index:99999;animation:fade-ctl 220ms linear both";
    const style = document.createElement("style");
    style.textContent = "@keyframes fade-ctl { from { opacity: 1; } to { opacity: 0.2; } }";
    document.head.appendChild(style);
    document.body.appendChild(el);
    const opacities: string[] = [];
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        opacities.push(getComputedStyle(el).opacity);
        if (performance.now() - t0 > 320) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const keyframeProps: string[] = document
      .getAnimations()
      .filter((a) => (a as CSSAnimation).animationName === "fade-ctl")
      .flatMap((a) => {
        try {
          const effect = a.effect as KeyframeEffect;
          const frames = effect.getKeyframes() as Record<string, unknown>[];
          return [...new Set(frames.flatMap((k) => Object.keys(k)))];
        } catch {
          return [] as string[];
        }
      });
    el.remove();
    style.remove();
    return {
      frameCount: opacities.length,
      distinctOpacities: [...new Set(opacities)],
      distinctOpacityCount: new Set(opacities).size,
      keyframeProperties: keyframeProps,
      firstOpacity: opacities[0] ?? null,
      lastOpacity: opacities[opacities.length - 1] ?? null,
    };
  });
  expect(fade.distinctOpacityCount, "the opacity sampler could not see a fade").toBeGreaterThan(3);
  expect(fade.keyframeProperties.map((p) => p.toLowerCase()), "the keyframe reader could not see opacity").toContain("opacity");

  // ------------------------------------------------------- controls A and B
  // One screencast, two subjects. A moving block and a still block, measured
  // by the identical pixel instrument that measured the slab.
  const geometry = await page.evaluate(() => {
    const style = document.createElement("style");
    style.id = "ab-control-style";
    style.textContent =
      "@keyframes ab-move { from { left: 10px; } to { left: 250px; } } " +
      "#move-control { position:fixed; top:120px; left:10px; width:60px; height:60px; background:#ff2f6d; z-index:99999; } " +
      "#still-control { position:fixed; top:220px; left:10px; width:60px; height:60px; background:#2f6dff; z-index:99999; }";
    document.head.appendChild(style);
    const mover = document.createElement("div");
    mover.id = "move-control";
    const still = document.createElement("div");
    still.id = "still-control";
    document.body.appendChild(mover);
    document.body.appendChild(still);
    return { moveRowY: 150, stillRowY: 250 };
  });

  const cast = await Screencast.start(page, 390, 844);
  await page.waitForTimeout(250);
  const before = cast.count();
  await page.evaluate(() => {
    const el = document.getElementById("move-control")!;
    el.style.animation = "ab-move 220ms linear both";
  });
  await page.waitForTimeout(700);
  await cast.stop();
  cast.rebaseFrom(Math.max(0, before - 1));

  const rawFrames = cast.all();
  const saved = saveFrames("controls-ab", rawFrames);
  const rasters = rawFrames.map((f) => decodePng(f.buffer));
  const finalRaster = rasters[rasters.length - 1]!;

  /** Leftmost and rightmost column on a row whose colour matches the block. */
  const span = (r: Raster, y: number, rgb: [number, number, number]) => {
    let left = -1;
    let right = -1;
    for (let x = 0; x < r.width; x++) {
      if (pixelDistance(pixel(r, x, y), rgb) <= 40) {
        if (left < 0) left = x;
        right = x;
      }
    }
    return { leftPx: left, rightPx: right, widthPx: left < 0 ? 0 : right - left + 1 };
  };
  const MOVE_RGB: [number, number, number] = [0xff, 0x2f, 0x6d];
  const STILL_RGB: [number, number, number] = [0x2f, 0x6d, 0xff];

  const moveSeries = rasters.map((r, i) => ({ index: i, tMs: rawFrames[i]!.tMs, ...span(r, geometry.moveRowY, MOVE_RGB) }));
  const stillSeries = rasters.map((r, i) => ({ index: i, tMs: rawFrames[i]!.tMs, ...span(r, geometry.stillRowY, STILL_RGB) }));

  const moveLefts = moveSeries.map((s) => s.leftPx).filter((v) => v >= 0);
  const stillLefts = stillSeries.map((s) => s.leftPx).filter((v) => v >= 0);
  const movingTravelPx = moveLefts.length ? Math.max(...moveLefts) - Math.min(...moveLefts) : 0;
  const stillTravelPx = stillLefts.length ? Math.max(...stillLefts) - Math.min(...stillLefts) : 0;
  const framesDifferingOnMoveRow = rasters.filter(
    (r) => paintedWidthOnRow(r, finalRaster, 0, 390, geometry.moveRowY) < 390,
  ).length;
  const framesDifferingOnStillRow = rasters.filter(
    (r) => paintedWidthOnRow(r, finalRaster, 0, 390, geometry.stillRowY) < 390,
  ).length;

  await page.evaluate(() => {
    document.getElementById("move-control")?.remove();
    document.getElementById("still-control")?.remove();
    document.getElementById("ab-control-style")?.remove();
  });

  evidence.controls = {
    A_movingElement: {
      frameCount: rasters.length,
      framesSaved: saved.length,
      series: moveSeries,
      travelPx: movingTravelPx,
      framesDifferingFromFinalOnItsRow: framesDifferingOnMoveRow,
    },
    B_staticElement: {
      series: stillSeries,
      travelPx: stillTravelPx,
      framesDifferingFromFinalOnItsRow: framesDifferingOnStillRow,
    },
    C_fade: fade,
    savedFrames: saved,
  };

  expect(rasters.length, "the screencast produced fewer than 4 frames, so it cannot resolve a 220 ms arrival").toBeGreaterThan(3);
  expect(movingTravelPx, "control A: the pixel instrument could not see a moving element").toBeGreaterThan(100);
  expect(framesDifferingOnMoveRow, "control A: no frame differed from the final frame on the moving row").toBeGreaterThan(0);
  expect(stillTravelPx, "control B: a static element appeared to move").toBe(0);
  expect(framesDifferingOnStillRow, "control B: a static element's row differed between frames").toBe(0);
});

test("build id, after the last measurement", async ({ request, baseURL }) => {
  evidence.buildIdAfter = await assertServedBuildId(request, baseURL!, EXPECTED_BUILD_ID, "after the last measurement");
});

test.afterAll(() => {
  evidence.recordedAt = new Date().toISOString();
  evidence.declared = {
    slabAnimation: "globals.css .vslabWipe { animation: vslab-wipe 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both }",
    slabDurationMs: DECLARED_SLAB_MS,
    otherTransitionsMs: REQUIRED_OTHER_MS,
    otherTransitionsCurve: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  };
  writeEvidence("c12-c13-verdict-motion.json", evidence);
});
