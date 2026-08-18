# Design

Product name: **Vitrine**.
Claude Design project: https://claude.ai/design/p/c986ef97-6be8-47d1-96b4-215caaea7581
Link scope: organisation, comment access.

Direction chosen by the user on 2026-08-17 from five rendered art directions.
The earlier direction, Field Registrar, is retired. Its project (b0f815ae) is kept
as a record only. Nothing in it binds this build.

## Direction

**Chromatic Era.** The graphic language of the era this merchandise comes from,
abstracted and brought forward. A deep ground, two high-saturation accents used as
a strict state grammar and never as decoration, condensed display type set large
and tight, angular cuts, a visible technical grid, thin keylines. Modern restraint
on top: real hierarchy, real spacing discipline, no noise for its own sake.

Not a franchise pastiche. No franchise iconography, no character silhouettes, no
tomb or artefact motifs. The era's design language only, so the product still works
as a catalogue for any franchise later.

**Two themes, both first class.** Light and dark, user-switchable, three states:
explicit light, explicit dark, and a system default that follows the device.

## Information architecture

```
1  CATALOGUE   Every entry ever sold or handed out. Search, facets, the sold / handed-out split.
2  CHECK       The aisle. Scan or type, verdict, add. Runs signed out and offline.
3  COLLECTION  Your copies. Saved views, sort, totals, CSV in and out. Wantlist is a view here.
4  COMMUNITY   Profiles, lists, recent additions. The reason to open the app when not logging.
5  ACCOUNT     Sync, export, delete, your suggestions, settings, About and the disclaimer.

Catalogue item -> SPECIMEN SHEET -> Variant picker -> Add to collection
                                 -> Suggest an edit -> Diff and reason, on the entry
The specimen sheet is the hub. Every route ends there and its URL is the permanent ID.
Merges and renames redirect forever. No permalink ever 404s.
Tab bar on phone, top bar plus facet rail on desktop. One footer line on every route.
```

Unchanged from the previous round. The architecture survived the direction change
because it was never a visual decision.

## Screen list

One file per screen, each self-contained, each carrying both themes. The single-file
approach hit a hard write ceiling at 141 KB and is abandoned. Start at the index:

