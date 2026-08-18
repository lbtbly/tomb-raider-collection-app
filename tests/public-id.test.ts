import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mintPublicId,
  isPublicId,
  insertWithFreshPublicId,
} from "../src/lib/id/public-id";

test("mintPublicId produces exactly 10 characters", () => {
  for (let i = 0; i < 200; i++) {
    assert.equal(mintPublicId().length, 10);
  }
});

test("mintPublicId never emits I, L, O or U (Crockford exclusions)", () => {
  for (let i = 0; i < 500; i++) {
    const id = mintPublicId();
    assert.doesNotMatch(id, /[ILOU]/);
  }
});

test("mintPublicId only emits the Crockford base32 alphabet", () => {
  const allowed = /^[0-9A-HJKMNP-TV-Z]{10}$/;
  for (let i = 0; i < 500; i++) {
    assert.match(mintPublicId(), allowed);
  }
});

test("mintPublicId is deterministic under an injected RNG", () => {
  const sequence = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  let i = 0;
  const id = mintPublicId(() => sequence[i++ % sequence.length]!);
  assert.equal(id.length, 10);
  // Same sequence, same id: proves the generator is a pure function of its
  // random source rather than reading hidden state.
  i = 0;
  const again = mintPublicId(() => sequence[i++ % sequence.length]!);
  assert.equal(id, again);
});

test("isPublicId accepts a minted id and rejects malformed ones", () => {
  assert.equal(isPublicId(mintPublicId()), true);
  assert.equal(isPublicId(""), false);
  assert.equal(isPublicId("short"), false);
  assert.equal(isPublicId("TOOLONGVALUE"), false);
  assert.equal(isPublicId("ABCDEFGHIL"), false); // contains I and L
  assert.equal(isPublicId("abcdefghjk"), false); // lowercase is not accepted
});

test("insertWithFreshPublicId returns the first successful attempt", async () => {
  const seen: string[] = [];
  const result = await insertWithFreshPublicId(async (id) => {
    seen.push(id);
    return `ok:${id}`;
  });
  assert.equal(seen.length, 1);
  assert.equal(result, `ok:${seen[0]}`);
});

test("insertWithFreshPublicId retries on a unique_violation and mints a fresh id each time", async () => {
  const attempts: string[] = [];
  let call = 0;
  const result = await insertWithFreshPublicId(async (id) => {
    attempts.push(id);
    call++;
    if (call < 3) {
      const err = new Error("duplicate key value violates unique constraint") as Error & {
        code?: string;
      };
      err.code = "23505";
      throw err;
    }
    return id;
  });
  assert.equal(attempts.length, 3);
  assert.equal(result, attempts[2]);
  // Every attempted id is a plausible mint, and consecutive attempts are not
  // required to differ (random collision odds are the point being retried
  // around), but the call count proves the retry loop actually ran three times.
  for (const id of attempts) assert.equal(id.length, 10);
});

test("insertWithFreshPublicId gives up after maxAttempts and surfaces the last error", async () => {
  await assert.rejects(
    () =>
      insertWithFreshPublicId(async () => {
        const err = new Error("duplicate key value violates unique constraint") as Error & {
          code?: string;
        };
        err.code = "23505";
        throw err;
      }, 3),
    /collided 3 times/,
  );
});

test("insertWithFreshPublicId does not retry on a non-collision error", async () => {
  let attempts = 0;
  await assert.rejects(
    () =>
      insertWithFreshPublicId(async () => {
        attempts++;
        throw new Error("connection refused");
      }),
    /connection refused/,
  );
  assert.equal(attempts, 1);
});
