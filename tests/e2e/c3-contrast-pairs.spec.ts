// C3: "Contrast measured against the built interface in both themes, 8 pairs,
// numbers recorded."
//
// The words that govern this file are "measured against the built interface".
// Token arithmetic answers a different question: it says what a pair WOULD
// measure if the product ever put that foreground on that background. It
// cannot say whether the product does. Twice on this line the arithmetic was
// right and the answer was wrong: once because --case2 was read as the
// personal surface when the personal surface is --drawer, once because
// --fmint was read as the focus ring when the ring is --mint.
//
// So every number here comes from a real element on a served page: the
// foreground read with getComputedStyle, the background composited from the
// element's own background-color up through its ancestors to the first opaque
// one, and the ratio computed from those two resolved values. Where no
// element in the shipped product carries a named pair, that is recorded as a
// finding, with the places the token does appear, and no computed value is
// substituted for a rendered one.
//
// Controls, because a contrast function that has never returned a known
// answer is not a measurement: black on white is 21:1, white on white is 1:1,
// and #767676 on white is 4.54:1, the WCAG boundary value. And because a
// light pair read in the dark theme is the exact error this line has already
// produced, the .lt scope class and the resolved ground are asserted before
// any light reading is taken.
//
// The build id is asserted before the first measurement and again after the
// last, against a literal, because a rebuild landing mid-run makes a startup
// assertion true when it is made and false when it matters.

import { expect, test, type Browser, type Page } from "@playwright/test";
import { assertServedBuildId, settle, writeEvidence } from "./harness";

const EXPECTED_BUILD_ID = "YzDsr6hHAGTXS-1fwnrSm";
const BASE = process.env.VITRINE_BASE_URL ?? "http://127.0.0.1:3800";
const THEME_STORAGE_KEY = "vitrine:theme";
const UNKNOWN_IDENTIFIER = "SLUS-99999";

// The two grounds from DESIGN.md's token tables, used only to prove the theme
// switched before anything is read in it.
const GROUND = { dark: "#0b1020", light: "#edf0f7" } as const;

// The only two rules in the shipped stylesheet that set a --drawer
// background, and the only two that set a --case background. A background is
// credited to a named surface by the rule that painted it, never by its
// resolved value: in the light theme --g2 and --drawer are both #e2e7f2, so
// value matching alone would file every top-nav element as sitting on the
// personal surface.
const PERSONAL_SURFACE_RULES = [["scanh"], ["drw"]];
const CANONICAL_SURFACE_RULES = [["vslab", "v-not"], ["card"]];

type BgLayer = { selector: string; backgroundColor: string; backgroundImage: string | null };

type Reading = {
  found: boolean;
  selector: string;
  text: string;
  fontPx: number | null;
  fontWeight: string | null;
  fgRaw: string | null;
  fgHex: string | null;
  fgAlpha: number | null;
  fgComposited: boolean;
  fgTokens: string[];
  bgHex: string | null;
  bgTokens: string[];
  bgLayers: BgLayer[];
  bgHasImage: boolean;
  hatchStripeHex: string | null;
  ratio: number | null;
  ratioOnHatchStripe: number | null;
};

type BorderReading = {
  found: boolean;
  selector: string;
  side: string;
  borderWidth: string | null;
  borderStyle: string | null;
  borderRaw: string | null;
  borderHex: string | null;
  borderTokens: string[];
  outsideHex: string | null;
  outsideTokens: string[];
  outsideLayers: BgLayer[];
  insideHex: string | null;
  insideTokens: string[];
  ratioAgainstOutside: number | null;
  ratioAgainstInside: number | null;
};

type OutlineReading = {
  found: boolean;
  selector: string;
  outlineStyle: string | null;
  outlineWidth: string | null;
  outlineOffset: string | null;
  outlineRaw: string | null;
  outlineHex: string | null;
  outlineTokens: string[];
  ownBackgroundAlpha: number | null;
  behindSource: string | null;
  behindHex: string | null;
  behindTokens: string[];
  behindLayers: BgLayer[];
  ownBoxHex: string | null;
  ownBoxTokens: string[];
  ratio: number | null;
  ratioAgainstOwnBox: number | null;
};

type RingReading = { focused: string; ring: OutlineReading; self: Reading };

// ---------------------------------------------------------------------------
// The instrument, installed into every document before it loads.
// ---------------------------------------------------------------------------

