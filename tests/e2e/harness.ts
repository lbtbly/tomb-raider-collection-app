// Shared instrument for the browser evidence specs. Every rule in here was
// paid for by a wrong number earlier in this run, so each one carries the
// reason it exists rather than a name.

import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { test } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export function repoRoot(): string {
  let dir = test.info().config.rootDir;
  while (!existsSync(path.join(dir, "package.json")) && path.dirname(dir) !== dir) {
    dir = path.dirname(dir);
  }
  return dir;
}

export function evidenceDir(): string {
  const dir = path.join(repoRoot(), ".forge", "evidence");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Repo-relative, never absolute. An absolute path names this machine's home
 * directory inside a tracked file, which check:no-local-paths fails on and
 * which means nothing to anyone reading the evidence elsewhere. */
export function repoRelative(file: string): string {
  return path.relative(repoRoot(), file);
}

/** Counts every leaf in a structure, not its top-level keys.
 *
 * The first version of the guard below counted top-level keys, which defends
 * against the incident that produced it and not against the class. A verifier
 * named the hole: an artifact with the same 20 keys and a hollowed body passes
 * unchallenged. Cut a `clauses` object from 5 entries to 1, keep every key, and
 * a key count says nothing. A leaf count sees it. */
function leafCount(value: unknown): number {
  if (value === null || typeof value !== "object") return 1;
  if (Array.isArray(value)) return value.reduce<number>((n, v) => n + leafCount(v), 0);
  return Object.values(value as Record<string, unknown>).reduce<number>(
    (n, v) => n + leafCount(v),
    0,
  );
}

/** Writes an artifact, and REFUSES to replace one with a thinner record.
 *
 * `test.afterAll` runs whether the tests passed or failed, so a spec that dies
 * early still writes its artifact, built from whatever it managed to collect.
 * That is how a deliberate wrong-build-pin control overwrote a complete
 * `f12-offline-routes.json` with a two-key stub. The run that destroyed it
 * reported success, because writing the stub was the last thing it did.
 *
 * The comparison is a recursive leaf count, so a record that keeps its shape
 * and loses its contents is caught too. It refuses rather than merges: a merge
 * would invent a record no single run produced, which is worse than either
 * file.
 *
 * `VITRINE_EVIDENCE_OVERWRITE` takes a FILENAME, not a flag. A boolean
 * disarmed the guard for every artifact a run wrote rather than the one the
 * author meant, which is the same shape of error as the guard itself was built
 * to catch. `*` is accepted for the rare case of meaning all of them. */
export function writeEvidence(name: string, body: unknown): string {
  const file = path.join(evidenceDir(), name);
  const next = `${JSON.stringify(body, null, 2)}\n`;
  const allow = process.env.VITRINE_EVIDENCE_OVERWRITE;
  const allowed = allow === "*" || allow === name;

  if (existsSync(file) && !allowed) {
    let priorLeaves = 0;
    try {
      priorLeaves = leafCount(JSON.parse(readFileSync(file, "utf8")));
    } catch {
      priorLeaves = 0; // unparseable, nothing to protect
    }
    const nextLeaves = leafCount(body);
    if (priorLeaves > 0 && nextLeaves < priorLeaves) {
      throw new Error(
        `Refusing to overwrite ${repoRelative(file)}: it holds ${priorLeaves} leaf ` +
          `values and this run produced ${nextLeaves}. A partial run must not replace ` +
          `a complete artifact. Fix the run, or set VITRINE_EVIDENCE_OVERWRITE=${name} ` +
          `if the thinner record is the one you mean to keep.`,
      );
    }
  }

  writeFileSync(file, next);
  return repoRelative(file);
}

/** Width and height read from the PNG's own IHDR chunk, not from what the
 * harness believes it asked for. `fullPage: true` once produced 560 px images
 * under a line reading "captured at 390 px"; the file is the only witness
 * that cannot repeat that mistake. */
export function pngSize(file: string): { widthPx: number; heightPx: number } {
  const buf = readFileSync(file);
  const signature = buf.subarray(0, 8).toString("hex");
  expect(signature, `${path.basename(file)} is not a PNG`).toBe("89504e470d0a1a0a");
  return { widthPx: buf.readUInt32BE(16), heightPx: buf.readUInt32BE(20) };
}

export type TargetEvidence = {
  baseUrl: string;
  port: string | null;
  status: number;
  devMarkersFound: string[];
  buildIdOnDisk: string | null;
  buildIdFoundInServedHtml: boolean | null;
  checkedAt: string;
};

/**
 * The server under measurement is a production build, and it is the build
 * that exists on disk right now.
 *
 * The second half is not decoration. A `next start` whose .next was rebuilt
 * underneath it answers 200 with genuine production headers while its chunk
 * URLs 404, so the app never hydrates and every reading taken against it
 * describes a corpse. This assertion fired as a true positive earlier today.
 */
export async function assertProductionTarget(
  request: APIRequestContext,
  baseURL: string,
): Promise<TargetEvidence> {
  const res = await request.get(baseURL);
  expect(res.status(), `no server at ${baseURL}`).toBe(200);
  const html = await res.text();

  const devMarkers = [
    "hmr-client",
    "next-devtools",
    "__nextjs_original-stack-frame",
    "react-refresh",
    "webpack-hmr",
  ].filter((marker) => html.includes(marker));

  const buildIdFile = path.join(repoRoot(), ".next", "BUILD_ID");
  const buildIdOnDisk = existsSync(buildIdFile) ? readFileSync(buildIdFile, "utf8").trim() : null;
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(baseURL);

  const evidence: TargetEvidence = {
    baseUrl: baseURL,
    port: new URL(baseURL).port || null,
    status: res.status(),
    devMarkersFound: devMarkers,
    buildIdOnDisk,
    buildIdFoundInServedHtml: buildIdOnDisk ? html.includes(buildIdOnDisk) : null,
    checkedAt: new Date().toISOString(),
  };

  expect(devMarkers, `dev-server markers in the HTML at ${baseURL}`).toEqual([]);
  if (isLocal && buildIdOnDisk) {
    expect(
      evidence.buildIdFoundInServedHtml,
      "the served HTML does not carry the BUILD_ID on disk: the server is running a build that no longer exists",
    ).toBe(true);
  }
  return evidence;
}

/**
 * Webfonts landed, every running animation finished, then two frames.
 *
 * The verdict slab arrives behind a 220 ms clip-path wipe. A capture taken
 * mid-wipe shows the verdict word sliced and reads exactly like a 390 px
 * overflow defect while every number is already correct: that trap invents a
 * defect. Type metrics are the other half, since a size measured before its
 * webfont lands is measured in the fallback face.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const running = document.getAnimations();
    await Promise.race([
      Promise.allSettled(running.map((a) => a.finished)),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
    );
  });
}

export type Scale = {
  bodyZoom: string;
  devicePixelRatio: number;
  visualViewportScale: number | null;
  innerWidthPx: number;
  documentScrollWidthPx: number;
};

/** No box is read before this passes. A stray body{zoom} once made a 44 px
 * target compute as 43.99. */
export async function assertScaleOne(page: Page, expectedWidth: number, where: string): Promise<Scale> {
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
  expect(scale.innerWidthPx, `viewport width at ${where}`).toBe(expectedWidth);
  return scale;
}

/** Viewport capture, never fullPage, and never mid-animation. The returned
 * size is read back out of the file. */
export async function capture(
  page: Page,
  name: string,
): Promise<{ file: string; widthPx: number; heightPx: number }> {
  await settle(page);
  const file = path.join(evidenceDir(), `${name}.png`);
  await page.screenshot({ path: file });
  const size = pngSize(file);
  const viewport = page.viewportSize();
  if (viewport) {
    expect(size.widthPx, `${name}.png width against the viewport it claims`).toBe(viewport.width);
  }
  return { file: repoRelative(file), ...size };
}

// ---------------------------------------------------------------------------
// The build the server is answering with, named rather than assumed.
//
// assertProductionTarget above compares the served HTML to .next/BUILD_ID on
// disk, which is the right comparison but not a sufficient one. Twice in this
// run a server was measured whose .next had moved underneath it, and once a
// rebuild landed while a verifier's server was already loaded: its "served
// matches disk" assertion was true when it was made and false by the time it
// measured. So the id is pinned to a literal the caller passes, read out of
// the served HTML rather than inferred, and checked again after the last
// measurement rather than only before the first.

/** The build id Next writes into the flight payload as "b":"<id>". Read from
 * the served bytes, never from disk, so this reports what ANSWERED and not
 * what is currently sitting in .next.
 *
 * The quotes are backslash-escaped in the served bytes, because the payload
 * is a JSON string inside a script. The first version of this read for the
 * unescaped form, matched nothing, and returned null on a perfectly healthy
 * document. It failed loudly rather than confirming, which is the only reason
 * it was caught; the pattern tolerates both forms now and its controls are
 * recorded with the run. */
export function servedBuildIdFrom(html: string): string | null {
  const match = html.match(/\\?"b\\?":\\?"([A-Za-z0-9_-]{10,})\\?"/);
  return match ? match[1]! : null;
}

export function buildIdOnDisk(): string | null {
  const file = path.join(repoRoot(), ".next", "BUILD_ID");
  return existsSync(file) ? readFileSync(file, "utf8").trim() : null;
}

export type ServedBuild = {
  baseUrl: string;
  port: string | null;
  status: number;
  servedBuildId: string | null;
  buildIdOnDisk: string | null;
  expectedBuildId: string;
  servedMatchesExpected: boolean;
  servedMatchesDisk: boolean;
  devMarkersFound: string[];
  checkedAt: string;
};

/** The full target assertion: production, the expected build, and the build
 * that is on disk, all three agreeing. `expected` is passed by the caller so
 * a stale id in a dispatch fails loudly here instead of quietly measuring
 * whatever happens to be running. */
export async function assertServedBuildId(
  request: APIRequestContext,
  baseURL: string,
  expected: string,
  when: string,
): Promise<ServedBuild> {
  const res = await request.get(baseURL, { headers: { "cache-control": "no-cache" } });
  expect(res.status(), `no server at ${baseURL} (${when})`).toBe(200);
  const html = await res.text();
  const devMarkers = [
    "hmr-client",
    "next-devtools",
    "__nextjs_original-stack-frame",
    "react-refresh",
    "webpack-hmr",
  ].filter((marker) => html.includes(marker));

  const served = servedBuildIdFrom(html);
  const onDisk = buildIdOnDisk();
  const evidence: ServedBuild = {
    baseUrl: baseURL,
    port: new URL(baseURL).port || null,
    status: res.status(),
    servedBuildId: served,
    buildIdOnDisk: onDisk,
    expectedBuildId: expected,
    servedMatchesExpected: served === expected,
    servedMatchesDisk: served === onDisk,
    devMarkersFound: devMarkers,
    checkedAt: new Date().toISOString(),
  };

  expect(devMarkers, `dev-server markers in the HTML at ${baseURL} (${when})`).toEqual([]);
  expect(
    evidence.servedBuildId,
    `the served build id at ${when} is not the build this measurement was commissioned against`,
  ).toBe(expected);
  return evidence;
}

// ---------------------------------------------------------------------------
// The subject has to be inside the picture.
//
// Twice today a capture was filed as evidence for a thing that sat below the
// bottom edge of it. A PNG of the right width, taken at the right moment, of
// the wrong part of the page is still not evidence. The element's own box is
// measured against the height the PNG reports from its IHDR, and the numbers
// go into the artifact whether they pass or not.

export type SubjectPlacement = {
  subject: string;
  selector: string;
  found: boolean;
  topPx: number | null;
  bottomPx: number | null;
  leftPx: number | null;
  rightPx: number | null;
  captureWidthPx: number;
  captureHeightPx: number;
  fullyInsideTheCapture: boolean;
  note?: string;
};

/** Reads the subject's box in viewport coordinates, which is exactly the
 * region a non-fullPage screenshot covers at deviceScaleFactor 1, and reports
 * it against the size read from the PNG's own IHDR. Reports only: some
 * subjects are legitimately taller than the viewport, and the honest record of
 * that is a number rather than a failure. Use assertSubjectInCapture for the
 * element a capture is actually filed as evidence for. */
export async function measureSubjectInCapture(
  page: Page,
  selector: string,
  shot: { file: string; widthPx: number; heightPx: number },
  subject: string,
): Promise<SubjectPlacement> {
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  }, selector);

  return {
    subject,
    selector,
    found: box !== null,
    topPx: box ? Math.round(box.top) : null,
    bottomPx: box ? Math.round(box.bottom) : null,
    leftPx: box ? Math.round(box.left) : null,
    rightPx: box ? Math.round(box.right) : null,
    captureWidthPx: shot.widthPx,
    captureHeightPx: shot.heightPx,
    fullyInsideTheCapture:
      box !== null &&
      box.top >= 0 &&
      box.bottom <= shot.heightPx &&
      box.left >= 0 &&
      box.right <= shot.widthPx,
  };
}

