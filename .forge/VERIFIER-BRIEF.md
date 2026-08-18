# Verifier brief, ready to dispatch

Written while the findings are fresh. **Dispatch only after
`NEXT-BROWSER-PASS.md` has run**, because six clauses it covers are currently
unmeasured and one red check depends on it.

## Your authority and its limit

**You alone flip a checkbox in `.forge/DOD.md`, and only against evidence in
`.forge/EVIDENCE.md`.** Nothing in this brief, and nothing any builder reported,
is a verdict. The evidence file grows as work lands, so it carries no count here, read
it. Several entries are explicitly PARTIAL and say so in their own text; treat
"partial" as a claim about scope, not a weaker pass.

**The rubric is closed.** 130 lines, verified unmodified since commit, 62 F /
30 C / 33 R / 5 D. If a line cannot pass, it fails. It does not get reworded,
and a threshold does not move to meet a measurement.

## Read these three first

- `.forge/evidence/coverage-map.txt`, which lines carry a claim. **An index, not
  a verdict.** A claim means evidence exists to read.
- `.forge/RESUME.md`, leads with the five operator decisions and the three
  categories of "not done".
- `docs/SECURITY.md`, why two checks are red and why that is correct.
- **`.forge/DEFECTS.md`, read this before treating any entry as an open
  defect.** EVIDENCE.md is append-only, so an entry titled "(open)" stays
  titled "(open)" after the fix lands. Two are stale right now: the sync
  protocol tombstones (09:08) and the absent camera scan (10:32) are both
  built. The index lists what is genuinely still open and points at the code
  that closed the rest.

## When the verifier goes quiet, stat the file before inferring anything

**This section is for whoever dispatches the verifier, not for the verifier.**

Four dispatches, four reports lost on the way back. Each returned its opening
sentence and nothing else, after 42 to 48 tool calls of real work. Telling the
agent to write `.forge/DOD.md` before composing its report **did not fix it**:
the fourth run wrote neither.

What works, three times out of three, is **asking again**. The follow-up has
never failed, and those reports have been the most valuable output of the run:
the C20 reversal, the F7 reading correction, and a critique that rewrote the
evidence guard.

**Before asking, stat the file.** `.forge/DOD.md`'s mtime and checkbox count
separate two facts a silent channel makes identical:

- mtime moved, count changed: the verdict landed, only the prose was lost.
- mtime unchanged: the run flipped nothing, which may be the correct verdict.

Then ask, and say which of those you observed, so the agent can tell you
straight away if it flipped something you cannot see. A lost write and a lost
report need different responses and cost differently.

## Before you run check:all, and this one bit you

`check:ui` performs a production build. If you are holding a `next start`, that
rebuild lands underneath it, your server keeps serving the **old** build from
its loaded state, and every number you take afterwards belongs to a build that
is no longer on disk.

**This happened to you.** Your artifacts are named
`verifier-recheck-U_TSj0yB6qLS3TQKwtvZ6.json` and were written at 16:02:10.
`.next/BUILD_ID` became `YzDsr6hHAGTXS-1fwnrSm` at 15:52:25. Your `check:all`
run rebuilt for it, which is also why "I rebuilt nothing" was not right. Your
startup assertion was true when you made it and false by the time you measured.

It cost nothing, and I verified that before saying so: no file under `src` or
`public` changed between 15:46 and 15:53 or since, so the new id is a rebuild of
byte-identical source. **The same event with one source edit would have
invalidated all six of your re-measurements silently.**

Two habits, both cheap:

- Run with `UI_CHECK_SKIP_BUILD=1` when you hold a server, or stop the server
  first.
- **Assert the build id after your last measurement as well as before it**,
  comparing served against disk both times, and record both. A one-time
  assertion at startup cannot see a rebuild that happens afterwards. If they
  diverge, your numbers are still good for the build you served, and the
  artifact must name that build rather than whatever is on disk when it is
  written.

## Audit clauses, not entries

**This is the single most important instruction here.** Most rubric lines hold
two or more clauses, and a multi-clause line is one a partial reading satisfies
while looking complete. Split every line you audit into its clauses first, then
ask which clause each entry actually answers. Five gaps were found this way in
lines that looked handled, and four have since been closed:

| Line | Measured | Also asked | Now |
|---|---|---|---|
| R4 | 0 values in the working tree | names in `REPORT.md`, which did not exist | **closed** |
| C23 | font size at 390 px | **and at 1440 px**, on the build not a comp | **closed**, 46.0/46.0/36.0 |
| F10 | verdict in 97 ms, 2 taps | **and a saved copy**, over **5 timed runs** | **closed**, 161.1 ms, 3 taps |
| F15 | an offline write | **and the replayed row count** | **closed**, 0 then 1 |
| R20 | no external hosts | **and 0 storage items** the notice does not name | **open**, waits on slice 8 |

