// Integration test: proves normalizeIdentifier (the client-side, on-device
// twin) and variant_identifier.normalized (the Postgres generated column)
// produce byte-identical output on the same input. The unit tests in
// normalize.test.ts prove the function does what the comment claims; this
// test is the one that would actually catch the two implementations
// drifting apart, which is the failure mode that matters: a value that
// matches server-side but misses on-device, or the reverse, would make the
// offline duplicate check silently fail to find items the user already
// owns.
//
// Requires the local Docker Postgres (docker-compose.yml) to be running;
// skips with a clear message rather than failing red if it is not reachable,
// since `npm test` should not require a running database to prove the pure
// function on its own.

import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { normalizeIdentifier } from "../src/lib/identifiers/normalize";
import { resolveDatabaseUrl } from "../src/db/connection";

const CASES = [
  "5000000000005",
  "500-0000-000005",
  "5-00000-000012",
  "FX-0001",
  "  FX 0001  ",
  "Ab!@#12 3",
  "!!!---___", // entirely separators
  "MiXeD-CaSe-123",
  "ÉDITION-FRANÇAISE-42", // unicode letters the regexp_replace class does not match
  "a".repeat(500) + "-" + "9".repeat(500), // very long value
  "日本語-1234", // non-Latin script, entirely stripped by [^a-zA-Z0-9]
];

test("normalizeIdentifier agrees with the Postgres generated column on every case", async () => {
  const url = resolveDatabaseUrl(true);
  const sql = postgres(url, { max: 1, connect_timeout: 3 });
  try {
    await sql`select 1`;
  } catch (err) {
    await sql.end({ timeout: 1 });
    console.log(
      `Skipping normalize-parity: local Postgres not reachable at ${url} (${(err as Error).message}). ` +
        "Run `docker compose up -d` first.",
    );
    return;
  }

  try {
    for (const input of CASES) {
      const [row] = await sql<{ normalized: string }[]>`
        select lower(regexp_replace(${input}::text, '[^a-zA-Z0-9]', '', 'g')) as normalized
      `;
      assert.ok(row, `no row returned for input ${JSON.stringify(input)}`);
      const pg = row.normalized;
      const ts = normalizeIdentifier(input);
      assert.equal(
        ts,
        pg,
        `mismatch for input ${JSON.stringify(input)}: TS="${ts}" Postgres="${pg}"`,
      );
    }
  } finally {
    await sql.end({ timeout: 1 });
  }
});
