# Resume

Phase 8, BUILD. Slice 1 of 10. Greenlight approved in words 2026-08-18;
`.forge/ARMED` created 07:57:34Z. The Stop gate is live.

**Goal condition:** every line of `.forge/DOD.md` checked, evidence in
`.forge/EVIDENCE.md`, PASS from the verifier. 130 lines, **0 checked**.

## Verdict, 2026-08-18 18:05

**FAIL. 25 of 130.** C13 newly checked, measured in **both** themes because the
verifier went and measured dark rather than asking for it.

**C3 refused** on "8 pairs, numbers recorded": 5 numbers, 3 nulls. My settlement
of the three as earliness was right as classification and does not reach the
verdict. Both readings are correct and only one decides the box.

**C12 refused**, and the refusal is the substantive finding of the pass. Clause
2 counts off-spec transitions at 0, and so is the count of transitions of any
kind: **a universal over a set the product does not have**. DESIGN.md declares
the 140 ms register; the shipped stylesheet contains the word `transition`
once. See `DEFECTS.md`.

**Two faults in my own documents**, both found by reading. My entry said "817
elements examined" where the artifact it cites says 378, and I carried that into
the brief twice. And the brief had **three sections duplicated verbatim**,
including two "What changed" blocks naming different build ids. 84 lines
removed.

## What actually blocks the 106, classified rather than reacted to

The Stop gate shows the same five lines every rotation and four of them are
blocked, which makes the queue look shorter and more stuck than it is.

| Blocker | Lines | Which |
|---|---|---|
| The live URL | 9 | F1, F62, R2, R3, R7, R17, R18, R24, R33 |
| Photographs, slice 5 | 14 | F5, F6, F12, F45, F49, F51, F52, F53, F54, C26, R16, R19, R25, R31 |
| All 7 screens, 3 exist | 13 | F17, F56, F57, C1, C2, C4, C14, C15, C16, C17, C22, C25, D2 |
| Later slices | most of 70 | F18 to F55, R8 to R32, and the rest |

**Two are blocked by nothing: C12 and C13.** In flight now. Both were measured
statically this morning and both entries end with "capture outstanding", which
is why they sat: an entry that names its own gap reads as substantial, and the
gap is the last word of the rubric line rather than anything in the numbers.

## Next action

**Nothing is in flight and nothing measurable remains.** Swept every unchecked
line's own evidence for hedges, which is how C12 and C13 were found; ten hedge
and all ten are blocked. R26 was the last candidate and is one clause short of
closable: its route half is fully measured, and the missing clause is the About
page, which arrives in slice 8.

1. **Blocked on you:** the deploy (9 lines directly, more behind), and R4's
   pushed half. `.forge/OPERATOR.md` has the sequence.
2. **Blocked on a designer:** the 140 ms transition register, which C12 needs
   and which risks C29, already checked. See `DEFECTS.md`.
3. **Blocked on slice 5:** F5, F6 and C20, one absence wearing three numbers.

## Where the build stands

`.next` holds **`YzDsr6hHAGTXS-1fwnrSm`**, mtime 15:52:25.

`check:all`: **7 green, 3 red**, and no red is a surprise. `check:ui` on C26
clause 1 (4 rules setting font or background without colour). The two history
checks on R4, awaiting your decision. **Two of those three gates did not exist
this morning**, and both found real things the moment they were wired.

## Coverage

`npm run coverage:map`. **No count is repeated here**, because I have now
corrected the same figure in this file twice, and a number written into prose
is a number that is wrong by tomorrow.

Three things the map cannot tell you, printed in its own header:

- A claim is not a pass.
- NO EVIDENCE does not mean missed. A line whose screen or slice does not
  exist yet reads identically to one nobody looked at.
- **The count is an upper bound.** It reads the line id an entry claims, not
  what the entry is about. F52's single entry is an ISBN cross-form result
  filed under the wrong number, so F52 shows covered and has nothing.

## Lines that will not close in slice 1, and why