const MEASURE_LIB = `
(function(){
  var TOKENS = ["g","g2","case","case2","drawer","nil","ink","ink2","ink3","mint","flare","edge","hair","hovp","fmint","fflare","onacc"];

  function parseColor(str){
    if(str === null || str === undefined) return null;
    var s = String(str).trim().toLowerCase();
    if(!s || s === "none" || s === "currentcolor") return null;
    if(s === "transparent") return {r:0,g:0,b:0,a:0};
    var m = s.match(/^#([0-9a-f]{3,8})$/);
    if(m){
      var h = m[1];
      if(h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      if(h.length === 4) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
      return {
        r: parseInt(h.slice(0,2),16),
        g: parseInt(h.slice(2,4),16),
        b: parseInt(h.slice(4,6),16),
        a: h.length === 8 ? parseInt(h.slice(6,8),16)/255 : 1
      };
    }
    m = s.match(/^rgba?\\(([^)]+)\\)$/);
    if(m){
      var parts = m[1].split(/[,\\/\\s]+/).filter(function(x){ return x.length > 0; });
      var chan = function(v){ return v.indexOf("%") >= 0 ? parseFloat(v)/100*255 : parseFloat(v); };
      var alpha = function(v){ return v === undefined ? 1 : (v.indexOf("%") >= 0 ? parseFloat(v)/100 : parseFloat(v)); };
      return { r: chan(parts[0]), g: chan(parts[1]), b: chan(parts[2]), a: alpha(parts[3]) };
    }
    m = s.match(/^color\\(srgb\\s+([^)]+)\\)$/);
    if(m){
      var p2 = m[1].split(/[\\/\\s]+/).filter(function(x){ return x.length > 0; });
      var f = function(v){ return v.indexOf("%") >= 0 ? parseFloat(v)/100 : parseFloat(v); };
      return { r: f(p2[0])*255, g: f(p2[1])*255, b: f(p2[2])*255, a: p2[3] === undefined ? 1 : f(p2[3]) };
    }
    return null;
  }

  function hex(c){
    if(!c) return null;
    var h = function(v){ var n = Math.round(Math.max(0, Math.min(255, v))).toString(16); return n.length === 1 ? "0"+n : n; };
    return "#" + h(c.r) + h(c.g) + h(c.b);
  }

  function over(fg, bg){
    var a = fg.a;
    return { r: fg.r*a + bg.r*(1-a), g: fg.g*a + bg.g*(1-a), b: fg.b*a + bg.b*(1-a), a: 1 };
  }

  function lum(c){
    var f = function(v){ v = v/255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b);
  }

  function ratio(a, b){
    if(!a || !b) return null;
    var l1 = lum(a), l2 = lum(b);
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  }

  function path(el){
    if(!el) return "";
    if(el === document.documentElement) return "html";
    if(el === document.body) return "body";
    var parts = [];
    var node = el;
    var guard = 0;
    while(node && node !== document.body && node !== document.documentElement && guard < 40){
      guard++;
      var tag = node.tagName ? node.tagName.toLowerCase() : "node";
      if(node.id){ parts.unshift(tag + "#" + node.id); break; }
      var cls = ((node.getAttribute && node.getAttribute("class")) || "").trim();
      var sel = tag + (cls ? "." + cls.split(/\\s+/).join(".") : "");
      var parent = node.parentElement;
      if(parent){
        var idx = Array.prototype.indexOf.call(parent.children, node) + 1;
        sel = sel + ":nth-child(" + idx + ")";
      }
      parts.unshift(sel);
      node = parent;
    }
    return parts.join(" > ");
  }

  function tokenTable(){
    var cs = getComputedStyle(document.documentElement);
    var out = {};
    for(var i=0;i<TOKENS.length;i++){
      var raw = cs.getPropertyValue("--" + TOKENS[i]).trim();
      out[TOKENS[i]] = { raw: raw, hex: hex(parseColor(raw)) };
    }
    return out;
  }

  var TOKEN_CACHE = null;
  function namesFor(c){
    if(!c) return [];
    if(!TOKEN_CACHE) TOKEN_CACHE = tokenTable();
    var names = [];
    for(var k in TOKEN_CACHE){
      var v = parseColor(TOKEN_CACHE[k].raw);
      if(!v) continue;
      if(Math.abs(v.r-c.r) < 0.6 && Math.abs(v.g-c.g) < 0.6 && Math.abs(v.b-c.b) < 0.6) names.push("--" + k);
    }
    return names;
  }

  // The background a glyph is actually painted on: the element's own
  // background-color composited over each ancestor's, down to the first
  // opaque one. Every layer is recorded, so a reading can be checked rather
  // than believed.
  function effectiveBg(el){
    var stack = [];
    var node = el;
    var guard = 0;
    while(node && guard < 60){
      guard++;
      var cs = getComputedStyle(node);
      var c = parseColor(cs.backgroundColor) || {r:0,g:0,b:0,a:0};
      var img = cs.backgroundImage && cs.backgroundImage !== "none" ? cs.backgroundImage : null;
      stack.push({ node: node, c: c, img: img });
      if(c.a >= 1) break;
      node = node.parentElement;
    }
    var base = { r:255, g:255, b:255, a:1 };
    var start = stack.length - 1;
    if(stack.length && stack[stack.length-1].c.a >= 1){ base = stack[stack.length-1].c; start = stack.length - 2; }
    for(var i = start; i >= 0; i--){
      if(stack[i].c.a > 0) base = over(stack[i].c, base);
    }
    // A repeating hatch on any layer means part of the surface is not the
    // flat token value. The stripe colour is read out of the computed
    // background-image and composited, rather than assumed away.
    var hatch = null;
    for(var j = 0; j < stack.length; j++){
      if(stack[j].img && stack[j].img.indexOf("repeating-linear-gradient") >= 0){
        // Chromium computes color-mix(in srgb, var(--ink) 4%, transparent) to
        // a color(srgb r g b / a) function, not to rgba(), and the gradient
        // also carries fully transparent stops. Take the first stop with any
        // opacity at all, in either syntax.
        var stops = stack[j].img.match(/(rgba?\\([^)]*\\)|color\\(srgb[^)]*\\))/g) || [];
        for(var s = 0; s < stops.length; s++){
          var stripe = parseColor(stops[s]);
          if(stripe && stripe.a > 0){ hatch = over(stripe, base); break; }
        }
        break;
      }
    }
    return {
      color: base,
      hatch: hatch,
      hasImage: stack.some(function(s){ return !!s.img; }),
      layers: stack.map(function(s){
        return {
          selector: path(s.node),
          backgroundColor: getComputedStyle(s.node).backgroundColor,
          backgroundImage: s.img ? s.img.slice(0, 200) : null
        };
      })
    };
  }

  function ownText(el){
    var t = "";
    for(var i=0;i<el.childNodes.length;i++){
      if(el.childNodes[i].nodeType === 3) t += el.childNodes[i].nodeValue;
    }
    return t.replace(/\\s+/g, " ").trim();
  }

  function visible(el){
    var cs = getComputedStyle(el);
    if(cs.display === "none" || cs.visibility === "hidden") return false;
    if(parseFloat(cs.opacity) === 0) return false;
    var r = el.getBoundingClientRect();
    if(r.width < 1 || r.height < 1) return false;
    if(el.closest && el.closest(".srOnly")) return false;
    return true;
  }

  function readEl(el){
    var cs = getComputedStyle(el);
    var bg = effectiveBg(el);
    var raw = parseColor(cs.color);
    var fg = raw;
    var composited = false;
    if(raw && raw.a < 1){ fg = over(raw, bg.color); composited = true; }
    return {
      found: true,
      selector: path(el),
      text: ownText(el).slice(0, 60),
      fontPx: parseFloat(cs.fontSize),
      fontWeight: cs.fontWeight,
      fgRaw: cs.color,
      fgHex: hex(fg),
      fgAlpha: raw ? raw.a : null,
      fgComposited: composited,
      fgTokens: namesFor(raw),
      bgHex: hex(bg.color),
      bgTokens: namesFor(bg.color),
      bgLayers: bg.layers,
      bgHasImage: bg.hasImage,
      hatchStripeHex: bg.hatch ? hex(bg.hatch) : null,
      ratio: ratio(fg, bg.color),
      ratioOnHatchStripe: bg.hatch ? ratio(fg, bg.hatch) : null
    };
  }

  function missingText(selector){
    return { found:false, selector:selector, text:"", fontPx:null, fontWeight:null, fgRaw:null, fgHex:null,
      fgAlpha:null, fgComposited:false, fgTokens:[], bgHex:null, bgTokens:[], bgLayers:[], bgHasImage:false,
      hatchStripeHex:null, ratio:null, ratioOnHatchStripe:null };
  }

  function readText(selector){
    var el = document.querySelector(selector);
    if(!el) return missingText(selector);
    return readEl(el);
  }

  // Every visible text-bearing element inside a root, the root included.
  function readTextIn(rootSelector){
    var root = document.querySelector(rootSelector);
    if(!root) return [];
    var out = [];
    var all = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
    for(var i=0;i<all.length;i++){
      if(!ownText(all[i])) continue;
      if(!visible(all[i])) continue;
      out.push(readEl(all[i]));
    }
    return out;
  }

  function readBorderEl(el, side){
    var cs = getComputedStyle(el);
    var col = parseColor(cs.getPropertyValue("border-" + side + "-color"));
    var own = parseColor(cs.backgroundColor) || {r:0,g:0,b:0,a:0};
    var outside = effectiveBg(el.parentElement || document.body);
    var insideBg = own.a >= 1 ? own : (own.a > 0 ? over(own, outside.color) : outside.color);
    var line = col && col.a < 1 ? over(col, outside.color) : col;
    return {
      found: true,
      selector: path(el),
      side: side,
      borderWidth: cs.getPropertyValue("border-" + side + "-width"),
      borderStyle: cs.getPropertyValue("border-" + side + "-style"),
      borderRaw: cs.getPropertyValue("border-" + side + "-color"),
      borderHex: hex(line),
      borderTokens: namesFor(col),
      outsideHex: hex(outside.color),
      outsideTokens: namesFor(outside.color),
      outsideLayers: outside.layers,
      insideHex: hex(insideBg),
      insideTokens: namesFor(insideBg),
      ratioAgainstOutside: ratio(line, outside.color),
      ratioAgainstInside: ratio(line, insideBg)
    };
  }

  function missingBorder(selector, side){
    return { found:false, selector:selector, side:side, borderWidth:null, borderStyle:null, borderRaw:null,
      borderHex:null, borderTokens:[], outsideHex:null, outsideTokens:[], outsideLayers:[], insideHex:null,
      insideTokens:[], ratioAgainstOutside:null, ratioAgainstInside:null };
  }

  function readBorder(selector, side){
    var el = document.querySelector(selector);
    if(!el) return missingBorder(selector, side);
    return readBorderEl(el, side);
  }

  function readOutlineEl(el){
    var cs = getComputedStyle(el);
    var col = parseColor(cs.outlineColor);
    var own = parseColor(cs.backgroundColor) || {r:0,g:0,b:0,a:0};
    // A positive outline-offset draws the ring OUTSIDE the element's own
    // border box, so the pixels under it are painted by the parent, not by
    // the element's own background. Reading the ring against the control's
    // own fill is how a 2px offset ring on a --case2 input gets filed as
    // sitting on --case2 when it is sitting on the surface behind it.
    var offset = parseFloat(cs.outlineOffset) || 0;
    var outside = effectiveBg(el.parentElement || el);
    var self = effectiveBg(el);
    var behind = offset >= 0 && el.parentElement ? outside : self;
    var line = col && col.a < 1 ? over(col, behind.color) : col;
    return {
      found: true,
      selector: path(el),
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineOffset: cs.outlineOffset,
      outlineRaw: cs.outlineColor,
      outlineHex: hex(line),
      outlineTokens: namesFor(col),
      ownBackgroundAlpha: own.a,
      behindSource: offset >= 0 && el.parentElement ? "the parent, since outline-offset is " + cs.outlineOffset : "the element itself",
      behindHex: hex(behind.color),
      behindTokens: namesFor(behind.color),
      behindLayers: behind.layers,
      ownBoxHex: hex(self.color),
      ownBoxTokens: namesFor(self.color),
      ratio: ratio(line, behind.color),
      ratioAgainstOwnBox: ratio(line, self.color)
    };
  }

  function missingOutline(selector){
    return { found:false, selector:selector, outlineStyle:null, outlineWidth:null, outlineOffset:null,
      outlineRaw:null, outlineHex:null, outlineTokens:[], ownBackgroundAlpha:null, behindSource:null,
      behindHex:null, behindTokens:[], behindLayers:[], ownBoxHex:null, ownBoxTokens:[], ratio:null,
      ratioAgainstOwnBox:null };
  }

  function sweepText(){
    var out = [];
    var all = document.querySelectorAll("*");
    for(var i=0;i<all.length;i++){
      if(!ownText(all[i])) continue;
      if(!visible(all[i])) continue;
      out.push(readEl(all[i]));
    }
    return out;
  }

  function sweepBorders(){
    var out = [];
    var all = document.querySelectorAll("*");
    var sides = ["top","right","bottom","left"];
    for(var i=0;i<all.length;i++){
      var el = all[i];
      if(!visible(el)) continue;
      var cs = getComputedStyle(el);
      for(var s=0;s<sides.length;s++){
        var style = cs.getPropertyValue("border-" + sides[s] + "-style");
        var width = parseFloat(cs.getPropertyValue("border-" + sides[s] + "-width"));
        if(style === "none" || style === "hidden" || !width) continue;
        var reading = readBorderEl(el, sides[s]);
        if(reading.borderTokens.length) out.push(reading);
      }
    }
    return out;
  }

  // Focus is applied here so the ring and the element are read in the frame
  // the focus lands in. .fw:focus-within needs no keyboard heuristic;
  // :focus-visible does, and the driver handles that with real Tab presses.
  function focusAndReadRing(selector){
    var el = document.querySelector(selector);
    if(!el) return { focused: selector + " NOT FOUND", ring: missingOutline(selector), self: missingText(selector) };
    el.focus();
    var node = el;
    var guard = 0;
    var ringEl = null;
    while(node && guard < 10){
      guard++;
      var cs = getComputedStyle(node);
      if(cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0){ ringEl = node; break; }
      node = node.parentElement;
    }
    return {
      focused: path(document.activeElement),
      ring: ringEl ? readOutlineEl(ringEl) : missingOutline("no outline on the focused element or any ancestor"),
      self: readEl(el)
    };
  }

  // Every rule in the served stylesheets that paints one of the accent
  // tokens, and the property it paints it with. A sweep can only see the
  // states it was driven into; this sees what the stylesheet is able to do at
  // all, which is what turns "no element found" into "no rule exists".
  function accentRules(){
    var wanted = ["--ink3","--mint","--flare","--edge","--fmint","--drawer","--case"];
    var props = ["color","background","background-color","border-color","border-top-color",
      "border-right-color","border-bottom-color","border-left-color","outline-color",
      "text-decoration-color","box-shadow","border-left","border-top","border","outline"];
    var out = [];
    function walk(rules){
      for(var i=0;i<rules.length;i++){
        var rule = rules[i];
        if(rule.cssRules && rule.cssRules.length){ walk(rule.cssRules); }
        if(!rule.style || !rule.selectorText) continue;
        for(var p=0;p<props.length;p++){
          var v = rule.style.getPropertyValue(props[p]);
          if(!v) continue;
          for(var w=0;w<wanted.length;w++){
            if(v.indexOf("var(" + wanted[w] + ")") >= 0){
              out.push({ selector: rule.selectorText, property: props[p], value: v, token: wanted[w] });
            }
          }
        }
      }
    }
    for(var s=0;s<document.styleSheets.length;s++){
      try { walk(document.styleSheets[s].cssRules); } catch(e){ /* cross origin */ }
    }
    return out;
  }

  function controls(){
    var black = {r:0,g:0,b:0,a:1}, white = {r:255,g:255,b:255,a:1}, grey = parseColor("#767676");
    return [
      { name: "black #000000 on white #ffffff", ratio: ratio(black, white), expected: 21 },
      { name: "white #ffffff on white #ffffff", ratio: ratio(white, white), expected: 1 },
      { name: "grey #767676 on white #ffffff", ratio: ratio(grey, white), expected: 4.54 }
    ];
  }

  function themeProof(){
    var body = getComputedStyle(document.body);
    return {
      ltClass: document.documentElement.classList.contains("lt"),
      bodyBackground: body.backgroundColor,
      bodyBackgroundHex: hex(parseColor(body.backgroundColor)),
      htmlColorScheme: getComputedStyle(document.documentElement).colorScheme,
      prefersLight: window.matchMedia("(prefers-color-scheme: light)").matches
    };
  }

  window.__c3 = {
    tokens: function(){ TOKEN_CACHE = null; return tokenTable(); },
    controls: controls,
    themeProof: themeProof,
    readText: readText,
    readTextIn: readTextIn,
    readBorder: readBorder,
    accentRules: accentRules,
    sweepText: sweepText,
    sweepBorders: sweepBorders,
    focusAndReadRing: focusAndReadRing
  };
})();
`;

