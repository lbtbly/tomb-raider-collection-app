// The home-directory patterns, shared by the working-tree check and the
// history check so the two cannot drift apart.
//
// They drifted once already in this project's other pair. no-local-paths.ts
// scanned only tracked files while its sibling scanned tracked and untracked,
// and it reported 2 offending files where there were 8. A rule that lives in
// one file and is retyped into another is a rule with two versions.
//
// Nothing here ever returns the matched path. Callers report the file, the
// line and the KIND, because output that leaks what it found is no safer than
// the thing it checks for.

export type PathKind = "macOS home" | "Linux home" | "Windows home";

// The capture group is the account name, which is the part that identifies a
// person rather than a filesystem layout.
const HOME_PATTERNS: Array<{ kind: PathKind; re: RegExp }> = [
  { kind: "macOS home", re: /\/Users\/([A-Za-z0-9._-]+)\// },
  { kind: "Linux home", re: /\/home\/([A-Za-z0-9._-]+)\// },
  { kind: "Windows home", re: /[A-Za-z]:\\Users\\([A-Za-z0-9._ -]+)\\/ },
];

// Placeholders are the point of the fix, not a violation of it.
const ALLOWED = [/\/Users\/<[^>]+>\//, /\/home\/<[^>]+>\//, /\/Users\/USER\//, /\/home\/USER\//];

export type PathFinding = { line: number; kind: PathKind };

// One pass over the text. Line numbers are 1-indexed to match every other
// tool a reader will hold this output next to.
export function findHomePaths(text: string): PathFinding[] {
  const out: PathFinding[] = [];
  text.split("\n").forEach((line, i) => {
    if (ALLOWED.some((re) => re.test(line))) return;
    for (const { kind, re } of HOME_PATTERNS) {
      if (re.test(line)) {
        out.push({ line: i + 1, kind });
        break;
      }
    }
  });
  return out;
}

// Null-byte sniff on the first chunk, the heuristic git itself uses. Binary
// files cannot carry a meaningful path and decoding them as text is noise.
export function looksBinary(buf: Buffer): boolean {
  return buf.subarray(0, 8000).includes(0);
}
