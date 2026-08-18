// F10: "From a cold app open with the network disabled, a scan or typed
// identifier reaches a verdict and a saved copy in 4 taps or fewer and 20
// seconds or less; the slowest of 5 timed runs recorded."
//
// What was on record before this file: a verdict in 97 ms, in 2 taps, once.
// Three clauses short.
//
//   - A VERDICT IS NOT A SAVED COPY. The journey the line describes ends with
//     the copy on the device, so the tap count for it was unknown.
//   - ONE RUN CANNOT ESTABLISH A SLOWEST OF FIVE. Five runs, five different
//     identifiers, and the worst of them is the number that counts.
//   - "COLD APP OPEN" means a new document each time, not a second check typed
//     into a page that is already warm.
//
// Every number below is read from the page's own clock. performance.now() is
// measured from the document's time origin, so a reading taken at the moment
// the saved-copy confirmation lands IS the elapsed time from the cold open,
// with no harness round trip inside it. Taps are counted by a listener the
// page installs on itself before the first document loads: the harness cannot
// undercount what it never counted.

import { expect, test, type Page } from "@playwright/test";
import { assertProductionTarget, settle, writeEvidence } from "./harness";

const SEL = {
  input: "#check-identifier",
  submit: 'form button[type="submit"]',
  slab: '[data-testid="verdict"]',
  recognizedLabel: "section.vslab .vlead.mono",
  addToCollection: 'section.vslab button:has-text("Add to collection")',
};

const CONFIRM = "Saved to your collection.";
const TAP_BUDGET = 4;
const SECONDS_BUDGET = 20;
const RUNS = 5;

type Tap = { atMs: number; target: string };
type Run = {
  index: number;
  identifier: string;
  verdictKind: string;
  taps: Tap[];
  tapCount: number;
  /** From the cold open (the document's time origin) to the confirmation. */
  coldOpenToSavedCopyMs: number;
  /** From the collector's first tap to the confirmation. */
  firstTapToSavedCopyMs: number;
  copiesOnDeviceAfter: number;
  networkRequestsDuringRun: { url: string; phase: string }[];
};

const evidence: Record<string, unknown> = {};

async function copiesOnDevice(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("vitrine");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const all = await new Promise<unknown[]>((resolve, reject) => {
      const req = db.transaction("userCopies", "readonly").objectStore("userCopies").getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return all.length;
  });
}

async function taps(page: Page): Promise<Tap[]> {
  return page.evaluate(() => (window as unknown as { __taps: Tap[] }).__taps ?? []);
}

/** Resolves with the page clock's reading at the animation frame that carries
 * the saved-copy confirmation. Installed BEFORE the tap that causes it. */
function waitForSavedCopy(page: Page, confirm: string): Promise<number> {
  return page.evaluate(
    (text) =>
      new Promise<number>((resolve) => {
        const done = () => {
          const slab = document.querySelector('[data-testid="verdict"]');
          if (slab && (slab.textContent ?? "").includes(text)) {
            observer.disconnect();
            requestAnimationFrame(() => resolve(performance.now()));
            return true;
          }
          return false;
        };
        const observer = new MutationObserver(() => done());
        observer.observe(document.body, { subtree: true, childList: true, characterData: true });
        done();
      }),
    confirm,
  );
}

