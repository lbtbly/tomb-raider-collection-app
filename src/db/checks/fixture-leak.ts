// The decision fixture-leak checking makes, pulled out as a pure function so
// it is unit-testable without a database round trip (see
// tests/fixture-leak-classifier.test.ts). scripts/checks/no-fixture-leak.ts
// is the thin wrapper that gathers the row count and the connection target
// and calls this.
//
// Fixture data in a local development database is correct and expected, so
// this only fails when it would matter: fixture rows reachable from a
// non-local target, or a target this cannot classify at all. Zero fixture
// rows is unconditionally OK no matter what the target is or whether it can
// even be parsed, because there is nothing to judge. An unparseable or
// absent target with fixture rows present fails closed rather than being
// treated as "probably fine", because a check that found fixture rows but
// cannot tell where it is running has no basis to pass.
import { isLocalDatabaseUrl } from "../connection";

export type FixtureLeakVerdict = "ok" | "info" | "fail";

export function classifyFixtureLeak(
  fixtureRowCount: number,
  databaseUrl: string | null | undefined,
): FixtureLeakVerdict {
  if (fixtureRowCount === 0) return "ok";

  if (!databaseUrl) return "fail";
  try {
    void new URL(databaseUrl); // parse-only, judging validity
  } catch {
    return "fail";
  }

  return isLocalDatabaseUrl(databaseUrl) ? "info" : "fail";
}
