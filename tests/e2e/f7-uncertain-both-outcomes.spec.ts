// F7: "Both outcomes of UNCERTAIN reverse from the item in 2 taps or fewer;
// captured before and after."
//
// WHY THIS FILE EXISTS, and it is a question about the words rather than the
// product. "Both outcomes" reads two ways.
//
//   Reading A, the two candidates. An UNCERTAIN pair offers two pick buttons,
//   and "both outcomes" means either one can be picked and then unpicked.
//
//   Reading B, the two resolutions. Picking resolves through
//   CheckScreen.resolveToCandidate, which returns OWNED when the picked
//   candidate is already held and NOT IN COLLECTION when it is not. On this
//   reading "both outcomes" names those two verdicts.
//
// Reading A is the weaker of the two and it is the one that gets measured by
// accident: with nothing held, BOTH candidates of a collision resolve to NOT
// IN COLLECTION, so a run can cover "both candidates" while never once
// producing an OWNED resolution. A verifier flagged exactly that about its own
// reading. This file measures READING B on purpose: a copy is saved first so
// that one candidate of the pair is held and the other is not, and then both
// picks are run, so one resolves OWNED and one resolves NOT IN COLLECTION.
// Reading A is covered in the same pass, since both candidates are picked.
//
// The ownership asymmetry is the whole point, so it is asserted rather than
// hoped for: the pair is read before the save (both "not owned") and again
// after it (exactly one "owned"), and both readings go into the artifact. A
// run where the pair came back both-unowned would be measuring reading A
// again while claiming reading B, which is the failure this file exists to
// avoid.

import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  assertScaleOne,
  assertServedBuildId,
  assertSubjectInCapture,
  buildIdOnDisk,
  capture,
  measureSubjectInCapture,
  settle,
  writeEvidence,
} from "./harness";

const SEL = {
  input: "#check-identifier",
  submit: 'form button[type="submit"]',
  slab: "section.vslab",
  word: "section.vslab .vword",
  recognizedLabel: "section.vslab .vlead.mono",
  candidatePick: "section.vslab .candidateRow .btn",
  candidateCard: "section.vslab .candCard",
  candidateOwnLine: "section.vslab .candCard .candOwn",
  addToCollection: 'section.vslab button:has-text("Add to collection")',
};

// Read from src/lib/i18n/en.ts and pinned here rather than imported: the
// measurement runs against a compiled build, and importing the catalogue
// would let a copy edit landing mid-run disagree with the bundle on screen.
const COPY = {
  reverse: "Undo, this is not the one",
  addedConfirm: "Saved to your collection.",
  owned: "Already in your collection",
  notOwned: "Not in your collection yet",
};

const VIEWPORT_WIDTH = 390;
const TAP_CAP = 4;

// The verdict word is the identity of the state a capture is filed as
// evidence for, and the reverse control is the thing being tapped. Those two
// are asserted to be inside the frame. The whole slab is measured and
// recorded but NOT asserted: at 390x844 the UNCERTAIN slab is taller than the
// viewport, because it carries two photograph-led candidate cards, so no
// single viewport capture can contain all of it. Recording that number is
// honest; failing on it would be measuring the viewport rather than the line.
const SUBJECT = {
  verdictWord: '[data-testid="verdict-word"]',
  slab: "section.vslab",
};

const evidence: Record<string, unknown> = {};

/** Placement of a control that has no stable selector of its own, read from
 * its own box rather than from a query. */
async function placementOfLocator(
  locator: Locator,
  shot: { widthPx: number; heightPx: number },
  subject: string,
): Promise<Record<string, unknown>> {
  const box = await locator.boundingBox();
  return {
    subject,
    found: box !== null,
    topPx: box ? Math.round(box.y) : null,
    bottomPx: box ? Math.round(box.y + box.height) : null,
    captureWidthPx: shot.widthPx,
    captureHeightPx: shot.heightPx,
    fullyInsideTheCapture:
      box !== null && box.y >= 0 && box.y + box.height <= shot.heightPx && box.x >= 0,
  };
}

