# Defects, and what is actually still open

`.forge/EVIDENCE.md` is append-only, which is right: an entry is a record of
what was true when it was written, and editing one destroys the thing that
makes it evidence. The cost is that an entry titled **"(open)"** stays titled
"(open)" for the rest of the run, and a reader working down the file will
report closed defects as live ones.

Two did exactly that today. `SYNC PROTOCOL DEFECT (open, slice 1)` at 09:08 and
`SLICE 1 IS NOT COMPLETE: camera scan absent` at 10:32 both read as open and
both are fixed. This file is the index that stops that. It carries no evidence
of its own: every row points at the entry that does.

**Status here is a claim by the lead, not a verdict.** The verifier is the only
actor that decides whether a fix satisfies a rubric line, and a defect being
closed is not the same as its line passing.

## Closed, and re-verified today against the build

| Defect | Was | Verified closed by |
|---|---|---|
| Route error boundaries missing (D3) | a thrown root layout rendered a browser default | `src/app/error.tsx`, `global-error.tsx`, `not-found.tsx` all present. The subtler half also holds: `global-error.tsx` sets `className` from a lazy `useState` reading the stored choice, so a light collector no longer gets a dark error page when React renders fresh and wipes the script's class. |
| Camera scan absent while the UI promised it | no `getUserMedia`, no `BarcodeDetector` anywhere in `src/` | `src/components/check/ScanControl.tsx`, 357 lines, native `BarcodeDetector`, imported and rendered at `CheckScreen.tsx:17` and `:245`. |
| Sync protocol had no deletion mechanism | 123 device rows against 74 server variants; one identifier matched 4 rows and produced a phantom "2 more releases also match" | tombstones (`isLive: false`) and a server-stamped `sync_epoch` (migration 0002), both ends: `src/app/api/sync/index/route.ts`, `src/lib/device/syncProtocol.ts`. |
| Stale camera confirmation | "Scanned with the camera" survived a later typed check, so the screen lied about provenance | derived from `activeIdentifier` and asserted in the harness. |
| UPC-A scans did not match | 29 of 30 resolved to nothing and **the 30th answered wrong** | the identifier-equivalence class, closed at two members, `src/lib/identifiers/`. |
| Item identity omitted category | a strategy guide could silently merge into its game, reported as a *skip* | `src/db/seed/loader.ts`, identity is franchise plus category plus title plus subtitle plus release year. |
| 68 sources cited `file://` paths on the operator's machine | a home directory in the catalogue data, bound for the hosted database | 0 in the working tree, `npm run check:no-local-paths` over 235 files. |
| C7, four tap targets at 23.4 px | 384 findings over a 96-combination sweep | 0 violations, and the fix used `text-decoration` rather than padding so four nav links did not become four dividers. |
| `sync-convergence-test-category` outlived every test run | the test's teardown deleted its franchise and items but never its category, and `check:no-fixture` matches `fixture-` prefixes so it could not see the row | teardown now deletes it, slug hoisted to a constant; verified by running the test, categories 15 to 14 |
| C26's 2 hand-written colour literals | `theme.ts` copied `#0b1020` and `#edf0f7` out of the stylesheet by hand | generated from `--g` by `scripts/gen/theme-colors.mjs`; `check:theme-colors` fails on drift, controlled both ways. **The line stays unchecked**, see below |
| "Back Back to your collection" | an accessibility key holding the literal word "Back", printed beside a label that already said it | `CollectionItemScreen.tsx:82` renders one label, orphaned key removed, `tsc` clean. |

## Open, and needing nobody but us