**C18 is PARTIAL and must not be read as passing.** The date clause is proven:
`18.08.2026` against `18/08/2026`, same calendar day, identical clock time
`14:27:45`, time zone pinned to Europe/Berlin so the difference is format and
not a date boundary. The integer clause is correct-but-identical, and is only
meaningful because of the in-page divergence control resolving 1234 to `1.234`
against `1,234`. But the line as written demands a capture showing
`1.234,56 EUR`, and no money renders anywhere until slice 4 brings market
value. When slice 4 lands, only the currency capture is missing.

Note for whoever reads the artifacts: `c18-catalogue-de-DE.png` and
`c18-catalogue-en-GB.png` are **byte-identical**. That pair proves nothing on
its own and is indistinguishable from a locale switch that never applied. The
divergence control and the differing check captures are what make it a reading
rather than a null result.

**D5 failed today and no line had recorded it.** Of the 70 captures then on
disk, 33 were at 390, 3 at 1440, and **zero at 768**. It was invisible because
`check:ui` audits 768 when `UI_CHECK_WIDTHS` is set but writes no image at all,
so a green audit at 768 was being read as covering a capture at 768. **An
instrument that measures next to a clause is not an instrument that measures
the clause.**

**Correction applied to REPORT.md:** its check table said `check:ui` covers four
widths. The default is two, 390 and 1440. Four was true of the C7 sweep, which
set the variable, and one run's settings had been generalised into the tool's
description.

