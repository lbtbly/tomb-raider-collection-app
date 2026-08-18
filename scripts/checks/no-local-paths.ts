// A home directory in a tracked file identifies the machine and its owner, and
// travels to wherever the repository goes. This catches that before a commit.
//
// It exists because the leak was reported closed once while it was not. The
// seed files and the database were cleaned; the DOCUMENTS describing the fix
// were not, and one of them was the evidence entry recording the finding, which
// quoted the offending path verbatim. Fixing data is not fixing the repository.
//
// Like its sibling no-env-values.ts, this reports the file, the line and the
// KIND of path, and never the path itself: output that leaks what it found is
// no safer than the thing it is checking for.
//
// Run with `npm run check:no-local-paths`.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { findHomePaths, looksBinary, type PathKind } from "../../src/repo-hygiene/local-path-scan";

type Finding = { file: string; line: number; kind: PathKind };

// Tracked files AND untracked files git would add. An untracked evidence
// artifact is one `git add .` away from being committed, so scanning only the
// index leaves exactly the gap that made check:no-env-values insufficient and
// forced its history twin into existence. Ignored files are excluded: those
// are the developer's own business and .gitignore already keeps them out.
function candidateFiles(): string[] {
  const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  const untracked = execFileSync(
    "git",
    ["ls-files", "-z", "--others", "--exclude-standard"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return [...new Set((tracked + untracked).split("\0").filter(Boolean))];
}

function scan(text: string, file: string): Finding[] {
  return findHomePaths(text).map((hit) => ({ file, line: hit.line, kind: hit.kind }));
}

function main() {
  const files = candidateFiles();
  const findings: Finding[] = [];
  let scanned = 0;

  for (const file of files) {
    let buf: Buffer;
    try {
      buf = readFileSync(file);
    } catch {
      continue;
    }
    if (looksBinary(buf)) continue;
    scanned++;
    findings.push(...scan(buf.toString("utf8"), file));
  }

  console.log(`Scanned ${scanned} text file(s) (tracked and untracked-but-addable) for home-directory paths.`);

  if (findings.length > 0) {
    console.error(`FAIL: ${findings.length} home-directory path(s). Path never printed.`);
    for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.kind}`);
    console.error("");
    console.error("Replace with ~ or a <home> placeholder. If the path is a source URL");
    console.error("for an unpublished personal file, it is not a citable source either:");
    console.error("see .forge/EVIDENCE.md on the in-hand photograph sources.");
    process.exit(1);
  }

  console.log("OK: 0 home-directory paths in tracked or addable files.");
  process.exit(0);
}

main();