In every case a real measurement existed and was correct, and answered a
narrower question than the line asked. **A line with two entries can still have
an unexamined clause.**

F10 is the one to study. The old figure, 97 ms in 2 taps, sat so far inside a
20-second, 4-tap budget that nobody would question it. It was also measuring
cold-open-to-*verdict*, and the line asks for cold-open-to-*saved copy*. The
real journey costs a third tap and about 60 ms more. **A comfortable margin is
not evidence that the right thing was measured**, and a wrong measurement that
passes easily is harder to catch than one that passes narrowly.

## What changed since your last dispatch

**The build is `YzDsr6hHAGTXS-1fwnrSm`.** It is a rebuild of source identical to
`U_TSj0yB6qLS3TQKwtvZ6`; no file under `src` or `public` changed between them.
An evidence entry claims eight files were modified after `U_TSj0y` was built.
**That entry is wrong** and a later one corrects it: it compares a UTC evidence
timestamp against local `stat` mtimes, and the offset is +2. `U_TSj0y` was on
disk at 15:47:46 local, after all eight files.

**F13, F16, F7 and F12 were re-measured on the current build**, with the build
id asserted before the first clause and again after the last. Read the
artifacts:

- **F13** satisfied. Real restart witnessed by the OS process table: pid 12860
  dead, 0 processes holding the profile, then pid 12907. Offline set before the
  second browser's first navigation.
- **F16** satisfied on its own words. 9 offline documents, 0 browser error
  pages, route set enumerated from disk into the artifact.
- **F7** satisfied **on the reading you flagged as unexercised**. The two
  resolutions, not the two candidates: the pair read `[not owned, not owned]`
  before the save and `[Already in your collection, Not in your collection yet]`
  after, so the asymmetry is asserted. OWNED and NOT IN COLLECTION each reversed
  in 1 tap against a bar of 2. The product **can** produce an OWNED resolution.
- **F12 cannot close**, and the artifact says so precisely: **0 failing of 4
  measured, not 0 of 5.** The thumbnail clause is unreachable while no
  photograph can exist.

**Two instrument fixes landed**, both from failures this run. `writeEvidence`
now refuses an artifact with fewer top-level keys than the one on disk, after a
control overwrote a complete F12 record with a two-key stub and reported
success. And `assertServedBuildId` reads the id from the served bytes and is
called before the first clause **and after the last**, which is the gap that let
your own server be measured against a build that had moved underneath it.

## The build moved after your last dispatch, and 6 of your 22 sit on the old one

`.next` has since moved on again and now holds `YzDsr6hHAGTXS-1fwnrSm`. The
22 checks in question were made against `7JzsJmX3Ve24jbZ-g46Vt`, and the
build that superseded it was `U_TSj0yB6qLS3TQKwtvZ6`. Nine source files changed in between: `globals.css`,
`CandidateRow.tsx` (new), `CheckScreen.tsx`, `PhotoFrame.tsx`,
`VerdictSlab.tsx`, `CollectionThumb.tsx`, `en.ts`, `theme.ts`, and a generated
theme-colour module.

**No regression is claimed.** A check is true of the product that existed when
it ran, and these eight ran against a product that has since changed:

| Line | What the diff reaches |
|---|---|
| F4 | the UNCERTAIN slab was rebuilt, so the capture on record photographs a screen that no longer exists |
| F7 | candidate rows went from a row to a 2-column grid with a new pick button; the tap path itself is new |
| C5, C6 | `PhotoFrame`'s no-photo branch dropped `role="img"` and an `.srOnly` span for two visible paragraphs, which is exactly what those lines count |
| C19 | five new strings |
| C23 | shares the slab that changed |

C7 and C8 are **not** in that table: `check:ui` re-measures them independently
on every run, so they answer themselves. **F4, F7, C5, C6, C19 and C23 need your
read** on whether their
artifacts still stand or need re-capture.

Untouched by the diff: F2, F3, F8, F9, F10, F11, F15, F58, C10, C27, C28, C29,
R6, D4.

## C12 and C13 are newly captured, and C12 hands you a vacuous zero

Both ended in a capture and neither had one; their 09:53 entries said so in
their own titles. `.forge/evidence/c12-c13-verdict-motion.json`, 75 frame PNGs
under `.forge/evidence/motion-frames/`.

