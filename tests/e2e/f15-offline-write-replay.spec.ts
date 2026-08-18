// F15: "A write made with the network disabled and replayed on reconnect
// creates exactly 1 row; a count query for that operation id returns 1."
//
// The mechanism was built deliberately and had never been demonstrated. Its
// three parts: a client-generated operation id (src/lib/device/collection.ts,
// writeCopy), an outbox that keeps the op when the send fails, and a server
// route (src/app/api/sync/ops/route.ts) whose own header states that replaying
// an id leaves exactly one client_op row. All three are asserted here, in that
// order, through the product rather than around it.
//
// The count query runs against Postgres directly, not through an API the app
// also wrote through. An endpoint reporting on its own writes could return 1
// because it returns 1.
//
// Two controls, because "the query returned 1" means nothing from an
// instrument that has never returned anything else:
//   - before reconnect the same query returns 0 for the same id;
//   - a never-issued operation id returns 0, and a freshly posted one returns 1.

import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { assertProductionTarget, settle, writeEvidence } from "./harness";

const SEL = {
  input: "#check-identifier",
  submit: 'form button[type="submit"]',
  slab: '[data-testid="verdict"]',
  recognizedLabel: "section.vslab .vlead.mono",
  addToCollection: 'section.vslab button:has-text("Add to collection")',
};

type OutboxOp = { opId: string; kind: string; status: string; payload: { deviceId: string } };

const evidence: Record<string, unknown> = {};

const DATABASE_URL = process.env.DATABASE_URL;
const sql = postgres(DATABASE_URL ?? "", { max: 1, idle_timeout: 2 });

/** The count query the line asks for. Straight SQL against the row the server
 * route writes. */
