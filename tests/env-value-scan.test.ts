import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnvAssignment, classifyEnvValue } from "../src/repo-hygiene/env-value-scan";

test("classifyEnvValue: empty value is OK", () => {
  assert.equal(classifyEnvValue(""), "ok");
  assert.equal(classifyEnvValue("   "), "ok");
  assert.equal(classifyEnvValue('""'), "ok");
  assert.equal(classifyEnvValue("''"), "ok");
});

test("classifyEnvValue: angle-bracket template is OK", () => {
  assert.equal(classifyEnvValue("<your-database-url>"), "ok");
  assert.equal(classifyEnvValue("<POOLED_CONNECTION_STRING>"), "ok");
});

test("classifyEnvValue: obvious placeholders are OK", () => {
  assert.equal(classifyEnvValue("changeme"), "ok");
  assert.equal(classifyEnvValue("CHANGE_ME"), "ok");
  assert.equal(classifyEnvValue("replace-me"), "ok");
  assert.equal(classifyEnvValue("your-value-here"), "ok");
  assert.equal(classifyEnvValue("TODO"), "ok");
  assert.equal(classifyEnvValue("todo"), "ok");
});

test("classifyEnvValue: a credentialed connection string is FAIL", () => {
  assert.equal(classifyEnvValue("postgres://user:s3cr3tPass@db.example.com:5432/app"), "fail");
  assert.equal(
    classifyEnvValue("mysql://admin:hunter2word@10.0.0.5:3306/prod?ssl=true"),
    "fail",
  );
});

test("classifyEnvValue: a long high-entropy token is FAIL", () => {
  assert.equal(classifyEnvValue("aK29fJ2plaQ93mzXlq0ZpQeR7wLk4Nb2"), "fail");
  assert.equal(classifyEnvValue("4f9c2e8a1b6d3f7051a2c4e6b8d0f1a3c5e7"), "fail");
});

test("classifyEnvValue: recognisable secret-key prefixes are FAIL", () => {
  assert.equal(classifyEnvValue("sk-abcdefghijklmnopqrstuvwx"), "fail");
  assert.equal(classifyEnvValue("sk_live_51H8abcdefghijklmno"), "fail");
  assert.equal(classifyEnvValue("ghp_abcdefghijklmnopqrstuvwxyz0123456789"), "fail");
  assert.equal(classifyEnvValue("AKIAABCDEFGHIJKLMNOP"), "fail");
});

test("classifyEnvValue: a lowercase configuration word is OK, not a secret", () => {
  // The case that keeps this check from crying wolf: NODE_ENV=development
  // must not fail just because it is a KEY=value line with a non-empty
  // right-hand side.
  assert.equal(classifyEnvValue("development"), "ok");
  assert.equal(classifyEnvValue("production"), "ok");
  assert.equal(classifyEnvValue("true"), "ok");
  assert.equal(classifyEnvValue("false"), "ok");
  assert.equal(classifyEnvValue("3000"), "ok");
  assert.equal(classifyEnvValue("info"), "ok");
});

test("classifyEnvValue: a short mixed-case word is OK (below the length floor)", () => {
  assert.equal(classifyEnvValue("Frankfurt1"), "ok");
});

test("parseEnvAssignment: recognises KEY=value with an uppercase, digit, underscore key", () => {
  assert.deepEqual(parseEnvAssignment("DATABASE_URL=postgres://x"), {
    key: "DATABASE_URL",
    value: "postgres://x",
  });
  assert.deepEqual(parseEnvAssignment("NODE_ENV=development"), {
    key: "NODE_ENV",
    value: "development",
  });
  assert.deepEqual(parseEnvAssignment("export API_KEY=abc123"), {
    key: "API_KEY",
    value: "abc123",
  });
});

test("parseEnvAssignment: ignores comment lines even if they contain KEY=value text", () => {
  assert.equal(parseEnvAssignment("# DATABASE_URL=postgres://user:pass@host/db"), null);
  assert.equal(parseEnvAssignment("   # NODE_ENV=development"), null);
});

test("parseEnvAssignment: ignores a line whose left-hand side is not a configuration name", () => {
  assert.equal(parseEnvAssignment("const foo = bar"), null); // lowercase key
  assert.equal(parseEnvAssignment("this is just a sentence"), null); // no '='
  assert.equal(parseEnvAssignment("a.b.c=1"), null); // dots are not part of the key alphabet
});

test("end to end: a NODE_ENV line never fails the scan", () => {
  const assignment = parseEnvAssignment("NODE_ENV=development");
  assert.ok(assignment);
  assert.equal(classifyEnvValue(assignment.value), "ok");
});

test("end to end: a committed connection string with credentials fails the scan", () => {
  const assignment = parseEnvAssignment(
    "DATABASE_URL=postgres://vitrine:vitrine_dev_only@localhost:5433/vitrine",
  );
  assert.ok(assignment);
  assert.equal(classifyEnvValue(assignment.value), "fail");
});
