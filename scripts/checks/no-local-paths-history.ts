// A home directory in history is still in the repository. no-local-paths.ts
// scans the working tree; this walks every blob reachable from every ref, so a
// path that was committed and later cleaned is still caught.
//
// It exists because the gap was real and nothing could see it. The env-value
// pair already had a history twin, and the path check did not, so a leak that
// had been described as "1 home directory in one commit" was actually 16 lines
// across 3 files in 3 commits, and no check in the suite reported it. The
// working-tree check was green the whole time and was correct to be: the
// cleanup had been done, just never committed.
//
// A guard built without the blind spot its predecessor taught is a guard that
// will earn the same lesson twice.
//
// Reports the blob, the stored path, the line and the KIND of path. Never the
// path itself, for the same reason as its siblings: the output has to be safe
// to paste into a CI log and into a chat.
//
// Run with `npm run check:no-local-paths:history`.

import { execFileSync } from "node:child_process";
import { findHomePaths, looksBinary, type PathKind } from "../../src/repo-hygiene/local-path-scan";

type Finding = { blob: string; path: string; line: number; kind: PathKind };

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
// blob content of a tree fails loudly on stderr. Silence that stream: the only
// interesting outcome is "this object is text we can scan", and a verifier
// reading noise as a fault is a real cost.
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
    if (looksBinary(buf)) continue;
    scanned++;
    for (const hit of findHomePaths(buf.toString("utf8"))) {
      findings.push({ blob: id.slice(0, 7), path, line: hit.line, kind: hit.kind });
    }
  }

  // Print the count of blobs actually read. A scan that examined nothing
  // prints a clean result that is indistinguishable from a clean repository,
  // and this check was written after exactly that mistake: a first attempt
  // walked zero objects and reported no findings.
  console.log(`Scanned ${scanned} text blob(s) across all reachable history.`);
  if (scanned === 0) {
    console.error("FAIL: 0 blobs examined. A clean result from an empty scan is not a pass.");
    process.exit(3);
  }

  if (findings.length > 0) {
    const files = new Set(findings.map((f) => f.path));
    console.error(
      `FAIL: ${findings.length} home-directory path(s) in history, across ${files.size} file(s). Path never printed.`,
    );
    for (const f of findings) console.error(`  blob ${f.blob}  ${f.path}:${f.line}  ${f.kind}`);
    console.error("");
    console.error("Cleaning the working tree does not clean history. These commits");
    console.error("have to be rewritten. Committing the current tree fixes what");
    console.error("happens next, not what is already stored.");
    process.exit(1);
  }

  console.log("OK: 0 home-directory paths in history.");
  process.exit(0);
}

main();
