// Vitrine UI audit. Runs inside a page: Playwright page.evaluate(uiAudit, opts),
// or pasted into a devtools/extension console.
//
// Measures what the rubric counts. It reports; it never judges and never writes
// to DOD.md. The verifier rules on lines, and only against output like this.
//
// Two traps this encodes, both of which produced false failures when they were
// missed by hand:
//   1. Measure at scale 1. A page zoom makes a declared 44px control compute as
//      43.99 and invents C7 violations.
//   2. Walking up for a background colour terminates on the body grid gradient
//      and invents contrast failures on every screen. Photograph backdrops are
//      handled separately: text over a photograph resolves to --ink, measured
//      against the photograph, never against a surface token.

function uiAudit(opts) {
  opts = opts || {};
  const TAP_MIN = 44 - 0.5, PRIMARY_MIN = 56 - 0.5;
  const SPACING = new Set([0, 4, 8, 12, 16, 20, 24, 32, 40, 56, 72]);
  const PHOTO = /(^|\s)(shot|jc|face|lp|slv|disc|pkbox|btlbox|btl|lid|bse|cd|spn|glyph|band|sheen|cast|cv-[a-z]+)(\s|$)/;
  const BANNED = ['seamless', 'robust', 'delve', 'effortless', 'elevate', 'unlock'];
  const PLACEHOLDER = ['lorem ipsum', '\\bTBD\\b', '\\bUntitled\\b', '\\bExample\\b', '\\bplaceholder\\b'];

  const srgb = c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  const parse = s => { const m = (s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].split(',').map(Number); return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = r => '#' + r.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const cs = el => getComputedStyle(el);
  const label = el => (el.tagName.toLowerCase() + '.' + ((el.className || '').toString().trim().split(/\s+/)[0] || '-')).slice(0, 40);

  // scale sanity: a declared-44px control must not measure 43.99
  const scaleWarning = (() => {
    const z = cs(document.body).zoom;
    return (z && z !== '1' && z !== 'normal') ? 'body zoom is ' + z + '; box measurements are unreliable' : null;
  })();

  // background behind an element, stopping at a photograph rather than at body
  const backdrop = el => {
    let n = el;
    while (n && n !== document.documentElement) {
      if (PHOTO.test(' ' + (n.className || '') + ' ')) return { photo: true };
      const c = cs(n);
      if (c.backgroundImage && c.backgroundImage !== 'none' && /gradient/.test(c.backgroundImage)) {
        return n === document.body ? { ground: true } : { photo: true };
      }
      const q = parse(c.backgroundColor);
      if (q && q.a > 0.85) return { rgb: q.rgb };
      n = n.parentElement;
    }
    return { ground: true };
  };

  const textNodes = [];
  document.querySelectorAll('*').forEach(el => {
    const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own.length) return;
    const c = cs(el);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.5) return;
    textNodes.push({ el, c, text: own.map(n => n.textContent.trim()).join(' ') });
  });

  // C3 / C25 contrast
  const contrast = {}, dimOverPhoto = [];
  textNodes.forEach(({ el, c, text }) => {
    const fg = parse(c.color); if (!fg || fg.a < 0.5) return;
    const b = backdrop(el);
    if (b.photo) {
      const h = hex(fg.rgb);
      if (!/#F2F6FF|#0C1226/i.test(h)) dimOverPhoto.push(label(el) + ' ' + h + ' :: ' + text.slice(0, 30));
      return;
    }
    if (b.ground) return;
    const size = parseFloat(c.fontSize), weight = parseInt(c.fontWeight) || 400;
    const floor = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
    const r = ratio(fg.rgb, b.rgb);
    if (r < floor) {
      const k = hex(fg.rgb) + ' on ' + hex(b.rgb) + ' @' + size + 'px need ' + floor;
      contrast[k] = (contrast[k] || 0) + 1;
    }
  });

  // C1 / C25 overflow against the viewport
  const overflow = [];
  const docW = document.documentElement.clientWidth;
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const over = Math.round(r.right - docW);
    if (over > 1 && cs(el).position !== 'fixed') overflow.push(label(el) + ' +' + over + 'px (w' + Math.round(r.width) + ')');
  });

  // C7 / F11 targets
  const small = [], primarySmall = [];
  document.querySelectorAll('a,button,input,select,textarea,[role="button"],[tabindex]:not([tabindex="-1"])').forEach(el => {
    const r = el.getBoundingClientRect(); if (!r.width && !r.height) return;
    if (cs(el).display === 'none') return;
    const m = Math.min(r.width, r.height);
    if (m < TAP_MIN) small.push(label(el) + ' ' + r.width.toFixed(1) + 'x' + r.height.toFixed(1));
    if (opts.primarySelector && el.matches(opts.primarySelector) && m < PRIMARY_MIN)
      primarySmall.push(label(el) + ' ' + r.width.toFixed(1) + 'x' + r.height.toFixed(1));
  });

  // C9 radii outside photograph objects
  const radii = [];
  document.querySelectorAll('body *').forEach(el => {
    if (PHOTO.test(' ' + (el.className || '') + ' ') || el.tagName === 'I') return;
    const c = cs(el);
    const v = ['borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius']
      .map(k => parseFloat(c[k]) || 0);
    if (Math.max(...v) > 0) radii.push(label(el) + ' = ' + c.borderRadius);
  });

  // C8 spacing, and C26 declare-do-not-inherit, from the stylesheets
  const offScale = new Set(), inheritColour = [], literalHex = new Set();
  for (const sheet of document.styleSheets) {
    let rules; try { rules = [...sheet.cssRules]; } catch { continue; }
    for (const rule of rules) {
      if (!rule.style || !rule.selectorText) continue;
      const sel = rule.selectorText;
      ['margin','padding','marginTop','marginRight','marginBottom','marginLeft',
       'paddingTop','paddingRight','paddingBottom','paddingLeft'].forEach(p => {
        const v = rule.style[p]; if (!v) return;
        (v.match(/-?\d+(\.\d+)?px/g) || []).forEach(t => {
          const n = Math.abs(parseFloat(t)); if (!SPACING.has(n)) offScale.add(n);
        });
      });
      // C26 clause 1 counts a rule that sets FONT OR BACKGROUND without colour.
      // setsSurface is that condition and was computed here from the start; the
      // line below used a background-only variable instead, so the font half of
      // the clause was never evaluated by the instrument built to evaluate it.
      // eslint flagged setsSurface as unused for exactly that reason.
      const setsSurface = rule.style.background || rule.style.backgroundColor || rule.style.font || rule.style.fontFamily;
      if (setsSurface && !rule.style.color && !PHOTO.test(' ' + sel.replace(/[.#>,:]/g, ' ') + ' ')) inheritColour.push(sel.slice(0, 50));
      const text = rule.cssText || '';
      (text.match(/#[0-9a-fA-F]{3,8}\b/g) || []).forEach(h => {
        if (!/^:root|\.lt\b/.test(sel) && !PHOTO.test(' ' + sel.replace(/[.#>,:]/g, ' ') + ' ')) literalHex.add(sel.slice(0, 28) + ' ' + h);
      });
    }
  }

  // C19 / D1 copy
  const body = document.body.innerText;
  const copy = {
    emDash: (body.match(/—/g) || []).length,
    emoji: (body.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length,
    banned: BANNED.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(body)),
    placeholders: PLACEHOLDER.filter(w => new RegExp(w, 'i').test(body))
  };

  // C24 / R26 disclaimer, C4 focus affordance
  const disclaimer = /unofficial|not affiliated/i.test(body);
  let focusable = 0, withRing = 0;
  document.querySelectorAll('a,button,input,select,textarea').forEach(el => {
    focusable++;
    const c = cs(el);
    if (c.outlineStyle !== 'none' || /inset/.test(c.boxShadow)) withRing++;
  });

  return {
    url: location.href,
    viewport: { w: docW, h: document.documentElement.clientHeight, dpr: devicePixelRatio },
    scaleWarning,
    textNodesChecked: textNodes.length,
    contrastFailures: Object.entries(contrast),
    dimTextOverPhotograph: dimOverPhoto.slice(0, 10),
    overflowCount: overflow.length, overflow: overflow.slice(0, 10),
    tapUnder44: small.length, tapSample: small.slice(0, 10),
    primaryUnder56: primarySmall,
    nonZeroRadii: radii.length, radiiSample: [...new Set(radii)].slice(0, 6),
    offScaleSpacing: [...offScale].sort((a, b) => a - b),
    // C26. Renamed from backgroundWithoutColour: the condition now includes
    // font, which is what the clause says and what setsSurface always computed.
    // Counts are returned WHOLE and the samples truncated, because a caller
    // that counts a truncated array reports 10 when the answer is 15.
    surfaceWithoutColourCount: new Set(inheritColour).size,
    surfaceWithoutColour: [...new Set(inheritColour)].slice(0, 10),
    literalHexOutsideTokensCount: literalHex.size,
    literalHexOutsideTokens: [...literalHex].slice(0, 10),
    copy, disclaimerPresent: disclaimer,
    focusableCount: focusable, withVisibleRingStyle: withRing
  };
}

if (typeof module !== 'undefined') module.exports = { uiAudit };
