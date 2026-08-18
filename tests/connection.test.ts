// Proves the local/non-local judgment scripts/db/seed.ts's fixture guard
// and scripts/db/remove-fixture.ts's refusal both depend on. No live
// database needed: isLocalDatabaseUrl only parses the URL.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isLocalDatabaseUrl } from "../src/db/connection";

test("isLocalDatabaseUrl accepts the local Docker Postgres and equivalent local hosts", () => {
  assert.equal(isLocalDatabaseUrl("postgres://vitrine:vitrine_dev_only@localhost:5433/vitrine"), true);
  assert.equal(isLocalDatabaseUrl("postgres://u:p@127.0.0.1:5432/db"), true);
  assert.equal(isLocalDatabaseUrl("postgres://u:p@[::1]:5432/db"), true);
  // docker-compose.yml's service name and container_name, reachable under
  // those hostnames from another container on the same compose network.
  assert.equal(isLocalDatabaseUrl("postgres://u:p@postgres:5432/db"), true);
  assert.equal(isLocalDatabaseUrl("postgres://u:p@vitrine-postgres:5432/db"), true);
});

test("isLocalDatabaseUrl rejects a hosted database, including one that merely looks local in the path", () => {
  assert.equal(
    isLocalDatabaseUrl(
      "postgres://u:p@ep-cool-lab-123456.eu-central-1.aws.neon.tech/vitrine?sslmode=require",
    ),
    false,
  );
  assert.equal(isLocalDatabaseUrl("postgres://u:p@example-hosted-db.invalid:5432/vitrine"), false);
  // The word "localhost" appearing somewhere other than the hostname must
  // not fool the guard: only the parsed hostname counts.
  assert.equal(isLocalDatabaseUrl("postgres://u:p@db.example.com:5432/localhost"), false);
});

test("isLocalDatabaseUrl rejects an unparseable url rather than throwing", () => {
  assert.equal(isLocalDatabaseUrl("not a url at all"), false);
  assert.equal(isLocalDatabaseUrl(""), false);
});
