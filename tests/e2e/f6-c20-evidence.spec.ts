// F6 (the UNCERTAIN pair) and C20 (every empty state names the next action).
//
// Both lines were built today and neither has ever been seen rendered. The
// build in .next before this pass was 7JzsJmX3Ve24jbZ-g46Vt, which predates
// both changes, so every number here is taken against a rebuild and the
// BUILD_ID is written into every artifact this file produces.
//
// Two clauses cannot be settled from source and are the reason this file
// exists:
//   F6  "both photographs side by side" is geometry, and
//       "count of preselected candidates is 0" is a runtime property.
//   C20 the no-photo frame measured 318 x 238.5 px with 0 VISIBLE text
//       nodes. A .srOnly span is in the DOM and is not visible; counting
//       DOM nodes is what made that state read as a pass.
//
// Every counter here carries a negative control, because a counter that has
// never returned the other answer has not been shown to be able to.

import { expect, test } from "@playwright/test";
import {
  assertProductionTarget,
  assertScaleOne,
  capture,
  repoRelative,
  settle,
  writeEvidence,
} from "./harness";
import { readFileSync } from "node:fs";
import path from "node:path";

const SEL = {
  input: "#check-identifier",
  submit: 'form button[type="submit"]',
  slab: "section.vslab",
  word: "section.vslab .vword",
  recognizedLabel: "section.vslab .vlead.mono",
  candidate: "section.vslab .candidateRow .btn",
};

const COPY = {
  addToCollection: "Add to collection",
  thirdDoor: "Neither. Add a new variant.",
};

// Verified against the served /api/sync/index in beforeAll rather than
// trusted: an earlier pass reported it as an UNCERTAIN collision and a
// reseed could have made that false.
const COLLIDING_IDENTIFIER = "3014202";

const VIEWPORT_WIDTH = 390;

let buildId = "unknown";
let unambiguous: string[] = [];

// ---------------------------------------------------------------------------
// The in-page instruments. Defined as strings so one definition serves every
// page.evaluate call and the same code measures the subject and the control.

const INSTRUMENT = `
window.__vit = (function () {
  function sel(el) {
    if (!el) return "(none)";
    const cls = (el.getAttribute("class") || "").trim().split(/\\s+/).filter(Boolean);
    return el.tagName.toLowerCase() + (cls.length ? "." + cls.join(".") : "");
  }
  function box(r) {
    return {
      xPx: +r.x.toFixed(2), yPx: +r.y.toFixed(2),
      widthPx: +r.width.toFixed(2), heightPx: +r.height.toFixed(2),
      leftPx: +r.left.toFixed(2), rightPx: +r.right.toFixed(2),
      topPx: +r.top.toFixed(2), bottomPx: +r.bottom.toFixed(2),
    };
  }

  /**
   * Counts VISIBLE text nodes under a root, and says why each rejected one
   * was rejected.
   *
   * Clipping is decided by hit testing, not by the presence of a clip-path.
   * The first version of this counter rejected any node with a clipped
   * ancestor and so scored the OWNED no-photo frame at 0 because the slab
   * carries a 20 px corner cut and the wipe wrapper carries a fully open
   * inset. Neither covers a single glyph. So each text node's own line boxes
   * are sampled on a 7x3 grid and each sample asks the document which
   * elements are actually painted at that point; a clip that removes the
   * text removes it from the stack, and a clip that does not, does not.
   *
   * Sampling needs the text inside the viewport, so the caller scrolls
   * first; a node whose samples all fall outside is reported as such rather
   * than counted either way.
   */
  function textNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const visible = [], hidden = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.nodeValue || "").replace(/\\s+/g, " ").trim();
      if (!text) continue;
      const parent = node.parentElement;
      const why = [];
      const clipPathAncestors = [];
      if (!parent) {
        hidden.push({ text: text, why: ["no parent element"] });
        continue;
      }
      let pointerEventsNoneOnChain = false;
      let el = parent;
      while (el && el !== document.documentElement) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (cs.display === "none") why.push("display:none on " + sel(el));
        if (cs.visibility !== "visible") why.push("visibility:" + cs.visibility + " on " + sel(el));
        if (parseFloat(cs.opacity) < 0.05) why.push("opacity:" + cs.opacity + " on " + sel(el));
        if (cs.pointerEvents === "none") pointerEventsNoneOnChain = true;
        if (cs.clipPath && cs.clipPath !== "none") clipPathAncestors.push(sel(el) + " " + cs.clipPath);
        const clipping = cs.overflow !== "visible" || cs.overflowX !== "visible" || cs.overflowY !== "visible";
        if (clipping && (r.width <= 2 || r.height <= 2)) {
          why.push(r.width.toFixed(1) + "x" + r.height.toFixed(1) + " box with overflow:" + cs.overflow + " on " + sel(el));
        }
        el = el.parentElement;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      const lineBoxes = [...range.getClientRects()];
      if (rect.width < 1 || rect.height < 1) {
        why.push("zero-area text rect " + rect.width.toFixed(1) + "x" + rect.height.toFixed(1));
      }
      const COLS = 7, ROWS = 3;
      let samples = 0, hits = 0, offscreen = 0;
      for (const lb of lineBoxes) {
        if (lb.width < 1 || lb.height < 1) continue;
        for (let i = 0; i < COLS; i++) {
          for (let j = 0; j < ROWS; j++) {
            const x = lb.left + ((i + 0.5) / COLS) * lb.width;
            const y = lb.top + ((j + 0.5) / ROWS) * lb.height;
            samples += 1;
            if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) { offscreen += 1; continue; }
            if ([...document.elementsFromPoint(x, y)].indexOf(parent) !== -1) hits += 1;
          }
        }
      }
      const testable = samples - offscreen;
      const shown = testable > 0 ? hits / testable : 0;
      if (samples === 0) why.push("no line box with area to sample");
      else if (testable === 0) why.push("all " + samples + " sample points fell outside the viewport; not measured");
      else if (shown < 0.995) {
        why.push("painted at " + hits + " of " + testable + " sample points inside its own line boxes");
        if (pointerEventsNoneOnChain) why.push("pointer-events:none on the ancestor chain may understate this hit test");
      }
      const record = {
        text: text,
        parent: sel(parent),
        rect: box(rect),
        lineBoxCount: lineBoxes.length,
        samplePoints: samples,
        samplePointsOutsideViewport: offscreen,
        samplePointsPainted: hits,
        shownFraction: +shown.toFixed(4),
        clipPathAncestors: clipPathAncestors,
      };
      if (why.length) { record.why = why; hidden.push(record); }
      else visible.push(record);
    }
    return {
      visibleCount: visible.length,
      visibleText: visible.map(function (v) { return v.text; }),
      visible: visible,
      hiddenCount: hidden.length,
      hidden: hidden,
    };
  }

  /** Geometry only. Two boxes are side by side when they do not overlap
   * horizontally and do overlap vertically; stacked is the mirror of that. */
  function arrangement(a, b) {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const hOverlap = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
    const vOverlap = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    let verdict = "overlapping";
    if (hOverlap <= 0.5 && vOverlap > 0.5) verdict = "side-by-side";
    else if (vOverlap <= 0.5 && hOverlap > 0.5) verdict = "stacked";
    return {
      verdict: verdict,
      horizontalOverlapPx: +hOverlap.toFixed(2),
      verticalOverlapPx: +vOverlap.toFixed(2),
      horizontalGapPx: +(Math.max(ra.left, rb.left) - Math.min(ra.right, rb.right)).toFixed(2),
      verticalGapPx: +(Math.max(ra.top, rb.top) - Math.min(ra.bottom, rb.bottom)).toFixed(2),
      a: box(ra), b: box(rb),
      sameTop: Math.abs(ra.top - rb.top) < 0.5,
    };
  }

  /** Numeric containment, not a look. Positive overflow on any side is text
   * leaving the frame that .photoFrame { overflow: hidden } would cut. */
  function containment(frame, child) {
    const f = frame.getBoundingClientRect(), c = child.getBoundingClientRect();
    const over = {
      leftPx: +(f.left - c.left).toFixed(2),
      rightPx: +(c.right - f.right).toFixed(2),
      topPx: +(f.top - c.top).toFixed(2),
      bottomPx: +(c.bottom - f.bottom).toFixed(2),
    };
    const worst = Math.max(over.leftPx, over.rightPx, over.topPx, over.bottomPx);
    return {
      child: sel(child),
      frame: box(f),
      childBox: box(c),
      overflowPx: over,
      worstOverflowPx: +worst.toFixed(2),
      containedInFrame: worst <= 0,
    };
  }

  function styleOf(el, props) {
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of props) out[p] = cs[p];
    return out;
  }

  function interactive(root) {
    const nodes = [...root.querySelectorAll('button, a, input, select, textarea, [role="button"], [tabindex]')];
    return nodes
      .filter(function (el) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
      })
      .map(function (el) {
        const r = el.getBoundingClientRect();
        return {
          selector: sel(el),
          label: (el.getAttribute("aria-label") || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 60),
          widthPx: +r.width.toFixed(2),
          heightPx: +r.height.toFixed(2),
          shortestSidePx: +Math.min(r.width, r.height).toFixed(2),
        };
      });
  }

  return {
    sel: sel, box: box, textNodes: textNodes, arrangement: arrangement,
    containment: containment, styleOf: styleOf, interactive: interactive,
  };
})();
`;