function expectedBuildId(): string {
  const pinned = process.env.VITRINE_EXPECTED_BUILD_ID;
  if (!pinned) {
    throw new Error(
      "VITRINE_EXPECTED_BUILD_ID is not set. This measurement is commissioned against one named build; " +
        "without the pin the run would measure whatever happens to be listening.",
    );
  }
  return pinned;
}

async function verdictKind(page: Page): Promise<string> {
  return page.evaluate((sel) => {
    const slab = document.querySelector(sel);
    if (!slab) return "NONE";
    return slab.getAttribute("data-verdict") ?? "UNKNOWN";
  }, SEL.slab);
}

async function check(page: Page, identifier: string): Promise<string> {
  await page.fill(SEL.input, identifier);
  await page.click(SEL.submit);
  await expect(page.locator(SEL.slab)).toHaveCount(1);
  await expect(page.locator(SEL.word)).toBeVisible();
  await settle(page);
  return verdictKind(page);
}

/** The pair as the screen states it: each candidate's name and, critically,
 * the ownership line it renders. This is the reading that separates reading B
 * from reading A, so it is recorded at every step rather than inferred from
 * what the test did earlier. */
async function candidatePair(page: Page): Promise<{ label: string; ownershipLine: string; owned: boolean }[]> {
  return page.evaluate(
    ({ cardSel, ownedText }) =>
      [...document.querySelectorAll(cardSel)].map((card) => {
        const name = (card.querySelector(".candName")?.textContent ?? "").replace(/\s+/g, " ").trim();
        const own = (card.querySelector(".candOwn")?.textContent ?? "").replace(/\s+/g, " ").trim();
        return { label: name, ownershipLine: own, owned: own === ownedText };
      }),
    { cardSel: SEL.candidateCard, ownedText: COPY.owned },
  );
}

/** Every visible interactive control on the item, so "reverse in 2 taps" is
 * measured against what is actually reachable rather than against the one
 * control this file hoped for. */
async function interactiveControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    return [...main.querySelectorAll("button, a")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
      })
      .map((el) => (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim())
      .filter((label) => label.length > 0);
  });
}

/**
 * Taps until the item is back at UNCERTAIN, counted by clicking rather than
 * asserted. Returns null when the reverse control is not on the item at all,
 * which is the answer this instrument has to be able to give: a counter that
 * has only ever returned 1 is not a counter. The negative controls at the
 * bottom of this file drive it to null and to the cap on purpose.
 */
async function tapsBackToUncertain(
  page: Page,
  controlName: string,
): Promise<{ taps: number | null; reachedUncertain: boolean; controlsFound: number }> {
  const control = page.getByRole("button", { name: controlName });
  const controlsFound = await control.count();
  if (controlsFound === 0) return { taps: null, reachedUncertain: false, controlsFound: 0 };

  let taps = 0;
  while (taps < TAP_CAP) {
    if ((await verdictKind(page)) === "UNCERTAIN") break;
    if ((await control.count()) === 0) break;
    await control.first().click();
    taps += 1;
    await settle(page);
  }
  return { taps, reachedUncertain: (await verdictKind(page)) === "UNCERTAIN", controlsFound };
}

type Cycle = {
  reading: string;
  identifier: string;
  pickedCandidateIndex: number;
  pickedCandidateLabel: string;
  pickedCandidateOwnershipLine: string;
  outcomeVerdict: string;
  tapsToReverse: number | null;
  reverseControlLabel: string;
  reachedUncertain: boolean;
  pairBeforePick: { label: string; ownershipLine: string; owned: boolean }[];
  pairAfterReverse: { label: string; ownershipLine: string; owned: boolean }[];
  restoredIdentically: boolean;
  interactiveControlsOnItem: string[];
  captures: Record<string, unknown>;
};