test("a cold offline open reaches a verdict and a saved copy, five times", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  evidence.target = await assertProductionTarget(request, baseURL!);

  // Taps counted by the page, on every document it loads, from before the
  // first script of the app runs.
  await context.addInitScript(() => {
    (window as unknown as { __taps: Tap[] }).__taps = [];
    window.addEventListener(
      "pointerdown",
      (event) => {
        const el = event.target as Element | null;
        const label = el
          ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${
              (el.textContent ?? "").trim() ? `[${(el.textContent ?? "").trim().slice(0, 24)}]` : ""
            }`
          : "unknown";
        (window as unknown as { __taps: Tap[] }).__taps.push({
          atMs: Math.round(performance.now() * 100) / 100,
          target: label,
        });
      },
      true,
    );
  });

  // Five identifiers, each carried by exactly one variant, read from the
  // catalogue being served. Five different ones because after the first run
  // the first identifier answers OWNED and offers no "Add to collection".
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
  const byVariant = new Map<string, string>();
  for (const [value, ids] of [...holders.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (ids.size !== 1) continue;
    const variant = [...ids][0]!;
    if (!byVariant.has(variant)) byVariant.set(variant, value);
  }
  const identifiers = [...byVariant.values()].slice(0, RUNS + 1);
  expect(identifiers.length, "not enough uniquely held identifiers for five runs").toBeGreaterThanOrEqual(
    RUNS + 1,
  );

  // Online once, to put the catalogue on the device and let the service worker
  // take control of the shell. Everything measured happens after this.
  await page.goto("/");
  await expect(page.locator(SEL.input)).toBeVisible();
  await expect(async () => {
    await page.fill(SEL.input, identifiers[0]!);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.recognizedLabel)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 500, 1000] });
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
  expect(swReady.controlled, "the service worker never took control, so no cold open can be offline").toBe(
    true,
  );
  evidence.warmUp = { serviceWorker: swReady, identifiersAvailable: identifiers.length };

  // ---- the network goes away, and stays away for every run below ---------
  await context.setOffline(true);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);

  const network: { url: string; phase: string }[] = [];
  page.on("requestfailed", (req) => network.push({ url: req.url(), phase: "failed" }));
  page.on("requestfinished", (req) => network.push({ url: req.url(), phase: "finished" }));

  const runs: Run[] = [];
  for (let i = 0; i < RUNS; i++) {
    const identifier = identifiers[i + 1] ?? identifiers[i]!;
    network.length = 0;

    // Cold open: a new document, offline, served by the worker.
    await page.goto("/");
    await expect(page.locator(SEL.input)).toBeVisible();

    // Tap 1: the field.
    await page.click(SEL.input);
    // Typing is not tapping. This is the "typed identifier" half of the line;
    // the scan half is F58's.
    await page.type(SEL.input, identifier);
    // Tap 2: Check.
    await page.click(SEL.submit);
    await expect(page.locator(SEL.slab)).toBeVisible();
    const verdictKind = (await page.locator(SEL.slab).getAttribute("data-verdict")) ?? "UNKNOWN";
    expect(verdictKind, `${identifier} must be recognised and unowned for run ${i + 1}`).toBe(
      "NOT_IN_COLLECTION",
    );

    const savedAt = waitForSavedCopy(page, CONFIRM);
    // Tap 3: Add to collection.
    await page.click(SEL.addToCollection);
    const coldOpenToSavedCopyMs = await savedAt;
    await expect(page.locator(SEL.slab)).toContainText(CONFIRM);
    await settle(page);

    const tapList = await taps(page);
    const copies = await copiesOnDevice(page);
    runs.push({
      index: i + 1,
      identifier,
      verdictKind,
      taps: tapList,
      tapCount: tapList.length,
      coldOpenToSavedCopyMs: Math.round(coldOpenToSavedCopyMs * 100) / 100,
      firstTapToSavedCopyMs:
        Math.round((coldOpenToSavedCopyMs - (tapList[0]?.atMs ?? 0)) * 100) / 100,
      copiesOnDeviceAfter: copies,
      networkRequestsDuringRun: [...network],
    });

    // The saved copy is a row on the device, not a sentence on a screen.
    expect(copies, `run ${i + 1} did not add a copy to the device`).toBe(i + 1);
  }

  // Control on the word "disabled". Every request logged during the runs came
  // back "finished" because the service worker answered it from the shell
  // cache, which is exactly what an offline app should look like. A request
  // for something no cache holds is the only way to show the network is gone.
  const offlineControl = await page.evaluate(async () => {
    try {
      const res = await fetch(`/api/sync/index?offline-control=${Date.now()}`, { cache: "no-store" });
      return { reachedTheNetwork: true, status: res.status };
    } catch (error) {
      return { reachedTheNetwork: false, error: String((error as Error).message) };
    }
  });
  evidence.offlineControl = offlineControl;
  expect(
    offlineControl.reachedTheNetwork,
    "an uncached request succeeded, so the network was not disabled and these runs measured nothing",
  ).toBe(false);

  const slowestColdOpen = Math.max(...runs.map((r) => r.coldOpenToSavedCopyMs));
  const mostTaps = Math.max(...runs.map((r) => r.tapCount));
  const slowestRun = runs.find((r) => r.coldOpenToSavedCopyMs === slowestColdOpen)!;

  evidence.runs = runs;
  evidence.slowestOfFive = {
    runIndex: slowestRun.index,
    identifier: slowestRun.identifier,
    coldOpenToSavedCopyMs: slowestColdOpen,
    coldOpenToSavedCopySeconds: Math.round((slowestColdOpen / 1000) * 1000) / 1000,
    firstTapToSavedCopyMs: slowestRun.firstTapToSavedCopyMs,
    tapCount: slowestRun.tapCount,
    budgetSeconds: SECONDS_BUDGET,
    budgetTaps: TAP_BUDGET,
  };

  // The clause, on the worst run rather than the best.
  expect(mostTaps, "taps from cold open to saved copy").toBeLessThanOrEqual(TAP_BUDGET);
  expect(slowestColdOpen / 1000, "slowest of five, cold open to saved copy").toBeLessThanOrEqual(
    SECONDS_BUDGET,
  );

  // And the copies are still there on one more cold offline open, which is
  // what "saved" has to mean.
  await page.goto("/collection");
  await expect(page.locator("body")).toContainText("copies saved");
  const persisted = await copiesOnDevice(page);
  evidence.copiesAfterAFurtherColdOpen = persisted;
  expect(persisted).toBe(RUNS);
});

test("the tap counter can count past the budget", async ({ page, context, baseURL }) => {
  // The negative control. Three taps under a budget of four is only evidence
  // if the counter is capable of reporting five, and if the assertion above
  // would have failed had the journey needed more. This run deliberately taps
  // twice more than the journey needs.
  await context.addInitScript(() => {
    (window as unknown as { __taps: Tap[] }).__taps = [];
    window.addEventListener(
      "pointerdown",
      () => {
        (window as unknown as { __taps: Tap[] }).__taps.push({
          atMs: Math.round(performance.now() * 100) / 100,
          target: "control",
        });
      },
      true,
    );
  });
  await page.goto(baseURL!);
  await expect(page.locator(SEL.input)).toBeVisible();
  for (let i = 0; i < 5; i++) await page.click(SEL.input);
  const counted = (await taps(page)).length;
  evidence.tapCounterControl = { deliberateTaps: 5, counted, budget: TAP_BUDGET };
  expect(counted, "the tap counter did not see five taps").toBe(5);
  expect(counted, "five taps would have blown the budget, as it must").toBeGreaterThan(TAP_BUDGET);
});

test.afterAll(() => {
  evidence.recordedAt = new Date().toISOString();
  writeEvidence("f10-cold-offline-saved-copy.json", evidence);
});