| Defect | State |
|---|---|
| **The offline banner is unverified on real hardware** | Verifier's flag, and it verified the cause rather than guessing. Under Playwright, `navigator.onLine` reads `true` on a document navigated to while already offline, so the banner never appears in those frames. `OfflineBanner.tsx` reads `navigator.onLine` at mount and subscribes to both events, so the absence is the harness. **It could not be proven from here. Confirm on a device before launch.** |
| **F12's thumbnail clause is unreachable, verified not assumed** | `photoBlob` is written only in `src/lib/device/collection.ts`, its one caller at `CheckScreen.tsx:152` passes none, `src` carries no file input and no capture control, and the photo store holds 0 rows. So 4 of 5 clauses render with **0 failing of 4, not 0 of 5**. F13 and F16 are now checked; F12 closes when slice 5 lands the upload path. |
| **(closed) F13 and F16 needed measuring a third time** | They were moved off the stale port 3100, and onto `7JzsJmX3Ve24jbZ-g46Vt`, which the rebuild then superseded. `CollectionThumb.tsx` is one of the nine changed files, it **is** F12's thumbnail route, and it renders inside the collection screens F13 and F16 captured offline. My own brief described these as "re-measured on the live build" while its table twenty lines lower said otherwise. |
| **F7's "both outcomes" may be unexercised** | Verifier's flag. Both candidates of the fixture were unowned, so both picks resolved to NOT IN COLLECTION. It checked the clause on the two-candidates reading. If "both outcomes" means the OWNED resolution and the NOT IN COLLECTION resolution, that clause has never been run. |
| **Offline, an unknown address renders the check screen** | `/no-such-route` and a never-visited `/collection/{id}` both come back as "Aisle check" with the network disabled; online the same two correctly render "That page is not here." and "This copy is not on this device." A comment in `public/sw.js` claims the shell fallback lets React hydrate "this pathname's own client route". It does not: the shell **is** the check screen's document. **F16's count is unaffected and stays 0**, because the check screen is a designed product screen, not a browser default, which is exactly why it survived. Under rule 2 it still fails: a collector who mistypes an address offline gets a working screen and never learns the link was dead. Fixing it changes the offline boundary, so it needs a measurement against F10's 161 ms cold open. |
| **F6 is built and still refused, on a clause no build can reach** | I escalated it as unspecifiable, which was wrong: the approved comp draws every clause. It is now built and captured, and the verifier refused it anyway. Two frames sit side by side and the `img` count inside them is **0**. **No photograph can exist anywhere in the product**: `addCopy` accepts a blob, no file input exists, no camera-still path exists, and the single call site passes nothing. F6 moves from "nothing specifies it" to **later slice**, not to done. My "dispatchable today" was half right, and the half that was right is now built. |
| **C20 refused at 56 px, and the ruling is on the record** | The 318 px frame now carries 2 visible text nodes and names its action. The 56 px `.thumb.np` carries 1, reading "No photo", and names none. **The verifier ruled a 56 px thumbnail IS an empty state**: same `.np` class, same `--nil` surface, same hatch, in the slot a photograph would occupy, and C20 carries no size exemption. Count of empty states without a next action is 1, not 0. Also: the census on record covers 2 empty states and **at least 6 exist**; the other four were rendered and all four name an action. |
| **C26 fails both clauses, and clause 2 was ruled against me** | Clause 1: 4 rules set font or background without colour (`.mono`, `.scanh`, `.thumb`, `.vword`), now visible because the gate was wired. Clause 2: **the verifier ruled a generated file is NOT inside "the token definitions"**. A generator plus a drift check reduces the risk the copy diverges; it does not reduce the count, and the line was drawn on the count. Both literals ship in the document head, confirmed by fetching the live document. Clearing them costs the no-JS theme-color path: **a design decision, not a lint fix.** |
| **`check:ui` never asserts what content it audited, and for two routes that content is a race** | Each combination opens a fresh context with no IndexedDB. `/collection` is definitively empty (nothing calls `addCopy`). `/collection/[publicId]` is definitively not-found (the segment becomes `check-ui-sample`). But `/` and `/catalogue` depend on whether `CheckScreen`'s best-effort background sync landed before the audit ran, and `settle()` waits a flat 150 ms without checking. **A clean report from a run that saw rows and one from a run that saw none are identical.** Every count from that sweep inherits this, C7's 96 combinations included. Fix: assert a row count, or seed the store. |
| **The populated collection-item screen has never been audited** | Same root cause, and it is why "Back Back" survived: the audited not-found branch renders the label correctly and the broken populated branch sat one conditional away. |
| **Two message keys describe behaviour the approved comp draws and the build omits** | `verdict.owned.addedOn` (the comp's OWNED slab reads "In your collection since 12 March 2019"; the build reads "Already in your collection") and `verdict.uncertain.pick` (the comp's candidates carry "This one"). **Corrected by the verifier:** `verdict.uncertain.differs` is NOT unbuilt behaviour, it is the retired field-name list that the difference sentence replaced, and the build renders a real sentence. `verdict.owned.quantity` and `check.checkAnother` are unbuilt but no line and no comp names them. Run `npm run orphan:strings`. |
| **C20's no-photo state has no visible words** | Unchecked by the verifier after I raised it. At 390 px the frame is 318 x 238.5 px with **0 visible text nodes** and one string clipped to 1x1. The comp writes the fix: "No photograph filed for this entry. Yours would be the first." Dispatched. |
| **C26 has no gate in the suite, and half of clause 1 is unmeasurable** | `check:ui` reads neither `inheritColour` nor `literalHex`, so both clauses are computed by the audit and discarded. Inside the audit, `setsSurface` (background OR font, matching the clause) is computed and unread while `isContainer` (background only) is used. Measured by hand: 2 rules set background without colour, 2 set font without colour, and `.vword`, the verdict word, inherits its colour from the slab. Queued in `NEXT-BROWSER-PASS.md`. |
| **C9 clause 2 has no inventory, which is why it is refused** | I built one, then **corrected my own conclusion**: I read "settled surface" as any raised panel, but DESIGN.md defines settled as a *state* (`--mint` settled, `--flare` unsettled). `.btn.sec` is a bordered box specified with **no cut**, structurally the same as `.card`, so an uncut container is a documented category rather than an omission. Clause 2 may well be 0. The inventory stands; my non-zero claim does not. Unaffected: `.cut12` is dead CSS with 0 uses (**not** `.scanNote`: it is live at `ScanControl.tsx:350` via a template expression my literal-`className` grep could not see), and `.btn.pri` renders at 8px where the handoff specifies 10px. |
| **The verdict panel diverges from the comp in 5 places** | The handoff's verdict table has six columns and none of them is body copy, so copy the comp draws had nothing to carry it into the build. Only one of the five is a rubric failure (C20). A systematic comp-versus-build copy audit is the right next step. |
| **`check.cacheAge.fresh` unreferenced** | possibly deliberate: F9 is worded around the stale case only. Needs a decision, not a fix. |
| **15 home-directory paths in `8add3a4`** | local commit, not pushed. A rebase clears it. No force-push, no operator decision. |