[00 Vitrine](https://claude.ai/design/p/c986ef97-6be8-47d1-96b4-215caaea7581?file=00+Vitrine.dc.html)

| # | Screen | File | Intent |
|---|---|---|---|
| 01 | Aisle check | [open](https://claude.ai/design/p/c986ef97-6be8-47d1-96b4-215caaea7581?file=01+Aisle+check.dc.html) | Duplicate check and the verdict: three verdicts, offline, no account. |
| 02 | Catalogue | [open](https://claude.ai/design/p/c986ef97-6be8-47d1-96b4-215caaea7581?file=02+Catalogue.dc.html) | Browse and search with sold versus handed out as a control at the top. |
| 03 | Specimen sheet | [open](https://claude.ai/design/p/c986ef97-6be8-47d1-96b4-215caaea7581?file=03+Specimen+sheet.dc.html) | The record, the variant picker, the bundle manifest with retailer rows. |
| 04 | My collection | [open](https://claude.ai/design/p/c986ef97-6be8-47d1-96b4-215caaea7581?file=04+My+collection.dc.html) | Saved views, purchase price beside market value, totals, CSV in and out. |
| 05 | Public profile | [open](https://claude.ai/design/p/c986ef97-6be8-47d1-96b4-215caaea7581?file=05+Public+profile.dc.html) | Another collector's shelf browsed signed out, money never public. |
| 06 | Contributor | [open](https://claude.ai/design/p/c986ef97-6be8-47d1-96b4-215caaea7581?file=06+Contributor.dc.html) | Suggest, diff, written reason, reply, merge, batch entry. |
| 07 | Landing | [open](https://claude.ai/design/p/c986ef97-6be8-47d1-96b4-215caaea7581?file=07+Landing.dc.html) | Name, one sentence, one action, the core loop shown rather than described. |

Every screen carries loading, empty, error and offline states.

`0 Compare.dc.html` and files `1` to `5` are the record of direction selection and are
not the screen set. `5 Chromatic Era.dc.html`, `_dark.part.html` and
`_tokens.part.html` are superseded: the two fragments carry no helmet and never
rendered on their own, which is why the dark theme was not viewable until the screens
were re-housed.

## Motion register

Vitrine moves in wipes, not fades: everything travels 140ms on
`cubic-bezier(.2,.8,.2,1)` along the same 45 degree cut that shapes every settled
surface, and the one held beat is the verdict slab arriving at full width in 220ms
with no opacity change at all, because a collector standing in an aisle needs the
answer to land, not to drift in.

**The theme swap never animates.** Every other transition is a 140ms wipe. A
cross-fade over every colour in a thousand-row table reads as a rendering fault.

## Tokens

Exact values, taken from the built comparison file. These bind the builder.

### Dark, the `:root` scope

| Token | Value | Role |
|---|---|---|
| `--g` | `#0B1020` | ground |
| `--g2` | `#05070E` | page behind the frame |
| `--case` | `#16203A` | canonical surface, raised |
| `--case2` | `#1E2B4C` | canonical raised, second step |
| `--drawer` | `#070A14` | personal surface, recessed |
| `--nil` | `#101A31` | no-photo surface |
| `--ink` | `#F2F6FF` | primary text |
| `--ink2` | `#A8B6D4` | secondary text |
| `--ink3` | `#8593B8` | labels, dimmest text allowed |
| `--mint` | `#00E0A4` | settled: selected, focused, owned, gain |
| `--flare` | `#FF5C2B` | unsettled: uncertain, unverified, unpriced |
| `--edge` | `#6478A8` | meaningful border |
| `--hair` | `#2E3B5E` | decorative hairline, never a boundary that carries meaning |
| `--hovp` | `#131A2C` | row hover |

Measured, on ground / case / drawer: ink 17.5 / 14.9 / 18.3. ink2 9.3 / 7.9 / 9.7.
ink3 6.2 / 5.3 / 6.5. mint 11.0 / 9.4 / 11.5. flare 6.1 / 5.2 / 6.4. edge 4.3 / 3.7
against a 3.0 floor. hair 1.5, decorative only.

**`--ink3` was `#7C8CB2` and is now `#8593B8`.** The original table measured three
surfaces and the kit uses five. On `--case2` `#1E2B4C`, which is where `.panh` puts
every panel label, `#7C8CB2` measured **4.15:1**, under the floor. It was failing in
five of the seven screens, twenty-four times in the contributor screen alone.
`#8593B8` measures 4.56:1 there and raises every other pairing.

Measured on the two surfaces the first table missed: ink3 on case2 4.56, on hovp
`#131A2C` 5.66. Both now clear 4.5.

### Light, the `.lt` scope

| Token | Value | Role |
|---|---|---|
| `--g` | `#EDF0F7` | ground |
| `--case` | `#FFFFFF` | canonical, raised |
| `--case2` | `#F7F9FC` | canonical, second step |
| `--drawer` | `#E2E7F2` | personal, recessed |
| `--nil` | `#E9EEF8` | no-photo surface |
| `--ink` | `#0C1226` | primary text |
| `--ink2` | `#3E4863` | secondary text |
| `--ink3` | `#565E7B` | labels, dimmest text allowed |
| `--mint` | `#006E50` | settled, as text, border and focus ring |
| `--flare` | `#B03005` | unsettled, as text and border |
| `--edge` | `#6F7A96` | meaningful border |
| `--hair` | `#CBD3E3` | decorative hairline |
| `--hovp` | `#D6DDEC` | row hover |

Measured, on ground / canonical / personal: ink 16.3 / 18.6 / 15.0. ink2 7.9 / 9.1
/ 7.3. ink3 5.5 / 6.4 / 5.1. mint 5.4 / 6.3 / 5.0. flare 5.6 / 6.4 / 5.1. edge 4.0
/ 4.3 / 3.5 against a 3.0 floor. hair 1.5, decorative only.

**Three light tokens moved, and one of them was a C22 failure, not a contrast one.**

`--ink3` was `#5D6684`. On `--hovp` `#D6DDEC`, the collection table's row hover, it
measured **4.16:1**. `#565E7B` measures 4.69 there, 5.5 on ground, 6.4 on canonical,
5.1 on personal, 6.0 on case2.

`--g` was `#F4F6FB` and `--case2` was `#E7ECF6`. That is the serious one. C22 requires
canonical lighter than its ground **in both themes**, and in light it was the other
way round: case2 sat at relative luminance 0.826 against a ground of 0.913, so every
`.panh` and every `.tot` read *recessed* while carrying canonical content. The rule
inverted itself the moment the theme flipped, which is precisely the silent failure
the vector exists to prevent. There is no room for a second step above `#FFFFFF`, so
the ground had to come down: ground 0.860, case2 0.936, canonical 1.000. Personal
stays at 0.790, below the ground, recessed as it must be.

Diagnostic worth keeping: **if a surface rule holds in one theme and inverts in the
other, check the ordering of the luminances before you check the code.** A vector
stated in words survives a token swap only if the numbers were checked in both
directions.

**The accents are re-derived for light, not reused.** `#00E0A4` measures 1.7:1 on
white and 1.4:1 on the personal panel. `#FF5C2B` measures 3.1:1 on white and 2.5:1
on the personal panel. Both fail as small text; the orange fails as a border too.
`#006E50` and `#B03005` hold the same two hues, 164 and 15 degrees, so the meaning
survives the flip even though the value does not.

### Shared across both themes, exactly three

`--fmint` `#00E0A4` and `--fflare` `#FF5C2B` as **fills only**, and `--onacc`
`#0B1020` as the text that sits on either fill (11.0:1 and 6.1:1). This is why the
OWNED slab and the primary button are pixel-identical in both themes. Deliberate.

### Type

- `--fd` **Archivo**, variable, `wdth` 62 to 125, `wght` 400 to 900. Display, UI,
  data. Fallback `'Helvetica Neue', Helvetica, Arial, sans-serif`.
- `--fm` **IBM Plex Mono** 400/500/600. Codes, catalogue numbers, identifiers,
  tracked uppercase labels. Fallback `ui-monospace, 'SF Mono', Menlo, Consolas`.
- `font-variant-numeric: tabular-nums` on every number in a column.
- 11px floor on tracked uppercase mono labels. Anything a collector reads to make a
  decision is 13px or larger. One exception: type printed inside a photograph, such
  as a catalogue code on a case spine, is part of the photograph, not interface text.
- Width axis is named per display size in the file. If the webfont fails the
  fallback keeps weight and tracking but loses the width axis, so display headings
  run wider than designed.

**Both faces are self-hosted from the app origin.** The comparison file loads them
from Google for convenience; the build must not. Three faces from a Google host put
a third-party request on every page, which costs the zero-banner claim (DOD R20) for
nothing.

### Geometry

- The 45 degree corner cut is load bearing, not decoration. Every settled surface
  carries it: `clip-path:polygon(0 0,calc(100% - Npx) 0,100% Npx,100% 100%,0 100%)`
  at N of 8, 12 or 18.
- Radius is 0 everywhere. The cut replaces the radius.
- Minimum tap target 44px. Aisle-flow primaries 56px.
- **The verdict word is fitted between 26px and 46px, at every viewport.** The 1440
  aisle check was drawn at 64px and was brought down to 46, not the rubric line up to
  64. C23 governed the drawing rather than the reverse. Settled by the operator on
  2026-08-18.
- Collection table at 1440, frame 1392 usable, row height 56px, cell padding 8px:
  32 select, 282 item, 50 year, 98 category, 154 variant, 56 prov, 90 value,
  104 cond, 48 qty, 72 grade, 96 paid, 104 acquired, 110 source, 96 storage. Sums to
  1392. Group bands 762 / 224 / 406. At 768: 32 + 200 + 50 + 128 + 40 + 84 + 104 + 98,
  summing to 736.
  Condition was 78px and clipped "Complete" to "Comple" under its own state mark. The
  26px came from variant, which wraps to two lines and was already allowed to. Year,
  acquisition date and both money columns were budgeted first and never gave up a pixel. Item, variant, source and storage wrap to two
  lines maximum. Every coded, numeric and date column is single line and prints
  whole; year, acquisition date and both money columns were budgeted first and never
  truncate.

## Interaction notes

Thirteen decisions a builder must not improvise.

Notes 1 to 3 carried over from the previous round unchanged, because they are
behavioural contracts the persona panel earned, not visual choices. Notes 4 to 6 came
with the direction. **Notes 7 to 13 were not designed; they were found**, by measuring
seven built screens in a browser against the rubric. Each one had already shipped as a
defect and none of them was visible in the source. They are written here so the build
does not re-earn them.

### 1. The duplicate check has three verdicts and never waits on the network

OWNED, UNCERTAIN, NOT IN COLLECTION. Never two. UNCERTAIN is not a soft OWNED and
it is not an error; it is a verdict with its own layout.

- The match runs against the on-device copy first, every time. A network call may
  refine a result; it may never gate one.
- Exact barcode plus exactly one matching variant is OWNED. A barcode matching more
  than one variant, or a title match with no variant resolved, is UNCERTAIN. Never
  infer a variant from a partial match.
- OWNED renders the user's own cached photograph. Never a community photograph
  there, because that implies the wrong copy.
- **UNCERTAIN has no default and no primary.** Both candidates get identical 56px
  secondary buttons. One candidate is already owned. Promoting either button to
  primary makes the verdict look confident again, which is the failure this whole
  screen exists to prevent. It carries a third door: neither, add a new variant.
- **UNCERTAIN is the only surface in the product with no corner cut and a dashed
  edge.** That is how the verdict system survives greyscale and colour blindness.
  Do not round it and do not give it a cut.
- A cache older than 24 hours prints its age under the verdict, same place every time.
- No entry found is recoverable with three doors: search by title, start an entry,
  add to Unfiled. Never a dead end; money is being spent now.

### 2. The wall sits after the work, and only in front of sync

- Signed out and fully working: catalogue browse, search, facets, specimen sheet,
  variant picker, public profiles, lists, and the complete duplicate check including
  add to collection.
- Anonymous adds write to a device-local store. No route guard, no interstitial, no
  modal on load, no greyed-out button with a lock on it.
- The account offer appears in exactly two places: below a completed save, and when
  a second device is detected. Dismissible, to the same screen.
- Never behind any wall: market value, collection totals, CSV export, CSV import.

### 3. Canonical and personal are separate surfaces, and credit is text

- **Canonical is always lighter than its ground. Personal is always darker than its
  ground.** The vector never changes; only which end of the scale the ground sits
  on. Dark: ground `#0B1020`, canonical `#16203A` up, personal `#070A14` down.
  Light: ground `#F4F6FB`, canonical `#FFFFFF` up, personal `#E2E7F2` down.
- Personal carries three reinforcements in both themes: a 135 degree hatch, an inner
  shadow from the top edge, and a solid 3px left rule with the words written out.
  In light the canonical card also gains a real drop shadow and the personal well an
  inset one, so lift and depression read physically, not only tonally.
- Personal fields are purchase price, date, source, condition, location, notes,
  grading company, grade, certification serial. Never on the canonical surface,
  never in a diff, never in a merge, never in a moderator's view.
- Public pages never carry purchase price, total paid, acquisition source, storage
  location, private notes or certification serial, at any privacy setting, with no
  toggle. A collection total is never public.
- Every decision on a suggestion renders on the entry page as a field-level diff,
  the contributor's written reason, the editor's written reason, and a reply.
- Permanent entry IDs. A merge or rename redirects forever.
- Contributor credit is body text under the photograph, attached to the photograph
  and not to the entry, so it survives merges, renames and variant restructures.
- Entry creation is publish then review, not review then publish.

### 4. Chroma is a two-word vocabulary and nothing else is coloured

Mint means settled: selected, focused, owned, gain. Orange means unsettled:
uncertain, unverified, unpriced. Nothing else in the interface carries colour.
Provenance marks are monochrome by rule, which is why greyscale safety is
structural rather than a filter test.

Sold versus handed out is carried by fill and shape: filled mark means money
changed hands, hollow mark means it was handed out, and the shape separates the
four handed-out types. Never hue.

### 5. The theme switch

- Three states: Light, Dark, System, with **System as the first-run default**.
- When System is active the control names what it resolved to, for example
  "Following the device, dark right now". Without that the user cannot tell whether
  the app or the device is wrong.
- The toggle lives in the chrome, never in a settings page. Desktop: a
  three-segment control in the top bar, 44px tall, the whole control carrying the
  corner cut, the active segment on the mint fill. Phone: a 44px half-disc button in
  the header opening a sheet with 56px rows.
- The focus ring flips: `#00E0A4` in dark, `#006E50` in light. Keeping the bright
  mint ring on paper ships a 1.7:1 invisible focus indicator.
- Object colours inside photographs are **not tokens** and never flip. A press-kit
  box band or a case top-strip hairline is printed on a physical object. Only chrome
  flips. The light studio sweep is a separate backdrop, not a filter over the dark one.
- The no-photo hatch is 45 degrees; the personal-surface hatch is 135 degrees. They
  are different states and must not converge.

### 6. A token scope must declare, not inherit

Any element that renders text resolves `color` through a variable the theme scope
redefines. A component that sets only `font` and `background` and lets `color`
cascade inverts silently when the second theme is added, and it does so
**selectively**: the components that happened to declare a colour keep working,
which makes it read like a specificity bug rather than a missing declaration.

This is not theoretical. It shipped in the comparison file and put the dark ink
`#F2F6FF` on the light table's white surface at 1.06:1, invisible, in seven of
fourteen columns.

Cheap check, no browser needed: every rule that sets `font` or `background` on a
text-bearing container must also set `color`. Any literal hex outside the token
definitions and outside the photograph object classes is a bug.

Diagnostic worth keeping: **if backgrounds flip but text does not, custom properties
are resolving fine and the bug is a missing `color` declaration**, not the palette
and not the cascade.

### 7. Focus rings die on cut surfaces, so the ring is drawn by a wrapper

`clip-path` clips an element's own `outline` **and** its `box-shadow`. Every settled
surface in this system carries the 45 degree cut, so a focus ring set directly on
`.btn.pri`, `.tts`, `.chip.on`, `.tt` or any `.cut` element renders and is then
clipped away. Nothing errors. The ring is simply never visible, on every screen, in
both themes.

The fix is an unclipped parent:

```
.fw{display:inline-flex;position:relative;max-width:100%}
.fw:focus-within{outline:2px solid var(--mint);outline-offset:2px}
```

Every focusable cut control is wrapped in `.fw`. Do not solve this by removing the
cut, and do not solve it with an inset shadow: the cut is load bearing and the shadow
is clipped by the same rule.

This is the kind of defect that passes every review that does not open a browser. It
was found by measurement, not by reading the CSS.

### 8. A link is not a settled state

Chroma is a two-word vocabulary: mint means settled, flare means unsettled, and
nothing else carries colour. The kit shipped `a{color:var(--mint)}`, which painted
every link in the product mint and put a third meaning on the settled colour.

Links resolve to `--ink` with a 1px `--edge` underline. They take mint on hover and
on focus, where the settled meaning is real:

```
a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--edge)}
a:hover,a:focus-visible{color:var(--mint);border-bottom-color:var(--mint)}
```

Two rules travel with it and are not optional:

```
.nav a:hover,.nav a:focus-visible,.foot a:hover,.foot a:focus-visible{color:var(--mint);border-bottom-color:var(--mint)}
a.btn,a.tbi{border-bottom:0}
```

The first exists because `.nav a` and `.foot a` set their own dim colour at equal
specificity and later in the sheet, so without it the two surfaces that use links most
take the underline and never reach the settled colour at all. The second exists because
an anchor styled as a button is a button: without it every anchor-button and every
tab-bar item grows a stray 1px rule under its label.

This also removes a colour-only affordance, which the accessibility floor wanted
anyway.

**The one carve-out, stated so it is not mistaken for drift:** a brand mark may carry
the fill token. The wordmark rule under VITRINE and the product icon are marks, not
interface state. Interface chrome may not.

### 9. What C26 does and does not reach

C26 counts rules that set `font` or `background` on a **text-bearing container**
without also setting `color`. It does not reach modifier classes.

`.mono`, `.mc`, `.mc10`, `.cd-n`, `.pgh h1`, `.sech h2` and `.wm b` set `font` and no
`color`. They are modifiers: they never appear alone and always resolve colour from a
container that declares one. They are not violations and must not be "fixed" by
pinning a colour onto them, which would break every place they are paired with `.i2`,
`.i3`, `.mt` or `.fl`.

The defensive list is the mechanism, and it was short by six names. It reads:

```
.frb,.tb,.sb,.ptb,.pbar,.scanh,.tbl,.pan,.drw,.tot,.np,.fg,.v-not,.v-unc,.itm,.fld,.ph,.panh,.tt,.c-can,.c-pub,.c-prv{color:var(--ink)}
```

`.ph`, `.panh`, `.tt`, `.c-can`, `.c-pub` and `.c-prv` were missing. Each sets a
background on a container whose subtree renders text and declared no colour.

### 10. Text over a photograph resolves to `--ink`, and nothing dimmer

The photograph exemption is narrow and it has been misread once already. **Type
*printed on the object* is part of the photograph**: a catalogue code on a case spine,
a band across a press-kit lid. That type is not interface and carries no contrast
duty.

**Interface text laid over a photograph is interface text.** A provenance label in the
corner of a shot, a photo credit, a "1 of 3" counter. It carries the full 4.5:1 duty,
and it is measured against the photograph, not against a surface token.

Measured on the studio gradients: `--ink3` `#8593B8` on the dark backdrop's lightest
stop `#3B4C82` is **2.70:1**. Light `--ink3` `#565E7B` on the light floor, roughly
`#8E9AB2`, is **2.22:1**. Both fail badly. `--ink` measures 7.5 on the dark backdrop
and 6.4 on the light one.

So: any text overlaying a photograph resolves to `--ink`. Never `--ink2`, never
`--ink3`. A photograph backdrop is not a token and does not participate in the surface
scale, so no dim step is safe on it.

### 11. Controls in the comps are drawn, not built

Two affordances are rendered as bare SVG in the phone frames because a comp draws a
picture of a control: the back chevron in `.ptb`, at 9 by 16, and the sort carets in
the collection header. They are pictures here and must be **controls** in the build,
each with a hit area of at least 44px on its shortest side, a programmatic label, and
a focus ring.

A DOM sweep of the comps will not count them, because a bare `<svg>` is not focusable
and not an interactive target. That is exactly why this is written down: the sweep
passing on the comps proves nothing about C7 on the built product.

### 12. Two names collided, and one of them was silently 390 pixels wide

`.ph` was the phone-frame modifier and, independently, the outline modifier on the
provenance icons, written `<svg class="pm ph">`. Both are single-class selectors and
`.ph` came second, so it won: every outline provenance mark in the product rendered
**390 pixels wide** with a ground-coloured field behind it. `.pm` carries `flex:none`,
so no amount of `min-width:0` on the row could shrink it.

It was the root cause of the provenance-row overflow on several screens, and it was
wrong at 1440 and 768 too, where a 390px icon has room and never crosses a frame edge,
so no overflow sweep would ever have reported it.

Bound by a two-class compound, which beats a single class whatever the source order:

```
.pm.ph{width:14px;height:14px;display:inline-block;background:none}
```

The real lesson is the naming. A two-letter class in a shared kit will collide. If
this system grows, one of the two gets renamed.

### 13. C22 governs resting surfaces, not transient states

In light, canonical cells are `--case` `#FFFFFF`, luminance 1.000, and the ground is
`#EDF0F7`, 0.8705. A row hover has to differ from white, and nothing is lighter than
white, so **every visible hover on a canonical cell is darker than the ground**. For
the duration of the hover, that row reads recessed.

The alternatives were measured, not assumed. A hover placed between the ground and
white lands near 0.93, a five to seven percent luminance drop, which is what
`--case2` was doing before and which read as no hover at all. The choice is a visible
hover that inverts the vector for as long as the pointer is on the row, or an
invisible one.

**C22 counts surfaces. A hover is a state.** The vector governs the resting
composition, which is what the rule exists to protect: canonical raised, personal
recessed, in both themes, so that the separation survives the theme flip. A pointer
sitting on a row does not restructure the page.

This is a reading of where the line was drawn, not a softening of it. **Settled by the
operator on 2026-08-18** and recorded at the head of DOD.md, so the verifier applies it
the same way. No threshold moved and the line text is unchanged.

### 14. What C8 reaches, and what it does not

C8 reads: *every margin and padding value the product's own rules set is drawn from
4, 8, 12, 16, 20, 24, 32, 40, 56, 72.*

- It reaches `margin` and `padding`. Twenty-two kit rules were off the scale and are
  now on it.
- **It does not reach `gap`.** Values of 6, 7, 10, 14, 18 and 34 survive on `.wm`,
  `.chip`, `.pmr`, `.panh`, `.itm`, `.tot`, `.gr2`, `.gr3` and the footer link row.
  The line says margin and padding, so gap is out of scope as written.
- It does not reach the canvas furniture that frames the artboards. `.pgh`, `.sec`,
  `.sech`, `.row` and `.frl` are not the product.
- It does not reach `width`, `height`, `min-height` or `flex-basis`. Some of those
  carry the collection column budget, which sums to exactly 1392 at 1440.

The gap exclusion is a real hole in the rubric line rather than a licence.
**Settled by the operator on 2026-08-18: the line stays as written and `gap` stays
outside it**, recorded at the head of DOD.md as a known hole rather than quietly
widened. A verifier does not count gap under C8, and does not get to invent it. If the
spacing rhythm is ever to be enforced in the third dimension, that is a new line, added
openly, not a reinterpretation of this one.

## Notes for verify

- Contrast is measured against the **built** interface in **both themes**, not
  against these tables.
- Every screen is captured at 390, 768 and 1440, in both themes.
- The greyscale check on the five provenance marks is structural: convert to
  greyscale and confirm no two marks share a fill-and-shape pair.
- **Closed.** The condition column at 78px overlapped its state icon with the word, so
  "Complete" rendered as "Comple" with the glyph on top. Condition is now 104px and
  variant 154px; the budget still sums to 1392 at 1440 and 736 at 768, and no coded,
  numeric or date column gave up a pixel.
- **C9 is measured against the rendered DOM, not grepped from source.** The half-disc
  theme glyph used to be a `<span>` with `border-radius:50%`. It is now an inline SVG
  circle, so no element renders a radius, but the dead `.hd` rule may survive in some
  files. A rule that matches no element sets no radius. If a verifier prefers to grep,
  strike the dead rule in all seven files first rather than argue the reading.
- **Measure, do not read.** Every screen in this set was authored by an agent with no
  browser, and every one of them believed its own layout was sound. A measured pass
  found overflow in six of the seven files, worst case 948px inside a 1440px frame,
  plus a focus ring that had never once been visible and a light-theme surface vector
  that was inverted. None of it was visible in the source. Verify against a rendered
  page, at both themes and every viewport, or the verification is worthless.
- Imagery in the comparison file is CSS and SVG only: layered gradients, a skewed
  blurred cast shadow, a specular sheen pass, and a shared `feTurbulence` grain data
  URI at 7 percent. No external image URL, no rights-holder artwork. Real user
  photographs replace the object contents inside the same wrapper at build time.
