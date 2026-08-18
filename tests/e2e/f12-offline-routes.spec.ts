// F12: "After one sync with the network disabled, the collection list, its
// thumbnails, the collection search field, a collection item, and the
// catalogue index all render; count of the 5 offline routes that fail is 0."
//
// WHY THIS FILE EXISTS. The number on record was taken on port 3100, and
// EVIDENCE.md entry 171 later established that 3100 was a `next start` whose
// .next had been rebuilt underneath it twice: it answered 200 with genuine
// production headers while its chunk URLs 404ed, so nothing hydrated. Every
// client-side reading taken there describes a corpse. This re-measures on a
// server whose BUILD_ID is asserted against the BUILD_ID on disk before a
// single clause is read, and the port and the BUILD_ID are written into the
// artifact so the next reader never has to ask which build answered.
//
// ONE CLAUSE OF THE FIVE CANNOT BE CLOSED HERE, and it is not closed. A
// thumbnail needs a photograph, and no path in the product writes one:
// `photoBlob` appears three times in src/, all three inside
// src/lib/device/collection.ts (the parameter, the guard, the write), and no
// caller anywhere passes it. There is no file input and no capture control.
// Until the upload path lands in slice 5 the only thing a collection row can
// render in that slot is `.thumb.np`, the designed no-photo state, and a
// no-photo placeholder is not a thumbnail. This spec measures that the slot
// renders its designed state and records the thumbnail clause as UNREACHABLE
// rather than dressing the placeholder up as a pass.

import { expect, test, type Page } from "@playwright/test";
import {
  assertProductionTarget,
  assertScaleOne,
  assertServedBuildId,
  assertSubjectInCapture,
  buildIdOnDisk,
  capture,
  settle,
  writeEvidence,
} from "./harness";

const VIEWPORT_WIDTH = 390;

/** The build this measurement is commissioned against, pinned by the caller.
 * A rebuild landing mid-run is the exact failure that invalidated this line
 * twice, and once it landed under a verifier whose server was already loaded,
 * so "served matches disk" was true when asserted and false when measured.
 * The pin is checked before the first clause and again after the last. */
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
  collectionSearch: "#collection-search",
  catalogueSearch: "#catalogue-search",
  pageHeading: "h1.pageh1",
  thumb: ".thumb",
  thumbNoPhoto: ".thumb.np",
  thumbImage: ".thumb img",
  footer: "footer.foot p",
};

const CONFIRM = "Saved to your collection.";

type ClauseResult = {
  clause: string;
  route: string;
  measured: boolean;
  renders: boolean | null;
  observed: Record<string, unknown>;
  note?: string;
};

const evidence: Record<string, unknown> = {};

async function copiesOnDevice(page: Page): Promise<{ id: string; itemTitle: string; photoId: string | null }[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("vitrine");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const all = await new Promise<{ id: string; itemTitle: string; photoId: string | null }[]>(
      (resolve, reject) => {
        const req = db.transaction("userCopies", "readonly").objectStore("userCopies").getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      },
    );
    db.close();
    return all;
  });
}

async function photosOnDevice(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("vitrine");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const count = await new Promise<number>((resolve, reject) => {
      const req = db.transaction("photos", "readonly").objectStore("photos").count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return count;
  });
}

/** The only honest way to say "the network was disabled": ask for something no
 * cache holds and show the request never reached anything. Every other request
 * during an offline run comes back "finished" because the worker answered it,
 * which is what a working offline app looks like and proves nothing on its
 * own. */
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