async function countRowsFor(opId: string): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    select count(*)::int as n from client_op where id = ${opId}
  `;
  return rows[0]!.n;
}

async function totalRows(): Promise<number> {
  const rows = await sql<{ n: number }[]>`select count(*)::int as n from client_op`;
  return rows[0]!.n;
}

async function readOutbox(page: Page): Promise<OutboxOp[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("vitrine");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const ops = await new Promise<OutboxOp[]>((resolve, reject) => {
      const req = db.transaction("outbox", "readonly").objectStore("outbox").getAll();
      req.onsuccess = () => resolve(req.result as OutboxOp[]);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return ops;
  });
}

test("an offline write replays on reconnect and leaves exactly one row", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  expect(
    DATABASE_URL,
    "DATABASE_URL is required: F15's clause is a count query, and there is no way to answer it without the database",
  ).toBeTruthy();
  evidence.target = await assertProductionTarget(request, baseURL!);

  // The identifier is read from the catalogue being served, never pinned:
  // public ids are minted on insert and this catalogue is rebuilt as it grows.
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
  const identifier = [...holders.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .find(([, ids]) => ids.size === 1)?.[0];
  expect(identifier, "no uniquely held identifier in the served catalogue").toBeTruthy();

  // Every request the page makes to the ops route, recorded from the browser
  // side. It is how "the write did not reach the server" is shown to be true
  // of the network and not just of the database.
  const opsRequests: { phase: string; method: string; status: number | null; atMs: number }[] = [];
  const startedAt = Date.now();
  page.on("requestfinished", (req) => {
    if (req.url().includes("/api/sync/ops")) {
      void req
        .response()
        .then((res) =>
          opsRequests.push({
            phase: "finished",
            method: req.method(),
            status: res?.status() ?? null,
            atMs: Date.now() - startedAt,
          }),
        )
        .catch(() => {});
    }
  });
  page.on("requestfailed", (req) => {
    if (req.url().includes("/api/sync/ops")) {
      opsRequests.push({ phase: "failed", method: req.method(), status: null, atMs: Date.now() - startedAt });
    }
  });

  const rowsBefore = await totalRows();

  // Online first, so the catalogue is on the device. Offline is about the
  // write, not about never having had a network.
  await page.goto("/");
  await expect(page.locator(SEL.input)).toBeVisible();
  await expect(async () => {
    await page.fill(SEL.input, identifier!);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.recognizedLabel)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 500, 1000] });

  // An "online" listener installed before the reconnect, so the replay path
  // the product actually uses is the one being measured: OutboxReplay listens
  // for this same event.
  await page.evaluate(() => {
    (window as unknown as { __onlineEvents: number }).__onlineEvents = 0;
    window.addEventListener("online", () => {
      (window as unknown as { __onlineEvents: number }).__onlineEvents += 1;
    });
  });

  // ---- the network goes away -------------------------------------------
  await context.setOffline(true);
  expect(await page.evaluate(() => navigator.onLine), "navigator.onLine after setOffline(true)").toBe(false);

  await page.fill(SEL.input, identifier!);
  await page.click(SEL.submit);
  await expect(page.locator(SEL.slab)).toBeVisible();
  const kindBefore = await page.locator(SEL.slab).getAttribute("data-verdict");
  expect(kindBefore, "the identifier must not already be owned, or there is no write to make").toBe(
    "NOT_IN_COLLECTION",
  );
  await page.click(SEL.addToCollection);
  await expect(page.locator(SEL.slab)).toContainText("Saved to your collection.");
  await settle(page);

  const offlineOutbox = await readOutbox(page);
  const pending = offlineOutbox.filter((op) => op.status === "pending");
  expect(pending, "the offline write left no pending outbox op").toHaveLength(1);
  const op = pending[0]!;
  expect(op.opId, "the operation id is client-generated and must be a UUID").toMatch(
    /^[0-9a-f-]{36}$/i,
  );

  const countWhileOffline = await countRowsFor(op.opId);
  const totalWhileOffline = await totalRows();

  evidence.offlineWrite = {
    identifier,
    opId: op.opId,
    kind: op.kind,
    outboxStatus: op.status,
    countQueryWhileOffline: countWhileOffline,
    clientOpRowsBefore: rowsBefore,
    clientOpRowsWhileOffline: totalWhileOffline,
    opsRequestsSoFar: [...opsRequests],
  };

  // Control. The same query, the same id, before the reconnect.
  expect(countWhileOffline, "a row existed before the replay, so the replay proves nothing").toBe(0);
  expect(totalWhileOffline, "client_op grew while the network was disabled").toBe(rowsBefore);

  // ---- the network comes back ------------------------------------------
  await context.setOffline(false);
  const replayStartedAt = Date.now();

  // The product's own path: the browser fires "online", OutboxReplay hears it
  // and calls replayOutbox. Polled from the outbox record, not from a timer.
  await expect(async () => {
    const ops = await readOutbox(page);
    const seen = ops.find((o) => o.opId === op.opId);
    expect(seen?.status, `outbox op ${op.opId}`).toBe("applied");
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 500, 1000] });
  const replayMs = Date.now() - replayStartedAt;

  const onlineEvents = await page.evaluate(
    () => (window as unknown as { __onlineEvents: number }).__onlineEvents,
  );

  // The clause, answered.
  const countAfterReplay = await countRowsFor(op.opId);
  const totalAfterReplay = await totalRows();

  // Replay it again, twice, exactly as a flaky connection would. The line says
  // a replay creates one row, so replaying more than once must not create two.
  const replayAgain = [];
  for (let i = 0; i < 2; i++) {
    const res = await request.post(new URL("/api/sync/ops", baseURL!).toString(), {
      data: { opId: op.opId, deviceId: op.payload.deviceId, kind: op.kind, payload: op.payload },
    });
    replayAgain.push({ status: res.status(), body: await res.json(), countAfter: await countRowsFor(op.opId) });
  }

  evidence.replay = {
    onlineEventsSeenInPage: onlineEvents,
    replayLatencyMs: replayMs,
    outboxStatusAfterReplay: "applied",
    countQueryAfterReplay: countAfterReplay,
    clientOpRowsAfterReplay: totalAfterReplay,
    deliberateReplaysOfTheSameId: replayAgain,
    opsRequests,
  };

  expect(onlineEvents, "the page never saw an online event, so this measured a reload not a reconnect").toBeGreaterThanOrEqual(1);
  expect(countAfterReplay, "count query for the operation id after replay").toBe(1);
  expect(totalAfterReplay, "the replay wrote more than the one row").toBe(rowsBefore + 1);
  for (const r of replayAgain) {
    expect(r.countAfter, "replaying the same operation id created a second row").toBe(1);
  }

  // The copy itself survived, which is the point of the write.
  const copies = await page.evaluate(async () => {
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
  expect(copies, "the offline write left no saved copy on the device").toBe(1);
  evidence.savedCopiesOnDevice = copies;
});

test("the count query can return something other than 1", async ({ request, baseURL }) => {
  // The positive and negative halves of the instrument. A query that returns 1
  // for everything would have passed the test above without the mechanism
  // existing at all.
  const neverIssued = "00000000-0000-4000-8000-00000000dead";
  const beforeUnknown = await countRowsFor(neverIssued);

  const fresh = crypto.randomUUID();
  const beforeFresh = await countRowsFor(fresh);
  const total0 = await totalRows();
  const res = await request.post(new URL("/api/sync/ops", baseURL!).toString(), {
    data: { opId: fresh, deviceId: "f15-control-device", kind: "add_copy", payload: { control: true } },
  });
  const afterFresh = await countRowsFor(fresh);
  const total1 = await totalRows();

  evidence.countQueryControl = {
    neverIssuedOpId: neverIssued,
    countForNeverIssued: beforeUnknown,
    freshOpId: fresh,
    countBeforePost: beforeFresh,
    postStatus: res.status(),
    countAfterPost: afterFresh,
    clientOpRowsBeforePost: total0,
    clientOpRowsAfterPost: total1,
  };

  expect(beforeUnknown, "the count query answered 1 for an id nobody ever issued").toBe(0);
  expect(beforeFresh).toBe(0);
  expect(afterFresh).toBe(1);
  expect(total1, "a distinct operation id must create its own row").toBe(total0 + 1);
});

test.afterAll(async () => {
  evidence.countQuery = "select count(*)::int as n from client_op where id = $1, run against Postgres directly";
  evidence.recordedAt = new Date().toISOString();
  writeEvidence("f15-offline-write-replay.json", evidence);
  await sql.end({ timeout: 5 });
});
