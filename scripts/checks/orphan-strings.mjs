// Message keys defined in en.ts and referenced nowhere in src/.
//
// An unreferenced string is the cheapest signal that a screen is less complete
// than its own message catalogue expects, and it has paid twice in this
// project. It found the camera scan written and never wired, five keys sitting
// in the catalogue while the UI promised "Scan or type what is in your hand".
// It found error.generic.action defined and never rendered while F56 requires
// every error state to offer a next action.
//
// A REPORT, NOT A GATE. It always exits 0 and is deliberately absent from
// check:all. Some orphans are correct: a11y.sortAscending and
// a11y.sortDescending belong to a table slice 2 builds, and check.cacheAge.fresh
// may be deliberate because F9 is worded around the stale case only. A gate
// here would need an allowlist, an allowlist is a place to hide a real gap, and
// a check whose red lines are routinely waved through teaches everyone to wave
// through red lines.
//
// Run with `npm run orphan:strings`.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const EN = "src/lib/i18n/en.ts";

// A key counts as USED if its literal string appears anywhere in src/ outside
// en.ts, not only inside a t("...") call. Matching t("...") alone is wrong here
// and reported 37 orphans where there are 8: this codebase also reaches keys
// through a variable (ThemeSwitch.tsx, `t(labelKey)`), through a constant map
// (VerdictSlab.tsx, `PROVENANCE_MESSAGE_KEY[key]`), and through calls that pass
// an interpolation argument, where the closing paren does not follow the key.
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if ([".ts", ".tsx"].includes(extname(p)) && p !== EN) out.push(p);
  }
  return out;
}

const keys = [...readFileSync(EN, "utf8").matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]);
const blob = walk("src")
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const orphans = keys.filter(
  (k) => !blob.includes(`"${k}"`) && !blob.includes(`'${k}'`) && !blob.includes(`\`${k}\``),
);

console.log(`${keys.length} message key(s) defined, ${orphans.length} referenced nowhere in src/.`);
if (orphans.length > 0) {
  console.log("");
  for (const k of orphans) console.log(`  ${k}`);
  console.log("");
  console.log("Each one is either a screen that is less complete than its catalogue,");
  console.log("or a string that should be deleted. Both are worth knowing. Neither is");
  console.log("decided by this script.");
}

process.exit(0);