test("the four reachable F12 clauses render with the network disabled", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const pinned = expectedBuildId();
  const target = await assertProductionTarget(request, baseURL!);
  const served = await assertServedBuildId(request, baseURL!, pinned, "before any F12 clause");
  evidence.target = target;
  evidence.servedBuild = served;
  evidence.port = served.port;
  evidence.buildId = served.servedBuildId;
  evidence.servedBuildId = served.servedBuildId;
  evidence.buildIdOnDiskAtStart = served.buildIdOnDisk;
  evidence.buildIdFoundInServedHtml = target.buildIdFoundInServedHtml;

  // ---- one sync, online, and the worker taking control ------------------
  const indexRes = await request.get(new URL("/api/sync/index", baseURL!).toString());
  const { rows } = (await indexRes.json()) as {
    rows: { variantPublicId: string; normalizedIdentifiers: string[] }[];
  };
  const holders = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const value of row.normalizedIdentifiers) {
      holders.set(value, (holders.get(value) ?? new Set()).add(row.variantPublicId));
    }
  }
  const soleHeld = [...holders.entries()]
    .filter(([, ids]) => ids.size === 1)
    .map(([value]) => value)
    .sort();
  expect(soleHeld.length, "no identifier is held by exactly one variant").toBeGreaterThan(0);
  const identifier = soleHeld[0]!;

  await page.goto("/");
  // No box below is read before this passes.
  evidence.scale = await assertScaleOne(page, VIEWPORT_WIDTH, "F12 start");
  await expect(page.locator(SEL.identifier)).toBeVisible();
  const swReady = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { supported: false, controlled: false, caches: [] as string[] };
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return {
      supported: true,
      controlled: navigator.serviceWorker.controller !== null,
      caches: "caches" in self ? await caches.keys() : [],
    };
  });
  expect(swReady.controlled, "the worker never took control, so no offline navigation is possible").toBe(
    true,
  );

  // The sync itself: the check screen fires it in the background on load, so
  // the number of rows on the device is what says it landed.
  await expect(async () => {
    const cached = await page.evaluate(async () => {
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
    expect(cached, "the catalogue index never reached the device").toBeGreaterThan(0);
  }).toPass({ timeout: 30_000, intervals: [250, 500, 1000] });

  const cachedVariants = await page.evaluate(async () => {
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

  // One copy, signed out, so the list has a row, the search field exists at
  // all (it renders only once a copy does) and an item route has an id.
  await expect(async () => {
    await page.fill(SEL.identifier, identifier);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.recognizedLabel)).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 1000] });
  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.slab)).toContainText(CONFIRM);

  const copies = await copiesOnDevice(page);
  expect(copies.length, "the signed-out add did not reach the device").toBe(1);
  const copy = copies[0]!;

  // Visited once online, so the worker holds this exact URL. F12 reads "a
  // collection item", which is the item a collector has already opened; the
  // never-before-visited case is F16's shell fallback, measured there.
  await page.goto("/collection");
  await expect(page.locator(SEL.pageHeading)).toHaveText("Your collection");
  await page.goto(`/collection/${copy.id}`);
  await expect(page.locator(SEL.pageHeading)).toBeVisible();
  await page.goto("/catalogue");
  await expect(page.locator(SEL.pageHeading)).toHaveText("Catalogue index");

  evidence.warmUp = {
    identifier,
    serviceWorker: swReady,
    cachedVariantsAfterOneSync: cachedVariants,
    copyId: copy.id,
    copyTitle: copy.itemTitle,
    routesVisitedOnlineBeforeGoingOffline: ["/", "/collection", `/collection/{copyId}`, "/catalogue"],
  };

  // ---- the network goes away and stays away ------------------------------
  await context.setOffline(true);
  const onLineOnTheLoadedDocument = await page.evaluate(() => navigator.onLine);
  expect(onLineOnTheLoadedDocument).toBe(false);
  const control = await offlineControl(page);
  evidence.offlineControl = control;
  // Worth recording rather than hiding: setOffline flips navigator.onLine to
  // false on the document that is already loaded, and each document loaded
  // AFTER it reads navigator.onLine as true again, while its uncached fetches
  // still fail. The network is genuinely gone either way (the control above
  // and the one after every clause both fail), but the OfflineBanner reads
  // navigator.onLine, so it stays absent on those documents. That is a
  // property of how the harness emulates offline across a navigation, not a
  // reading about the banner. The banner's own behaviour is measured in
  // f16-offline-designed-state.spec.ts against a real offline event.
  evidence.navigatorOnLine = {
    onTheDocumentLoadedBeforeSetOffline: onLineOnTheLoadedDocument,
    note: "each document navigated to after setOffline reports navigator.onLine true; see the per-clause readings",
  };
  expect(
    control.reachedTheNetwork,
    "an uncached request succeeded, so the network was not disabled and nothing below was measured offline",
  ).toBe(false);

  const clauses: ClauseResult[] = [];

  // ---- clause 1: the collection list -------------------------------------
  await page.goto("/collection");
  await expect(page.locator(SEL.pageHeading)).toHaveText("Your collection");
  // The capture settles fonts, animations and two frames first, so every
  // reading below describes the same frame the PNG shows rather than a frame
  // one tick earlier. The offline banner lands on the tick after mount, so a
  // read taken before settling reports it absent while the screen shows it.
  const listShot = await capture(page, "f12-1-collection-list-offline");
  // The capture has to contain the thing it is filed as evidence for. A
  // capture that stops above its subject has been filed twice in this run.
  const listSubject = await assertSubjectInCapture(
    page,
    "ul li a.row",
    listShot,
    "the offline collection list's first row",
  );
  const listObserved = {
    heading: await page.locator(SEL.pageHeading).textContent(),
    countLine: await page.locator("p.mono", { hasText: "saved" }).first().textContent(),
    rowCount: await page.locator("ul li a.row").count(),
    firstRowTitle: await page.locator("ul li a.row span span").first().textContent(),
    footerDisclaimerPresent: (await page.locator(SEL.footer).count()) === 1,
    // Read in one DOM pass rather than through a locator: locator.textContent
    // has no default action timeout in this config, so asking it for an
    // element that is not there hangs the whole test instead of reporting the
    // absence. That is how this reading was taken the first time.
    ...(await page.evaluate(() => {
      const banner = document.querySelector(".offlineBanner");
      return {
        navigatorOnLine: navigator.onLine,
        offlineBannerPresent: banner !== null,
        offlineBannerText: banner ? (banner.textContent ?? "").trim() : null,
      };
    })),
  };
  expect(listObserved.rowCount, "the offline collection list rendered no rows").toBe(1);
  clauses.push({
    clause: "the collection list",
    route: "/collection",
    measured: true,
    renders: true,
    observed: {
      ...listObserved,
      capture: listShot.file,
      capturePx: [listShot.widthPx, listShot.heightPx],
      subjectInCapture: listSubject,
    },
  });

  // ---- clause 2: its thumbnails. NOT CLOSED ------------------------------
  const thumbSubject = await assertSubjectInCapture(
    page,
    SEL.thumb,
    listShot,
    "the thumbnail slot on the offline collection list",
  );
  const thumbObserved = {
    thumbSlots: await page.locator(SEL.thumb).count(),
    thumbsRenderingAPhotograph: await page.locator(SEL.thumbImage).count(),
    thumbsRenderingTheDesignedNoPhotoState: await page.locator(SEL.thumbNoPhoto).count(),
    noPhotoAriaLabel: await page.locator(SEL.thumbNoPhoto).first().getAttribute("aria-label"),
    photosInTheOnDevicePhotoStore: await photosOnDevice(page),
    subjectInCapture: thumbSubject,
  };
  clauses.push({
    clause: "its thumbnails",
    route: "/collection",
    measured: false,
    renders: null,
    observed: thumbObserved,
    note:
      "UNREACHABLE, not failed. A thumbnail needs a photograph and the product has no path that writes one: " +
      "photoBlob occurs only inside src/lib/device/collection.ts and no caller passes it, there is no file input " +
      "and no capture control, and the on-device photo store holds 0 rows. The slot renders .thumb.np, the " +
      "designed no-photo state, which is the correct screen for a copy with no photograph and is not a thumbnail. " +
      "This clause cannot be measured until the upload path lands in slice 5.",
  });

  // ---- clause 3: the collection search field ------------------------------
  const searchField = page.locator(SEL.collectionSearch);
  await expect(searchField).toBeVisible();
  // Present is not the same as working. Typing a needle that matches nothing
  // has to reach the designed no-results state, or the field is decoration.
  await searchField.fill("zzzz-no-such-title");
  await expect(page.locator("p.vlead")).toContainText("No saved copy matches");
  const rowsWhileFiltered = await page.locator("ul li a.row").count();
  await searchField.fill(copy.itemTitle.slice(0, 4));
  await expect(page.locator("ul li a.row")).toHaveCount(1);
  await searchField.fill("");
  await settle(page);
  const searchShot = await capture(page, "f12-2-collection-search-offline");
  const searchSubject = await assertSubjectInCapture(
    page,
    SEL.collectionSearch,
    searchShot,
    "the offline collection search field",
  );
  clauses.push({
    clause: "the collection search field",
    route: "/collection",
    measured: true,
    renders: true,
    observed: {
      selector: SEL.collectionSearch,
      label: await page.locator('label[for="collection-search"]').textContent(),
      placeholder: await searchField.getAttribute("placeholder"),
      rowsWithANonMatchingNeedle: rowsWhileFiltered,
      rowsWithAMatchingNeedle: 1,
      capture: searchShot.file,
      capturePx: [searchShot.widthPx, searchShot.heightPx],
      subjectInCapture: searchSubject,
    },
  });

  // ---- clause 4: a collection item ---------------------------------------
  await page.goto(`/collection/${copy.id}`);
  await expect(page.locator(SEL.pageHeading)).toHaveText(copy.itemTitle);
  await settle(page);
  const itemObserved = {
    heading: await page.locator(SEL.pageHeading).textContent(),
    provenanceLine: await page.locator("dl .priv p").last().textContent(),
    backLinkPresent: (await page.locator('a[href="/collection"]').count()) > 0,
    footerDisclaimerPresent: (await page.locator(SEL.footer).count()) === 1,
  };
  const itemShot = await capture(page, "f12-3-collection-item-offline");
  const itemSubject = await assertSubjectInCapture(
    page,
    SEL.pageHeading,
    itemShot,
    "the offline collection item heading",
  );
  clauses.push({
    clause: "a collection item",
    route: "/collection/{copyId}",
    measured: true,
    renders: true,
    observed: {
      ...itemObserved,
      capture: itemShot.file,
      capturePx: [itemShot.widthPx, itemShot.heightPx],
      subjectInCapture: itemSubject,
    },
  });

  // ---- clause 5: the catalogue index --------------------------------------
  await page.goto("/catalogue");
  await expect(page.locator(SEL.pageHeading)).toHaveText("Catalogue index");
  await expect(page.locator(SEL.catalogueSearch)).toBeVisible();
  await settle(page);
  const catalogueRows = await page.locator("ul li").count();
  const catalogueObserved = {
    heading: await page.locator(SEL.pageHeading).textContent(),
    countLine: await page.locator("p.mono", { hasText: "cached on this device" }).first().textContent(),
    rowsRendered: catalogueRows,
    cachedVariantsAfterOneSync: cachedVariants,
    footerDisclaimerPresent: (await page.locator(SEL.footer).count()) === 1,
  };
  expect(catalogueRows, "the offline catalogue index rendered no rows").toBeGreaterThan(0);
  const catalogueShot = await capture(page, "f12-4-catalogue-index-offline");
  const catalogueSubject = await assertSubjectInCapture(
    page,
    "ul li",
    catalogueShot,
    "the offline catalogue index's first row",
  );
  clauses.push({
    clause: "the catalogue index",
    route: "/catalogue",
    measured: true,
    renders: true,
    observed: {
      ...catalogueObserved,
      capture: catalogueShot.file,
      capturePx: [catalogueShot.widthPx, catalogueShot.heightPx],
      subjectInCapture: catalogueSubject,
    },
  });

  // The network was still gone at the end, not only at the start.
  const controlAfter = await offlineControl(page);
  evidence.offlineControlAfterAllClauses = controlAfter;
  expect(controlAfter.reachedTheNetwork).toBe(false);

  // The build has to still be the one this run was commissioned against. A
  // rebuild landing mid-run is how a previous reading went stale between its
  // own assertion and its own measurement.
  const closing = await assertServedBuildId(request, baseURL!, pinned, "after the last F12 clause");
  evidence.servedBuildAfter = closing;
  evidence.buildIdOnDiskAtEnd = buildIdOnDisk();

  const measured = clauses.filter((c) => c.measured);
  evidence.clauses = clauses;
  evidence.count = {
    clausesInTheLine: 5,
    clausesMeasured: measured.length,
    clausesThatRender: measured.filter((c) => c.renders === true).length,
    clausesThatFail: measured.filter((c) => c.renders === false).length,
    clausesUnreachable: clauses.filter((c) => !c.measured).length,
  };

  evidence.verdict = {
    lineReads: "count of the 5 offline routes that fail is 0",
    clausesInTheLine: 5,
    clausesMeasured: measured.length,
    clausesThatFailedOfThoseMeasured: measured.filter((c) => c.renders === false).length,
    clausesUnread: clauses.filter((c) => !c.measured).map((c) => c.clause),
    canTheLineReadZero: false,
    reading:
      "0 of the 4 measured clauses failed. The line counts 5, and the thumbnail clause is unread rather " +
      "than passing, so the count of failing routes is 0 out of 4 and not 0 out of 5. F12 cannot read " +
      "0 failing routes while one of its five is unread, and it is not checked on this evidence.",
  };

  expect(measured.length, "four of the five clauses are measurable today").toBe(4);
  expect(
    measured.filter((c) => c.renders === false).length,
    "count of measured offline clauses that failed",
  ).toBe(0);
});