/** Runs an expression against window.__c3 in the page. The function is sent as
 * source, so it closes over nothing and cannot smuggle a node-side value into
 * a measurement. */
function c3<T>(page: Page, source: string): Promise<T> {
  const expression = `(window.__c3.${source})`;
  return page.evaluate(expression as unknown as () => T);
}

// ---------------------------------------------------------------------------
// Driving the product into the states the pairs live in.
// ---------------------------------------------------------------------------

async function newThemePage(browser: Browser, theme: "dark" | "light"): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: theme,
    serviceWorkers: "block",
  });
  await context.addInitScript(
    ([key, value]: string[]) => {
      try {
        window.localStorage.setItem(key!, value!);
      } catch {
        /* storage unavailable; the colorScheme emulation still applies */
      }
    },
    [THEME_STORAGE_KEY, theme],
  );
  await context.addInitScript({ content: MEASURE_LIB });
  return context.newPage();
}

async function gotoAndSettle(page: Page, path: string) {
  await page.goto(new URL(path, BASE).toString(), { waitUntil: "load" });
  await page.waitForSelector("main", { state: "attached", timeout: 30_000 });
  await settle(page);
}

async function runCheck(page: Page, value: string) {
  await page.fill("#check-identifier", value);
  await page.click('form button[type="submit"]');
  await page.waitForSelector('[data-testid="verdict"]', { state: "visible", timeout: 30_000 });
  await settle(page);
}