**C12's duration is measured, not read.** 219.97 ms and 219.73 ms against a
declared 220, derived by inverting the eased `clip-path` output through the
bezier and regressing wall clock on normalised time, cross-checked three ways.
Opacity 1 on all 50 frames per arrival, 0 changes.

**The width has two answers and the artifact says which it took.** The layout
box is 358 px on every frame, because the wipe is a `clip-path: inset()` and not
a transform, so a box measurement calls it full width from frame 0 and measures
nothing. The painted region runs 0, 109, 202 ... 358. It measured the painted
region.

**C12's second clause is a zero with nothing behind it.** "Count of transitions
off 140 ms or off the curve is 0" measures 0. So does "established transitions
anywhere", and "elements computing a live transition" is 0 of 378 across 6
states and 119 rules. The product has no transitions. **This is the same shape
you refused C11 for**, and it is your ruling, not the lead's.

**C13 is clean and not vacuous.** Travel 0, scale 0, 0 transforms across 51
frames, 0 part-painted frames against 12 with motion allowed. Retention checked
as a 10-property diff, 0 differences. Four controls span both answers.
**Volunteered caveat: light theme only.** C13's own words do not name a theme
and C25 is the theme-parity line, so whether light-only satisfies it is yours to
decide. Note `--fmint` is theme-invariant so OWNED's fill is the same either
way; NOT IN COLLECTION's surface is not.

## C3 is newly measured, and the reading you need is in its artifact

Five of eight pairs rendered and passing, three with **no element in the
shipped product**. `.forge/evidence/c3-contrast-pairs.json`.

The measuring agent closed by calling the three a rubric-versus-product
mismatch for the lead to settle. **I settled it: they are early.** The specimen
sheet comp draws flare on canonical as the "Unverified" and "On 2 variants"
badges, on screen 03, slice 2. The verdicts comp draws flare and mint together
in the market-value box, slice 4. Whether that box is the personal surface is
flagged and not asserted, because market value is public data and the clearly
personal box in that comp is the hatched one.

**The token mapping is in the artifact with the DESIGN.md line behind each
name**, which is what this line needed and never had: canonical is `--case`,
personal is `--drawer`, and `--case2` is the second canonical step. Reading
`--case2` as personal is an error already made once on this line.

## Lines whose evidence expires when a later slice lands

A check is true of the product that existed when it ran. Four of the current
passes are scoped to what is built, and the scope is not visible in the number:

- **C5, C6, C7, C8, C19, R6** are proven over **3 of 7 screens**. Re-run each
  time a screen lands.
- **C7 specifically.** The 145 catalogue rows carry **no interactive target at
  all** today, because the specimen sheet they would link to is slice 2. When
  screen 03 lands, the catalogue gains **145 tap targets in one commit**, and a
  C7 pass taken before that says nothing about them.
- **F5's second clause**, 0 community photographs in the OWNED frame, currently
  measures 0 for two reasons stacked: vacuously, since no photograph exists,
  and structurally, since `PhotoFrame` reads only the device store. **Only the
  structural reason survives slice 5.**
- **C11** is currently satisfied by there being 0 tables in the product. That is
  a zero with nothing behind it.

## A second shape: the adjacent instrument

Distinct from a partly-measured clause, and it produced the newest finding.

**D5, C1 and C17** all want captures at 390, 768 and 1440. Zero captures at 768
exist. This stayed invisible because `check:ui` *audits* at 768 when
`UI_CHECK_WIDTHS` is set, and a green audit at 768 was being read as covering a
capture at 768. `check:ui` writes no image at all: confirmed by grepping it for
`screenshot`, `.png`, `toBuffer`, `writeFile` and `capture`, where the only hit
is a comment. **A tool that measures next to the clause is not a tool that
measures the clause.** The same reading error put "four widths" into
`REPORT.md`, generalising one run's `UI_CHECK_WIDTHS` into the tool's default,
which is two. That row is now corrected.

## Classify a failure before reporting it

Three things look identical from outside and mean completely different things.

1. **Later slice.** F21's provenance marks are named in slice 2's plan; F19's CSV
   in slice 4; R15-R23 in slice 8. **Reporting these as findings at slice 1 is
   noise that buries the real ones.**

   The subtle members of this category are **C1, C17 and D5**, which look like
   craft failures and are not. All three want all 7 screens; 4 exist. 03 is
   slice 2, 06 is slice 7, 07 is **slice 9**, so slice 9 is the earliest any of
   them can close. Their 768 column *was* a real gap and is being closed now for
   the screens that exist. **C18 is the same story**: its date clause is proven
   and its currency clause needs money on a screen, which arrives in slice 4.
   Report these as early, not as broken.