test("negative control: the search-field check reports the field absent when it is absent", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  // A presence check that has never reported an absence is not a check. The
  // collection search field renders only once a copy exists, so emptying the
  // on-device store offline is the one state where it must disappear. If the
  // detector still says "renders" here, every reading above is worthless.
  const target = await assertServedBuildId(request, baseURL!, expectedBuildId(), "F12 negative control");

  await page.goto("/");
  await assertScaleOne(page, VIEWPORT_WIDTH, "F12 negative control");
  await expect(page.locator(SEL.identifier)).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  await page.goto("/collection");
  await expect(page.locator(SEL.pageHeading)).toHaveText("Your collection");

  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("vitrine");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction("userCopies", "readwrite").objectStore("userCopies").clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  });

  await context.setOffline(true);
  const control = await offlineControl(page);
  expect(control.reachedTheNetwork).toBe(false);

  await page.goto("/collection");
  await expect(page.locator(SEL.pageHeading)).toHaveText("Your collection");
  await expect(page.locator("p.vlead")).toContainText("Nothing saved yet.");
  const fieldsFound = await page.locator(SEL.collectionSearch).count();
  const rowsFound = await page.locator("ul li a.row").count();
  const thumbsFound = await page.locator(SEL.thumb).count();
  await settle(page);
  const shot = await capture(page, "f12-control-collection-empty-offline");

  evidence.searchFieldDetectorControl = {
    port: target.port,
    servedBuildId: target.servedBuildId,
    what: "the same #collection-search presence check, run offline against an emptied on-device store",
    copiesOnDevice: 0,
    searchFieldsFound: fieldsFound,
    rowsFound,
    thumbSlotsFound: thumbsFound,
    designedEmptyStateRendered: true,
    emptyStateLead: await page.locator("p.vlead").first().textContent(),
    offlineControl: control,
    capture: shot.file,
    reading:
      "the detector reports 0 search fields here and 1 in the measured run, so its positive reading is a " +
      "reading and not a constant",
  };

  expect(fieldsFound, "the search field must be absent with no copies saved").toBe(0);
  expect(rowsFound).toBe(0);
});

test.afterAll(() => {
  evidence.line =
    "F12. After one sync with the network disabled, the collection list, its thumbnails, the collection " +
    "search field, a collection item, and the catalogue index all render; count of the 5 offline routes " +
    "that fail is 0.";
  evidence.recordedAt = new Date().toISOString();
  writeEvidence("f12-offline-routes.json", evidence);
});