const WEIGHT_PROPS = [
  "fontFamily", "fontSize", "fontWeight", "fontStretch", "letterSpacing", "textTransform",
  "color", "backgroundColor", "backgroundImage", "opacity", "boxShadow", "clipPath",
  "borderTopWidth", "borderTopStyle", "borderTopColor",
  "borderBottomWidth", "borderBottomStyle", "borderBottomColor",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "minHeight", "width", "height", "borderRadius", "textDecorationLine",
];

// Attributes and classes that would mark a candidate as already chosen.
// Every one of them is read, because "preselected" has no single spelling.
const SELECTED_ATTRS = [
  "aria-pressed", "aria-selected", "aria-checked", "aria-current",
  "data-selected", "data-state", "data-active", "checked", "selected",
];
const SELECTED_CLASS_HINTS = ["selected", "active", "current", "chosen", "picked", "on", "pri"];

// The two shapes the instrument returns that are read back in Node. window.__vit
// is untyped on purpose (it is injected source, not a module), so the shapes it
// hands back are named here rather than left implicitly any.
type Target = {
  selector: string;
  label: string;
  widthPx: number;
  heightPx: number;
  shortestSidePx: number;
};
type HiddenTextNode = { text: string; shownFraction: number; why?: string[] };

// ---------------------------------------------------------------------------

test.beforeAll(async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext();
  const res = await request.get(new URL("/api/sync/index", baseURL!).toString());
  expect(res.ok(), "catalogue index unavailable").toBeTruthy();
  const body = (await res.json()) as { rows: { normalizedIdentifiers: string[]; variantPublicId: string }[] };
  const byIdentifier = new Map<string, Set<string>>();
  for (const row of body.rows) {
    for (const id of row.normalizedIdentifiers) {
      if (!byIdentifier.has(id)) byIdentifier.set(id, new Set());
      byIdentifier.get(id)!.add(row.variantPublicId);
    }
  }
  unambiguous = [...byIdentifier.entries()].filter(([, v]) => v.size === 1).map(([id]) => id);
  const collides = byIdentifier.get(COLLIDING_IDENTIFIER);
  expect(
    collides ? collides.size : 0,
    `${COLLIDING_IDENTIFIER} against the catalogue this server is serving`,
  ).toBeGreaterThanOrEqual(2);
  await request.dispose();
});

// ---------------------------------------------------------------------------
// Step 1. The target, before any measurement.

