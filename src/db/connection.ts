// One place resolves DATABASE_URL and judges whether it points at a local
// database. Both src/db/index.ts (the app's runtime client) and the seed
// scripts import from here, so the local-only guard around fixture data
// (scripts/db/seed.ts) and the app's own connection can never drift apart.

// Local Docker Postgres default (docker-compose.yml), used only when
// DATABASE_URL is unset outside production. Never a production credential:
// production always sets DATABASE_URL through the deploy environment, never
// through a file in this repository.
export const LOCAL_DEV_DEFAULT =
  "postgres://vitrine:vitrine_dev_only@localhost:5433/vitrine";

export function resolveDatabaseUrl(preferUnpooled = false): string {
  const primary = preferUnpooled
    ? (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)
    : (process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED);
  if (primary) return primary;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL is not set. See .env.example for the shape and " +
        ".forge/OPERATOR.md for where the production value comes from.",
    );
  }
  return LOCAL_DEV_DEFAULT;
}

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  // WHATWG URL.hostname brackets an IPv6 literal ("[::1]", not "::1"); the
  // set stores the bracketed form so a direct membership check is enough.
  "[::1]",
  // docker-compose.yml's service name, reachable under this hostname from
  // another container on the same compose network.
  "postgres",
  // docker-compose.yml's container_name, reachable by name from the host
  // Docker daemon's network and from other containers.
  "vitrine-postgres",
  // Docker Desktop's fixed alias for "the host machine", used when a
  // process inside a container needs to reach a database published on the
  // host's loopback interface.
  "host.docker.internal",
]);

// Deliberately conservative: judges the connection target, not an
// environment variable a caller could set to claim "local". Anything that
// is not unambiguously the local Docker Postgres from docker-compose.yml
// counts as non-local, including a Neon hostname reached via a local proxy.
export function isLocalDatabaseUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return LOCAL_HOSTNAMES.has(parsed.hostname);
}
