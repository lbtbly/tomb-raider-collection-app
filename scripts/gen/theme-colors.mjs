// Derives the two theme-color values from the token definitions in
// globals.css, so the ground colour is AUTHORED IN EXACTLY ONE PLACE.
//
// Why this exists. C26 counts literal colour values outside the token
// definitions and wants 0. theme.ts held two by hand, `#0b1020` and
// `#edf0f7`, copied from `--g` in `:root` and `.lt`. They were correct, and a
// hand-copied colour is a second source of truth whatever its current value:
// the comment above them said "they move when --g moves", which is a promise a
// person has to keep rather than something the build enforces.
//
// It cannot simply read the custom property at runtime. `<meta
// name="theme-color">` with a `media` attribute is static document metadata
// that Next renders on the server, before any stylesheet is parsed and with no
// element to compute a style against. Reading `--g` in the head script would
// work, and would drop the no-JS path that the media-query form gives for
// free. So the value is copied, but by a machine, and `npm run
// check:theme-colors` fails if the copy drifts.
//
// Run with `npm run gen:theme-colors`, checked by `npm run check:theme-colors`.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";


const CSS = "src/app/globals.css";
const OUT = "src/lib/theme/theme-colors.generated.ts";

// The two scopes the product defines a ground in. `:root` is dark, which is
// the default the design settled on; `.lt` is the light scope.
const SCOPES = [
  { selector: ":root", constant: "THEME_COLOR_DARK" },
  { selector: ".lt", constant: "THEME_COLOR_LIGHT" },
];

// Reads `--g` out of one selector's block. Deliberately narrow: it matches the
// selector at the start of a line, takes the text to the closing brace, and
// finds the FIRST `--g`. A looser regex over the whole file would happily
// return a `--g` from some other block and produce a plausible wrong colour,
// which is the failure mode this whole script exists to prevent.
export function groundFor(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "m").exec(css);
  if (!block) throw new Error(`${CSS}: no block for selector ${selector}`);
  const value = /--g:\s*(#[0-9a-fA-F]{3,8})\s*;/.exec(block[1]);
  if (!value) throw new Error(`${CSS}: ${selector} defines no --g`);
  return value[1];
}

export function render(css) {
  const lines = SCOPES.map(({ selector, constant }) => {
    const colour = groundFor(css, selector);
    return `/** \`--g\` from \`${selector}\` in ${CSS}. */\nexport const ${constant} = "${colour}";`;
  });
  return [
    "// GENERATED FILE, DO NOT EDIT.",
    "//",
    `// Written by scripts/gen/theme-colors.mjs from the \`--g\` token in ${CSS},`,
    "// which is the single authored source for the ground colour. Edit the CSS,",
    "// then run `npm run gen:theme-colors`. `npm run check:theme-colors` fails if",
    "// this file and the stylesheet disagree.",
    "",
    ...lines,
    "",
  ].join("\n");
}

// `--check` compares without writing, for CI and for check:all.
function walkSource(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkSource(full));
    else if ([".ts", ".tsx"].includes(extname(full))) out.push(full);
  }
  return out;
}

const check = process.argv.includes("--check");
const css = readFileSync(CSS, "utf8");
const wanted = render(css);

if (check) {
  let actual = "";
  try {
    actual = readFileSync(OUT, "utf8");
  } catch {
    console.error(`FAIL: ${OUT} does not exist. Run \`npm run gen:theme-colors\`.`);
    process.exit(1);
  }
  if (actual !== wanted) {
    console.error(`FAIL: ${OUT} does not match the tokens in ${CSS}.`);
    console.error("The ground colour moved in one place and not the other.");
    console.error("Run `npm run gen:theme-colors`.");
    process.exit(1);
  }
  console.log(`OK: ${OUT} matches --g in ${CSS} for ${SCOPES.length} scope(s).`);

  // C26 clause 2 counts literal colour values outside the token definitions.
  // check:ui cannot count these: its audit runs in a browser and builds its
  // list from document.styleSheets, so a literal in a TypeScript module is
  // invisible to it and its count reads 0 with nothing behind it. These two
  // ship: they render as <meta name="theme-color"> in the document head of
  // every page.
  //
  // A verifier ruled on 2026-08-18 that a generated file is NOT inside "the
  // token definitions": a generator plus a drift check reduces the risk that
  // the copy diverges, it does not reduce the count, and the line was drawn on
  // the count. So this reports and does not pass.
  const tsLiterals = [];
  for (const file of walkSource("src")) {
    const text = readFileSync(file, "utf8");
    text.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        tsLiterals.push(`${file}:${i + 1}  ${m[0]}`);
      }
    });
  }
  console.log("");
  console.log(`C26 clause 2, TypeScript half: ${tsLiterals.length} literal colour value(s) in src.`);
  for (const hit of tsLiterals) console.log("  " + hit);
  if (tsLiterals.length) {
    console.log("");
    console.log("These are outside the token definitions and they ship. C26 clause 2");
    console.log("counts them and wants 0. Clearing them means the theme-color meta");
    console.log("stops being static, which costs the no-JS path. That is a design");
    console.log("decision, not a lint fix.");
  }
  process.exit(0);
}

mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
writeFileSync(OUT, wanted);
console.log(`Wrote ${OUT} from --g in ${CSS}.`);
