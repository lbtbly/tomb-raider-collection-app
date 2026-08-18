// R4, second half: "0 values appear anywhere in the repository." A repository
// is its history, not only its working tree. no-env-values.ts scans tracked
// files as they stand now; this walks every blob reachable from every ref, so
// a value that was committed and later replaced with a placeholder is still
// caught. That is not hypothetical: it is how this check came to exist.
//
// Reports the stored path, line number and variable name. Never the value, for
// the same reason as its sibling: the output has to be safe to paste into a CI
// log and into a chat.
//
// Run with `npm run check:no-env-values:history`.

import { execFileSync } from "node:child_process";
import { parseEnvAssignment, classifyEnvValue } from "../../src/repo-hygiene/env-value-scan";

type Finding = { blob: string; path: string; line: number; key: string };

// Every blob reachable from every ref, with the path it was stored under.
// Deduplicated by object id: the same content committed twice is one object
// and only needs scanning once.
function listHistoricalBlobs(): Map<string, string> {
  const out = execFileSync("git", ["rev-list", "--objects", "--all"], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  const blobs = new Map<string, string>();
  for (const line of out.split("\n")) {
    const space = line.indexOf(" ");
    if (space === -1) continue;
    const id = line.slice(0, space);
    const path = line.slice(space + 1).trim();
    if (path && !blobs.has(id)) blobs.set(id, path);
  }
  return blobs;
}

// `rev-list --objects` yields trees as well as blobs, and asking git for the
// blob content of a tree fails loudly on stderr. Silence that stream: the
// only interesting outcome here is "this object is text we can scan", and a
// verifier reading noise as a fault is a real cost.
function readBlob(id: string): Buffer | null {
  try {
    return execFileSync("git", ["cat-file", "blob", id], {
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function main() {
  const blobs = listHistoricalBlobs();
  const findings: Finding[] = [];
  let scanned = 0;

  for (const [id, path] of blobs) {
    const buf = readBlob(id);
    if (!buf) continue;
    // Null-byte sniff, the same heuristic the working-tree check uses.
    if (buf.subarray(0, 8000).includes(0)) continue;
    scanned++;
    buf
      .toString("utf8")
      .split("\n")
      .forEach((line, idx) => {
        const assignment = parseEnvAssignment(line);
        if (!assignment) return;
        if (classifyEnvValue(assignment.value) === "fail") {
          findings.push({ blob: id.slice(0, 7), path, line: idx + 1, key: assignment.key });
        }
      });
  }

  console.log(`Scanned ${scanned} text blob(s) across all reachable history.`);

  if (findings.length > 0) {
    console.error(`FAIL: ${findings.length} populated assignment(s) in history. Value never printed.`);
    for (const f of findings) console.error(`  blob ${f.blob}  ${f.path}:${f.line}  ${f.key}`);
    console.error("");
    console.error("A value in history is not fixed by editing the working tree.");
    console.error("The commit has to be rewritten, and the value itself rotated at");
    console.error("the provider: rewriting history does not undo the exposure.");
  } else {
    console.log("OK: 0 populated assignments found in history.");
  }

  process.exit(findings.length === 0 ? 0 : 1);
}

main();
