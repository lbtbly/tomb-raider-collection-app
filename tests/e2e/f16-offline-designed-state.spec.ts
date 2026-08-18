// F16: "With the network disabled, every route renders the designed offline
// state; count of routes showing a browser error page is 0."
//
// WHY THIS FILE EXISTS. Two reasons.
//
//   1. The reading on record was taken on port 3100, and EVIDENCE.md entry 171
//      later established that 3100 was serving a build that no longer existed:
//      200s, real production headers, 404ing chunks, nothing hydrating. A
//      client-side reading taken there describes a corpse.
//
//   2. THE ROUTE SET HAS CHANGED SINCE. src/app/error.tsx,
//      src/app/global-error.tsx and src/app/not-found.tsx did not exist when
//      "every route" was last counted, so the count was taken over a smaller
//      set than the words cover. This file enumerates the route set from the
//      filesystem at run time and writes it into the artifact, so the set the
//      count was taken over is part of the evidence rather than an assumption
//      about it.
//
// THE DETECTOR HAS TO BE ABLE TO SAY NO. A check that has only ever returned
// "designed" is not a check, it is a constant. Two controls below force a real
// Chrome error document and run the same classifier over it, and the line is
// only worth reading if those two come back "browser-default".
//
// One thing learned in the writing and worth stating: headless Chromium's
// network error document carries no ERR_ string in its markup, so a detector
// built on scraping "ERR_INTERNET_DISCONNECTED" out of the DOM would have
// passed a browser error page as designed. What separates the two here is that
// the error document reports origin "null" and carries none of the product's
// own furniture: no footer disclaimer, no app shell, no resolved theme token.

import { expect, test, type Page } from "@playwright/test";
import { readdirSync } from "node:fs";
import path from "node:path";
import {
  assertProductionTarget,
  assertScaleOne,
  assertServedBuildId,
  buildIdOnDisk,
  capture,
  measureSubjectInCapture,
  repoRelative,
  repoRoot,
  writeEvidence,
} from "./harness";

const VIEWPORT_WIDTH = 390;

/** The build this measurement is commissioned against, pinned by the caller,
 * checked before the first route and again after the last. */
function expectedBuildId(): string {
  const pinned = process.env.VITRINE_EXPECTED_BUILD_ID;
  if (!pinned) {
    throw new Error(
      "VITRINE_EXPECTED_BUILD_ID is not set. Without the pin this run would measure whatever is listening.",
    );
  }
  return pinned;
}

const SEL = {
  identifier: "#check-identifier",
  submit: 'form button[type="submit"]',
  slab: '[data-testid="verdict"]',
  recognizedLabel: "section.vslab .vlead.mono",
  addToCollection: 'section.vslab button:has-text("Add to collection")',
  pageHeading: "h1.pageh1",
};

const CONFIRM = "Saved to your collection.";

type Classification = {
  requested: string;
  navigationError: string | null;
  origin: string | null;
  documentTitle: string | null;
  heading: string | null;
  lead: string | null;
  footerDisclaimerPresent: boolean;
  appShellPresent: boolean;
  resolvedInkToken: string | null;
  topNavPresent: boolean;
  bodyTextLength: number;
  verdict: "designed" | "browser-default";
  evaluationFailed?: string;
};

const evidence: Record<string, unknown> = {};

/** Reads what the document actually is. Positive product markers, not scraped
 * error strings: the product's own footer line, its app shell, and a theme
 * token that only resolves if globals.css loaded. A browser error page has
 * none of the three and reports origin "null". */