## Open, and waiting on the operator

| Defect | Why it cannot move |
|---|---|
| **The 140 ms transition register is declared and not built** | DESIGN.md:72 and :78 say "everything travels 140ms" and "Every other transition is a 140ms wipe". The shipped stylesheet contains the string `transition` **once**, the reduced-motion neutraliser. C12 clause 2 counts off-spec transitions at 0 and the verifier refused it: a universal over a set the product does not have. **The build documented its choice** at `globals.css:396-405`, because a token-driven transition also fires on the theme class toggle, which C14 counts at 0 and **C29, already checked**, would be at risk from. Not contradictory: scoping the transition away from token-driven properties satisfies all three. Either build it that way and **re-measure C14 and C29 rather than assuming**, or amend DESIGN.md. What must not happen is the design declaring a register the product does not want. |
| **`d685b72` history** | 2 env values plus 1 path, pushed to `origin/main`. Clearing needs a force-push. |
| **"A1 through A4" names nothing** | slice 1's closing conditions cite a capture series that is defined in no document. The rubric's prefixes are F, C, R, D only. |

## One absence wearing three rubric numbers

**F5, F6 and C20 all fail for the same root cause: no photograph can exist in
this product.** `addCopy` accepts a blob, no file input and no camera-still path
exist anywhere in `src`, and the one call site passes nothing.

- **F5** wants OWNED rendered over the user's own cached photograph.
- **F6** wants both candidate photographs side by side. The layout is built and
  captured; the `img` count inside the two frames is 0.
- **C20** wants every empty state to name its next action. The photo empty
  state's action, at either scale, is one nobody can perform.

Worth seeing as one thing when slice 5 is planned, rather than as three lines to
chase separately. **The 56 px thumbnail is not a copywriting problem.** Every
empty state that passes names something a collector can do now: run the aisle
check, clear the search, connect to the network once. Inventing a string that
fits 56 px and points at an absent capability would satisfy a word count and
soften the line.

## Not defects, though they read like them

**C3** joins them. Five of its eight contrast pairs are measured on real
rendered elements and pass. The three with no element are not a rubric error:
the specimen sheet comp draws flare on the canonical surface as "Unverified"
and "On 2 variants" badges (slice 2), and the verdicts comp draws flare and
mint together in the market-value box (slice 4). **Nothing about the line needs
amending.**

A trap for whoever re-runs it: in light, `--g2` and `--drawer` resolve to the
same hex, so the mint wordmark reads 5.06 against `--g2` and a **value-based**
reading files it as pair 6 passing. It is painted by `.topnav`, not by any
personal-surface rule. Credit each background to the rule that painted it.


**C1, C17 and D5** all want 7 screens at 390, 768 and 1440. Three screens
exist. 03 is slice 2, 05 is slice 6, 06 is slice 7, 07 is slice 9. The 768
column was a real gap and is now closed for everything built; the rest is
earliness, not breakage. **C18** is the same shape: its date clause is proven
and its currency clause needs money on a screen, which arrives in slice 4.