test("F7 both resolutions of UNCERTAIN, OWNED and NOT IN COLLECTION, reverse from the item", async ({
  page,
  request,
  baseURL,
}) => {
  const pinned = expectedBuildId();
  const target = await assertServedBuildId(request, baseURL!, pinned, "before any F7 measurement");
  evidence.target = target;
  evidence.port = target.port;
  evidence.servedBuildId = target.servedBuildId;
  evidence.buildIdOnDiskAtStart = target.buildIdOnDisk;

  // The colliding identifier, read off the catalogue the server is actually
  // serving rather than pinned to a string a reseed could invalidate.
  const indexRes = await request.get(new URL("/api/sync/index", baseURL!).toString());
  const { rows } = (await indexRes.json()) as {
    rows: { variantPublicId: string; normalizedIdentifiers: string[]; title: string }[];
  };
  const holders = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const value of row.normalizedIdentifiers) {
      holders.set(value, (holders.get(value) ?? new Set()).add(row.variantPublicId));
    }
  }
  const collisions = [...holders.entries()]
    .filter(([, ids]) => ids.size === 2)
    .map(([value]) => value)
    .sort();
  expect(collisions.length, "no identifier is shared by exactly 2 variants").toBeGreaterThan(0);
  const collisionIdentifier = collisions[0]!;
  const soleHeld = [...holders.entries()]
    .filter(([, ids]) => ids.size === 1)
    .map(([value]) => value)
    .sort();
  evidence.catalogue = {
    rows: rows.length,
    identifiersSharedByExactlyTwoVariants: collisions.length,
    collisionIdentifierUsed: collisionIdentifier,
  };

  await page.goto("/");
  await assertScaleOne(page, VIEWPORT_WIDTH, "F7 start");
  await expect(page.locator(SEL.input)).toBeVisible();
  // A clean profile holds no catalogue, so readiness is behavioural: a known
  // identifier has to resolve rather than fall through to the unknown path.
  await expect(async () => {
    await page.fill(SEL.input, soleHeld[0]!);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.recognizedLabel)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 500, 1000] });

  // ---- the pair before anything is held ----------------------------------
  // Both candidates unowned. This is the state the earlier reading was taken
  // in, and on its own it can only ever produce NOT IN COLLECTION.
  const kindBefore = await check(page, collisionIdentifier);
  expect(kindBefore, `${collisionIdentifier} is meant to be an UNCERTAIN collision`).toBe("UNCERTAIN");
  const pairBeforeAnySave = await candidatePair(page);
  expect(pairBeforeAnySave.length, "UNCERTAIN must show exactly 2 candidates").toBe(2);
  evidence.pairBeforeAnySave = pairBeforeAnySave;
  expect(
    pairBeforeAnySave.filter((c) => c.owned).length,
    "with nothing held, both candidates must read not-owned; this is the state that can only produce NOT IN COLLECTION",
  ).toBe(0);

  // ---- setup: hold one candidate of the pair, and only one ---------------
  // Setup taps are not counted toward any reversal: the item is not on screen
  // in its measured state yet. Picking candidate 0 resolves NOT IN COLLECTION
  // (nothing is held), and its recognized candidate is what the add saves, so
  // exactly one variant of the pair becomes held.
  await page.locator(SEL.candidatePick).nth(0).click();
  await settle(page);
  expect(await verdictKind(page), "picking with nothing held must resolve NOT IN COLLECTION").toBe(
    "NOT_IN_COLLECTION",
  );
  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.slab)).toContainText(COPY.addedConfirm);

  // ---- the pair after the save: the asymmetry, asserted ------------------
  const kindAfterSave = await check(page, collisionIdentifier);
  expect(kindAfterSave, "the collision still stands after one of its variants is held").toBe("UNCERTAIN");
  const pairAfterSave = await candidatePair(page);
  expect(pairAfterSave.length).toBe(2);
  evidence.pairAfterSave = pairAfterSave;
  const ownedCount = pairAfterSave.filter((c) => c.owned).length;
  expect(
    ownedCount,
    "exactly one candidate of the pair must be held, or this run is measuring reading A while claiming reading B",
  ).toBe(1);
  evidence.ownershipAsymmetry = {
    what: "the same collision read before and after one of its two variants was saved",
    ownedCandidatesBeforeTheSave: pairBeforeAnySave.filter((c) => c.owned).length,
    ownedCandidatesAfterTheSave: ownedCount,
    ownershipLinesBefore: pairBeforeAnySave.map((c) => c.ownershipLine),
    ownershipLinesAfter: pairAfterSave.map((c) => c.ownershipLine),
    reading:
      "the ownership reading moved from 0 owned to 1 owned on the same identifier, so the pair really is " +
      "asymmetric and one pick resolves OWNED while the other resolves NOT IN COLLECTION. The detector " +
      "reports both values, so it is a reading and not a constant.",
  };

  const ownedIndex = pairAfterSave.findIndex((c) => c.owned);
  const notOwnedIndex = pairAfterSave.findIndex((c) => !c.owned);
  expect(ownedIndex).toBeGreaterThanOrEqual(0);
  expect(notOwnedIndex).toBeGreaterThanOrEqual(0);

  const cycles: Cycle[] = [];

  async function runCycle(reading: string, candidateIndex: number, tag: string): Promise<Cycle> {
    const kind = await check(page, collisionIdentifier);
    expect(kind).toBe("UNCERTAIN");
    const pairBeforePick = await candidatePair(page);
    expect(pairBeforePick.length).toBe(2);

    // BEFORE. The verdict word is scrolled into view and then proven to be
    // inside the picture: a capture that stops above its subject has already
    // been filed twice today. The whole slab is measured alongside it and the
    // number is kept whether it fits or not.
    await page.locator(SUBJECT.verdictWord).scrollIntoViewIfNeeded();
    const before = await capture(page, `f7b-${tag}-1-before-uncertain`);
    const beforePlacement = await assertSubjectInCapture(
      page,
      SUBJECT.verdictWord,
      before,
      `${tag} UNCERTAIN verdict word`,
    );
    const beforeSlab = await measureSubjectInCapture(page, SUBJECT.slab, before, `${tag} UNCERTAIN slab`);

    // The pick. This is the action being undone, not part of the undo.
    await page.locator(SEL.candidatePick).nth(candidateIndex).click();
    await settle(page);
    const outcomeVerdict = await verdictKind(page);

    // AFTER THE PICK. This capture has to show two things: which verdict the
    // pick resolved to, and the control that reverses it. Both are asserted
    // into the frame rather than assumed into it.
    const reverseControl = page.getByRole("button", { name: COPY.reverse });
    await reverseControl.scrollIntoViewIfNeeded();
    const afterPick = await capture(page, `f7b-${tag}-2-after-pick-${outcomeVerdict.toLowerCase()}`);
    const afterPickPlacement = await assertSubjectInCapture(
      page,
      SUBJECT.verdictWord,
      afterPick,
      `${tag} ${outcomeVerdict} verdict word`,
    );
    const afterPickSlab = await measureSubjectInCapture(
      page,
      SUBJECT.slab,
      afterPick,
      `${tag} ${outcomeVerdict} slab`,
    );
    const reversePlacement = await placementOfLocator(
      reverseControl,
      afterPick,
      `${tag} reverse control`,
    );
    expect(
      reversePlacement.fullyInsideTheCapture,
      `${tag}: the reverse control is not inside the capture that evidences it`,
    ).toBe(true);
    const controlsOnItem = await interactiveControls(page);

    // The measurement.
    const reversal = await tapsBackToUncertain(page, COPY.reverse);
    const pairAfterReverse = await candidatePair(page);
    await page.locator(SUBJECT.verdictWord).scrollIntoViewIfNeeded();
    const afterReverse = await capture(page, `f7b-${tag}-3-after-reverse-${(await verdictKind(page)).toLowerCase()}`);
    const afterReversePlacement = await assertSubjectInCapture(
      page,
      SUBJECT.verdictWord,
      afterReverse,
      `${tag} restored UNCERTAIN verdict word`,
    );
    const afterReverseSlab = await measureSubjectInCapture(
      page,
      SUBJECT.slab,
      afterReverse,
      `${tag} restored UNCERTAIN slab`,
    );

    expect(reversal.reachedUncertain, "the reversal did not return the UNCERTAIN pair").toBe(true);
    expect(reversal.taps, "taps to reverse").not.toBeNull();
    expect(reversal.taps!).toBeLessThanOrEqual(2);
    expect(pairAfterReverse.map((c) => c.label)).toEqual(pairBeforePick.map((c) => c.label));

    return {
      reading,
      identifier: collisionIdentifier,
      pickedCandidateIndex: candidateIndex,
      pickedCandidateLabel: pairBeforePick[candidateIndex]!.label,
      pickedCandidateOwnershipLine: pairBeforePick[candidateIndex]!.ownershipLine,
      outcomeVerdict,
      tapsToReverse: reversal.taps,
      reverseControlLabel: COPY.reverse,
      reachedUncertain: reversal.reachedUncertain,
      pairBeforePick,
      pairAfterReverse,
      restoredIdentically:
        JSON.stringify(pairBeforePick.map((c) => c.label)) === JSON.stringify(pairAfterReverse.map((c) => c.label)),
      interactiveControlsOnItem: controlsOnItem,
      captures: {
        beforePick: before.file,
        beforePickPx: [before.widthPx, before.heightPx],
        beforePickVerdictWord: beforePlacement,
        beforePickSlab: beforeSlab,
        afterPick: afterPick.file,
        afterPickPx: [afterPick.widthPx, afterPick.heightPx],
        afterPickVerdictWord: afterPickPlacement,
        afterPickSlab: afterPickSlab,
        afterPickReverseControl: reversePlacement,
        afterReverse: afterReverse.file,
        afterReversePx: [afterReverse.widthPx, afterReverse.heightPx],
        afterReverseVerdictWord: afterReversePlacement,
        afterReverseSlab: afterReverseSlab,
      },
    };
  }

  // Reading B, the two resolutions. This is what the file exists for.
  cycles.push(await runCycle("outcome OWNED", ownedIndex, "owned-outcome"));
  cycles.push(await runCycle("outcome NOT IN COLLECTION", notOwnedIndex, "not-in-collection-outcome"));

  const outcomes = [...new Set(cycles.map((c) => c.outcomeVerdict))].sort();
  expect(
    outcomes,
    "both resolutions must actually have been produced, or reading B was not exercised",
  ).toEqual(["NOT_IN_COLLECTION", "OWNED"]);

  const closing = await assertServedBuildId(request, baseURL!, pinned, "after the last F7 measurement");
  evidence.targetAfter = closing;
  evidence.buildIdOnDiskAtEnd = buildIdOnDisk();

  evidence.cycles = cycles;
  evidence.count = {
    cycles: cycles.length,
    outcomesCovered: outcomes,
    tapsToReverse: cycles.map((c) => c.tapsToReverse),
    maxTapsToReverse: Math.max(...cycles.map((c) => c.tapsToReverse ?? Number.POSITIVE_INFINITY)),
    cyclesOverTwoTaps: cycles.filter((c) => (c.tapsToReverse ?? Number.POSITIVE_INFINITY) > 2).length,
    cyclesNotRestoredIdentically: cycles.filter((c) => !c.restoredIdentically).length,
    capturesPerCycle: 3,
  };
  evidence.readingMeasured =
    "Reading B, the two RESOLUTIONS. One variant of the collision was saved first, so the pair is " +
    "asymmetric: picking the held candidate resolves OWNED and picking the other resolves NOT IN " +
    "COLLECTION. Reading A, the two candidates, is covered by the same two cycles, since the two picks " +
    "are the two different candidates.";
});

