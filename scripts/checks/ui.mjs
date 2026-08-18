#!/usr/bin/env node
// check:ui -- the standing guard for C1, C3, C7 and C25.
//
// Why this exists. Three defects in this run followed the same path: the
// design comps were measured clean, the build reintroduced the defect, and
// it survived until an agent happened to look. A 390px document that
// scrolled to 560 and clipped the verdict word mid-word. A light-theme nav
// at 1.08:1, effectively invisible. Four tap targets under 44px on every
// route. scripts/ui-audit.js could measure all three the whole time; it was
// never wired to anything that fails a build.
//
// This runs that audit against a built app -- never `next dev` -- at 390 and
// 1440, in both themes, over every route the build actually produced, and
// exits non-zero on any horizontal overflow, any contrast pair under its
// floor, or any interactive target under 44px on its shortest side.
//
// Two measurement traps, both of which have already produced false readings
// in this project and are asserted against here rather than remembered:
//   1. Scale. A leftover `body { zoom }` makes a declared 44px control
//      compute as 43.99 and invents C7 violations. Every page is asserted at
//      zoom 1 and deviceScaleFactor 1 before a single box is read.
//   2. Route health. A route that 500s cannot overflow and cannot fail
//      contrast, so a broken page reads as a clean one. Every audited route
//      must return 200 and render <main>, or the run aborts as
//      COULD NOT RUN rather than passing.
//
// Exit codes are three, not two, because "clean" and "could not look" must
// never share one:
//   0  audited, no findings
//   1  audited, findings (the counts and selectors are printed)
//   3  could not audit (no build, no browser, a route that would not render)
//
// Database. `npm run build` needs DATABASE_URL because the two /api/sync
// routes resolve a connection string at module scope. Every route this
// audits is client-rendered from the on-device copy and touches no database
// at request time. So the check runs in one of two named modes and says
// which, every time, on every summary line:
//   database     DATABASE_URL is set, or the local Docker Postgres on 5433
//                is reachable. Full coverage.
//   no-database  neither. The build still completes against an unreachable
//                placeholder, and the layout, contrast and tap-target
//                measurements are identical, because no audited route reads
//                the database. What is NOT covered is stated in the banner:
//                catalogue-populated states. Route health is asserted hard,
//                so a page that broke for want of a database aborts the run
//                instead of passing it.
// Set VITRINE_BASE_URL to audit a running server or a deployment instead,
// in which case no build and no database are involved at all.

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { connect } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const AUDIT_SRC = path.join(ROOT, "scripts", "ui-audit.js");
const LOCAL_DEV_DEFAULT = "postgres://vitrine:vitrine_dev_only@localhost:5433/vitrine";
// Syntactically valid, deliberately unroutable. Used only to let `next build`
// resolve a connection string in no-database mode. Never connected to: the
// audited routes do not read the database, and any route that tried would
// fail its 200 check and abort the run.
const PLACEHOLDER_DB_URL = "postgres://vitrine:none@127.0.0.1:1/vitrine_absent";

// 390 is the width the design was drawn for and the width F4 captures at;
// 1440 is the desktop the nav geometry was settled against. UI_CHECK_WIDTHS
// widens the sweep (320,390,768,1440) when a layout change needs proving at
// the breakpoints in between.
const WIDTHS = (process.env.UI_CHECK_WIDTHS ?? "390,1440")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => n > 0)
  .map((w) => ({ w, h: w >= 1024 ? 900 : 844, label: String(w) }));
// Both rendered scopes, and both ways a collector arrives at them. "system"
// is the first-run default and is the only state that renders the resolved
// line under the theme switch, which makes the nav 96px instead of 77 and
// changes how the row wraps at 390. Auditing only an explicit choice would
// have measured a nav that no first-time visitor ever sees.
const THEMES = ["dark", "light"];
const STORED_CHOICES = (theme) => ["system", theme];
const THEME_STORAGE_KEY = "vitrine:theme";
// Well formed, in no catalogue anywhere. Renders the three-doors verdict,
// which is the state the 560px overflow lived in, and it renders it with or
// without a database.
const UNKNOWN_IDENTIFIER = "SLUS-99999";