type IndexRow = { variantPublicId: string; normalizedIdentifiers: string[] };

async function identifierHolders(page: Page): Promise<Map<string, Set<string>>> {
  const rows = await page.evaluate(async (base: string) => {
    const res = await fetch(new URL("/api/sync/index", base).toString());
    if (!res.ok) return [] as IndexRow[];
    const body = (await res.json()) as { rows: IndexRow[] };
    return body.rows;
  }, BASE);
  const holders = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const value of row.normalizedIdentifiers) {
      const set = holders.get(value) ?? new Set<string>();
      set.add(row.variantPublicId);
      holders.set(value, set);
    }
  }
  return holders;
}

/** A value carried by two or more variants reaches UNCERTAIN, a value carried
 * by exactly one reaches NOT IN COLLECTION and then OWNED. Both are picked
 * from the catalogue the server is actually serving, never pinned. */
async function pickIdentifiers(page: Page): Promise<{ colliding: string | null; unique: string | null }> {
  const holders = [...(await identifierHolders(page)).entries()].sort(([a], [b]) => a.localeCompare(b));
  return {
    colliding: holders.find(([, ids]) => ids.size > 1)?.[0] ?? null,
    unique: holders.find(([, ids]) => ids.size === 1)?.[0] ?? null,
  };
}

