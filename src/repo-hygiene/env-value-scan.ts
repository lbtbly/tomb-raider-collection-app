// R4: "environment variable names are listed in REPORT.md and 0 values
// appear anywhere in the repository." The two pure functions here decide,
// line by line, whether a line is an environment-style assignment
// (parseEnvAssignment) and, if so, whether its value is a populated secret
// or an acceptable template/placeholder/plain-configuration value
// (classifyEnvValue). scripts/checks/no-env-values.ts is the thin wrapper
// that walks git-tracked files and calls these; both are unit tested
// without touching the filesystem or git (tests/env-value-scan.test.ts).
//
// The classifier is deliberately not "does this look like KEY=value at
// all", which would flag NODE_ENV=development, PORT=3000 and every other
// harmless piece of configuration and get ignored within a week. It is
// "does this specific value look like a secret": a connection string
// carrying embedded credentials, a recognisable API-key prefix, or a long
// no-whitespace token that mixes case and digits the way a generated
// credential does and a word does not.

export type EnvAssignment = { key: string; value: string };

const ASSIGNMENT_RE = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/;

// Parses one line of source text as a possible environment assignment.
// Returns null for a comment line, a blank line, or a line whose left-hand
// side does not look like a configuration name (uppercase, digits,
// underscores; see the coordinator's spec). Does not judge the value; that
// is classifyEnvValue's job, kept separate so each half is independently
// testable.
export function parseEnvAssignment(line: string): EnvAssignment | null {
  if (/^\s*#/.test(line)) return null;
  const match = ASSIGNMENT_RE.exec(line);
  if (!match) return null;
  const [, key, value] = match;
  if (!key || value === undefined) return null;
  return { key, value };
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

const PLACEHOLDER_NORMALIZED = new Set([
  "changeme",
  "replaceme",
  "yourvaluehere",
  "todo",
]);

// scheme://user:pass@host: the shape of an embedded-credential connection
// string, independent of what the scheme or the credential actually are.
const CREDENTIALED_URL_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/\s@]+:[^/\s@]+@/;

// Recognisable secret-key prefixes: OpenAI, Stripe, GitHub, AWS, Google, and
// a bare JWT. Not exhaustive by design; the high-entropy check below is the
// general-purpose backstop for anything not on this list.
const KEY_SHAPED_RES: RegExp[] = [
  /^sk-[A-Za-z0-9]{10,}/,
  /^sk_(live|test)_[A-Za-z0-9]{10,}/i,
  /^pk_(live|test)_[A-Za-z0-9]{10,}/i,
  /^(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{10,}/,
  /^AKIA[0-9A-Z]{12,}/,
  /^AIza[0-9A-Za-z_-]{10,}/,
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
];

export type EnvValueVerdict = "ok" | "fail";

export function classifyEnvValue(rawValue: string): EnvValueVerdict {
  const value = stripQuotes(rawValue);

  if (value.length === 0) return "ok";
  if (/^<[^>]*>$/.test(value)) return "ok";

  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (PLACEHOLDER_NORMALIZED.has(normalized)) return "ok";

  if (CREDENTIALED_URL_RE.test(value)) return "fail";
  if (KEY_SHAPED_RES.some((re) => re.test(value))) return "fail";

  // High-entropy token: no whitespace, long enough that a plain word would
  // be unusual, and mixing at least two of {lowercase, uppercase, digit},
  // the shape a generated secret has and a configuration word like
  // "development" or "production" does not.
  if (value.length >= 20 && !/\s/.test(value) && /^[A-Za-z0-9+/_=.-]+$/.test(value)) {
    const hasLower = /[a-z]/.test(value);
    const hasUpper = /[A-Z]/.test(value);
    const hasDigit = /[0-9]/.test(value);
    const varietyCount = [hasLower, hasUpper, hasDigit].filter(Boolean).length;
    if (varietyCount >= 2) return "fail";
  }

  return "ok";
}