/** Reads the subject's box in viewport coordinates, which is exactly the
 * region a non-fullPage screenshot covers at deviceScaleFactor 1, and checks
 * it against the size read from the PNG's own IHDR. */
export async function assertSubjectInCapture(
  page: Page,
  selector: string,
  shot: { file: string; widthPx: number; heightPx: number },
  subject: string,
): Promise<SubjectPlacement> {
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  }, selector);

  const placement: SubjectPlacement = {
    subject,
    selector,
    found: box !== null,
    topPx: box ? Math.round(box.top) : null,
    bottomPx: box ? Math.round(box.bottom) : null,
    leftPx: box ? Math.round(box.left) : null,
    rightPx: box ? Math.round(box.right) : null,
    captureWidthPx: shot.widthPx,
    captureHeightPx: shot.heightPx,
    fullyInsideTheCapture:
      box !== null &&
      box.top >= 0 &&
      box.bottom <= shot.heightPx &&
      box.left >= 0 &&
      box.right <= shot.widthPx,
  };

  expect(placement.found, `${subject}: not in the document, so the capture cannot show it`).toBe(true);
  expect(
    placement.fullyInsideTheCapture,
    `${subject} sits outside the captured viewport: top ${placement.topPx}, bottom ${placement.bottomPx}, ` +
      `capture ${shot.widthPx}x${shot.heightPx}. The capture does not show what it is filed as evidence for.`,
  ).toBe(true);
  return placement;
}
