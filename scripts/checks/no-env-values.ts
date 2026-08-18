// R4: "environment variable names are listed in REPORT.md and 0 values
// appear anywhere in the repository." Scans every git-tracked file's
// current working-tree content for a populated environment assignment and
// fails if it finds one. Untracked files are the developer's own business
// and are not scanned; .gitignore already keeps .env* out of tracking, so
// this is the backstop for the file that gets added anyway.
//
// Reports the file and line number only. Never the value: printing the
// value defeats the purpose of a check meant to be safe to run in CI and
// safe for an agent (or a human pasting output into a chat) to read.
//
// Run with `npm run check:no-env-values`.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnvAssignment, classifyEnvValue } from "../../src/repo-hygiene/env-value-scan";

// Tracked files AND untracked files git would add. Scanning only the index
// leaves a gap: a scratch file holding a real value is not tracked yet, and is
// one `git add .` away from being committed. Ignored files stay excluded, which
// is why an untracked .env.local is correctly out of scope — .gitignore already
// guarantees it cannot reach the repository, and R4 governs the repository.
//
// This blind spot was found first in the sibling check, no-local-paths.ts,
// which reported 2 offending files where there were 8: six were untracked.
function listCandidateFiles(): string[] {
  const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  const addable = execFileSync("git", ["ls-files", "-z", "--others", "--exclude-standard"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return [...new Set((tracked + addable).split("\0").filter(Boolean))];
}

// Null-byte sniff on the first chunk, the same heuristic git itself uses to
// decide whether a file is text. Binary files (images, fonts, the .jpg
// direction comps) cannot contain a meaningful environment assignment and
// are skipped rather than decoded as text.
function looksBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, 8000);
  return sample.includes(0);
}

type Finding = { file: string; line: number; key: string };

function main() {
  const files = listCandidateFiles();
  const findings: Finding[] = [];
  let filesScanned = 0;
  let linesScanned = 0;

  for (const file of files) {
    let buf: Buffer;
    try {
      buf = readFileSync(file);
    } catch {
      // Tracked but missing from the working tree (e.g. mid-rename); nothing
      // to scan here.
      continue;
    }
    if (looksBinary(buf)) continue;

    filesScanned++;
    const lines = buf.toString("utf8").split("\n");
    lines.forEach((line, idx) => {
      linesScanned++;
      const assignment = parseEnvAssignment(line);
      if (!assignment) return;
      if (classifyEnvValue(assignment.value) === "fail") {
        findings.push({ file, line: idx + 1, key: assignment.key });
      }
    });
  }

  console.log(`Scanned ${filesScanned} text file(s) (tracked and untracked-but-addable), ${linesScanned} line(s).`);

  if (findings.length > 0) {
    console.error(`FAIL: ${findings.length} populated environment value(s) found. Value never printed.`);
    for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.key}`);
  } else {
    console.log("OK: 0 populated environment values found in tracked or addable files.");
  }

  process.exit(findings.length === 0 ? 0 : 1);
}

main();
