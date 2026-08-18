// F13: "A copy created signed out survives a hard reload and a full browser
// restart with the network disabled; both captured."
//
// WHY THIS FILE EXISTS. Two reasons, and the second is the serious one.
//
//   1. The reading on record was taken on port 3100, which EVIDENCE.md entry
//      171 later established was a `next start` whose .next had been rebuilt
//      underneath it: production headers, 404ing chunks, nothing hydrating.
//      Everything here runs against a server whose BUILD_ID is asserted
//      against the BUILD_ID on disk first, and the port and the BUILD_ID are
//      written into the artifact.
//
//   2. THE BROWSER RESTART WAS NEVER PERFORMED. What was recorded was a new
//      tab in the same profile, and the entry said so itself. A tab is not a
//      browser, and closing and reopening a Playwright context is not one
//      either: the browser process never dies, so nothing that lives in it is
//      ever asked to come back from disk. This file kills the browser
//      process and starts another one against the same on-disk profile, and
//      proves the kill happened by checking the old pid is gone from the
//      process table before the new browser is launched.
//
// WHAT "HARD RELOAD" IS TAKEN TO MEAN, stated because the choice is
// load-bearing. Page.reload with ignoreCache: true, which discards the whole
// document and every byte of in-memory JavaScript state and re-requests
// ignoring the HTTP cache. A reload that ALSO bypasses the service worker
// (what shift-reload does in Chrome) cannot produce any document at all with
// the network disabled, since the worker is the only thing answering. That is
// not a property of this product; it is what bypassing the offline layer
// while offline means. It is measured below as a control so the claim is a
// measurement rather than an argument.

import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import {
  assertProductionTarget,
  assertScaleOne,
  assertServedBuildId,
  assertSubjectInCapture,
  buildIdOnDisk,
  capture,
  repoRelative,
  repoRoot,
  settle,
  writeEvidence,
} from "./harness";

/** The build this measurement is commissioned against, pinned by the caller.
 * Checked before the first reading and again after the last, because a
 * rebuild landing mid-run is how a previous reading went stale between its
 * own assertion and its own measurement. */
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
  row: "ul li a.row",
};

const CONFIRM = "Saved to your collection.";
const VIEWPORT = { width: 390, height: 844 };

const evidence: Record<string, unknown> = {};

async function copiesOnDevice(page: Page): Promise<{ id: string; itemTitle: string }[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("vitrine");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const all = await new Promise<{ id: string; itemTitle: string }[]>((resolve, reject) => {
      const req = db.transaction("userCopies", "readonly").objectStore("userCopies").getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return all;
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

/** Ask for something no cache holds. Every other request during an offline run
 * comes back "finished" because the worker answered it. */
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
    if (!("serviceWorker" in navigator)) return { supported: false, controlled: false, caches: [] as string[] };
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 60 && !navigator.serviceWorker.controller; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return {
      supported: true,
      controlled: navigator.serviceWorker.controller !== null,
      caches: "caches" in self ? await caches.keys() : [],
    };
  });
}

/** Types the identifier and saves the copy. Signed out is not a mode here: the
 * product has no account, no sign-in control and no session, so every copy any
 * run creates is created signed out by construction. */
async function createCopySignedOut(page: Page, identifier: string): Promise<void> {
  await expect(page.locator(SEL.identifier)).toBeVisible();
  await expect(async () => {
    await page.fill(SEL.identifier, identifier);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.recognizedLabel)).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 1000] });
  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.slab)).toContainText(CONFIRM);
}

/** The operating system's own answer to "which processes are running against
 * this profile directory right now". Chromium under Playwright writes no
 * SingletonLock, so the process table is the witness instead: it is external to
 * both Playwright and the test, and it is what makes "the browser restarted"
 * a fact rather than an assertion about an API call. Only pids are returned;
 * the directory is never printed. */