async function classify(page: Page, requested: string, appOrigin: string): Promise<Classification> {
  let navigationError: string | null = null;
  try {
    await page.goto(requested, { waitUntil: "load", timeout: 20_000 });
  } catch (error) {
    navigationError = String((error as Error).message).split("\n")[0]!;
  }

  const facts = await page
    .evaluate(() => {
      const heading = document.querySelector("h1.pageh1");
      // Some designed states lead with p.vlead rather than a heading (the
      // collection item's not-found state is one), so both are read or a
      // screen with no h1 looks like a screen with no content.
      const lead = document.querySelector("p.vlead");
      return {
        origin: location.origin,
        documentTitle: document.title,
        heading: heading ? (heading.textContent ?? "").trim() : null,
        lead: lead ? (lead.textContent ?? "").trim() : null,
        footerDisclaimerPresent:
          (document.querySelector("footer.foot p")?.textContent ?? "").includes("unofficial"),
        appShellPresent: document.querySelector("main.shell") !== null,
        resolvedInkToken: getComputedStyle(document.documentElement).getPropertyValue("--ink").trim(),
        topNavPresent: document.querySelector("header.topnav") !== null,
        bodyTextLength: (document.body?.innerText ?? "").trim().length,
      };
    })
    .catch((error) => ({ evaluationFailed: String((error as Error).message).split("\n")[0] }));

  if ("evaluationFailed" in facts) {
    return {
      requested,
      navigationError,
      origin: null,
      documentTitle: null,
      heading: null,
      lead: null,
      footerDisclaimerPresent: false,
      appShellPresent: false,
      resolvedInkToken: null,
      topNavPresent: false,
      bodyTextLength: 0,
      verdict: "browser-default",
      evaluationFailed: facts.evaluationFailed,
    };
  }

  const designed =
    navigationError === null &&
    facts.origin === appOrigin &&
    facts.footerDisclaimerPresent &&
    facts.appShellPresent &&
    facts.resolvedInkToken !== "";

  return { requested, navigationError, ...facts, verdict: designed ? "designed" : "browser-default" };
}

/** The route set, read off the filesystem rather than remembered, because the
 * last count of "every route" was taken before three of these files existed. */
function routeFilesOnDisk(): { pageRoutes: string[]; boundaries: string[] } {
  const appDir = path.join(repoRoot(), "src", "app");
  const pageRoutes: string[] = [];
  const boundaries: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name === "page.tsx") pageRoutes.push(repoRelative(full));
      if (["error.tsx", "global-error.tsx", "not-found.tsx"].includes(entry.name)) {
        boundaries.push(repoRelative(full));
      }
    }
  };
  walk(appDir);
  return { pageRoutes: pageRoutes.sort(), boundaries: boundaries.sort() };
}

async function offlineControl(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async () => {
    try {
      const res = await fetch(`/api/sync/index?offline-control=${Date.now()}`, { cache: "no-store" });
      return { reachedTheNetwork: true, status: res.status };
    } catch (error) {
      return { reachedTheNetwork: false, error: String((error as Error).message) };
    }
  });
}

async function waitForWorkerControl(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { supported: false, controlled: false };
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 60 && !navigator.serviceWorker.controller; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return { supported: true, controlled: navigator.serviceWorker.controller !== null };
  });
}

async function catalogueRowsOnDevice(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("vitrine");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const count = await new Promise<number>((resolve, reject) => {
      const req = db.transaction("catalogueIndex", "readonly").objectStore("catalogueIndex").count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return count;
  });
}

async function copyIdsOnDevice(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("vitrine");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const all = await new Promise<{ id: string }[]>((resolve, reject) => {
      const req = db.transaction("userCopies", "readonly").objectStore("userCopies").getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return all.map((c) => c.id);
  });
}

async function warmUpAndSaveOneCopy(page: Page, baseURL: string, identifier: string): Promise<string> {
  await page.goto("/");
  const worker = await waitForWorkerControl(page);
  expect(worker.controlled, "the worker never took control").toBe(true);
  await expect(async () => {
    expect(await catalogueRowsOnDevice(page)).toBeGreaterThan(0);
  }).toPass({ timeout: 30_000, intervals: [250, 500, 1000] });
  await expect(async () => {
    await page.fill(SEL.identifier, identifier);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.recognizedLabel)).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 1000] });
  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.slab)).toContainText(CONFIRM);
  const ids = await copyIdsOnDevice(page);
  expect(ids.length).toBe(1);
  void baseURL;
  return ids[0]!;
}

async function firstSoleHeldIdentifier(
  baseURL: string,
  get: (url: string) => Promise<{ json: () => Promise<unknown> }>,
): Promise<string> {
  const res = await get(new URL("/api/sync/index", baseURL).toString());
  const { rows } = (await res.json()) as {
    rows: { variantPublicId: string; normalizedIdentifiers: string[] }[];
  };
  const holders = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const value of row.normalizedIdentifiers) {
      holders.set(value, (holders.get(value) ?? new Set()).add(row.variantPublicId));
    }
  }
  const sole = [...holders.entries()]
    .filter(([, ids]) => ids.size === 1)
    .map(([value]) => value)
    .sort();
  expect(sole.length).toBeGreaterThan(0);
  return sole[0]!;
}