// ---------------------------------------------------------------------------

type PairRecord = {
  pair: number;
  theme: "dark" | "light";
  clause: string;
  foreground: string;
  background: string;
  threshold: number;
  route: string | null;
  state: string | null;
  selector: string | null;
  foregroundHex: string | null;
  backgroundHex: string | null;
  ratio: number | null;
  verdict: "PASS" | "FAIL" | "NO ELEMENT";
  note: string;
  /** For a pair with no element: the closest thing the product does render,
   * with its numbers, so the finding names a fact rather than an absence. */
  nearest?: unknown;
};

/** The classes of the last node in one of the library's selector paths, so a
 * background can be credited to the rule that painted it rather than to its
 * resolved value. In the light theme --g2 and --drawer are both #e2e7f2, and
 * a reading taken by value alone files the top nav as a personal surface. */
function classesOfPaintingNode(selector: string): string[] {
  const leaf = selector.split(" > ").pop() ?? "";
  const [head] = leaf.split(":nth-child");
  const parts = (head ?? "").split(".");
  return parts.slice(1);
}

function paintedBy(r: Reading, rules: string[][]): boolean {
  return r.bgLayers.some((layer) => {
    if (layer.backgroundColor === "rgba(0, 0, 0, 0)") return false;
    const classes = classesOfPaintingNode(layer.selector);
    return rules.some((rule) => rule.every((cls) => classes.includes(cls)));
  });
}

const onPersonalSurface = (r: Reading) => paintedBy(r, PERSONAL_SURFACE_RULES);
const onCanonicalSurface = (r: Reading) => paintedBy(r, CANONICAL_SURFACE_RULES);

test.describe.configure({ mode: "serial" });

