// Maps every rubric line to whether EVIDENCE.md carries a coverage claim for
// it. This is an INDEX, not a verdict: a claim is a place to start looking, and
// the verifier still has to open the evidence and decide.
//
// One subtlety, learned the hard way. Matching a line id anywhere in the body
// counts MENTIONS, not coverage: the entry recording "these lines have no
// evidence" names every uncovered line, so the record of the gap disguises the
// gap. Only the second pipe-delimited field is a claim.
//
// Run with `node scripts/checks/coverage-map.mjs`.

import { readFileSync } from "node:fs";

const dod = readFileSync(".forge/DOD.md", "utf8");
const ev = readFileSync(".forge/EVIDENCE.md", "utf8");

const lines = [...dod.matchAll(/^- \[([ x])\] ([FCRD]\d+)\. (.+)$/gm)].map((m) => ({
  checked: m[1] === "x",
  id: m[2],
  text: m[3],
}));
if (lines.length === 0) throw new Error("no rubric lines parsed; refusing to report a coverage map from nothing");

const claimed = new Map();
for (const row of ev.split("\n")) {
  const parts = row.split("|");
  if (parts.length < 3) continue;
  for (const m of parts[1].matchAll(/\b([FCRD]\d+)\b/g)) {
    claimed.set(m[1], (claimed.get(m[1]) ?? 0) + 1);
  }
}

const group = (p) => lines.filter((l) => l.id.startsWith(p));
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

console.log(`# Coverage map\n`);
console.log(`${lines.length} rubric lines. ${lines.filter((l) => l.checked).length} checked off (the verifier alone does this).`);
console.log(`${claimed.size} lines carry at least one evidence claim; ${lines.length - claimed.size} carry none.\n`);
console.log(`A claim is not a pass. It means evidence exists to read.`);
// NO EVIDENCE means exactly one thing: nothing in EVIDENCE.md names this line.
// It does NOT distinguish a line that was missed from a line whose subject is
// not built yet, and those look identical here. C1, C17 and D5 all want 7
// screens and 4 exist; F25 onward are later slices. Read a red line against
// PLAN.md before calling it a gap.
console.log(`NO EVIDENCE means nothing names the line. It does NOT mean the line
was missed: a line whose screen or slice does not exist yet reads the same.
Check PLAN.md before calling a red line a gap.`);
// The count is an upper bound, not a measurement. It reads the line id an
// entry CLAIMS, and cannot tell whether the body is about that line. One
// entry is filed under F52 and is an ISBN cross-form result, so F52 reads as
// covered and has no evidence at all. Found by reading, not by a sweep: an
// attempt to detect this by word overlap flagged 7 entries of which 6 were
// false positives, and was discarded.
console.log(`The count is an UPPER BOUND. It reads the id an entry claims, not
what the entry is about. F52's one entry is an ISBN result filed under the
wrong number, so F52 shows covered and has nothing.\n`);

for (const [p, name] of [["F", "Function"], ["C", "Craft"], ["R", "Release"], ["D", "Disqualifier"]]) {
  const g = group(p);
  const withEv = g.filter((l) => claimed.has(l.id));
  console.log(`## ${name}: ${withEv.length}/${g.length} with evidence (${pct(withEv.length, g.length)}%)\n`);
  for (const l of g) {
    const n = claimed.get(l.id) ?? 0;
    const mark = l.checked ? "[x]" : "[ ]";
    const ev_ = n ? `${n} entr${n === 1 ? "y" : "ies"}` : "NO EVIDENCE";
    console.log(`  ${mark} ${l.id.padEnd(4)} ${ev_.padEnd(11)} ${l.text.slice(0, 96)}`);
  }
  console.log("");
}