test("F7 negative controls: the instruments can return the other answer", async ({
  page,
  request,
  baseURL,
}) => {
  const pinned = expectedBuildId();
  const target = await assertServedBuildId(request, baseURL!, pinned, "F7 negative controls");

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
  const collisionIdentifier = [...holders.entries()]
    .filter(([, ids]) => ids.size === 2)
    .map(([value]) => value)
    .sort()[0]!;
  const soleHeldIdentifier = [...holders.entries()]
    .filter(([, ids]) => ids.size === 1)
    .map(([value]) => value)
    .sort()[0]!;

  await page.goto("/");
  await assertScaleOne(page, VIEWPORT_WIDTH, "F7 controls start");
  await expect(async () => {
    await page.fill(SEL.input, soleHeldIdentifier);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.recognizedLabel)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 500, 1000] });

  const controls: Record<string, unknown>[] = [];

  // Control 1. The tap counter, run on a fresh UNCERTAIN where nothing has
  // been picked. There is nothing to undo, so the reverse control is not on
  // the item and the counter must report that rather than reporting 1.
  expect(await check(page, collisionIdentifier)).toBe("UNCERTAIN");
  const noPickYet = await tapsBackToUncertain(page, COPY.reverse);
  controls.push({
    control: "the tap counter on a fresh UNCERTAIN, before any pick",
    reverseControlsFound: noPickYet.controlsFound,
    tapsReported: noPickYet.taps,
    expected: "null, because the control is absent",
    passes: noPickYet.taps === null && noPickYet.controlsFound === 0,
  });
  expect(noPickYet.controlsFound, "no pick has been made, so no reverse control should exist").toBe(0);
  expect(noPickYet.taps, "the counter must report absence rather than a number").toBeNull();

  // Control 2. The same counter, driven at a control that does not exist.
  // This is the counter being made to answer "not reversible" on demand, so
  // its 1 in the measured run is a reading rather than a constant.
  const absentControl = await tapsBackToUncertain(page, "A control this product does not have");
  controls.push({
    control: "the tap counter aimed at a control name the product does not carry",
    reverseControlsFound: absentControl.controlsFound,
    tapsReported: absentControl.taps,
    expected: "null",
    passes: absentControl.taps === null,
  });
  expect(absentControl.taps).toBeNull();

  // Control 3. The verdict detector, driven to each of the three kinds. A
  // detector that has only ever returned UNCERTAIN cannot be trusted to have
  // recognised OWNED in the measured run.
  const kinds: Record<string, string> = {};
  kinds.uncertain = await check(page, collisionIdentifier);
  await page.locator(SEL.candidatePick).nth(0).click();
  await settle(page);
  kinds.afterPickWithNothingHeld = await verdictKind(page);
  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.slab)).toContainText(COPY.addedConfirm);
  await check(page, collisionIdentifier);
  const pair = await candidatePair(page);
  const ownedIdx = pair.findIndex((c) => c.owned);
  await page.locator(SEL.candidatePick).nth(ownedIdx).click();
  await settle(page);
  kinds.afterPickWithOneHeld = await verdictKind(page);
  controls.push({
    control: "the verdict detector driven to all three kinds",
    kinds,
    distinctKindsReturned: [...new Set(Object.values(kinds))].sort(),
    expected: "three distinct kinds",
    passes: new Set(Object.values(kinds)).size === 3,
  });
  expect([...new Set(Object.values(kinds))].sort()).toEqual([
    "NOT_IN_COLLECTION",
    "OWNED",
    "UNCERTAIN",
  ]);

  // Control 4. The reverse control is React state, not an address. A reload
  // discards pickedFrom, so the item comes back with nothing to undo. This is
  // a real product state in which the answer to "reverse in 2 taps" is no,
  // and the instrument is shown giving that answer against the real screen.
  const reverseBeforeReload = await page.getByRole("button", { name: COPY.reverse }).count();
  await page.reload({ waitUntil: "load" });
  await settle(page);
  const afterReload = await tapsBackToUncertain(page, COPY.reverse);
  const slabAfterReload = await page.locator(SEL.slab).count();
  controls.push({
    control: "the item reloaded after a pick, which discards the in-memory pick state",
    reverseControlsBeforeReload: reverseBeforeReload,
    reverseControlsAfterReload: afterReload.controlsFound,
    verdictSlabsAfterReload: slabAfterReload,
    tapsReported: afterReload.taps,
    expected: "null, and no slab at all: the check screen comes back empty",
    passes: afterReload.taps === null,
    reading:
      "the pick, the verdict and the reverse control all live in CheckScreen's React state, so a reload " +
      "returns the check screen to its empty state rather than to the item. F7 measures a reversal from " +
      "the item as it stands, which is what the two cycles do; this control records that the same " +
      "instrument returns null the moment the item is no longer there.",
  });
  expect(afterReload.taps, "after a reload there is no item to reverse from").toBeNull();

  evidence.negativeControls = {
    port: target.port,
    servedBuildId: target.servedBuildId,
    controls,
    reading:
      "the tap counter returns null in three different states and a number in the measured cycles, and the " +
      "verdict detector returns all three kinds. Neither instrument is a constant.",
  };
});

test.afterAll(() => {
  evidence.line =
    "F7. Both outcomes of UNCERTAIN reverse from the item in 2 taps or fewer; captured before and after.";
  evidence.recordedAt = new Date().toISOString();
  writeEvidence("f7-uncertain-both-outcomes.json", evidence);
});