test("C3: eight contrast pairs measured on real elements of the built interface", async ({
  browser,
  request,
}) => {
  test.setTimeout(900_000);

  const evidence: Record<string, unknown> = {
    line: "C3. Contrast measured against the built interface in both themes, 8 pairs, numbers recorded.",
    baseUrl: BASE,
    viewport: "390x844, deviceScaleFactor 1",
  };

  const before = await assertServedBuildId(request, BASE, EXPECTED_BUILD_ID, "before the first measurement");
  evidence.buildIdBefore = before;

  const pairs: PairRecord[] = [];
  const perTheme: Record<string, unknown> = {};
  const accentIndex: Record<string, Reading[]> = {};

  for (const theme of ["dark", "light"] as const) {
    const page = await newThemePage(browser, theme);
    const record: Record<string, unknown> = {};
    const accents: Reading[] = [];
    const seen = new Set<string>();

    const collect = (route: string, state: string, readings: Reading[]) => {
      for (const r of readings) {
        if (!r.fgTokens.some((t) => t === "--ink3" || t === "--mint" || t === "--flare")) continue;
        const key = `${route}|${state}|${r.selector}|${r.fgHex}|${r.bgHex}`;
        if (seen.has(key)) continue;
        seen.add(key);
        accents.push({ ...r, selector: `${route} [${state}]  ${r.selector}` });
      }
    };

    // ---- the check screen, resting -------------------------------------
    await gotoAndSettle(page, "/");

    const controls = await c3<{ name: string; ratio: number; expected: number }[]>(page, "controls()");
    record.ratioFunctionControls = controls;
    expect(controls[0]?.ratio, "control: black on white").toBe(21);
    expect(controls[1]?.ratio, "control: white on white").toBe(1);
    expect(controls[2]?.ratio, "control: #767676 on white").toBe(4.54);

    const proof = await c3<{ ltClass: boolean; bodyBackgroundHex: string }>(page, "themeProof()");
    record.themeProof = proof;
    expect(proof.ltClass, `the .lt scope class in the ${theme} theme`).toBe(theme === "light");
    expect(proof.bodyBackgroundHex, `the resolved ground in the ${theme} theme`).toBe(GROUND[theme]);

    record.tokens = await c3(page, "tokens()");
    // What the served stylesheet is able to paint, ahead of what any one
    // state happens to render. This is what makes a NO ELEMENT verdict
    // checkable rather than a claim about how hard somebody looked.
    record.accentRulesInStylesheet = await c3(page, "accentRules()");

    // Pair 4 lives on the resting check screen: control boundaries on the ground.
    const inputBorder = await c3<BorderReading>(page, 'readBorder("#check-identifier", "top")');
    const scanBorder = await c3<BorderReading>(
      page,
      'readBorder("[data-testid=\\"scan-control\\"] .fw > .btn.sec", "top")',
    );
    record.boundariesOnGround = { checkInput: inputBorder, scanButton: scanBorder };
    record.borderTokenInventoryOnCheckScreen = await c3<BorderReading[]>(page, "sweepBorders()");
    collect("/", "resting", await c3<Reading[]>(page, "sweepText()"));

    // ---- unknown identifier: NOT IN COLLECTION with the three doors ------
    await runCheck(page, UNKNOWN_IDENTIFIER);
    record.notInCollectionSlab = await c3<Reading>(page, 'readText("section.vslab.v-not")');
    const scanHeaderReadings = await c3<Reading[]>(page, 'readTextIn(".scanh")');
    record.scanHeaderReadings = scanHeaderReadings;
    collect("/", "unknown identifier", await c3<Reading[]>(page, "sweepText()"));

    // The second door is the one form in the product that puts an ink3 label
    // on a canonical surface.
    await page.locator("section.vslab .doorList .fw > button").first().click();
    await page.waitForSelector("#draft-title", { state: "visible", timeout: 15_000 });
    await settle(page);
    const slabReadings = await c3<Reading[]>(page, 'readTextIn("section.vslab.v-not")');
    record.notInCollectionReadings = slabReadings;
    collect("/", "unknown identifier, draft form open", await c3<Reading[]>(page, "sweepText()"));

    // The focus ring on a canonical surface, from both focusable controls
    // that sit on one.
    const ringFromInput = await c3<RingReading>(page, 'focusAndReadRing("#draft-title")');
    const ringFromButton = await c3<RingReading>(
      page,
      'focusAndReadRing("section.vslab .doorList .fw > button")',
    );
    record.focusRingOnCanonical = { fromDraftInput: ringFromInput, fromDoorButton: ringFromButton };

    // ---- UNCERTAIN: the only flare text in the product -------------------
    const { colliding, unique } = await pickIdentifiers(page);
    record.collidingIdentifier = colliding;
    record.uniqueIdentifier = unique;
    if (colliding) {
      await runCheck(page, colliding);
      const kind = await page.getAttribute('[data-testid="verdict"]', "data-verdict");
      record.collidingVerdictKind = kind;
      if (kind === "UNCERTAIN") {
        record.flareTextReading = await c3<Reading>(page, 'readText(".vcaution")');
        collect("/", "UNCERTAIN", await c3<Reading[]>(page, "sweepText()"));
      }
    }

    // ---- a saved copy, so the collection list and item screens exist -----
    await runCheck(page, UNKNOWN_IDENTIFIER);
    await page.locator("section.vslab .doorList .fw > button").last().click();
    await page.waitForTimeout(600);
    await gotoAndSettle(page, "/collection");
    const rowLink = page.locator("ul li a").first();
    record.collectionRowCount = await page.locator("ul li a").count();
    if ((await rowLink.count()) > 0) {
      const resting = await c3<Reading[]>(page, 'readTextIn("ul li a")');
      await rowLink.hover();
      await page.waitForTimeout(150);
      const hovered = await c3<Reading[]>(page, 'readTextIn("ul li a")');
      collect("/collection", "row link hovered", hovered);
      // Keyboard focus, so :focus-visible really applies rather than relying
      // on a programmatic focus the heuristic may not honour.
      await page.mouse.move(0, 0);
      await page.locator("#collection-search").focus();
      await page.keyboard.press("Tab");
      await page.waitForTimeout(150);
      const activeIsLink = await page.evaluate(
        () => (document.activeElement?.tagName ?? "") + " focus-visible=" + String(document.activeElement?.matches(":focus-visible")),
      );
      const focused = await c3<Reading[]>(page, 'readTextIn("ul li a")');
      collect("/collection", "row link keyboard focused", focused);
      record.collectionRowLink = { resting, hovered, activeIsLink, focused };

      const href = await rowLink.getAttribute("href");
      if (href) {
        await gotoAndSettle(page, href);
        await page.waitForSelector(".drw", { state: "visible", timeout: 20_000 }).catch(() => undefined);
        record.personalSurfaceReadings = await c3<Reading[]>(page, 'readTextIn(".drw")');
        collect("/collection/[id]", "personal surface", await c3<Reading[]>(page, "sweepText()"));
      }
    }

    // ---- the remaining screens and states, so "no element" means the
    // product was looked at, not that the sweep stopped early -------------
    await gotoAndSettle(page, "/catalogue");
    collect("/catalogue", "resting", await c3<Reading[]>(page, "sweepText()"));
    record.catalogueRowCount = await page.locator("ul li").count();

    if (unique) {
      await gotoAndSettle(page, "/");
      await runCheck(page, unique);
      collect("/", "NOT IN COLLECTION, recognized", await c3<Reading[]>(page, "sweepText()"));
      const addButton = page.locator("section.vslab .fw > button.btn.pri");
      if ((await addButton.count()) > 0) {
        await addButton.first().click();
        await page.waitForTimeout(700);
      }
      await runCheck(page, unique);
      record.ownedVerdictKind = await page.getAttribute('[data-testid="verdict"]', "data-verdict");
      collect("/", "OWNED", await c3<Reading[]>(page, "sweepText()"));
    }

    // The offline banner is the one surface in the product that puts --flare
    // on a canonical second step, as a 1px boundary rather than as text.
    // Reached by dropping the network on the loaded page: a navigation while
    // offline would not resolve, service workers being blocked here.
    await page.context().setOffline(true);
    const bannerAppeared = await page
      .waitForSelector(".offlineBanner", { state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    record.offlineBannerRendered = bannerAppeared;
    let offlineBoundary: BorderReading | null = null;
    if (bannerAppeared) {
      record.offlineBannerText = await c3<Reading>(page, 'readText(".offlineBanner")');
      offlineBoundary = await c3<BorderReading>(page, 'readBorder(".offlineBanner", "top")');
      record.offlineBannerBoundary = offlineBoundary;
      collect("/", "offline", await c3<Reading[]>(page, "sweepText()"));
    }
    await page.context().setOffline(false);

    accentIndex[theme] = accents;
    perTheme[theme] = record;

    // -----------------------------------------------------------------
    // The pairs for this theme.
    // -----------------------------------------------------------------
    const findAccent = (fg: string, surface: "canonical" | "personal" | "ground") =>
      accents.filter((r) => {
        if (!r.fgTokens.includes(fg)) return false;
        if (surface === "canonical") return onCanonicalSurface(r);
        if (surface === "personal") return onPersonalSurface(r);
        return r.bgTokens.includes("--g") && !onPersonalSurface(r) && !onCanonicalSurface(r);
      });

    // Every place the token does appear as a foreground, for a pair that has
    // nowhere to be measured.
    const whereverItAppears = (fg: string) =>
      accents
        .filter((r) => r.fgTokens.includes(fg))
        .map((r) => ({
          where: r.selector,
          text: r.text,
          foregroundHex: r.fgHex,
          backgroundHex: r.bgHex,
          backgroundTokensByValue: r.bgTokens,
          paintedBy: r.bgLayers.filter((l) => l.backgroundColor !== "rgba(0, 0, 0, 0)").map((l) => l.selector),
          ratio: r.ratio,
        }));

    const push = (
      pair: number,
      clause: string,
      foreground: string,
      background: string,
      threshold: number,
      hit: Reading | undefined,
      route: string,
      state: string,
      note: string,
      nearest?: unknown,
    ) => {
      if (!hit) {
        pairs.push({
          pair, theme, clause, foreground, background, threshold,
          route: null, state: null, selector: null, foregroundHex: null, backgroundHex: null,
          ratio: null, verdict: "NO ELEMENT", note, nearest,
        });
        return;
      }
      pairs.push({
        pair, theme, clause, foreground, background, threshold,
        route, state,
        selector: hit.selector,
        foregroundHex: hit.fgHex,
        backgroundHex: hit.bgHex,
        ratio: hit.ratio,
        verdict: (hit.ratio ?? 0) >= threshold ? "PASS" : "FAIL",
        note,
      });
    };

    if (theme === "dark") {
      const ink3OnCase = findAccent("--ink3", "canonical")[0];
      push(1, "ink3 on the canonical surface", "--ink3", "--case (canonical surface, raised)", 4.5,
        ink3OnCase, "/", "unknown identifier, draft form open",
        "The one ink3 label the product puts on a --case surface: the draft-entry field inside the NOT IN COLLECTION slab.");

      const mintOnGround = findAccent("--mint", "ground")[0];
      push(2, "mint on the ground", "--mint", "--g (ground)", 4.5,
        mintOnGround, "/collection", "row link hovered or keyboard focused",
        "Mint is a link state, never a resting colour: a:hover and a:focus-visible. The collection row link sits directly on the ground.");

      const flareOnCase = findAccent("--flare", "canonical")[0];
      push(3, "flare on the canonical surface", "--flare", "--case (canonical surface, raised)", 4.5,
        flareOnCase, "/", "any",
        "color: var(--flare) is set by exactly one rule in the shipped stylesheet, .vcaution, which renders only inside .vslab.v-unc whose background is --g.",
        { flareAsTextEverywhereItAppears: whereverItAppears("--flare"),
          flareTouchingACanonicalSurfaceAsABoundary: offlineBoundary });

      const edge = [inputBorder, scanBorder].find(
        (b) => b.found && b.borderTokens.includes("--edge") && b.outsideTokens.includes("--g"),
      );
      pairs.push({
        pair: 4, theme, clause: "edge as a control boundary on the ground",
        foreground: "--edge", background: "--g (ground)", threshold: 3,
        route: "/", state: "resting",
        selector: edge ? edge.selector : null,
        foregroundHex: edge ? edge.borderHex : null,
        backgroundHex: edge ? edge.outsideHex : null,
        ratio: edge ? edge.ratioAgainstOutside : null,
        verdict: edge ? ((edge.ratioAgainstOutside ?? 0) >= 3 ? "PASS" : "FAIL") : "NO ELEMENT",
        note: edge
          ? `Border ${edge.borderWidth} ${edge.borderStyle}. Against the control's own fill (${edge.insideHex}) the same line measures ${edge.ratioAgainstInside}.`
          : "No control with an --edge boundary sitting on the ground.",
      });
    } else {
      const ink3OnDrawer = findAccent("--ink3", "personal")[0];
      push(5, "ink3 on the personal surface", "--ink3", "--drawer (personal surface, recessed)", 4.5,
        ink3OnDrawer, "/", "unknown identifier",
        "The scan header timestamp, inline color: var(--ink3) on .scanh, which is one of the two rules that paint --drawer.");

      const mintOnDrawer = findAccent("--mint", "personal")[0];
      push(6, "mint on the personal surface", "--mint", "--drawer (personal surface, recessed)", 4.5,
        mintOnDrawer, "/", "any",
        "Mint as text is set by a:hover, a:focus-visible and .wm only. Neither personal surface, .scanh or .drw, contains a link or a wordmark. " +
          "In the light theme --g2 and --drawer both resolve to #e2e7f2, so a reading taken by colour value alone files the top-nav wordmark as sitting on the personal surface. It sits on --g2, painted by .topnav.",
        { mintAsTextEverywhereItAppears: whereverItAppears("--mint") });

      const flareOnDrawer = findAccent("--flare", "personal")[0];
      push(7, "flare on the personal surface", "--flare", "--drawer (personal surface, recessed)", 4.5,
        flareOnDrawer, "/", "any",
        "color: var(--flare) is set by .vcaution alone, which renders inside .vslab.v-unc on --g.",
        { flareAsTextEverywhereItAppears: whereverItAppears("--flare"),
          flareAsABoundary: offlineBoundary });

      const rings = [ringFromInput, ringFromButton].filter(
        (r) => r.ring.found && r.ring.outlineTokens.includes("--mint"),
      );
      const ringOnCase = rings.find((r) => r.ring.behindTokens.includes("--case"));
      pairs.push({
        pair: 8, theme, clause: "the focus ring against the canonical surface",
        foreground: "--mint (the focus ring, per DESIGN.md note 5, not --fmint)",
        background: "--case (canonical surface, raised)", threshold: 3,
        route: "/", state: "unknown identifier, draft form open, control focused",
        selector: ringOnCase ? ringOnCase.ring.selector : null,
        foregroundHex: ringOnCase ? ringOnCase.ring.outlineHex : null,
        backgroundHex: ringOnCase ? ringOnCase.ring.behindHex : null,
        ratio: ringOnCase ? ringOnCase.ring.ratio : null,
        verdict: ringOnCase ? ((ringOnCase.ring.ratio ?? 0) >= 3 ? "PASS" : "FAIL") : "NO ELEMENT",
        note: ringOnCase
          ? `outline ${ringOnCase.ring.outlineWidth} ${ringOnCase.ring.outlineStyle}, offset ${ringOnCase.ring.outlineOffset}, drawn outside the control's own box so the pixels under it are the slab's --case fill.`
          : "No focus ring resolved against a --case surface.",
      });
    }

    await page.context().close();
  }

  evidence.pairs = pairs;
  evidence.perTheme = perTheme;
  evidence.accentTextByTheme = Object.fromEntries(
    Object.entries(accentIndex).map(([theme, list]) => [
      theme,
      list.map((r) => ({
        where: r.selector,
        text: r.text,
        fg: r.fgTokens.join("|"),
        fgHex: r.fgHex,
        bg: r.bgTokens.join("|"),
        bgHex: r.bgHex,
        ratio: r.ratio,
        hatchStripeHex: r.hatchStripeHex,
        ratioOnHatchStripe: r.ratioOnHatchStripe,
      })),
    ]),
  );

  const after = await assertServedBuildId(request, BASE, EXPECTED_BUILD_ID, "after the last measurement");
  evidence.buildIdAfter = after;

  const file = writeEvidence("c3-contrast-pairs.json", evidence);
  console.log("C3 artifact: " + file);
  for (const p of pairs) {
    console.log(
      `pair ${p.pair} ${p.theme}  ${p.clause}  ${p.foregroundHex ?? "-"} on ${p.backgroundHex ?? "-"}  ` +
        `ratio ${p.ratio ?? "-"} against ${p.threshold}  ${p.verdict}  ${p.selector ?? ""}`,
    );
  }
});
