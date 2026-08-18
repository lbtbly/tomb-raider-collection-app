// Unit tests for the pure decision no-fixture-leak.ts prints and exits on
// (src/db/checks/fixture-leak.ts). No database needed: this is exactly why
// the decision was pulled out as a function of (count, target) rather than
// left inline in the script.

import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFixtureLeak } from "../src/db/checks/fixture-leak";

const LOCAL = "postgres://vitrine:vitrine_dev_only@localhost:5433/vitrine";
const REMOTE = "postgres://u:p@ep-cool-lab-123456.eu-central-1.aws.neon.tech/vitrine?sslmode=require";

test("fixture rows on a local target: OK (info, not fatal)", () => {
  assert.equal(classifyFixtureLeak(4, LOCAL), "info");
});

test("fixture rows on a remote target: FAIL", () => {
  assert.equal(classifyFixtureLeak(4, REMOTE), "fail");
});

test("fixture rows with an absent target: FAIL (fail closed, unknown treated as production)", () => {
  assert.equal(classifyFixtureLeak(4, undefined), "fail");
  assert.equal(classifyFixtureLeak(4, null), "fail");
  assert.equal(classifyFixtureLeak(4, ""), "fail");
});

test("fixture rows with an unparseable target: FAIL", () => {
  assert.equal(classifyFixtureLeak(4, "not a url"), "fail");
});

test("zero fixture rows: OK regardless of target", () => {
  assert.equal(classifyFixtureLeak(0, LOCAL), "ok");
  assert.equal(classifyFixtureLeak(0, REMOTE), "ok");
  assert.equal(classifyFixtureLeak(0, undefined), "ok");
  assert.equal(classifyFixtureLeak(0, "not a url"), "ok");
});

test("docker-compose service hostnames and host.docker.internal count as local", () => {
  assert.equal(classifyFixtureLeak(1, "postgres://u:p@postgres:5432/vitrine"), "info");
  assert.equal(classifyFixtureLeak(1, "postgres://u:p@vitrine-postgres:5432/vitrine"), "info");
  assert.equal(classifyFixtureLeak(1, "postgres://u:p@host.docker.internal:5433/vitrine"), "info");
  assert.equal(classifyFixtureLeak(1, "postgres://u:p@127.0.0.1:5433/vitrine"), "info");
  assert.equal(classifyFixtureLeak(1, "postgres://u:p@[::1]:5433/vitrine"), "info");
});