test("target: the served build is the rebuild, and the old BUILD_ID is gone", async ({
  request,
  page,
  baseURL,
}) => {
  const target = await assertProductionTarget(request, baseURL!);
  buildId = target.buildIdOnDisk ?? "unknown";

  const html = await (await request.get(baseURL!)).text();
  const OLD_BUILD_ID = "7JzsJmX3Ve24jbZ-g46Vt";
  const oldStillServed = html.includes(OLD_BUILD_ID);

  await page.goto("/");
  await settle(page);
  const scale = await assertScaleOne(page, VIEWPORT_WIDTH, "target");

  const record = {
    line: "target",
    oldBuildIdReplaced: OLD_BUILD_ID,
    newBuildId: buildId,
    oldBuildIdStillInServedHtml: oldStillServed,
    ...target,
    scale,
  };
  const file = writeEvidence("f6-c20-target.json", record);
  console.log(`[target] build ${buildId} at ${baseURL} -> ${file}`);

  expect(oldStillServed, "the pre-F6 build id is still in the served HTML").toBe(false);
  expect(buildId, "the served build is not the old one").not.toBe(OLD_BUILD_ID);
});

// ---------------------------------------------------------------------------
// Step 3. F6.

test("F6: the UNCERTAIN pair, every clause measured at 390 px", async ({ page, baseURL }) => {
  await page.goto("/");
  await expect(page.locator(SEL.input)).toBeVisible();

  // Sync has to land before an identifier can collide with anything.
  await expect(async () => {
    await page.fill(SEL.input, unambiguous[0]!);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.recognizedLabel)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 500, 1000] });

  await page.fill(SEL.input, COLLIDING_IDENTIFIER);
  await page.click(SEL.submit);
  await expect(page.locator(SEL.slab)).toHaveCount(1);
  await expect(page.locator(SEL.word)).toBeVisible();
  await settle(page);

  const scale = await assertScaleOne(page, VIEWPORT_WIDTH, "F6 UNCERTAIN");
  await page.addScriptTag({ content: INSTRUMENT });

  // Two captures at two recorded scroll offsets. The first is the screen as
  // it stands the instant the verdict paints, unscrolled, which is what a
  // collector sees; at 390 px it stops above the candidate pair. The second
  // is scrolled to the pair and holds the whole slab, every clause in one
  // frame. Viewport captures both, never fullPage, and the offsets are in
  // the record so either framing can be reproduced rather than rediscovered.
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  const shotSlab = await capture(page, "f6-uncertain-slab-390");
  const scrollYAtSlab = await page.evaluate(() => Math.round(window.scrollY));

  // --- clause: renders UNCERTAIN, no corner cut, dashed edge ---------------
  const slab = await page.evaluate(() => {
    const el = document.querySelector("section.vslab") as HTMLElement;
    const cs = getComputedStyle(el);
    return {
      documentTopPx: +(el.getBoundingClientRect().top + window.scrollY).toFixed(2),
      documentBottomPx: +(el.getBoundingClientRect().bottom + window.scrollY).toFixed(2),
      dataVerdict: el.getAttribute("data-verdict"),
      classList: [...el.classList],
      verdictWord: (document.querySelector("section.vslab .vword")?.textContent ?? "").trim(),
      clipPath: cs.clipPath,
      cutClasses: [...el.classList].filter((c) => c.startsWith("cut")),
      border: {
        topStyle: cs.borderTopStyle, topWidth: cs.borderTopWidth, topColor: cs.borderTopColor,
        rightStyle: cs.borderRightStyle, rightWidth: cs.borderRightWidth,
        bottomStyle: cs.borderBottomStyle, bottomWidth: cs.borderBottomWidth,
        leftStyle: cs.borderLeftStyle, leftWidth: cs.borderLeftWidth,
      },
      borderRadius: cs.borderRadius,
      box: window.__vit.box(el.getBoundingClientRect()),
    };
  });

  // --- clause: both photographs side by side ------------------------------
  const frames = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("section.vslab .candidateRow .candCard")];
    const photoFrames = cards.map((c) => c.querySelector(".photoFrame") as HTMLElement);
    const row = document.querySelector("section.vslab .candidateRow") as HTMLElement;
    return {
      cardCount: cards.length,
      frameCount: photoFrames.filter(Boolean).length,
      frameClasses: photoFrames.map((f) => (f ? [...f.classList] : null)),
      rowDisplay: getComputedStyle(row).display,
      rowTemplateColumns: getComputedStyle(row).gridTemplateColumns,
      rowGap: getComputedStyle(row).gap,
      frameBoxes: photoFrames.map((f) => window.__vit.box(f.getBoundingClientRect())),
      arrangement:
        photoFrames.length === 2 && photoFrames[0] && photoFrames[1]
          ? window.__vit.arrangement(photoFrames[0], photoFrames[1])
          : null,
      cardArrangement:
        cards.length === 2 ? window.__vit.arrangement(cards[0] as HTMLElement, cards[1] as HTMLElement) : null,
    };
  });

  // Negative control for the side-by-side detector: force one column and
  // confirm the same function returns "stacked", then put it back.
  const stackedControl = await page.evaluate(() => {
    const style = document.createElement("style");
    style.id = "vit-stack-control";
    style.textContent = "section.vslab .candidateRow { grid-template-columns: 1fr !important; }";
    document.head.appendChild(style);
    const cards = [...document.querySelectorAll("section.vslab .candidateRow .candCard")];
    const frames = cards.map((c) => c.querySelector(".photoFrame") as HTMLElement);
    const result = window.__vit.arrangement(frames[0], frames[1]);
    style.remove();
    return result;
  });
  await settle(page);
  const restored = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("section.vslab .candidateRow .candCard")];
    const frames = cards.map((c) => c.querySelector(".photoFrame") as HTMLElement);
    return window.__vit.arrangement(frames[0], frames[1]);
  });

  // --- the builder's flagged risk: does the no-photo copy fit the frame? ---
  // Scrolled into view first: the visible-text counter hit tests real
  // painted pixels, which only exist inside the viewport.
  // Centred, not merely "in view": scrollIntoViewIfNeeded stops the moment
  // the row is reachable, which left the slab's dashed top border 7 px above
  // the viewport. The slab is shorter than 844 px, so it is centred whole.
  await page.evaluate(() => {
    const el = document.querySelector("section.vslab") as HTMLElement;
    const r = el.getBoundingClientRect();
    const documentTop = r.top + window.scrollY;
    const target =
      r.height <= window.innerHeight - 24
        ? documentTop - (window.innerHeight - r.height) / 2
        : (document.querySelector("section.vslab .candidateRow") as HTMLElement).getBoundingClientRect().top +
          window.scrollY -
          80;
    window.scrollTo(0, Math.max(0, Math.round(target)));
  });
  await settle(page);
  const shotCandidates = await capture(page, "f6-uncertain-candidates-390");
  const scrollYAtCandidates = await page.evaluate(() => Math.round(window.scrollY));

  // Two measurements that are NOT rubric clauses. F6 says identical weight,
  // which is styling, and the styling is identical. These are divergences
  // from the approved comp, recorded as numbers so the decision to fix or
  // keep is made against a measurement rather than off a screenshot.
  const compDivergences = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("section.vslab .candidateRow .btn")] as HTMLElement[];
    const cards = [...document.querySelectorAll("section.vslab .candidateRow .candCard")] as HTMLElement[];
    const lineRects = (el: HTMLElement) => {
      const node = [...el.childNodes].find(
        (n) => n.nodeType === 3 && (n.nodeValue ?? "").trim().length > 0,
      );
      if (!node) return null;
      const range = document.createRange();
      range.selectNodeContents(node);
      const lines = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
      return {
        text: (node.nodeValue ?? "").replace(/\s+/g, " ").trim(),
        lineCount: lines.length,
        lineWidthsPx: lines.map((r) => +r.width.toFixed(2)),
        lineHeightsPx: lines.map((r) => +r.height.toFixed(2)),
        textBlockHeightPx: lines.length
          ? +(Math.max(...lines.map((r) => r.bottom)) - Math.min(...lines.map((r) => r.top))).toFixed(2)
          : 0,
      };
    };
    const tops = btns.map((b) => +b.getBoundingClientRect().top.toFixed(2));
    const names = cards.map((c) => {
      const n = c.querySelector(".candName") as HTMLElement | null;
      return n ? lineRects(n) : null;
    });
    return {
      pickButtons: btns.map((b, i) => {
        const r = b.getBoundingClientRect();
        const cs = getComputedStyle(b);
        return {
          index: i,
          topPx: +r.top.toFixed(2),
          bottomPx: +r.bottom.toFixed(2),
          widthPx: +r.width.toFixed(2),
          heightPx: +r.height.toFixed(2),
          fontSizePx: cs.fontSize,
          lineHeight: cs.lineHeight,
          label: lineRects(b),
        };
      }),
      buttonTopDeltaPx: tops.length === 2 ? +Math.abs(tops[0]! - tops[1]!).toFixed(2) : null,
      buttonBottomDeltaPx:
        btns.length === 2
          ? +Math.abs(btns[0]!.getBoundingClientRect().bottom - btns[1]!.getBoundingClientRect().bottom).toFixed(2)
          : null,
      sharedBaseline: tops.length === 2 ? Math.abs(tops[0]! - tops[1]!) < 0.5 : null,
      cardTitles: names,
      cardBoxes: cards.map((c) => {
        const r = c.getBoundingClientRect();
        return { topPx: +r.top.toFixed(2), heightPx: +r.height.toFixed(2), widthPx: +r.width.toFixed(2) };
      }),
    };
  });

  const clipping = await page.evaluate(() => {
    const frames = [...document.querySelectorAll("section.vslab .candidateRow .photoFrame")] as HTMLElement[];
    return frames.map((f, i) => {
      const children = [...f.children] as HTMLElement[];
      return {
        index: i,
        frame: window.__vit.box(f.getBoundingClientRect()),
        overflowStyle: getComputedStyle(f).overflow,
        clientWidthPx: f.clientWidth,
        clientHeightPx: f.clientHeight,
        scrollWidthPx: f.scrollWidth,
        scrollHeightPx: f.scrollHeight,
        scrollOverflowXPx: f.scrollWidth - f.clientWidth,
        scrollOverflowYPx: f.scrollHeight - f.clientHeight,
        children: children.map((c) => window.__vit.containment(f, c)),
        text: window.__vit.textNodes(f),
      };
    });
  });

  // --- clause: the differing field written as a sentence -------------------
  const sentences = await page.evaluate(() =>
    [...document.querySelectorAll("section.vslab .vlead")].map((el) =>
      (el.textContent ?? "").replace(/\s+/g, " ").trim(),
    ),
  );
  const differenceSentence =
    sentences.find(
      (s, i) => i > 0 && s.endsWith(".") && s.split(/\s+/).length >= 5,
    ) ?? null;

  // --- clause: 2 candidate buttons, identical weight, 0 primary ------------
  const buttons = await page.evaluate(
    ({ props, attrs, hints }) => {
      const btns = [...document.querySelectorAll("section.vslab .candidateRow .btn")] as HTMLElement[];
      // A live probe of what "styled as primary" computes to in this build,
      // rather than a class-name match alone.
      const probe = document.createElement("button");
      probe.className = "btn pri b56 full";
      probe.textContent = "probe";
      const host = document.querySelector("section.vslab .candidateRow .fw.block") ?? document.body;
      host.appendChild(probe);
      const probeStyle = window.__vit.styleOf(probe, ["backgroundColor", "color", "borderTopStyle", "borderTopColor"]);
      probe.remove();

      const read = btns.map((b) => {
        const r = b.getBoundingClientRect();
        const style = window.__vit.styleOf(b, props);
        const marks: Record<string, string | null> = {};
        for (const a of attrs) marks[a] = b.getAttribute(a);
        const inputChecked = b instanceof HTMLInputElement ? b.checked : null;
        return {
          selector: window.__vit.sel(b),
          classList: [...b.classList],
          label: (b.textContent ?? "").replace(/\s+/g, " ").trim(),
          box: window.__vit.box(r),
          shortestSidePx: +Math.min(r.width, r.height).toFixed(2),
          style,
          hasPriClass: b.classList.contains("pri"),
          matchesPrimaryPaint:
            style.backgroundColor === probeStyle.backgroundColor && style.color === probeStyle.color,
          selectedMarks: marks,
          selectedMarkCount: Object.values(marks).filter((v) => v !== null && v !== "false").length,
          inputChecked,
          classHints: [...b.classList].filter((c) => hints.includes(c.toLowerCase())),
          disabled: (b as HTMLButtonElement).disabled ?? null,
          tabIndex: (b as HTMLButtonElement).tabIndex,
          isDocumentActiveElement: document.activeElement === b,
        };
      });

      // The whole candidate area, not just the buttons: a preselection could
      // be marked on the card rather than on its control.
      const row = document.querySelector("section.vslab .candidateRow") as HTMLElement;
      const markedAnywhere: string[] = [];
      for (const el of [...row.querySelectorAll("*")] as HTMLElement[]) {
        for (const a of attrs) {
          const v = el.getAttribute(a);
          if (v !== null && v !== "false") markedAnywhere.push(`${window.__vit.sel(el)}[${a}="${v}"]`);
        }
        for (const c of [...el.classList]) {
          if (hints.includes(c.toLowerCase())) markedAnywhere.push(`${window.__vit.sel(el)} class "${c}"`);
        }
      }
      const checkedInputs = [...row.querySelectorAll("input")].filter((i) => (i as HTMLInputElement).checked).length;

      return { probeStyle, buttons: read, markedAnywhere, checkedInputs };
    },
    { props: WEIGHT_PROPS, attrs: SELECTED_ATTRS, hints: SELECTED_CLASS_HINTS },
  );

  const weightDiff: string[] = [];
  if (buttons.buttons.length === 2) {
    const [a, b] = buttons.buttons;
    for (const p of WEIGHT_PROPS) {
      const va = (a!.style as Record<string, string>)[p];
      const vb = (b!.style as Record<string, string>)[p];
      if (va !== vb) weightDiff.push(`${p}: "${va}" against "${vb}"`);
    }
  }

  // --- clause: a third door ------------------------------------------------
  const doors = await page.evaluate((thirdDoorText) => {
    const slab = document.querySelector("section.vslab") as HTMLElement;
    const all = [...slab.querySelectorAll("button")] as HTMLButtonElement[];
    const outside = all.filter((b) => !b.closest(".candidateRow"));
    return {
      buttonsInSlab: all.length,
      buttonsOutsideCandidateRow: outside.map((b) => ({
        label: (b.textContent ?? "").replace(/\s+/g, " ").trim(),
        classList: [...b.classList],
        box: window.__vit.box(b.getBoundingClientRect()),
      })),
      thirdDoorPresent: outside.some((b) => (b.textContent ?? "").trim() === thirdDoorText),
    };
  }, COPY.thirdDoor);

  // --- step 5: what the .candidateRow grid change could have moved ---------
  const targets = await page.evaluate(() => {
    // The whole document, not just main: the grid change sits inside main
    // but a 44 px floor is a floor everywhere on the screen.
    return {
      interactive: window.__vit.interactive(document.body),
      documentScrollWidthPx: document.documentElement.scrollWidth,
      documentClientWidthPx: document.documentElement.clientWidth,
    };
  });
  const under44 = (targets.interactive as Target[]).filter((t: Target) => t.shortestSidePx < 44);
  const pickButtonShortestSides = buttons.buttons.map((b) => b.shortestSidePx);


  const record = {
    line: "F6",
    buildId,
    baseUrl: baseURL,
    identifier: COLLIDING_IDENTIFIER,
    viewportWidthPx: VIEWPORT_WIDTH,
    scale,
    captures: {
      slabTop: { ...shotSlab, windowScrollYPx: scrollYAtSlab },
      candidatePair: { ...shotCandidates, windowScrollYPx: scrollYAtCandidates },
    },
    clauses: {
      rendersUncertain: {
        dataVerdict: slab.dataVerdict,
        verdictWord: slab.verdictWord,
        slabBox: slab.box,
        slabDocumentTopPx: slab.documentTopPx,
        slabDocumentBottomPx: slab.documentBottomPx,
        pass: slab.dataVerdict === "UNCERTAIN",
      },
      noCornerCut: {
        clipPath: slab.clipPath,
        cutClasses: slab.cutClasses,
        borderRadius: slab.borderRadius,
        pass: slab.clipPath === "none" && slab.cutClasses.length === 0,
      },
      dashedEdge: { border: slab.border, pass: slab.border.topStyle === "dashed" },
      bothPhotographsSideBySide: {
        frameCount: frames.frameCount,
        frameClasses: frames.frameClasses,
        rowDisplay: frames.rowDisplay,
        rowTemplateColumns: frames.rowTemplateColumns,
        frameBoxes: frames.frameBoxes,
        arrangement: frames.arrangement,
        cardArrangement: frames.cardArrangement,
        pass: frames.frameCount === 2 && frames.arrangement?.verdict === "side-by-side",
      },
      differingFieldAsSentence: {
        allLeadParagraphs: sentences,
        sentence: differenceSentence,
        wordCount: differenceSentence ? differenceSentence.split(/\s+/).length : 0,
        endsWithFullStop: differenceSentence ? differenceSentence.endsWith(".") : false,
        pass: differenceSentence !== null,
      },
      twoCandidateButtonsIdenticalWeight: {
        count: buttons.buttons.length,
        labels: buttons.buttons.map((b) => b.label),
        classLists: buttons.buttons.map((b) => b.classList),
        differingComputedProperties: weightDiff,
        pass: buttons.buttons.length === 2 && weightDiff.length === 0,
      },
      candidateButtonsStyledAsPrimary: {
        primaryProbeStyle: buttons.probeStyle,
        perButton: buttons.buttons.map((b) => ({
          label: b.label,
          hasPriClass: b.hasPriClass,
          matchesPrimaryPaint: b.matchesPrimaryPaint,
          backgroundColor: b.style.backgroundColor,
          color: b.style.color,
        })),
        count: buttons.buttons.filter((b) => b.hasPriClass || b.matchesPrimaryPaint).length,
        pass: buttons.buttons.filter((b) => b.hasPriClass || b.matchesPrimaryPaint).length === 0,
      },
      preselectedCandidates: {
        measuredBeforeAnyInteraction: true,
        attributesRead: SELECTED_ATTRS,
        classHintsRead: SELECTED_CLASS_HINTS,
        perButton: buttons.buttons.map((b) => ({
          label: b.label,
          selectedMarks: b.selectedMarks,
          selectedMarkCount: b.selectedMarkCount,
          inputChecked: b.inputChecked,
          classHints: b.classHints,
          isDocumentActiveElement: b.isDocumentActiveElement,
        })),
        markedAnywhereInCandidateRow: buttons.markedAnywhere,
        checkedInputsInCandidateRow: buttons.checkedInputs,
        count:
          buttons.buttons.reduce((n, b) => n + b.selectedMarkCount + b.classHints.length, 0) +
          buttons.markedAnywhere.length +
          buttons.checkedInputs,
        pass:
          buttons.buttons.every((b) => b.selectedMarkCount === 0 && b.classHints.length === 0) &&
          buttons.markedAnywhere.length === 0 &&
          buttons.checkedInputs === 0,
      },
      thirdDoor: {
        ...doors,
        pass: doors.thirdDoorPresent,
      },
    },
    // Not rubric clauses. Recorded because they were asked for as numbers.
    divergencesFromTheComp: {
      note:
        "F6 measures identical weight, which is styling, and the styling is identical. " +
        "Neither entry below is a violation of the line.",
      pickButtonsShareABaseline: {
        question: "do the two pick buttons sit on one baseline in the two-up comparison",
        topPx: compDivergences.pickButtons.map((b) => b.topPx),
        buttonTopDeltaPx: compDivergences.buttonTopDeltaPx,
        buttonBottomDeltaPx: compDivergences.buttonBottomDeltaPx,
        sharedBaseline: compDivergences.sharedBaseline,
        cause: "candidate title line count, not styling",
        candidateTitleLineCounts: compDivergences.cardTitles.map((t) => t?.lineCount ?? null),
        candidateTitles: compDivergences.cardTitles.map((t) => t?.text ?? null),
        cardBoxes: compDivergences.cardBoxes,
        measuredAtScrollYPx: scrollYAtCandidates,
      },
      pickButtonLabelWrap: {
        question: "how many lines does the label take in a 151 px column",
        labelText: compDivergences.pickButtons[0]?.label?.text ?? null,
        lineCount: compDivergences.pickButtons[0]?.label?.lineCount ?? null,
        lineWidthsPx: compDivergences.pickButtons[0]?.label?.lineWidthsPx ?? null,
        textBlockHeightPx: compDivergences.pickButtons[0]?.label?.textBlockHeightPx ?? null,
        buttonBoxPx: compDivergences.pickButtons.map((b) => `${b.widthPx} x ${b.heightPx}`),
        fontSizePx: compDivergences.pickButtons[0]?.fontSizePx ?? null,
        lineHeight: compDivergences.pickButtons[0]?.lineHeight ?? null,
        compWording: "This one",
        shippedWording: compDivergences.pickButtons[0]?.label?.text ?? null,
      },
    },
    builderFlaggedRisk: {
      question: "do .npLead and .npAction fit a 165 px photo frame that sets overflow: hidden",
      frames: clipping,
      worstOverflowPx: Math.max(...clipping.flatMap((f) => f.children.map((c) => c.worstOverflowPx))),
      anyScrollOverflow: clipping.some((f) => f.scrollOverflowXPx > 0 || f.scrollOverflowYPx > 0),
      pass:
        clipping.every((f) => f.children.every((c) => c.containedInFrame)) &&
        clipping.every((f) => f.scrollOverflowXPx <= 0 && f.scrollOverflowYPx <= 0),
    },
    controls: {
      sideBySideDetectorOnAForcedSingleColumn: {
        purpose: "prove the detector can return stacked",
        result: stackedControl,
        pass: stackedControl.verdict === "stacked",
      },
      sideBySideRestoredAfterControl: {
        result: restored,
        pass: restored.verdict === "side-by-side",
      },
    },
    step5AfterTheGridChange: {
      pickButtonShortestSidePx: pickButtonShortestSides,
      interactiveTargetsMeasured: targets.interactive.length,
      minimumShortestSidePx: Math.min(...(targets.interactive as Target[]).map((t: Target) => t.shortestSidePx)),
      under44: under44,
      under44Count: under44.length,
      documentScrollWidthPx: targets.documentScrollWidthPx,
      documentClientWidthPx: targets.documentClientWidthPx,
      allTargets: targets.interactive,
    },
    measuredAtIso: new Date().toISOString(),
  };

  const file = writeEvidence("f6-uncertain.json", record);
  console.log(
    `[F6] build ${buildId} -> ${file}, captures ${shotSlab.file} ${shotSlab.widthPx}x${shotSlab.heightPx} ` +
      `and ${shotCandidates.file} ${shotCandidates.widthPx}x${shotCandidates.heightPx}`,
  );

  // Assertions last, so every number is on disk whatever fails.
  expect(slab.dataVerdict, "verdict kind").toBe("UNCERTAIN");
  expect(slab.clipPath, "no corner cut").toBe("none");
  expect(slab.cutClasses, "no cut class").toEqual([]);
  expect(slab.border.topStyle, "dashed edge").toBe("dashed");
  expect(frames.frameCount, "photograph frames in the candidate row").toBe(2);
  expect(frames.arrangement?.verdict, "the two photographs").toBe("side-by-side");
  expect(stackedControl.verdict, "control: the detector can see a stack").toBe("stacked");
  expect(restored.verdict, "control removed, the real layout again").toBe("side-by-side");
  expect(differenceSentence, "the differing field written as a sentence").not.toBeNull();
  expect(buttons.buttons.length, "candidate buttons").toBe(2);
  expect(weightDiff, "identical weight: differing computed properties").toEqual([]);
  expect(record.clauses.candidateButtonsStyledAsPrimary.count, "candidate buttons styled as primary").toBe(0);
  expect(record.clauses.preselectedCandidates.count, "preselected candidates").toBe(0);
  expect(doors.thirdDoorPresent, "a third door").toBe(true);
  expect(record.builderFlaggedRisk.worstOverflowPx, "worst text overflow out of the photo frame").toBeLessThanOrEqual(0);
  expect(under44, "targets under 44 px after the grid change").toEqual([]);
  expect(targets.documentScrollWidthPx, "document scrollWidth at 390").toBe(390);
  expect(shotSlab.widthPx, "slab capture width from the PNG IHDR").toBe(390);
  expect(shotCandidates.widthPx, "candidate-pair capture width from the PNG IHDR").toBe(390);
});