const argv = new Set(process.argv.slice(2));
const VERBOSE = argv.has("--verbose");

function say(line = "") {
  process.stdout.write(line + "\n");
}
function fail(code, ...lines) {
  say("");
  for (const l of lines) say(l);
  process.exit(code);
}

// ---------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------

function tcpReachable(host, port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function resolveDatabaseMode() {
  // The no-database path has to be exercisable on a machine that has a
  // database, or nobody ever finds out it is broken until CI does.
  if (process.env.UI_CHECK_FORCE_NO_DATABASE) {
    return {
      mode: "no-database",
      url: PLACEHOLDER_DB_URL,
      why: "UI_CHECK_FORCE_NO_DATABASE is set",
    };
  }
  if (process.env.DATABASE_URL) {
    return { mode: "database", url: process.env.DATABASE_URL, why: "DATABASE_URL is set" };
  }
  const local = new URL(LOCAL_DEV_DEFAULT);
  if (await tcpReachable(local.hostname, Number(local.port))) {
    return {
      mode: "database",
      url: LOCAL_DEV_DEFAULT,
      why: `local Postgres reachable on ${local.hostname}:${local.port}`,
    };
  }
  return {
    mode: "no-database",
    url: PLACEHOLDER_DB_URL,
    why: "DATABASE_URL unset and no local Postgres on 5433",
  };
}

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: VERBOSE ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout?.on("data", (d) => (out += d));
    child.stderr?.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

async function waitForHttp(url, timeoutMs, onDead) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (onDead && onDead()) return false;
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status > 0) return true;
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

// ---------------------------------------------------------------------
// Routes, from the build the server is about to serve
// ---------------------------------------------------------------------

function routesFromManifest() {
  const file = path.join(ROOT, ".next", "app-path-routes-manifest.json");
  if (!existsSync(file)) return null;
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  const routes = [];
  for (const route of Object.values(manifest)) {
    if (route.startsWith("/api/")) continue; // no interface to measure
    if (route.endsWith(".svg") || route.endsWith(".ico")) continue;
    // Next generates /_global-error as a fallback shell that no navigation
    // reaches. Reported as not audited rather than counted clean.
    if (route === "/_global-error") continue;
    if (route === "/_not-found") {
      routes.push({ label: "/_not-found", path: "/no-such-route-check-ui", note: "404 shell" });
      continue;
    }
    if (route.includes("[")) {
      // A dynamic segment with a value no device holds renders the route's
      // real not-found state, which is a state the rubric counts.
      routes.push({
        label: route,
        path: route.replace(/\[\[?\.{0,3}(\w+)\]?\]/g, "check-ui-sample"),
        note: "unknown id, not-found state",
      });
      continue;
    }
    routes.push({ label: route, path: route });
  }
  routes.sort((a, b) => a.path.localeCompare(b.path));
  return routes;
}

// ---------------------------------------------------------------------
// The audit
// ---------------------------------------------------------------------

const auditSource = existsSync(AUDIT_SRC) ? readFileSync(AUDIT_SRC, "utf8") : null;