**D5 does not fail alone.** C1 ("all 7 screens at 390, 768 and 1440 in the dark
theme") and C17 (the same three widths at 40 percent text expansion) carry the
identical requirement. All three are blocked on the same two facts, and the
second is the harder one:

| # | Screen | Route | State |
|---|---|---|---|
| 01 | Aisle check | `/` | built |
| 02 | Catalogue | `/catalogue` | built |
| 03 | Specimen sheet | not routed | slice 2 |
| 04 | My collection | `/collection` (+ detail) | built |
| 05 | Public profile | not routed | slice 6 |
| 06 | Contributor | not routed | slice 7 |
| 07 | Landing | not routed | **slice 9** |

**Three of seven exist**, and two route names mislead. `/` is the aisle check,
not the landing. And `/collection/[publicId]` is **not** screen 05: the segment
is named `publicId` for routing consistency, but it carries the on-device
copy's own id, because an anonymous offline-first copy has no server-issued
public id. It is a detail view inside screen 04. I mapped it to 05 by its name
and the capture agent checked the source instead of taking my word.

So the earliest C1, C17 and D5 can close is **slice 9**.
The 768 column is now closed for all three built screens: 42 captures,
7 screen states by 2 themes by 3 widths, every width read back from the PNG's
own IHDR rather than from the viewport that was requested, 0 disagreements.
That was the part that was actually behind rather than merely early.

## Six lines re-measured on a verified-clean build

Target asserted four ways before any number was trusted: dev markers absent,
`BUILD_ID` matching disk to served HTML, prerender header, cache hit.

| Line | Result | Was |
|---|---|---|
| F1 | **11.35 ms median, 13.4 max** vs 250 cap | 10.0 / 10.9 |
| F2 | 10 verdicts, **0 requests, absent not cached** | 0, but no SW existed |
| F3 | **2353.1 ms** clearance, 1 request in flight | 2349 ms |
| F4 | **[390 × 5]** | **[560 × 5]**, the defect |
| C15 | **0 app errors across 5 screens** | 0 across 1 of 7 |
| C29 | 16 frames, **0 wrong**, control caught 1 of 5 | same |

**F2 now answers the line.** Three counters over one window; the discriminator
is that *a cache hit answered by a worker still writes a
`PerformanceResourceTiming` entry, a fetch never attempted writes nothing.*
Calibrated with a deliberate fetch returning `transferSize 0, workerStart
111.2ms`, a real worker cache hit the counter saw.

**The `BUILD_ID` assertion fired as a true positive on first exposure**, catching
a build that ran under a live server. Dev markers plus prerender headers are
**not** sufficient: port 3100 had both while serving a dead build.

## Live database rebuilt, and the prediction held exactly

`npm run db:reset-catalogue` (new, refuses a non-local target) emptied 97/146,
then `db:seed` rebuilt from all 5 research documents.

**96 items, 145 variants, 173 identifiers, 213 sources, 414 verifications.**
Predicted hours earlier as 96/145, in a form that could have proven me wrong.

- **Cross-form barcode collisions 1 → 0.** The Record Store Day duplicate has
  collapsed into ONE variant carrying both encodings and both sources.
- **Sources holding a local path 68 → 0.** Every in-hand photograph source now
  reads `urn:vitrine:in-hand-photograph:`.
- Sources fell 360 → 213 with verifications unchanged at 414: that is
  source-reuse-on-full-tuple-match working, not data lost.

`check:all`: all data checks green. Still failing on exactly the 2 known lines,
the 8 stale evidence artifacts (regenerate in the browser pass) and the R4
history finding (**yours**).

## The identifier class is closed at two members, both fixed

- **GTIN.** 29 of 30 printed UPC-A symbols resolved to nothing; the 30th matched
  the *wrong* record as a clean single answer. Proven end to end with a real
  decode and a negative control.
- **ISBN.** 7 of 8 one-sided book variants were unreachable from the form a
  collector would present. **The builder corrected my measurement of 8**, the
  8th was already reachable via a Bookland number stored under a different
  identifier kind. Reachability is a property of a variant, not of a row.
- **Composed, not tangled.** `lookup.ts` is the only place the two rules meet;
  a `978…` value yields its ISBN-10 and never a 12-digit strip, a `979…` yields
  nothing, a plain EAN-13 yields nothing.
- **Residual risk named and measured:** ~1 in 11 arbitrary 10-digit numbers pass
  a mod-11 check. This catalogue holds 3 such non-ISBN values; **none closes mod
  11**, and all 3 are pinned as a test so a grown catalogue is re-measured.

**111 tests pass**, up from 68 this morning.

## Four things need the operator, and none blocks the build

1. **R4, and only part of it is yours to decide.** The remote holds `d685b72`
   and nothing after it, confirmed with `git ls-remote` rather than the local
   tracking ref. That splits the leak into two very different costs:

   | Commit | Pushed | Carries | Cost |
   |---|---|---|---|
   | `d685b72` | **yes** | 2 env values, 1 path in `.forge/ASSETS.md` | rewrite plus **force-push** |
   | `8add3a4` | no | 15 paths in two evidence JSONs | local rebase only |

   **16 paths in 3 files, where this file said "1 home directory".** Found by a
   new check, `check:no-local-paths:history`, which failed on its first run: the
   env-value check had a history twin and the path check did not, so nothing in
   the suite could see a path committed and later cleaned. Most of the leak by
   count is in local history and needs no decision from you. Only `d685b72`
   does. Low severity either way: private repo, localhost credentials.
   Committing the current tree fixes what happens next, not what is stored.

2. **Neon, the auth secret, R2.** Then deploy. **Unblocks ~30 of 130 lines**:
   F1 to F5, R1 to R5, R7, R15 to R23 all begin "on the live URL".
3. **How wide should a test-row guard reach?** `check:no-fixture` matches
   slugs prefixed `fixture-` and `created_by` prefixed `fixture:`. A category
   named `sync-convergence-test-category` and items created by
   `test:sync-convergence` pass it, and one such row had survived every run.
   The teardown is fixed. Widening the pattern to `test` or `sample` would
   catch it and would also flag a legitimate future category, since a real
   catalogue could hold something like screen-tests. The durable fix is
   **marking test rows in the data** rather than inferring them from a name,
   which is a schema change. Your call: widen the pattern, add the column, or
   leave it and rely on teardowns.
4. **A dangling reference in the plan.** Slice 1 closes on "the A1 through A4
   clean-session capture series", and **there is no A series**. The string `A1`
   appears exactly once in all of `.forge/`, in that sentence, and is defined
   nowhere; the rubric's prefixes are F, C, R and D only. The intent almost
   certainly became F1, F2, F4 and F10, which are all measured, but the
   renumbering that would prove it is not recorded, so that reading is
   plausible rather than evidenced. Nothing is gated on it: the DOD is the
   contract and the DOD has no A lines. Either confirm the mapping and I will
   amend PLAN.md to name the four lines, or say what the series was.

## Three categories of "not done", which look identical from outside

The coverage map cannot tell these apart; all three read as an unchecked box.

1. **Later slice.** F21's provenance marks (slice 2 by plan), F19's CSV (slice 4),
   R15-R23 (slice 8). **On schedule. Reporting these at slice 1 is noise that
   buries the real ones.**
2. **Nothing specifies it.** **F6 alone, in 130 lines.** The only category
   needing a decision. That it has one member and not ten is the reassuring
   result of the audit.
3. **Built but partly measured.** R4, C23, R20, F10, F12, F15. **The evidence
   file is wrong, not the product.** Lead's bookkeeping, no permission needed.

**The verifier should classify a failure before reporting it.**

## Clause audit, and what it found

**39 of the 68 evidence-carrying lines hold 2 or more clauses.** A multi-clause
line is one a partial reading satisfies while looking complete. Auditing them
found **5 real gaps that no test surfaced**, plus one cluster:

| Line | Measured | Also asks |
|---|---|---|
| R4 | 0 values in the working tree | names in `REPORT.md`, **now written** |
| C23 | font size at 390 px | **and at 1440 px**, on the build not a comp; and "live text, never an image" |
| R20 | no external hosts | **and 0 storage items** beyond those the privacy notice names |
| F10 | verdict in 97 ms, 2 taps | **and a saved copy**, over **5 timed runs** |
| F12 | thumbnail slot, no-photo state | a real image (blocked, see cluster) |

**The common shape:** in every case a real measurement existed and was correct,
and answered a NARROWER question than the line asked. Not sloppiness. The
failure is reading a line once, extracting the clause easiest to measure, and
remembering the line by that clause. More dangerous than a wrong number, because
a wrong number invites scrutiny and a partial answer invites none.
**The verifier should audit clauses, not entries.**

**The photo cluster: 5 obligations, one missing path (slice 5).** F5's first
half; F12's thumbnail clause; R25's re-inventory; R10 and R11 for the 68 in-hand
sources; F51's EXIF stripping. Each was recorded as a separate deferral and they
are one dependency. **Slice 5 is worth more to this rubric than its plan
position suggests.**

**R20's storage inventory, recorded now so the slice-8 privacy notice is not
written from memory:** localStorage `vitrine:theme`; IndexedDB `catalogueIndex`,
`draftEntries`, `meta`, `outbox`, `photos`, `userCopies`; Cache Storage
`vitrine-v1-shell`, `vitrine-v1-runtime`; **cookies none**, which matters because
a cookie is what would force the banner R20 forbids.

## F9 needs a settled reading, and it is the operator's

"its age prints under the verdict in the **same position** on all 3 verdicts."
Two readings, opposite verdicts, nothing tuned:

- **Inset from each slab edge:** OWNED 20, UNCERTAIN 22, NOT IN COLLECTION 17,
  **fails**
- **Offset from the verdict word's text column:** [0, 0, 0], **passes**

They differ because the slabs carry different paddings by design (`.v-own` 20,
`.v-unc` 20 inside a 2px dashed border, `.v-not` 16 inside a 1px border).
Identical insets need one shared padding, contradicting the design and leaving
the age line unaligned with the verdict word in two of three slabs. **The lead's
reading is the text column**; C23, C8 and C22 were settled by the operator at the
greenlight and this one arose after.

## Counting coverage: the method, because the first attempt was wrong

Grepping the whole EVIDENCE.md body for a line id counts *mentions*, and the
entry that records "these lines have no evidence" names every one of them, so
the record of the gap disguised the gap. Match only the line-id field, the
second pipe-delimited column. `npm run coverage:map` does this correctly; the
live numbers are at the top of this file and are not repeated here, because a
count written into prose is a count that is wrong by tomorrow.

## Landed since the last refresh

- **390 px overflow FIXED.** scrollWidth 390 at 390, measured at 320/390/768/1440
  in both themes, overflowCount 0 in all 8 combinations. Cause was the theme
  switch's three flex children needing 568 px of min-content in a row that could
  not wrap. Fixed structurally, and deliberately **not** with `overflow-x: clip`,
  which would have made the number read 390 while the content stayed cut.
- **Light theme contrast defect FIXED.** `.lt` redefined 13 of 14 ground tokens
  and missed `--g2`, which the nav uses: light theme rendered a near-black band,
  recomputed at **1.08:1**. Now 14.99:1 light, 16.98:1 dark. **It was visible in
  the F4 evidence PNG and the lead did not see it**, which is the argument for
  measuring every pair rather than eyeballing captures.
- **C29 PASSES.** 16 frames across 4 stored states, 0 in the wrong theme, against
  a verified production server. Two details make it credible: the tab is painted
  magenta before navigating, so `about:blank` white cannot be mistaken for a light
  flash; and a **negative control** injects a deliberate one-frame flash and the
  harness catches it. Four zeroes from a blind instrument would be worthless.
- **C19 em dash clause CLOSED** in code, seed files and database. 32 in data to 0.
  The database update was necessary rather than cosmetic: **title is part of item
  identity**, so fixing the files alone would have made the next seed insert 8
  duplicates.
- **C3: all 8 pairs computed, all pass**, tightest dark edge 4.32 against a 3.0
  floor. Token math only; the line says "measured against the built interface",
  so a browser pass is still owed.
- **Static Craft lines measured and re-verified after the fix:** C5, C6, C9, C10,
  C12, C13, C14, C26 pass. **C20 fails**, fix in flight. D1 and D4 pass.

## State, measured from SQL and from a production build

**Catalogue, after loading all four research documents:** 89 items, 129
variants, 173 identifiers, 337 sources, 391 verifications, **13 populated
categories**. `scripts/db/seed.ts` now loads every `.forge/research/seed-*.json`
in fixed order, not just `seed-starter.json`; a second full run inserts **0**
across all four files, so merge-on-dedupe is idempotent on real data.

**Against R8:** items 89 of 220, variants 129 of 380, **categories 13 of 12 MET
AND EXCEEDED**, handed-out 29 of 60. Provenance: retail 100, promotional 18,
press 9, preorder_bonus 2, **`convention_exclusive` 0**.
**R8 requires all 5 provenance types present, so that zero is a categorical
blocker: one verified convention-exclusive row is worth more to the line than
fifty retail variants.** The seam is hard because comics.org (403) is where SDCC
variant covers live; the current pass is trying Wayback snapshots instead.

**Checks, all against the loaded catalogue:** barcode 51 rows / 0 failures;
verification 89 + 129 + 173 rows, 0 missing; sources 337 with URL and
retrieved_on, 391 verifications all resolving, 0 failures; no-fixture exit 0
(informational on a local target, which is correct). **`check:all` exits
non-zero for exactly one reason: the R4 history finding**, which is real and
awaiting the operator.

**Client and offline shell: working, validated against a PRODUCTION build** on
port 3100, not `next dev`. Service worker registers, activates and precaches.
F16 renders the real app offline on 5 routes including a never-visited one.
F12 0 of 5 failed. F13 survives hard reload. F10 cold offline verdict in 97 ms.
F1 paint median **10.0 ms**, max 10.9 ms against a 250 ms cap.

**Sync converges.** Tombstones for status change, epoch for wholesale rebuild.
Device index 1 to 0 on tombstone; stale index converges via epoch and the row
count cross-checks against SQL.

**R10 has a hole to remember:** it names four row types and the check covers
three. `bundle_component` is **unbuilt**, not merely unchecked. Extend the check
when bundles land or it will report a false all-clear over a table it never
looked at.

## Open defects

1. **390 px overflow.** `documentScrollWidth` 560 at a 390 px viewport, all five
   verdict states, verdict word clipped mid-word. Fix in flight. **The design
   comps were swept clean of exactly this and the build reintroduced it.**
2. **Intermittent** `Router action dispatched before initialization`, 2 of 6
   runs, only under F3's throttled cold reload. Stack capture wired. C15 risk on
   slow connections only.
3. `sendOp` retries forever with no backoff on a permanent server error. Right
   bias for slice 1, **must not survive into slice 3**.
4. No photo capture path, so F5's first half is undemonstrated. Slice 5.
   F5's second half is already structurally guaranteed three ways.

## Reading errors to not repeat, three in one hour

All three produced a confident finding. All three dissolved on re-reading the
source I had already cited. The shape is identical every time: **a rule read
wider than its own sentence, or a corpus searched narrower than the question.**

1. **F58.** "No test exercises scanning." I searched `tests/` twice, the second
   time with a differently worded grep that felt like corroboration. The scan
   harness is 357 lines under `.forge/evidence/scan/` with its own runner. One
   grep of EVIDENCE.md for `F58` would have returned nine entries.
2. **C9.** ".card is a settled surface missing its cut." DESIGN.md defines
   settled as a *state* (`--mint` settled, `--flare` unsettled), not as any
   raised panel. `.btn.sec` is a bordered box specified with no cut, which makes
   uncut containers a documented category.
3. **`.btn.pri`.** "8px diverges from the handoff's measured 10px." The
   stylesheet's precedence comment scopes its exception to *the verdict slab*
   and nothing else, so 8 follows the rule as written.

**The check that would have caught all three costs one minute:** before filing,
re-read the exact sentence that grants the rule, and name the corpus the search
actually covered. A negative search result is a fact about where you looked.

## Dispatch errors to not repeat

- **The `scout` agent type has no Write tool.** Its tools are WebSearch, WebFetch
  and Read. Two catalogue passes were dispatched to it with a brief telling them
  to write a JSON file, which neither could do; the first returned its whole
  batch inline and the lead wrote the file. **Dispatch research that must produce
  a file to an agent type that can write one**, or tell the scout to return the
  JSON inline and budget for the reply length.
- **A batch of one-variant items makes R8 harder, not easier.** Batch 02 landed
  at 1.08 variants per item against the 1.73 required and pulled the catalogue
  average from 1.41 to 1.33. Category coverage and variant depth are different
  targets and a pass aimed at one can lose ground on the other. Say which target
  a dispatch is for.

## Latent traps, found by inspection before they were built

- **`global-error.tsx` escapes the root layout.** It does not exist yet. When it
  is added, and F16 and C15 will want it, Next.js requires it to render its own
  `<html>` and `<body>`: it **replaces** the root layout rather than nesting in
  it. The Footer is mounted once in the root layout, so a global error boundary
  would be the one route in the product with **no disclaimer line**, failing
  R26 and C24 at exactly the moment nobody is looking at the footer. Whoever
  adds it must render the disclaimer inside it, and the theme init script too,
  or C29 flashes there as well. `not-found.tsx` and `error.tsx` do nest and are
  safe.

## Dispatch rule added 2026-08-18

- **Name the shared resources, not just the files.** The database is shared,
  appears in no file list, and two agents needed it at once. Use a throwaway
  schema from the real migrations; rewrite drizzle-kit's `"public"."variant"`
  prefix or it resolves against the real tables and passes for the wrong reason.

## Dispatching: scope for the proof, not the build

Six agents hit their turn ceiling in this run and **every one stopped at the
same transition**, from building to proving. "Let us verify the test data was
cleaned up." "Now the after measurement." "Now the end-to-end spec." The modules
and unit tests land; the budget runs out before the evidence does.

**That is the expensive half to lose**, because proving is where the real
defects surfaced: the `global-error` theme wipe that survived re-inlining the
theme script, the mid-wipe capture that invents a defect, the 29-of-30 UPC-A
failure, the stale-slab read that would have faked a pass.

- **Scope a brief on the proof, not the change.** Verification costs roughly as
  much as implementation here.
- **Resuming works and costs one message.** Say where they stopped, and name
  **what moved outside their territory while they worked**, an agent returning
  to a changed codebase will otherwise report something no longer true.

checkpoint: 2026-08-18T17:03:02Z (SessionEnd)

checkpoint: 2026-08-18T17:03:06Z (SessionEnd)