// ---------------------------------------------------------------------------
// Step 4. C20, both scales.

test("C20: the no-photo state at 318 px and at 56 px, visible text counted", async ({ page, baseURL }) => {
  const identifier = unambiguous[0]!;
  await page.goto("/");
  await expect(page.locator(SEL.input)).toBeVisible();
  await expect(async () => {
    await page.fill(SEL.input, identifier);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.recognizedLabel)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 500, 1000] });

  // Own it, so the OWNED verdict renders, with no photograph filed.
  await page.getByRole("button", { name: COPY.addToCollection }).click();
  await expect(page.locator(SEL.slab)).toContainText("Saved to your collection.");
  await page.fill(SEL.input, identifier);
  await page.click(SEL.submit);
  await expect(page.locator(SEL.word)).toBeVisible();
  await settle(page);

  const scale = await assertScaleOne(page, VIEWPORT_WIDTH, "C20 OWNED");
  await page.addScriptTag({ content: INSTRUMENT });

  // The OWNED slab runs past 844 px, so the no-photo frame starts below the
  // fold. Measured and captured where it is actually painted.
  await page.locator("section.vslab .photoFrame").scrollIntoViewIfNeeded();
  await settle(page);
  const scrollYAtFrame = await page.evaluate(() => Math.round(window.scrollY));

  const verdictKind = await page.evaluate(
    () => document.querySelector("section.vslab")?.getAttribute("data-verdict") ?? null,
  );

  const largeFrame = await page.evaluate(() => {
    const f = document.querySelector("section.vslab .photoFrame") as HTMLElement;
    if (!f) return null;
    const r = f.getBoundingClientRect();
    return {
      selector: window.__vit.sel(f),
      classList: [...f.classList],
      box: window.__vit.box(r),
      sizeLabel: `${r.width.toFixed(1)} x ${r.height.toFixed(1)} px`,
      overflowStyle: getComputedStyle(f).overflow,
      domTextNodeCount: (() => {
        const w = document.createTreeWalker(f, NodeFilter.SHOW_TEXT);
        let n = 0;
        while (w.nextNode()) if ((w.currentNode.nodeValue ?? "").trim()) n += 1;
        return n;
      })(),
      srOnlyDescendants: f.querySelectorAll(".srOnly").length,
      ariaLabel: f.getAttribute("aria-label"),
      role: f.getAttribute("role"),
      text: window.__vit.textNodes(f),
    };
  });

  const ownedShot = await capture(page, "c20-owned-no-photo-390");

  // The 56 px scale, on a real collection row.
  await page.goto("/collection");
  await expect(page.locator("main")).toBeVisible();
  await settle(page);
  await assertScaleOne(page, VIEWPORT_WIDTH, "C20 collection");
  await page.addScriptTag({ content: INSTRUMENT });

  await page.locator(".thumb.np").first().scrollIntoViewIfNeeded();
  await settle(page);
  const scrollYAtThumb = await page.evaluate(() => Math.round(window.scrollY));

  const thumb = await page.evaluate(() => {
    const t = document.querySelector(".thumb.np") as HTMLElement;
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return {
      selector: window.__vit.sel(t),
      box: window.__vit.box(r),
      sizeLabel: `${r.width.toFixed(1)} x ${r.height.toFixed(1)} px`,
      overflowStyle: getComputedStyle(t).overflow,
      role: t.getAttribute("role"),
      ariaLabel: t.getAttribute("aria-label"),
      innerAriaHidden: (t.firstElementChild as HTMLElement | null)?.getAttribute("aria-hidden") ?? null,
      fontSizePx: getComputedStyle(t.querySelector(".thumbNoPhoto") ?? t).fontSize,
      text: window.__vit.textNodes(t),
      containment: (() => {
        const child = t.querySelector(".thumbNoPhoto") as HTMLElement | null;
        return child ? window.__vit.containment(t, child) : null;
      })(),
    };
  });

  const collectionRows = await page.evaluate(() => document.querySelectorAll("main ul li").length);
  const thumbShot = await capture(page, "c20-collection-thumb-390");

  // Controls for the visible-text counter, run in the same page with the same
  // function: one genuinely empty box, one .srOnly-only box (the exact shape
  // that made this state read as a pass), one plainly visible paragraph.
  const controls = await page.evaluate(() => {
    // Fixed, opaque and on top, so every control sits inside the viewport
    // the hit test samples, whatever the page is scrolled to.
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;left:0;top:0;width:390px;height:844px;z-index:2147483647;background:#808080;color:#000;";
    document.body.appendChild(host);

    const empty = document.createElement("div");
    empty.style.cssText = "width:318px;height:238px;";
    host.appendChild(empty);

    const srOnlyOnly = document.createElement("div");
    srOnlyOnly.style.cssText = "width:318px;height:60px;overflow:hidden;";
    srOnlyOnly.innerHTML = '<span class="srOnly">No photograph saved for this copy.</span>';
    host.appendChild(srOnlyOnly);

    const plain = document.createElement("div");
    plain.style.cssText = "width:318px;height:60px;";
    plain.innerHTML = "<p style='margin:0'>One visible sentence.</p>";
    host.appendChild(plain);

    const clipped = document.createElement("div");
    clipped.style.cssText = "width:20px;height:16px;overflow:hidden;font-size:14px;white-space:nowrap;";
    clipped.innerHTML = "<p style='margin:0'>A sentence far wider than its box.</p>";
    host.appendChild(clipped);

    const out = {
      emptyBox: window.__vit.textNodes(empty),
      srOnlyOnlyBox: window.__vit.textNodes(srOnlyOnly),
      plainVisibleBox: window.__vit.textNodes(plain),
      clippedBox: window.__vit.textNodes(clipped),
    };
    host.remove();
    return out;
  });

  const record = {
    line: "C20",
    buildId,
    baseUrl: baseURL,
    identifier,
    viewportWidthPx: VIEWPORT_WIDTH,
    scale,
    theMeasurementThatUncheckedTheLine: {
      was: "318 x 238.5 px with 0 visible text nodes, OWNED verdict at 390 px",
      nowSizeLabel: largeFrame?.sizeLabel ?? null,
      nowVisibleTextNodeCount: largeFrame?.text.visibleCount ?? null,
    },
    largeFrame: {
      verdictKind,
      ...largeFrame,
      visibleTextNodeCount: largeFrame?.text.visibleCount ?? null,
      visibleStrings: largeFrame?.text.visibleText ?? null,
      windowScrollYPx: scrollYAtFrame,
      capture: ownedShot,
    },
    thumb56: {
      ...thumb,
      collectionRowCount: collectionRows,
      visibleTextNodeCount: thumb?.text.visibleCount ?? null,
      visibleStrings: thumb?.text.visibleText ?? null,
      windowScrollYPx: scrollYAtThumb,
      capture: thumbShot,
    },
    openQuestionForTheVerifier: {
      question:
        "does a short label with no restated action satisfy C20 at 56 px, or does the rubric want the action named at every scale",
      notAnsweredHere: true,
      stringAt318px: largeFrame?.text.visibleText ?? null,
      stringAt56px: thumb?.text.visibleText ?? null,
      accessibleNameAt56px: thumb?.ariaLabel ?? null,
      actionNamedAt318px: (largeFrame?.text.visibleText ?? []).length >= 2,
      actionNamedAt56px: false,
    },
    controls: {
      note: "the same textNodes() that measured the frames above",
      genuinelyEmptyBoxReturnsZero: {
        visibleCount: controls.emptyBox.visibleCount,
        pass: controls.emptyBox.visibleCount === 0,
      },
      srOnlyOnlyBoxReturnsZero: {
        visibleCount: controls.srOnlyOnlyBox.visibleCount,
        hiddenCount: controls.srOnlyOnlyBox.hiddenCount,
        rejectionReasons: (controls.srOnlyOnlyBox.hidden as HiddenTextNode[]).map((h: HiddenTextNode) => h.why),
        pass: controls.srOnlyOnlyBox.visibleCount === 0 && controls.srOnlyOnlyBox.hiddenCount === 1,
      },
      plainVisibleBoxReturnsOne: {
        visibleCount: controls.plainVisibleBox.visibleCount,
        visibleText: controls.plainVisibleBox.visibleText,
        pass: controls.plainVisibleBox.visibleCount === 1,
      },
      textClippedByOverflowHiddenIsNotCounted: {
        visibleCount: controls.clippedBox.visibleCount,
        hidden: (controls.clippedBox.hidden as HiddenTextNode[]).map((h: HiddenTextNode) => ({ shownFraction: h.shownFraction, why: h.why })),
        pass: controls.clippedBox.visibleCount === 0,
      },
    },
    measuredAtIso: new Date().toISOString(),
  };

  const file = writeEvidence("c20-empty-states.json", record);
  console.log(
    `[C20] build ${buildId} large ${largeFrame?.sizeLabel} visible ${largeFrame?.text.visibleCount}, ` +
      `thumb ${thumb?.sizeLabel} visible ${thumb?.text.visibleCount} -> ${file}`,
  );

  expect(verdictKind, "the state under measurement").toBe("OWNED");
  expect(largeFrame, "the no-photo frame").not.toBeNull();
  expect(largeFrame!.classList, "the no-photo variant of the frame").toContain("np");
  expect(controls.emptyBox.visibleCount, "control: an empty box").toBe(0);
  expect(controls.srOnlyOnlyBox.visibleCount, "control: a .srOnly-only box").toBe(0);
  expect(controls.plainVisibleBox.visibleCount, "control: a plainly visible paragraph").toBe(1);
  expect(controls.clippedBox.visibleCount, "control: text clipped by overflow hidden").toBe(0);
  expect(largeFrame!.text.visibleCount, "visible text nodes in the 318 px frame").toBeGreaterThanOrEqual(2);
  expect(thumb, "the 56 px no-photo thumbnail").not.toBeNull();
  expect(thumb!.text.visibleCount, "visible text nodes in the 56 px thumbnail").toBeGreaterThanOrEqual(1);
  expect(thumb!.containment?.worstOverflowPx, "the 56 px label inside its box").toBeLessThanOrEqual(0);
  expect(ownedShot.widthPx, "OWNED capture width from the PNG IHDR").toBe(390);
  expect(thumbShot.widthPx, "collection capture width from the PNG IHDR").toBe(390);
});