test("every route renders the designed offline state", async ({ page, context, request, baseURL }) => {
  const pinned = expectedBuildId();
  const target = await assertProductionTarget(request, baseURL!);
  const served = await assertServedBuildId(request, baseURL!, pinned, "before any F16 route");
  evidence.target = target;
  evidence.servedBuild = served;
  evidence.port = served.port;
  evidence.buildId = served.servedBuildId;
  evidence.servedBuildId = served.servedBuildId;
  evidence.buildIdOnDiskAtStart = served.buildIdOnDisk;
  evidence.routeFilesOnDisk = routeFilesOnDisk();

  const appOrigin = new URL(baseURL!).origin;
  const identifier = await firstSoleHeldIdentifier(baseURL!, (url) => request.get(url));
  const copyId = await warmUpAndSaveOneCopy(page, baseURL!, identifier);
  evidence.scale = await assertScaleOne(page, VIEWPORT_WIDTH, "F16 start");

  // Visited once online so the worker holds each exact URL, which is the
  // realistic state of a device that has used the app before losing signal.
  for (const route of ["/collection", `/collection/${copyId}`, "/catalogue"]) {
    await page.goto(route);
    await expect(page.locator(SEL.pageHeading)).toBeVisible();
  }

  // Addresses the offline pass will use must never be visited online first:
  // visiting one puts its exact document in the worker's runtime cache, and
  // the offline reading then describes that cache rather than the fallback.
  // That happened once in the writing of this file and inverted the result, so
  // the online comparison below deliberately uses DIFFERENT addresses of the
  // same two shapes.
  const neverVisitedCopyId = "00000000-0000-4000-8000-00000000f16a";
  const comparisonCopyId = "00000000-0000-4000-8000-00000000f16b";

  await page.goto("/no-such-route-f16-online");
  await expect(page.locator(SEL.pageHeading)).toBeVisible();
  const unmatchedOnline = await page.evaluate(() => {
    const h = document.querySelector("h1.pageh1");
    return h ? (h.textContent ?? "").trim() : null;
  });
  await page.goto(`/collection/${comparisonCopyId}`);
  await expect(page.locator("p.vlead")).toBeVisible();
  const neverVisitedOnline = await page.evaluate(() => {
    const lead = document.querySelector("p.vlead");
    return lead ? (lead.textContent ?? "").trim() : null;
  });
  evidence.onlineComparison = {
    what: "the same two address shapes with a network, at different addresses so the offline pass stays cold",
    unmatchedAddress: { route: "/no-such-route-f16-online", heading: unmatchedOnline },
    neverVisitedCollectionItem: { route: "/collection/{unknownId}", lead: neverVisitedOnline },
  };

  await context.setOffline(true);
  const controlBefore = await offlineControl(page);
  expect(
    controlBefore.reachedTheNetwork,
    "an uncached request succeeded, so nothing below was measured offline",
  ).toBe(false);

  const documents: {
    what: string;
    classification: Classification;
    capture: string;
    capturePx: number[];
    subjectInCapture: Record<string, unknown>;
  }[] = [];

  const measure = async (what: string, route: string, shot: string) => {
    const classification = await classify(page, route, appOrigin);
    const png = await capture(page, shot);
    // The capture has to contain the designed screen it is filed as evidence
    // for. main.shell is the product's own frame: on a browser error document
    // it is absent, which is why this is measured rather than asserted for
    // every row and asserted only where the classifier said "designed".
    const placement = await measureSubjectInCapture(
      page,
      "main.shell",
      png,
      `${what}: the product's app shell`,
    );
    if (classification.verdict === "designed") {
      expect(
        placement.found,
        `${what}: classified designed but the app shell is not in the captured document`,
      ).toBe(true);
      expect(
        placement.topPx !== null && placement.topPx < png.heightPx,
        `${what}: the designed screen starts below the bottom of its own capture`,
      ).toBe(true);
    }
    documents.push({
      what,
      classification,
      capture: png.file,
      capturePx: [png.widthPx, png.heightPx],
      subjectInCapture: placement,
    });
    return classification;
  };

  await measure("the check screen", "/", "f16-1-check-offline");
  await measure("the collection list", "/collection", "f16-2-collection-offline");
  await measure(
    "a collection item visited online before",
    `/collection/${copyId}`,
    "f16-3-collection-item-offline",
  );
  await measure(
    "a collection item never visited, resolved from the precached shell",
    `/collection/${neverVisitedCopyId}`,
    "f16-4-collection-item-never-visited-offline",
  );
  await measure("the catalogue index", "/catalogue", "f16-5-catalogue-offline");
  await measure(
    "an address that matches no route, which is what not-found.tsx is for",
    "/no-such-route-f16",
    "f16-6-unmatched-address-offline",
  );

  const controlAfter = await offlineControl(page);
  expect(controlAfter.reachedTheNetwork, "the network came back during the run").toBe(false);

  // The offline banner reads navigator.onLine, and the harness only flips that
  // on a document that is already loaded, so it is measured here on one rather
  // than inferred from the navigations above. This is an observation about the
  // designed offline state, not part of the browser-error-page count.
  await page.goto("/collection");
  await context.setOffline(false);
  await page.reload({ waitUntil: "load" });
  await context.setOffline(true);
  await expect(page.locator(".offlineBanner")).toBeVisible({ timeout: 5000 });
  const bannerShot = await capture(page, "f16-7-offline-banner-on-a-loaded-document");
  evidence.offlineBanner = {
    what: "the network taken away from a document that is already loaded, which is what fires the offline event",
    bannerText: await page.evaluate(() => {
      const banner = document.querySelector(".offlineBanner");
      return banner ? (banner.textContent ?? "").trim() : null;
    }),
    navigatorOnLine: await page.evaluate(() => navigator.onLine),
    capture: bannerShot.file,
    note:
      "on a document navigated to AFTER the harness went offline, navigator.onLine reads true again even " +
      "though every uncached request fails, so the banner stays absent in those readings. That is a property " +
      "of the harness emulation, not of the banner.",
  };

  // A finding, recorded because it contradicts a comment in public/sw.js. That
  // comment says the shell fallback lets React hydrate "this pathname's own
  // client route". It does not. Both addresses that have no cached document of
  // their own come back as the check screen, at the requested URL, because the
  // fallback serves the "/" document and the "/" flight payload with it. That
  // is a designed screen and not a browser error page, so F16's own count is
  // unaffected, but it is the wrong designed screen: online these two render
  // not-found.tsx and the item's not-found state.
  const shellFallback = documents.filter((d) =>
    [`/collection/${neverVisitedCopyId}`, "/no-such-route-f16"].includes(d.classification.requested),
  );
  evidence.shellFallbackFinding = {
    what: "addresses with no cached document of their own, offline",
    routes: shellFallback.map((d) => ({
      route: d.classification.requested,
      headingOffline: d.classification.heading,
      documentTitleOffline: d.classification.documentTitle,
      verdict: d.classification.verdict,
    })),
    onlineComparison: evidence.onlineComparison,
    reading:
      "the worker's caches.match('/') fallback serves the check screen document for these addresses, so the " +
      "screen that renders is the check screen rather than the address's own. No browser error page, so the " +
      "F16 count stands at 0, and not-found.tsx is not what a collector reaches at an unknown address offline.",
  };

  const closing = await assertServedBuildId(request, baseURL!, pinned, "after the last F16 route");
  evidence.servedBuildAfter = closing;
  evidence.buildIdOnDiskAtEnd = buildIdOnDisk();

  evidence.routeDocuments = documents;
  evidence.offlineControlBefore = controlBefore;
  evidence.offlineControlAfter = controlAfter;
  evidence.count = {
    documentsMeasured: documents.length,
    designed: documents.filter((d) => d.classification.verdict === "designed").length,
    browserDefault: documents.filter((d) => d.classification.verdict === "browser-default").length,
  };

  expect(
    documents.filter((d) => d.classification.verdict === "browser-default").length,
    "count of routes showing a browser error page",
  ).toBe(0);
});

