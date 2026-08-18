# Screen 01 handoff, measured from the built design

Values read off the rendered frames in `01 Aisle check.dc.html` with
`getComputedStyle`, not transcribed from source. Where this file and a memory of the
design disagree, this file wins. Where this file and DESIGN.md disagree, say so rather
than picking one.

## The three verdict states

| | background | text | corner cut | border | padding | verdict word |
|---|---|---|---|---|---|---|
| **OWNED** | `--fmint` `#00E0A4` | `--onacc` `#0B1020` | **yes**, 20px | none | 24 20 20 | 46px / 800 / stretch 114% / ls -1.38px |
| **UNCERTAIN** | `--g` `#0B1020` | `--ink` | **NONE** | **2px dashed `--flare`** | 0 | 46px / 800 / stretch 114% / ls -1.38px |
| **NOT IN COLLECTION** | `--case` `#16203A` | `--ink` | yes | 1px solid `--edge` | 20 16 16 | 36px / 800 / stretch 110% / ls -0.9px |

**UNCERTAIN is the only surface in the product with no `clip-path` and a dashed edge.**
That is not decoration. It is how the verdict system survives greyscale and colour
blindness, and it is checked by F6. If a refactor gives it a cut, the screen is broken
even though nothing errors.

OWNED is the mint **fill**, which is one of the three tokens identical in both themes,
so the OWNED slab is pixel-identical in light and dark. Deliberate.

The verdict word sits at 46px on the phone verdicts and 36px on NOT IN COLLECTION.
**C23 caps the fitted verdict word between 26px and 46px at every viewport**, so 46 is
the ceiling and there is no headroom above it. The 1440 frame was authored at 64px and
was brought down to 46 to meet the line.

## Scan header

`.scanh`: `--drawer` `#070A14` ground, padding 16, 1px `--hair` bottom border, flex,
gap 12. It carries the barcode graphic, the identifier in mono, and the match time.

## Controls

- `.btn` 44px tall, padding 0 16, `700 14px/1` display face, `min-width:0`.
- `.btn.b56` 56px tall, 16px text, padding 0 24. **Aisle-flow primaries are b56**, and
  F11 counts anything under 56px on its shortest side at 390px as a violation.
- `.btn.pri` mint fill, `--onacc` text, 10px corner cut.
- `.btn.sec` transparent, `--ink` text, 1px `--edge` border, **no cut**.
- **UNCERTAIN's two candidates are both `.btn.sec.b56`, identical weight.** Count of
  candidates styled as primary is 0 and count preselected is 0. The third door is a
  full-width secondary reading "Neither. Add a new variant."

## Focus rings

`clip-path` clips an element's own `outline` **and** its `box-shadow`, so a ring set on
`.btn.pri` or any cut surface renders and is then clipped away, silently. Wrap cut
controls in `.fw` (`display:inline-flex;position:relative;max-width:100%`) and put the
ring on `.fw:focus-within`. For a control inside a clipped ancestor, use an **inset**
box-shadow, which paints inside the child's own border box and survives the clip.

The ring colour is `--mint`, which resolves to `#00E0A4` in dark and `#006E50` in light,
so one rule covers both themes.

## The personal surface

`.drw`: a 135 degree hatch over `--drawer`, 1px `--hair` border, inset top shadow.
`.priv`: 3px solid `--ink2` left rule, 12px left padding, with the words written out.
The no-photo hatch is 45 degrees and must not converge with the personal 135.

## Motion

- The verdict slab arrives at **full width in 220ms with zero opacity change**.
- Everything else travels **140ms on `cubic-bezier(.2,.8,.2,1)`**.
- **The theme swap never animates.** A cross-fade over every colour in a table reads as
  a rendering fault.
- Under reduced motion the slab arrives with zero travel and zero scale while the slab,
  its colour and its cut remain. It does not fade in instead; it is simply already there.

## What the screen must do, not just look like

- The match runs against the on-device copy **first, every time**. A network call may
  refine a verdict; it may never gate one.
- Exact barcode plus exactly one matching variant is OWNED. A barcode on more than one
  variant, or a title match with no variant resolved, is UNCERTAIN. Never infer a
  variant from a partial match.
- OWNED renders the user's own cached photograph, never a community one.
- A cache older than 24 hours prints its age under the verdict, same position on all
  three verdicts.
- No entry found renders three doors: search by title, start an entry, add to Unfiled.
  No path ends without a next action.
- Everything here runs signed out. No route guard, no interstitial, no modal on load.