// ---------------------------------------------------------------------------
// Every capture this file wrote, re-read from its own IHDR, plus the build id
// the whole pass ran against.

test("captures: width read back from every PNG IHDR", async () => {
  const names = [
    "f6-uncertain-slab-390",
    "f6-uncertain-candidates-390",
    "c20-owned-no-photo-390",
    "c20-collection-thumb-390",
  ];
  const dir = path.join(process.cwd(), ".forge", "evidence");
  const sizes = names.map((n) => {
    const file = path.join(dir, `${n}.png`);
    const buf = readFileSync(file);
    expect(buf.subarray(0, 8).toString("hex"), `${n}.png is not a PNG`).toBe("89504e470d0a1a0a");
    return {
      file: repoRelative(file),
      widthPx: buf.readUInt32BE(16),
      heightPx: buf.readUInt32BE(20),
      bytes: buf.length,
    };
  });
  const file = writeEvidence("f6-c20-captures.json", { buildId, viewportWidthPx: VIEWPORT_WIDTH, captures: sizes });
  console.log(`[captures] ${JSON.stringify(sizes)} -> ${file}`);
  for (const s of sizes) expect(s.widthPx, `${s.file} width from IHDR`).toBe(VIEWPORT_WIDTH);
});

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __vit: any;
  }
}