test("the three route boundaries render their designed state offline", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  // not-found.tsx is reachable by address. error.tsx and global-error.tsx are
  // not: nothing a collector can type makes a render throw, so they are
  // triggered by breaking a browser primitive the product renders through,
  // which is a real uncaught failure in the product's own code path rather
  // than a mock of one. The probe disarms itself after firing so the boundary
  // it produced is not taken down by the same throw.
  const target = await assertServedBuildId(request, baseURL!, expectedBuildId(), "F16 route boundaries");
  const appOrigin = new URL(baseURL!).origin;

  await context.addInitScript(() => {
    const RealNumberFormat = Intl.NumberFormat;
    const RealMutationObserver = window.MutationObserver;
    // Formatting the "1 copy saved" plural on the collection list runs through
    // Intl.NumberFormat, below the root layout, which is where error.tsx sits.
    Object.defineProperty(Intl, "NumberFormat", {
      configurable: true,
      writable: true,
      value: function PatchedNumberFormat(...args: unknown[]) {
        // A countdown, not a single shot. React answers a throw during
        // hydration by re-rendering the tree on the client, so a probe that
        // disarms after one throw is simply repaired by the retry and the
        // boundary never appears. That is exactly what the first version of
        // this file measured: a green result from a probe that never fired.
        const left = Number(sessionStorage.getItem("f16-throw-below-the-layout") ?? "0");
        if (left > 0) {
          sessionStorage.setItem("f16-throw-below-the-layout", String(left - 1));
          throw new Error("f16 probe: forced render failure below the root layout");
        }
        return new (RealNumberFormat as unknown as new (...a: unknown[]) => object)(...args);
      },
    });
    // ThemeProvider observes the head from inside the root layout itself, so a
    // throw there is above error.tsx and only global-error.tsx can catch it.
    Object.defineProperty(window, "MutationObserver", {
      configurable: true,
      writable: true,
      value: function PatchedMutationObserver(...args: unknown[]) {
        // Same countdown, and it has to run out: global-error.tsx mounts its
        // own ThemeProvider, which observes the head exactly the same way, so
        // a probe armed forever takes down the boundary it just produced.
        const left = Number(sessionStorage.getItem("f16-throw-inside-the-layout") ?? "0");
        if (left > 0) {
          sessionStorage.setItem("f16-throw-inside-the-layout", String(left - 1));
          throw new Error("f16 probe: forced failure inside the root layout");
        }
        return new (RealMutationObserver as unknown as new (...a: unknown[]) => object)(...args);
      },
    });
  });

  const identifier = await firstSoleHeldIdentifier(baseURL!, (url) => request.get(url));
  await warmUpAndSaveOneCopy(page, baseURL!, identifier);

  await context.setOffline(true);
  const control = await offlineControl(page);
  expect(control.reachedTheNetwork, "the boundaries were not measured offline").toBe(false);

  const boundaries: { boundary: string; how: string; classification: Classification; capture: string; distinguishedBy: Record<string, unknown> }[] = [];

  const screenFacts = () =>
    page.evaluate(() => ({
      heading: (document.querySelector("h1.pageh1")?.textContent ?? "").trim(),
      controls: [...document.querySelectorAll("a.btn, button.btn")].map((el) =>
        (el.textContent ?? "").trim(),
      ),
      // global-error.tsx replaces the root layout, so it has no top nav. That
      // is what tells the two error boundaries apart in a capture.
      topNavPresent: document.querySelector("header.topnav") !== null,
    }));

  // ---- not-found.tsx ------------------------------------------------------
  // Measured offline AND online, because the two do not agree and the
  // difference is the point. Offline the worker serves the "/" shell for any
  // address it holds no document for, so an unknown address renders the check
  // screen rather than not-found.tsx.
  const notFound = await classify(page, "/no-such-route-f16-boundary", appOrigin);
  const notFoundShot = await capture(page, "f16-8-not-found-offline");
  const notFoundOfflineFacts = await screenFacts();
  await context.setOffline(false);
  await page.goto("/no-such-route-f16-boundary");
  await expect(page.locator(SEL.pageHeading)).toBeVisible();
  const notFoundOnlineFacts = await screenFacts();
  const notFoundOnlineShot = await capture(page, "f16-8b-not-found-online");
  await context.setOffline(true);
  boundaries.push({
    boundary: "src/app/not-found.tsx",
    how: "an address that matches no route, measured with the network disabled and again with it back",
    classification: notFound,
    capture: notFoundShot.file,
    distinguishedBy: {
      offline: notFoundOfflineFacts,
      online: { ...notFoundOnlineFacts, capture: notFoundOnlineShot.file },
      reading:
        "offline this address renders the check screen from the worker's shell fallback, not not-found.tsx. " +
        "Online it renders not-found.tsx. Neither is a browser error page.",
    },
  });
  expect(notFoundOnlineFacts.heading, "not-found.tsx must render for an unmatched address online").toBe(
    "That page is not here.",
  );

  // ---- error.tsx ----------------------------------------------------------
  await page.goto("/collection");
  await page.evaluate(() => sessionStorage.setItem("f16-throw-below-the-layout", "6"));
  await page.reload({ waitUntil: "load" });
  const routeError = await classify(page, "/collection", appOrigin);
  const routeErrorShot = await capture(page, "f16-9-route-error-offline");
  const routeErrorFacts = await screenFacts();
  boundaries.push({
    boundary: "src/app/error.tsx",
    how: "Intl.NumberFormat made to throw while the collection list formats its count, offline",
    classification: routeError,
    capture: routeErrorShot.file,
    distinguishedBy: routeErrorFacts,
  });
  // The probe has to be shown to have fired. Without this the test passes on a
  // screen that never failed, which is what the first version of it did.
  expect(routeErrorFacts.heading, "the route error boundary did not render, so nothing was measured").toBe(
    "That did not load.",
  );
  expect(routeErrorFacts.controls).toContain("Try again");
  expect(routeErrorFacts.topNavPresent, "error.tsx nests inside the root layout, so the nav is there").toBe(
    true,
  );

  // ---- global-error.tsx ---------------------------------------------------
  await page.goto("/collection");
  await page.evaluate(() => sessionStorage.setItem("f16-throw-inside-the-layout", "6"));
  await page.reload({ waitUntil: "load" });
  const globalError = await classify(page, "/collection", appOrigin);
  const globalErrorShot = await capture(page, "f16-10-global-error-offline");
  const globalErrorFacts = await screenFacts();
  boundaries.push({
    boundary: "src/app/global-error.tsx",
    how: "MutationObserver made to throw inside the root layout's ThemeProvider, offline",
    classification: globalError,
    capture: globalErrorShot.file,
    distinguishedBy: globalErrorFacts,
  });
  expect(globalErrorFacts.heading, "the global error boundary did not render, so nothing was measured").toBe(
    "That did not load.",
  );
  expect(globalErrorFacts.topNavPresent, "global-error.tsx replaces the root layout, so there is no nav").toBe(
    false,
  );

  evidence.boundaries = {
    port: target.port,
    servedBuildId: target.servedBuildId,
    offlineControl: control,
    measured: boundaries,
    count: {
      measured: boundaries.length,
      designed: boundaries.filter((b) => b.classification.verdict === "designed").length,
      browserDefault: boundaries.filter((b) => b.classification.verdict === "browser-default").length,
    },
  };

  expect(
    boundaries.filter((b) => b.classification.verdict === "browser-default").length,
    "count of route boundaries showing a browser error page offline",
  ).toBe(0);
});