function pidsRunningAgainstProfile(userDataDir: string): number[] {
  try {
    const out = execFileSync("pgrep", ["-f", userDataDir], { encoding: "utf8" });
    return out
      .split("\n")
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isFinite(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
}

function processIsAlive(pid: number | null): boolean {
  if (pid === null) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function soleHeldIdentifiers(
  baseURL: string,
  get: (url: string) => Promise<{ json: () => Promise<unknown> }>,
): Promise<string[]> {
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
  return [...holders.entries()]
    .filter(([, ids]) => ids.size === 1)
    .map(([value]) => value)
    .sort();
}

test("a copy created signed out and offline survives a hard reload", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const pinned = expectedBuildId();
  const target = await assertProductionTarget(request, baseURL!);
  const served = await assertServedBuildId(request, baseURL!, pinned, "before the F13 hard reload");
  evidence.target = target;
  evidence.servedBuild = served;
  evidence.port = served.port;
  evidence.buildId = served.servedBuildId;
  evidence.servedBuildId = served.servedBuildId;
  evidence.buildIdOnDiskAtStart = served.buildIdOnDisk;

  const identifiers = await soleHeldIdentifiers(baseURL!, (url) => request.get(url));
  expect(identifiers.length).toBeGreaterThan(0);
  const identifier = identifiers[0]!;

  // Online once, so the worker installs and the catalogue index lands. Nothing
  // measured happens before the network is gone.
  await page.goto("/");
  evidence.scale = await assertScaleOne(page, VIEWPORT.width, "F13 hard reload start");
  const worker = await waitForWorkerControl(page);
  expect(worker.controlled, "the worker never took control").toBe(true);
  await expect(async () => {
    expect(await catalogueRowsOnDevice(page)).toBeGreaterThan(0);
  }).toPass({ timeout: 30_000, intervals: [250, 500, 1000] });

  await context.setOffline(true);
  const controlBefore = await offlineControl(page);
  expect(
    controlBefore.reachedTheNetwork,
    "an uncached request succeeded, so nothing below was measured offline",
  ).toBe(false);

  // The copy is created with the network already disabled, which is the
  // stricter reading of the line: created signed out, offline, and only then
  // asked to survive.
  await createCopySignedOut(page, identifier);
  const created = await copiesOnDevice(page);
  expect(created.length).toBe(1);
  const copy = created[0]!;

  await page.goto("/collection");
  await expect(page.locator(SEL.pageHeading)).toHaveText("Your collection");
  await expect(page.locator(SEL.row)).toHaveCount(1);
  const beforeShot = await capture(page, "f13-1-before-hard-reload-offline");
  const beforeSubject = await assertSubjectInCapture(
    page,
    SEL.row,
    beforeShot,
    "the saved copy's row before the hard reload",
  );

  // ---- variant 1: a full document reload ---------------------------------
  // The whole document and every byte of in-memory JavaScript state is thrown
  // away and rebuilt. The worker answers the request, which is the offline
  // layer doing its job.
  await page.reload({ waitUntil: "load" });
  await expect(page.locator(SEL.pageHeading)).toHaveText("Your collection");
  await expect(page.locator(SEL.row)).toHaveCount(1);
  await settle(page);
  const afterDocumentReload = await copiesOnDevice(page);
  const controlAfterDocumentReload = await offlineControl(page);
  const afterShot = await capture(page, "f13-2-after-hard-reload-offline");
  const afterSubject = await assertSubjectInCapture(
    page,
    SEL.row,
    afterShot,
    "the saved copy's row after the document reload",
  );
  const rowsAfterDocumentReload = await page.locator(SEL.row).count();
  const countLineAfterDocumentReload = await page
    .locator("p.mono", { hasText: "saved" })
    .first()
    .textContent();

  expect(controlAfterDocumentReload.reachedTheNetwork, "the network came back during the reload").toBe(false);
  expect(afterDocumentReload.length, "the copy did not survive the document reload").toBe(1);
  expect(afterDocumentReload[0]!.id).toBe(copy.id);

  // ---- variant 2: the literal cache-bypassing hard reload ----------------
  // Measured, not argued. Page.reload with ignoreCache is Chrome's hard
  // reload, and a hard reload bypasses the service worker for the document.
  // With the network disabled the worker is the only thing that can answer,
  // so the navigation has nothing to load from. The number that matters is
  // what happens to the COPY afterwards, which is what the line is about.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Page.enable");
  let hardReloadError: string | null = null;
  try {
    await Promise.all([
      page.waitForEvent("load", { timeout: 10_000 }),
      cdp.send("Page.reload", { ignoreCache: true }),
    ]);
  } catch (error) {
    hardReloadError = String((error as Error).message).split("\n")[0]!;
  }
  const documentAfterHardReload = await page
    .evaluate(() => ({
      origin: location.origin,
      productFooterPresent: document.querySelector("footer.foot") !== null,
      appShellPresent: document.querySelector("main.shell") !== null,
      collectionRows: document.querySelectorAll("ul li a.row").length,
    }))
    .catch((error) => ({ evaluationFailed: String((error as Error).message).split("\n")[0] }));

  // The copy is on the device, not in the document, so the next worker-served
  // navigation is what says whether it survived.
  await page.goto("/collection");
  await expect(page.locator(SEL.pageHeading)).toHaveText("Your collection");
  await expect(page.locator(SEL.row)).toHaveCount(1);
  await settle(page);
  const afterHardReload = await copiesOnDevice(page);
  const controlAfterHardReload = await offlineControl(page);
  const hardShot = await capture(page, "f13-2b-after-cache-bypassing-hard-reload-offline");
  const hardSubject = await assertSubjectInCapture(
    page,
    SEL.row,
    hardShot,
    "the saved copy's row after the cache-bypassing hard reload",
  );

  expect(controlAfterHardReload.reachedTheNetwork, "the network came back").toBe(false);
  expect(afterHardReload.length, "the copy did not survive the cache-bypassing hard reload").toBe(1);
  expect(afterHardReload[0]!.id).toBe(copy.id);

  evidence.hardReload = {
    port: target.port,
    buildId: target.buildIdOnDisk,
    identifier,
    copyId: copy.id,
    copyTitle: copy.itemTitle,
    copiesBeforeAnyReload: created.length,
    offlineControlBeforeAnyReload: controlBefore,
    documentReload: {
      method: "page.reload, network disabled, the worker answering the navigation",
      documentLoaded: true,
      copiesAfter: afterDocumentReload.length,
      sameCopyId: afterDocumentReload[0]!.id === copy.id,
      rowsRenderedAfter: rowsAfterDocumentReload,
      countLineAfter: countLineAfterDocumentReload,
      offlineControlAfter: controlAfterDocumentReload,
      captures: [beforeShot.file, afterShot.file],
      capturePx: [afterShot.widthPx, afterShot.heightPx],
      subjectInCaptureBefore: beforeSubject,
      subjectInCaptureAfter: afterSubject,
    },
    cacheBypassingHardReload: {
      method: "CDP Page.reload with ignoreCache true, network disabled",
      navigationError: hardReloadError,
      documentAfter: documentAfterHardReload,
      whatThisMeans:
        "Chrome's hard reload bypasses the service worker for the document. With the network disabled the " +
        "worker is the only thing that can answer, so no document loads. That is what bypassing the offline " +
        "layer while offline means, not a property of this product, and the second control test in this file " +
        "reproduces it directly with Network.setBypassServiceWorker.",
      copyAfterOnTheNextWorkerServedNavigation: afterHardReload.length,
      sameCopyId: afterHardReload[0]!.id === copy.id,
      offlineControlAfter: controlAfterHardReload,
      capture: hardShot.file,
      capturePx: [hardShot.widthPx, hardShot.heightPx],
      subjectInCapture: hardSubject,
    },
  };

  const closingReload = await assertServedBuildId(
    request,
    baseURL!,
    pinned,
    "after the F13 hard reload readings",
  );
  evidence.servedBuildAfterHardReload = closingReload;
});

test("control: a reload that also bypasses the worker cannot load any document offline", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  // Not a failure of the line. This is what fixes the meaning of "hard reload"
  // in an offline test: with the worker bypassed there is nothing left to
  // answer, so the browser shows its own error page. Measuring it is the only
  // way to say that honestly rather than assert it.
  const target = await assertServedBuildId(request, baseURL!, expectedBuildId(), "F13 worker-bypass control");

  await page.goto("/");
  const worker = await waitForWorkerControl(page);
  expect(worker.controlled).toBe(true);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await context.setOffline(true);
  await cdp.send("Network.setBypassServiceWorker", { bypass: true });

  let navigationError: string | null = null;
  try {
    await page.goto("/collection", { waitUntil: "load", timeout: 15_000 });
  } catch (error) {
    navigationError = String((error as Error).message).split("\n")[0]!;
  }

  const documentFacts = await page
    .evaluate(() => ({
      origin: location.origin,
      title: document.title,
      productFooterPresent: document.querySelector("footer.foot") !== null,
      appShellPresent: document.querySelector("main.shell") !== null,
      browserErrorMarkers: ["ERR_INTERNET_DISCONNECTED", "ERR_FAILED", "main-frame-error", "neterror"].filter(
        (marker) => document.documentElement.outerHTML.includes(marker),
      ),
    }))
    .catch((error) => ({ evaluationFailed: String((error as Error).message).split("\n")[0] }));

  evidence.workerBypassControl = {
    port: target.port,
    servedBuildId: target.servedBuildId,
    what: "network disabled, Network.setBypassServiceWorker bypass true, then a navigation to /collection",
    navigationError,
    document: documentFacts,
    reading:
      "with the offline layer bypassed there is nothing to answer the request, so no document loads. " +
      "A shift-reload is that plus a cache bypass, which is why the hard reload measured in this file is a " +
      "cache-ignoring document reload served by the worker rather than a worker bypass.",
  };

  expect(navigationError, "bypassing the worker while offline must fail the navigation").not.toBeNull();
});

test("a copy created signed out survives a full browser restart with the network disabled", async ({
  request,
  baseURL,
}) => {
  const pinned = expectedBuildId();
  const target = await assertServedBuildId(request, baseURL!, pinned, "before the F13 browser restart");
  const identifiers = await soleHeldIdentifiers(baseURL!, (url) => request.get(url));
  const identifier = identifiers[0]!;

  const profileDir = path.join(repoRoot(), "test-results", "f13-browser-restart-profile");
  rmSync(profileDir, { recursive: true, force: true });
  mkdirSync(profileDir, { recursive: true });

  const launch = () =>
    chromium.launchPersistentContext(profileDir, {
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      isMobile: false,
    });

  const firstPage = async (ctx: BrowserContext) => ctx.pages()[0] ?? (await ctx.newPage());

  // ---- browser process 1 --------------------------------------------------
  const sessionA = await launch();
  const pidsA = pidsRunningAgainstProfile(profileDir);
  const pidA = pidsA[0] ?? null;
  expect(pidsA.length, "no operating system process is running against the profile").toBeGreaterThan(0);
  const pageA = await firstPage(sessionA);
  await pageA.goto(new URL("/", baseURL!).toString());
  const scaleA = await assertScaleOne(pageA, VIEWPORT.width, "F13 first browser");
  const workerA = await waitForWorkerControl(pageA);
  expect(workerA.controlled, "the worker never took control in the first browser").toBe(true);
  await expect(async () => {
    expect(await catalogueRowsOnDevice(pageA)).toBeGreaterThan(0);
  }).toPass({ timeout: 30_000, intervals: [250, 500, 1000] });
  const catalogueRowsA = await catalogueRowsOnDevice(pageA);

  await sessionA.setOffline(true);
  const controlA = await offlineControl(pageA);
  expect(controlA.reachedTheNetwork, "the first browser was not offline").toBe(false);

  await createCopySignedOut(pageA, identifier);
  const createdA = await copiesOnDevice(pageA);
  expect(createdA.length).toBe(1);
  const copy = createdA[0]!;

  await pageA.goto(new URL("/collection", baseURL!).toString());
  await expect(pageA.locator(SEL.pageHeading)).toHaveText("Your collection");
  await expect(pageA.locator(SEL.row)).toHaveCount(1);
  const beforeShot = await capture(pageA, "f13-3-before-browser-restart-offline");
  const beforeSubject = await assertSubjectInCapture(
    pageA,
    SEL.row,
    beforeShot,
    "the saved copy's row in the first browser, before it is killed",
  );

  await sessionA.close();

  // The restart is real only if the processes that were running against the
  // profile are gone from the operating system's process table. This is the
  // assertion a context close could never satisfy, and it is the one the
  // reading on record never made.
  const pidsAAfterClose = pidsRunningAgainstProfile(profileDir);
  const pidAAliveAfterClose = processIsAlive(pidA);
  expect(pidAAliveAfterClose, "the first browser process is still running, so nothing restarted").toBe(false);
  expect(pidsAAfterClose.length, "processes are still running against the profile").toBe(0);

  // ---- browser process 2, same profile on disk ----------------------------
  const sessionB = await launch();
  const pidsB = pidsRunningAgainstProfile(profileDir);
  const pidB = pidsB[0] ?? null;
  expect(pidsB.length, "the second browser did not start").toBeGreaterThan(0);
  expect(pidB).not.toBe(pidA);
  expect(pidsB.some((pid) => pidsA.includes(pid)), "a process survived the restart").toBe(false);

  // Offline before the first navigation of the new browser, so nothing this
  // process ever renders came off the network.
  await sessionB.setOffline(true);
  const pageB = await firstPage(sessionB);
  await pageB.goto(new URL("/collection", baseURL!).toString());
  const scaleB = await assertScaleOne(pageB, VIEWPORT.width, "F13 second browser");
  await expect(pageB.locator(SEL.pageHeading)).toHaveText("Your collection");
  await expect(pageB.locator(SEL.row)).toHaveCount(1);
  const controlB = await offlineControl(pageB);
  const survivors = await copiesOnDevice(pageB);
  const catalogueRowsB = await catalogueRowsOnDevice(pageB);
  const afterShot = await capture(pageB, "f13-4-after-browser-restart-offline");
  const afterSubject = await assertSubjectInCapture(
    pageB,
    SEL.row,
    afterShot,
    "the saved copy's row in the second browser, after the restart",
  );
  const rowsRenderedB = await pageB.locator(SEL.row).count();
  const rowTitleB = await pageB.locator(`${SEL.row} span span`).first().textContent();
  const countLineB = await pageB.locator("p.mono", { hasText: "saved" }).first().textContent();

  expect(controlB.reachedTheNetwork, "the second browser was not offline").toBe(false);
  expect(survivors.length, "the copy did not survive the browser restart").toBe(1);
  expect(survivors[0]!.id).toBe(copy.id);

  await sessionB.close();

  // ---- control: the same check against a browser that never saw the copy ---
  // A survival check that has never reported a disappearance is not a check.
  // Same code, same assertions, a profile directory with nothing in it.
  const emptyProfileDir = path.join(repoRoot(), "test-results", "f13-browser-restart-control-profile");
  rmSync(emptyProfileDir, { recursive: true, force: true });
  mkdirSync(emptyProfileDir, { recursive: true });
  const sessionC = await chromium.launchPersistentContext(emptyProfileDir, {
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    isMobile: false,
  });
  const pidC = pidsRunningAgainstProfile(emptyProfileDir)[0] ?? null;
  const pageC = await firstPage(sessionC);
  // Online, because an empty profile holds no worker and no cache: the point
  // of this control is the copy count, not the offline path.
  await pageC.goto(new URL("/collection", baseURL!).toString());
  await expect(pageC.locator(SEL.pageHeading)).toHaveText("Your collection");
  const controlCopies = await copiesOnDevice(pageC).catch(() => []);
  const controlRows = await pageC.locator(SEL.row).count();
  const controlLead = await pageC.evaluate(() => {
    const lead = document.querySelector("p.vlead");
    return lead ? (lead.textContent ?? "").trim() : null;
  });
  const controlShot = await capture(pageC, "f13-control-fresh-profile-no-copy");
  const controlSubject = await assertSubjectInCapture(
    pageC,
    "p.vlead",
    controlShot,
    "the designed empty state in a profile that never saw the copy",
  );
  await sessionC.close();

  expect(controlCopies.length, "a fresh profile must hold no copies").toBe(0);
  expect(controlRows, "a fresh profile must render no collection rows").toBe(0);

  const closingRestart = await assertServedBuildId(
    request,
    baseURL!,
    pinned,
    "after the F13 browser restart readings",
  );

  evidence.browserRestart = {
    port: target.port,
    servedBuildId: target.servedBuildId,
    servedBuildIdAfter: closingRestart.servedBuildId,
    buildIdOnDiskAtEnd: buildIdOnDisk(),
    method:
      "two chromium.launchPersistentContext launches against the same on-disk profile directory, with the " +
      "first browser's processes confirmed gone from the operating system process table before the second " +
      "was launched. Closing and reopening a context would not have moved any of these numbers.",
    profileDirectory: repoRelative(profileDir),
    identifier,
    copyId: copy.id,
    copyTitle: copy.itemTitle,
    firstBrowser: {
      browserProcessPid: pidA,
      processesRunningAgainstTheProfile: pidsA.length,
      catalogueRowsOnDevice: catalogueRowsA,
      copiesCreated: createdA.length,
      offlineControl: controlA,
      capture: beforeShot.file,
      capturePx: [beforeShot.widthPx, beforeShot.heightPx],
      subjectInCapture: beforeSubject,
      scale: scaleA,
    },
    processTable: {
      processesAgainstTheProfileWhileTheFirstBrowserRan: pidsA.length,
      firstBrowserPidAliveAfterClose: pidAAliveAfterClose,
      processesAgainstTheProfileAfterTheFirstBrowserClosed: pidsAAfterClose.length,
      processesAgainstTheProfileWhileTheSecondBrowserRan: pidsB.length,
      secondBrowserPidDiffersFromFirst: pidB !== pidA,
      anyPidSharedBetweenTheTwoBrowsers: pidsB.some((pid) => pidsA.includes(pid)),
    },
    secondBrowser: {
      browserProcessPid: pidB,
      offlineBeforeFirstNavigation: true,
      copiesFound: survivors.length,
      sameCopyId: survivors[0]!.id === copy.id,
      rowsRendered: rowsRenderedB,
      rowTitle: rowTitleB,
      countLine: countLineB,
      catalogueRowsOnDevice: catalogueRowsB,
      offlineControl: controlB,
      capture: afterShot.file,
      capturePx: [afterShot.widthPx, afterShot.heightPx],
      subjectInCapture: afterSubject,
      scale: scaleB,
    },
    freshProfileControl: {
      browserProcessPid: pidC,
      profileDirectory: repoRelative(emptyProfileDir),
      copiesFound: controlCopies.length,
      rowsRendered: controlRows,
      designedEmptyStateLead: controlLead,
      capture: controlShot.file,
      capturePx: [controlShot.widthPx, controlShot.heightPx],
      subjectInCapture: controlSubject,
      reading:
        "the same assertions run against a browser that never saw the copy report 0, so the reading of 1 " +
        "after the restart is a reading and not a constant",
    },
  };
});

test.afterAll(() => {
  evidence.line =
    "F13. A copy created signed out survives a hard reload and a full browser restart with the network " +
    "disabled; both captured.";
  evidence.signedOut =
    "The product has no account, no sign-in control and no session of any kind in this slice, so every copy " +
    "created by any run is created signed out. There is no signed-in state to distinguish it from.";
  evidence.recordedAt = new Date().toISOString();
  writeEvidence("f13-copy-survives-restart.json", evidence);
});