async function auditPage(page, { width, theme, label, state }) {
  await page.addScriptTag({ content: auditSource });

  const zoom = await page.evaluate(() => getComputedStyle(document.body).zoom);
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  if (zoom !== "1" && zoom !== "normal") {
    fail(3, `COULD NOT RUN: body zoom is ${zoom} at ${label} ${theme} ${width}px.`,
      "Box measurements taken under a page zoom are not comparable to a 44px floor.");
  }
  if (dpr !== 1) {
    fail(3, `COULD NOT RUN: devicePixelRatio is ${dpr}, expected 1.`);
  }

  const result = await page.evaluate(() => window.uiAudit({ primarySelector: 'form button[type="submit"]' }));
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    navHeight: Math.round(document.querySelector("header.topnav")?.getBoundingClientRect().height ?? -1),
    // .srOnly carries text a screen reader depends on and a sighted user must
    // never see. Both halves are checked: a box that grew would show it, and
    // display:none or empty text would silently delete it from the
    // accessibility tree.
    srOnly: [...document.querySelectorAll(".srOnly")].map((el) => {
      const r = el.getBoundingClientRect();
      const c = getComputedStyle(el);
      const name = (el.getAttribute("aria-label") || el.textContent || "").trim();
      const problems = [];
      if (r.width > 2 || r.height > 2) problems.push(`visible box ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
      if (!name) problems.push("no accessible name");
      if (c.display === "none" || c.visibility === "hidden") problems.push(`removed from the a11y tree (${c.display}/${c.visibility})`);
      return problems.length ? `.srOnly "${name.slice(0, 30)}" ${problems.join(", ")}` : null;
    }).filter(Boolean),
    srOnlyCount: document.querySelectorAll(".srOnly").length,
  }));

  return {
    route: label,
    state,
    theme,
    width,
    scrollWidth: geometry.scrollWidth,
    clientWidth: geometry.clientWidth,
    navHeight: geometry.navHeight,
    overflowCount: result.overflowCount,
    overflow: result.overflow,
    contrastFailureCount: result.contrastFailures.reduce((n, [, c]) => n + c, 0),
    contrastFailures: result.contrastFailures,
    tapUnder44: result.tapUnder44,
    tapSample: result.tapSample,
    primaryUnder56: result.primaryUnder56,
    offScaleSpacing: result.offScaleSpacing,
    srOnlyCount: geometry.srOnlyCount,
    srOnlyProblems: geometry.srOnly,
    // C26. The audit computed both of these from the start and this file read
    // neither, so the line had no gate anywhere in the suite while its two
    // literal colours shipped.
    surfaceWithoutColourCount: result.surfaceWithoutColourCount,
    surfaceWithoutColour: result.surfaceWithoutColour,
    literalHexCount: result.literalHexOutsideTokensCount,
    literalHex: result.literalHexOutsideTokens,
    textNodesChecked: result.textNodesChecked,
  };
}

async function settle(page) {
  await page.waitForSelector("main", { state: "attached", timeout: 20_000 });
  await page.waitForSelector("header.topnav", { state: "attached", timeout: 20_000 });
  // Type metrics decide line-box height, which decides whether a bare text
  // link measures 23.4 or 44. Measuring before the webfont lands measures
  // the fallback.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main() {
  if (!auditSource) fail(3, `COULD NOT RUN: ${AUDIT_SRC} is missing.`);

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    fail(3, "COULD NOT RUN: playwright is not installed. npm install, then npm run pw:install.");
  }

  const externalBase = process.env.VITRINE_BASE_URL;
  let baseUrl = externalBase;
  let server = null;
  let db = { mode: "external", url: null, why: `VITRINE_BASE_URL is set to ${externalBase}` };

  say("check:ui  overflow, contrast, tap targets. C1, C3, C7, C25.");

  if (!externalBase) {
    db = await resolveDatabaseMode();
    if (db.mode === "no-database") {
      say("");
      say("  ###############################################################");
      say("  #  NO DATABASE. Running in reduced coverage.                  #");
      say("  #  " + db.why.slice(0, 59).padEnd(59) + "#");
      say("  #  Covered: every route's resting state, both themes, both    #");
      say("  #  widths, plus the unknown-identifier verdict.               #");
      say("  #  NOT covered: catalogue-populated states (OWNED, UNCERTAIN, #");
      say("  #  a populated catalogue index and collection list).          #");
      say("  #  Route health is asserted: any route that will not render   #");
      say("  #  aborts this run as COULD NOT RUN rather than passing it.   #");
      say("  ###############################################################");
    } else {
      say(`  database mode: ${db.why}`);
    }

    if (!process.env.UI_CHECK_SKIP_BUILD) {
      say("  building (next build) ...");
      const built = await run("npm", ["run", "build"], { DATABASE_URL: db.url });
      if (built.code !== 0) {
        fail(3, "COULD NOT RUN: npm run build failed.", built.out.slice(-3000));
      }
    }
    if (!existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
      fail(3, "COULD NOT RUN: no build in .next. Run npm run build first, or unset UI_CHECK_SKIP_BUILD.");
    }

    const port = Number(process.env.UI_CHECK_PORT) || (await freePort());
    baseUrl = `http://127.0.0.1:${port}`;
    say(`  starting next start on ${baseUrl} ...`);
    let exited = null;
    server = spawn("npm", ["run", "start", "--", "-p", String(port)], {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: db.url, NODE_ENV: "production" },
      stdio: VERBOSE ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    server.on("close", (code) => (exited = code));
    const up = await waitForHttp(baseUrl + "/", 120_000, () => exited !== null);
    if (!up) {
      stopServer(server);
      fail(3, `COULD NOT RUN: the production server never answered on ${baseUrl}.`);
    }
  } else {
    say(`  auditing ${baseUrl} (no build, no database involved)`);
  }

  const routes = routesFromManifest();
  if (!routes || routes.length === 0) {
    stopServer(server);
    fail(3, "COULD NOT RUN: no routes found in .next/app-path-routes-manifest.json.");
  }
  say(`  routes: ${routes.map((r) => r.label).join(", ")}`);
  say("");

  const browser = await chromium.launch({ headless: true });
  const rows = [];
  const unreachable = [];

  try {
    for (const theme of THEMES) {
      for (const stored of STORED_CHOICES(theme)) {
        for (const size of WIDTHS) {
          const scope = `${theme}/${stored}`;
          const context = await browser.newContext({
            viewport: { width: size.w, height: size.h },
            deviceScaleFactor: 1,
            colorScheme: theme,
            serviceWorkers: "block",
          });
          await context.addInitScript(
            ([key, value]) => {
              try {
                if (value === "system") window.localStorage.removeItem(key);
                else window.localStorage.setItem(key, value);
              } catch {
                /* storage unavailable; the colorScheme emulation still applies */
              }
            },
            [THEME_STORAGE_KEY, stored],
          );
          const page = await context.newPage();

          for (const route of routes) {
            const res = await page.goto(baseUrl + route.path, { waitUntil: "load" });
            const status = res?.status() ?? 0;
            const expected = route.note === "404 shell" ? 404 : 200;
            if (status !== expected) {
              unreachable.push(`${route.label} returned ${status}, expected ${expected} (${scope} ${size.label})`);
              continue;
            }
            await settle(page);
            const resting = await auditPage(page, { width: size.w, theme: scope, label: route.label, state: "resting" });
            rows.push(resting);
            // The light theme rendered its nav at 1.08:1 because .lt missed
            // one ground token. A scope that renders in the wrong theme
            // would hide that, so the scope is asserted, not assumed.
            const isLight = await page.evaluate(() => document.documentElement.classList.contains("lt"));
            if (isLight !== (theme === "light")) {
              unreachable.push(`${route.label} rendered the wrong theme scope for ${scope} at ${size.label}`);
            }

            // One driven state, on the route that has one. The three-doors
            // verdict is where the 560px overflow lived, and it renders
            // without a catalogue.
            if (route.path === "/") {
              const input = page.locator("#check-identifier");
              if (await input.count()) {
                await input.fill(UNKNOWN_IDENTIFIER);
                await page.locator('form button[type="submit"]').click();
                const slab = page.locator("section.vslab");
                await slab.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
                if (await slab.count()) {
                  await page.evaluate(() => document.fonts.ready);
                  rows.push(
                    await auditPage(page, { width: size.w, theme: scope, label: "/", state: "verdict: unknown identifier" }),
                  );
                } else {
                  unreachable.push(`/ never rendered a verdict for ${UNKNOWN_IDENTIFIER} (${scope} ${size.label})`);
                }
              } else {
                unreachable.push(`/ has no #check-identifier input (${scope} ${size.label})`);
              }
            }
          }
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    stopServer(server);
  }

  report(rows, unreachable, db);
}

function stopServer(server) {
  if (!server || server.killed) return;
  try {
    server.kill("SIGTERM");
  } catch {
    /* already gone */
  }
}

// ---------------------------------------------------------------------
// Report. Counts and selectors, never a bare pass/fail.
// ---------------------------------------------------------------------

function report(rows, unreachable, db) {
  const mode = db.mode;
  const pad = (s, n) => String(s).padEnd(n);

  say(pad("route / state", 40) + pad("theme/stored", 14) + pad("vw", 6) + pad("scrollW", 9) + pad("nav", 6) + pad("overflow", 10) + pad("contrast", 10) + pad("tap<44", 8) + "prim<56");
  say("-".repeat(109));
  for (const r of rows) {
    const name = r.state === "resting" ? r.route : `${r.route}  [${r.state}]`;
    say(
      pad(name.slice(0, 39), 40) +
        pad(r.theme, 14) +
        pad(r.width, 6) +
        pad(r.scrollWidth, 9) +
        pad(r.navHeight, 6) +
        pad(r.overflowCount, 10) +
        pad(r.contrastFailureCount, 10) +
        pad(r.tapUnder44, 8) +
        r.primaryUnder56.length,
    );
  }
  say("");

  const overflowRows = rows.filter((r) => r.overflowCount > 0 || r.scrollWidth > r.clientWidth);
  const contrastRows = rows.filter((r) => r.contrastFailureCount > 0);
  const tapRows = rows.filter((r) => r.tapUnder44 > 0);
  const primaryRows = rows.filter((r) => r.primaryUnder56.length > 0);

  const detail = (title, list, pick) => {
    if (!list.length) return;
    say(title);
    for (const r of list) {
      say(`  ${r.route} [${r.state}] ${r.theme} @${r.width}px`);
      for (const line of pick(r)) say(`      ${line}`);
    }
    say("");
  };

  detail("OVERFLOW (C1, C25): elements past the viewport, or a document wider than it", overflowRows, (r) => [
    `document.scrollWidth ${r.scrollWidth} against clientWidth ${r.clientWidth}`,
    ...r.overflow,
  ]);
  detail("CONTRAST (C3, C25): pairs under their floor", contrastRows, (r) =>
    r.contrastFailures.map(([pair, count]) => `${count}x  ${pair}`),
  );
  detail("TAP TARGETS (C7): under 44px on the shortest side", tapRows, (r) => r.tapSample);
  detail("PRIMARY TARGETS (F11): under 56px on the shortest side", primaryRows, (r) => r.primaryUnder56);
  const srOnlyRows = rows.filter((r) => r.srOnlyProblems.length > 0);
  detail("VISUALLY HIDDEN TEXT: .srOnly that is showing, or gone from the a11y tree", srOnlyRows, (r) => r.srOnlyProblems);

  // C8 rides along. The audit already reads every margin and padding value
  // the stylesheets set, so reporting it costs nothing; it is reported and
  // failed on, because an off-scale value that only a person notices is the
  // same class of defect as the three above.
  const offScale = [...new Set(rows.flatMap((r) => r.offScaleSpacing))].sort((a, b) => a - b);
  if (offScale.length) {
    say("SPACING (C8): margin or padding values off the 4/8/12/16/20/24/32/40/56/72 scale");
    say("      " + offScale.join(", "));
    say("");
  }

  // C26 clause 1: a rule that sets font or background on a text-bearing
  // container without setting colour. Clause 2: a literal colour outside the
  // token definitions and the photograph classes.
  const inherit = [...new Set(rows.flatMap((r) => r.surfaceWithoutColour || []))].sort();
  if (inherit.length) {
    say("DECLARE, DO NOT INHERIT (C26): sets font or background, does not set color");
    for (const sel of inherit) say("      " + sel);
    say("");
  }
  // C26 clause 2, THE HALF THIS GATE CAN SEE. The audit runs in a browser and
  // builds this from document.styleSheets, so it reaches CSS and cannot reach
  // TypeScript. A literal in a .ts module that ships into the document head is
  // invisible here and this count will read 0 with nothing behind it. That is
  // not hypothetical: `theme-colors.generated.ts` holds two, both of which
  // render as <meta name="theme-color"> on every page. `npm run
  // check:theme-colors` counts those. Reading this 0 as the clause is the
  // mistake the label exists to prevent.
  const literals = [...new Set(rows.flatMap((r) => r.literalHex || []))].sort();
  if (literals.length) {
    say("LITERAL COLOUR IN CSS (C26 clause 2, partial): outside :root, .lt and the photograph classes");
    for (const hit of literals) say("      " + hit);
    say("");
  }

  const totals = {
    combinations: rows.length,
    overflowFindings: rows.reduce((n, r) => n + r.overflowCount, 0),
    contrastFindings: rows.reduce((n, r) => n + r.contrastFailureCount, 0),
    tapFindings: rows.reduce((n, r) => n + r.tapUnder44, 0),
    primaryFindings: rows.reduce((n, r) => n + r.primaryUnder56.length, 0),
    offScaleSpacing: offScale.length,
    inheritColourFindings: Math.max(...rows.map((r) => r.surfaceWithoutColourCount || 0), 0),
    literalColourFindings: Math.max(...rows.map((r) => r.literalHexCount || 0), 0),
    srOnlyFindings: rows.reduce((n, r) => n + r.srOnlyProblems.length, 0),
    srOnlyElementsSeen: Math.max(...rows.map((r) => r.srOnlyCount), 0),
    widestScrollWidthAt390: Math.max(...rows.filter((r) => r.width === 390).map((r) => r.scrollWidth), 0),
  };

  say(
    `totals over ${totals.combinations} route/state/theme/width combinations: ` +
      `overflow ${totals.overflowFindings}, contrast ${totals.contrastFindings}, ` +
      `tap<44 ${totals.tapFindings}, primary<56 ${totals.primaryFindings}, ` +
      `off-scale spacing ${totals.offScaleSpacing}, ` +
      `inherit-colour ${totals.inheritColourFindings}, ` +
      `literal-colour-in-css ${totals.literalColourFindings} (CSS only, see check:theme-colors), ` +
      `.srOnly ${totals.srOnlyFindings} findings over ${totals.srOnlyElementsSeen} elements, ` +
      `widest scrollWidth at 390 = ${totals.widestScrollWidthAt390}`,
  );

  if (unreachable.length) {
    say("");
    say("COULD NOT AUDIT:");
    for (const u of unreachable) say("  " + u);
    say("");
    say(`check:ui COULD NOT RUN (${mode} mode). A route that will not render cannot be measured,`);
    say("and an unmeasured route must never read as a clean one.");
    process.exit(3);
  }

  const failed =
    totals.overflowFindings +
      totals.contrastFindings +
      totals.tapFindings +
      totals.primaryFindings +
      totals.offScaleSpacing +
      totals.srOnlyFindings +
      totals.inheritColourFindings +
      totals.literalColourFindings >
      0 || overflowRows.length > 0;

  say("");
  if (failed) {
    say(`check:ui FAIL (${mode} mode). Selectors above.`);
    process.exit(1);
  }
  say(
    mode === "no-database"
      ? "check:ui PASS (no-database mode: catalogue-populated states were NOT audited)"
      : `check:ui PASS (${mode} mode)`,
  );
  process.exit(0);
}

main().catch((err) => {
  say("");
  say("COULD NOT RUN: " + (err?.stack ?? String(err)));
  process.exit(3);
});