test("negative controls: the detector calls a browser error page a browser error page", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const target = await assertServedBuildId(request, baseURL!, expectedBuildId(), "F16 negative controls");
  const appOrigin = new URL(baseURL!).origin;
  const controls: { control: string; classification: Classification }[] = [];

  // Control 1: one of the product's own routes forced to a browser default.
  // The worker is the only thing that can answer with the network gone, so
  // bypassing it is exactly "force this route to a browser default".
  await page.goto("/");
  const worker = await waitForWorkerControl(page);
  expect(worker.controlled).toBe(true);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await context.setOffline(true);
  await cdp.send("Network.setBypassServiceWorker", { bypass: true });
  controls.push({
    control: "/catalogue, network disabled, service worker bypassed",
    classification: await classify(page, "/catalogue", appOrigin),
  });

  // Control 2: a host that is not there at all, online. A different failure
  // mode reaching the same document, so the classifier is not being read on
  // one accident.
  await context.setOffline(false);
  await cdp.send("Network.setBypassServiceWorker", { bypass: false });
  controls.push({
    control: "http://127.0.0.1:1/, a port with nothing listening",
    classification: await classify(page, "http://127.0.0.1:1/", appOrigin),
  });

  evidence.negativeControls = {
    port: target.port,
    servedBuildId: target.servedBuildId,
    controls,
    count: {
      forcedToABrowserDefault: controls.length,
      classifiedBrowserDefault: controls.filter((c) => c.classification.verdict === "browser-default").length,
      classifiedDesigned: controls.filter((c) => c.classification.verdict === "designed").length,
    },
    reading:
      "the classifier returns browser-default on both, so its 'designed' readings elsewhere are readings " +
      "and not a constant. Note neither document carried an ERR_ string in its markup: a detector built on " +
      "scraping those would have passed both as designed.",
  };

  for (const c of controls) {
    expect(c.classification.verdict, `the detector must reject: ${c.control}`).toBe("browser-default");
  }
});

test.afterAll(() => {
  evidence.line =
    "F16. With the network disabled, every route renders the designed offline state; count of routes " +
    "showing a browser error page is 0.";
  evidence.recordedAt = new Date().toISOString();
  writeEvidence("f16-offline-designed-state.json", evidence);
});