2. **Nothing specifies it.** **F6 alone.** The rubric requires UNCERTAIN to show
   "both photographs side by side"; no slice plan and no design document mentions
   it, and `handoff-screen-01.md` specifies UNCERTAIN exhaustively while naming
   photographs only for OWNED. **This is the most important thing in your
   report.** It cannot be dispatched to a builder and the line cannot move.
3. **Built but partly measured.** The table above. **The evidence file is wrong,
   not the product.**

## Two lines need a reading, not a measurement

Both have their numbers recorded and **nothing was tuned to reach green**.

- **F9.** "Same position on all 3 verdicts": from each slab's edge gives
  20 / 22 / 17 and **fails**; from the verdict word's text column gives
  **[0, 0, 0]** and passes. The slabs carry different paddings by design. The
  lead's reading is the text column. **C23, C8 and C22 were settled by the
  operator at the greenlight; this arose after.**
- **R30.** "One shape", the icon is a full-bleed `<rect>` ground plus one
  `<path>`. Ground-is-not-a-shape passes; a strict count of two fails.

## What is expected to be red, and why that is right

`check:all` fails on exactly two lines, both real, both converging on one
operator decision:

- `check:no-env-values:history`, 2 values (`DATABASE_URL` and
  `DATABASE_URL_UNPOOLED`) in `.env.example`, blob `c27fda2`, from `d685b72`
- `check:no-local-paths:history`, **new today, failed on its first run**: 16
  home-directory paths across 3 files, from `d685b72` and `8add3a4`

Both are history. `check:no-local-paths` itself **passes** over the working
tree, 0 findings across 235 files, and passed throughout: the cleanup was done
and never committed, and a working-tree check cannot report what a working tree
no longer contains. Reading that green as coverage of history is the error the
new check exists to stop. Both commits are pushed to `origin/main`. One rewrite
clears both. **Do not
report these as new findings and do not suggest making them green by other
means.** Values were never printed at any point, by design.

## Defects fixed late, and what to re-check rather than trust

These landed after most evidence was written, so entries predating them may
describe a product that no longer behaves that way.

- **UPC-A scans did not match.** 29 of 30 printed UPC-A symbols resolved to
  nothing; the 30th matched the *wrong* record as a clean single answer. Fixed
  at lookup in `src/lib/identifiers/gtin.ts`, **not** in `normalizeIdentifier`,
  whose parity with a Postgres generated column is load-bearing. **F58's
  earlier pass did not exercise UPC-A**, its test barcode was an EAN-13.
- **A real duplicate**: two entries for one Record Store Day 2LP, escaping
  dedupe by title case, item year and barcode encoding at once. Corrected in
  the seed data so the loader merges them. **Done: the database was rebuilt and
  holds 96 items, 145 variants**, the prediction was recorded before the change
  and held exactly. Cross-form collisions 1 → 0, sources with a local path
  68 → 0.
- **ISBN-10 against ISBN-13 is fixed too**, so the identifier class is closed at
  two members. 7 of 8 one-sided book variants were unreachable; **an agent
  corrected the lead's count of 8**, because the 8th was already reachable via a
  Bookland number stored under a different identifier kind. Reachability is a
  property of a variant, not of a row.
- **Item identity omitted category**, so a strategy guide could silently merge
  into its game. Latent, never fired, fixed before it could.

**F1 to F4, C15 and C29 were re-measured after all of the above**, on a build
verified four ways (dev markers absent, `BUILD_ID` matched disk to served HTML,
prerender header, cache hit). Those entries are current. **F4 reads
`[390, 390, 390, 390, 390]` where it read `[560 × 5]`**, that was the defect.

**The `BUILD_ID` assertion is not decoration.** It fired as a true positive on
first exposure, catching a `next build` that ran under a live server and
refusing to report numbers from the resulting corpse. Dev markers plus prerender
headers are **not** sufficient: port 3100 had both while serving a dead build.

## Instrument discipline

Twelve instrument errors were made and caught in this run, every one by
re-checking a result rather than re-reading code. Three kinds:

- **Silence read as failure**, a grep that missed because npm colourises digits.
- **Emptiness read as success**, two empty sets compared, printing "OK". A count
  of zero deserves the same suspicion as a surprising finding.
- **A wrong slice read as a defect**, a table halved at the wrong row reported
  a dark hover in the light theme; a fill mistaken for a focus ring; the wrong
  surface used for three contrast pairs. **Four false defects were caught before
  filing. The tell each time: the finding was surprising in a way the project's
  own documents did not support.**

**A green result from an instrument that cannot fail is worthless.** Every zero
in this run that means anything has a negative control behind it. Where a claim
rests on a zero with no control, treat it as unverified.
