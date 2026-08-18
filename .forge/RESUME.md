# Resume

Last phase: 6. GREENLIGHT **approved by the operator in words on 2026-08-18**.
`.forge/ARMED` created at 2026-08-18T07:57:34Z. The Stop gate is live. Now in 8. BUILD.

Goal condition: every line of `.forge/DOD.md` checked, evidence in
`.forge/EVIDENCE.md`, and a PASS verdict from the verifier agent.

Next action: slice 1, the aisle check signed out and offline, through the builder
agent. Record evidence with `scripts/evidence.sh` as each line closes. **The verifier
alone flips checkboxes**, and only against evidence.

## The rule that was broken once and must not break again

A `/goal` paste is not approval. Approval is explicit words. If the goal arrives while
the gate is open, say so, keep waiting, and never create ARMED. The evaluator's push
never outranks the gate. On 2026-08-17 a paste was treated as approval, ARMED was
created at 20:00:47Z, and the run built behind a gate nobody had opened. It was undone.

## Settled by the operator, in words

- Name **Vitrine**. Host: the Vercel subdomain, no domain registered.
- Direction **Chromatic Era**, dual theme, light and dark, three-state switch.
- **Three rubric readings, 2026-08-18.** C23 keeps 26 to 46 px and the design came down
  to meet it. C8 reaches margin and padding, not `gap`, recorded as a known hole. C22
  counts surfaces, and a hover is a state. All three are at the head of DOD.md. No
  threshold moved and no line text changed.
- **The pre-gate scaffold is removed**, at the operator's instruction, so the build
  starts from nothing.

- **All eighteen amendments**, recorded in `.forge/AMENDMENTS.md`, including the two
  that were not neutral: F62 and R7 becoming OPERATOR lines, and R14 dropping from four
  processor contracts to three. The rubric is closed to amendment. From here it is
  verified, not negotiated.

## The gate, closed

Approved in words on 2026-08-18, after being wrongly armed once on 2026-08-17 and
rolled back. The record of that failure and its correction is in `.forge/AMENDMENTS.md`
and stays there.

The rubric is closed to amendment. From here it is verified, not negotiated. No line is
softened to reach PASS: on two FAILs of the same slice the builder is re-dispatched a
model tier higher, on three the slice goes back to the architect. The bar never moves,
the resources do.

## Rubric state

130 lines, all unchecked: 62 Function, 30 Craft, 33 Release, 5 Disqualifiers.
Zero residual Field Registrar token vocabulary. OPERATOR lines: R14, F62, R7.
The verifier alone flips checkboxes, and only against evidence in EVIDENCE.md.

## Working tree

Clean. Zero product source, one commit (`7732f85 forge harness`), nothing deployed.
Removed 2026-08-18: `package.json`, `package-lock.json`, `node_modules/`,
`next.config.ts`, `tsconfig.json`, `tsconfig.tsbuildinfo`, `eslint.config.mjs`, and the
empty `src/` and `public/` trees.

## Toolchain

- Vercel CLI authenticated as `lambertbouley-4006`. GitHub CLI as `lbtbly`.
- Node 24.18.0, npm 11.16.0.
- **Not yet available:** Neon, Cloudflare R2, and the two OAuth apps. They need the
  operator's consoles and are listed in `.forge/OPERATOR.md`. Resend is deliberately
  absent: no domain means no sending domain, and naming a processor that processes
  nothing is itself a defect.

## Design state, measured 2026-08-18

Claude Design project `c986ef97-6be8-47d1-96b4-215caaea7581`. Start at
`00 Vitrine.dc.html`.

Seven screens, one file each, both themes in every file. Each was authored, patched
under a fourteen-part kit patch, then measured in a browser at scale 1.

| Screen | Frames | Overflow | Contrast | Tap <44 | Radii |
|---|---|---|---|---|---|
| `01 Aisle check` | 14 | 0 | 0 | 0 | 0 |
| `02 Catalogue` | 11 | 0 | 0 | 0 | 0 |
| `03 Specimen sheet` | 11 | 0 | 0 | 0 | 0 |
| `04 My collection` | 11 | 0 | 0 | 0 | 0 |
| `05 Public profile` | 10 | 0 | 0 | 0 | 0 |
| `06 Contributor` | 10 | 0 | 0 | 0 | 0 |
| `07 Landing` | 13 | 0 | 0 | 0 | 0 |

Zero em dashes, zero banned words, zero placeholder strings. R29 verified mechanically:
exactly one call to action above the fold in all nine landing page frames. 04's column
budget sums to 1392 at 1440 and 736 at 768.

Before the patch: six of seven files overflowed, worst 948 px inside a 1440 px frame;
56 contrast failures; ten interactive targets under 44 px; focus rings invisible
product-wide because `clip-path` clips an element's own outline. None of it was visible
in the source, and every author believed their file was sound.

`0 Compare.dc.html` and files `1` to `5` are the record of direction selection.
`5 Chromatic Era.dc.html`, `_dark.part.html` and `_tokens.part.html` are superseded.

**Two measurement traps, recorded so the verifier does not fall into them.** `body`
carries the grid gradient, so a naive "is this text on a photograph" walk hits it and
reports false failures on every screen; scope the walk to photograph classes. And
measure at scale 1: a leftover `body{zoom}` made a 44 px control compute as 43.99 and
produced eight false C7 violations.

## The kit patch, K1 to K14, applied to all seven files

Recorded so a later session knows what changed and why, and does not undo it.

1. **K1** dark `--ink3` to `#8593B8`. It measured 4.15:1 on `--case2`, where the kit's
   own panel headers put label text.
2. **K2** light `--ink3` to `#565E7B`. It measured 4.16:1 on `--hovp`.
3. **K3** light `--g` to `#EDF0F7` and `--case2` to `#F7F9FC`. C22 was **inverted in
   light**: canonical sat darker than its ground. No room above white, so the ground
   came down.
4. **K4** `.fw` focus wrapper. `clip-path` clips an element's own outline and
   box-shadow, so focus rings had never been visible on any cut control.
5. **K5** the defensive colour list, six class names short.
6. **K6** links resolve to `--ink` with an `--edge` underline, mint on hover and focus.
7. **K7** 22 kit rules brought onto the C8 spacing scale.
8. **K8, K9** `.pmr` and `.btn` given wrap and shrink permission.
9. **K10** borderless `--case2` surfaces gain a light-scoped hairline, a K3 consequence.
10. **K11** `.nav a` and `.foot a` beat `a:hover` on specificity, so the settled colour
    never reached the two surfaces that use links most.
11. **K12** inset `box-shadow` for segments inside a clipped control: an inset shadow
    paints inside the child's own border box and survives the ancestor clip.
12. **K13** the half-disc theme glyph carried a 50% radius. Redrawn as SVG.
13. **K14** `.ph` was **both** the phone-frame class and the provenance-icon outline
    modifier, declared second, so every outline mark rendered 390 px wide. Root cause of
    the overflow on four screens, and silently wrong at 1440 and 768 where it had room.

## Slice order, from PLAN.md

1. Aisle check, signed out and offline
2. Catalogue, specimen sheet, permanent IDs
3. Accounts, sync, claim, the wall in two places
4. The sofa: collection, value, CSV in and out
5. Photographs and the notice mechanism
6. Community: profiles, lists, wantlist matching
7. Contributor trust
8. Rights, retention, transparency
9. The front door
10. Launch and the full sweep
