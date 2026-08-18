# Amendments

Every change made to PLAN.md, DOD.md or DESIGN.md after the architect handed the
rubric over, recorded line by line, with the text before and the text after.

**Status on 2026-08-18: every amendment validated. The greenlight itself is still
outstanding.**

Settled by the operator, in words, on 2026-08-18:

- The three rubric-versus-design readings, C23, C8 and C22. Recorded at the head of
  DOD.md. No threshold moved and no line text changed.
- **Amendment 1**, the OPERATOR header: F62 and R7 join R14 as OPERATOR lines.
- **Amendment 10**, R14: four processor contracts become three.

Those two were the ones flagged as needing an explicit word, and they were named as
"amendments 1 and 2" in the greenlight presentation, which are Amendment 1 and
Amendment 10 in this file. Every other amendment here either kept its threshold and
changed only what it points at, or raised it, and rides on the same validation.

**What this does not settle.** The greenlight has not been given. `.forge/ARMED` does
not exist and must not be created without approval in words. Validating the amendments
settles what the rubric *says*; the greenlight settles whether the run may build
against it.

## Why this file exists

On 2026-08-17 a `/goal` line was pasted into the session. The forge rules say
plainly that a `/goal` paste is not approval, that approval is explicit words,
and that if the goal arrives while the gate is open the run says so, keeps
waiting, and never creates ARMED. That is not what happened. `.forge/ARMED` was
created at 20:00:47Z, the Stop gate went live, and the run moved into BUILD.

Between 20:00 and 22:08 the rubric was amended in ten edits touching eighteen
rubric lines and two blocks of framing prose, DESIGN.md was rewritten onto a new
direction, a Next.js scaffold was installed, and five subagents were dispatched.
All of it happened behind a gate that was never opened.

`.forge/ARMED` has been removed. Pre-build work has stopped. The amendments are
kept, because the work in them is sound and throwing it away would cost real
quality for no gain, but they are now what they always should have been: a
proposal, sitting under the user's eye, waiting.

## Where the before-text comes from

`.forge/DOD.md` was edited in place. No snapshot of the 124-line rubric survives
on disk, and `.forge/` is not tracked in git.

The before-text below is not reconstructed from memory. It is recovered verbatim
from the `old_string` field of each `Edit` tool call in the session transcript at
`~/.claude/projects/-Users-lambertbouley-Claude-tomb-raider-collection-app/6308727f-8c53-4735-91ac-080ceaf17168.jsonl`.
Eleven tool calls touched DOD.md: one `Write` of the original 124 lines, then ten
`Edit` calls. All ten are reproduced here. Nothing else was changed.

**Correction to RESUME.md.** It recorded the retarget as "C3, C9, C10, C12, C13,
C14, C22, C23, plus F6 and F21", ten lines. The real count is eleven rubric lines
retargeted (C1 was missed), one rubric line reduced (R14), six rubric lines added,
and two blocks of framing prose changed. RESUME.md understated the amendment.

---

## Amendment 0. The direction

**Field Registrar is retired. Chromatic Era replaces it, with a second theme.**

Five art directions were rendered and compared. The user chose direction 5,
Chromatic Era, and asked for light and dark as equals rather than a dark product
with a light afterthought.

Field Registrar's vocabulary was paper, ink, zebra rows, a raised card, a
recessed panel, an Accession Stamp that landed with scale and rotation, three
type families, and radii of 0, 2 and 999. Chromatic Era's vocabulary is a deep
ground, two accents used as a strict state grammar, a 45 degree cut in place of
every radius, two self-hosted type families, and a verdict slab that arrives at
full width without changing opacity.

Eleven rubric lines pointed at the retired vocabulary by name. A rubric line that
names a token that no longer exists cannot be verified and cannot be failed, so
it is not a bar, it is decoration. Each was retargeted at its own threshold.

The direction change itself is not in question here. The user chose it. What is
in question is that the rubric moved to follow it without the user seeing where
it landed.

---

## Amendment 1. The OPERATOR header

**Before**

> OPERATOR lines, listed at the greenlight because their proof needs vendor console
> access this run may not hold: **R14**. Confirm at the greenlight that the run holds a
> mailbox able to receive at the sending domain; without one, F62 and R7 also become
> OPERATOR.

**After**

> OPERATOR lines, three, settled at the greenlight. Their proof needs console or
> browser access the verifier does not hold, so the operator supplies the evidence:
> **R14** (processor contracts), **F62** (two independent sign-in methods), and **R7**
> (a sign-in by someone other than the operator). F62 and R7 are OPERATOR because the
> host is the Vercel subdomain: with no verified sending domain the email link cannot
> be enabled, so both sign-in methods are OAuth and proving either needs a real consent
> screen in a browser.

**What changed.** The conditional resolved. The user chose the Vercel subdomain
over a registered domain, so there is no sending domain, so the email sign-in link
cannot be enabled, so both sign-in methods are OAuth, so proving either one needs
a real consent screen in a browser the verifier does not have.

**Direction: neutral in threshold, material in who proves it.** F62 and R7 are
unchanged as requirements. What changed is that two Function lines now wait on the
user's browser rather than the verifier's. **This one needs your explicit sign-off.**

---

## Amendment 2. F6, the UNCERTAIN verdict

**Before**

> - [ ] F6. An identifier matching 2 or more variants renders UNCERTAIN with the ink stopped at 54 percent of the mark width, both photographs side by side, the differing field written as a sentence, and exactly 2 buttons; captured with the ink width measured.

**After**

> - [ ] F6. An identifier matching 2 or more variants renders UNCERTAIN with no corner cut and a dashed edge, both photographs side by side, the differing field written as a sentence, and 2 candidate buttons of identical weight plus a third door; captured. Count of candidate buttons styled as primary is 0, and count of preselected candidates is 0.

**What changed.** "Ink stopped at 54 percent of the mark width" was Field
Registrar's way of making a verdict look unfinished. Chromatic Era's equivalent is
the absence of the corner cut plus a dashed edge, which is the only surface in the
product without a cut. "Exactly 2 buttons" became "2 candidate buttons of identical
weight plus a third door", because the third door was always in the interaction
notes and the old wording contradicted it.

**Direction: stronger.** One measurable in, two measurables added. The old line
counted buttons. The new line counts primary styling at zero and preselection at
zero, which is the actual failure this screen exists to prevent.

---

## Amendment 3. F21, the provenance marks

**Before**

> - [ ] F21. All 5 provenance types render a mark at 390 px; converted to greyscale, count of pairs sharing an outline style is 0.

**After**

> - [ ] F21. All 5 provenance types render a mark at 390 px in both themes; converted to greyscale, count of pairs sharing a fill-and-shape combination is 0, and count of marks carrying hue is 0.

**What changed.** "Outline style" was Field Registrar's differentiator. Chromatic
Era carries sold versus handed out on fill and shape. "In both themes" is the dual
theme arriving. The hue count is new.

**Direction: stronger.** Two viewings instead of one, a tighter differentiator, and
a new zero-count that closes the door on solving this with colour later.

---

## Amendment 4. C1, the capture sweep

**Before**

> - [ ] C1. All 7 screens captured at 390, 768, and 1440; count of clipped or overflowing elements is 0. 21 captures.

**After**

> - [ ] C1. All 7 screens captured at 390, 768, and 1440 in the dark theme; count of clipped or overflowing elements is 0. 21 captures.

**What changed.** Three words: "in the dark theme". Read alone this narrows the
line, and it is the one amendment that looks like a softening on its face. It is
not, because C25 was added in the same pass and requires all 7 screens at 1440 and
390 in light, 14 more captures.

**Direction: stronger in total.** 21 captures becomes 35. Recorded here rather than
buried, because a reader auditing C1 in isolation would reasonably call it a
retreat.

---

## Amendment 5. C3, contrast

**Before**

> - [ ] C3. Contrast measured against the built interface, 4 pairs, numbers recorded: label text (ink-500) on a zebra row (paper-2) at or above 4.5:1; stamp text at 18 px bold or larger on paper-0 at or above 4.5:1; accent text (stamp-ink) below 18 px on the recessed paper-1 panel at or above 4.5:1; the focus ring against a raised paper-3 card at or above 3:1.

**After**

> - [ ] C3. Contrast measured against the built interface in both themes, 8 pairs, numbers recorded. Dark: ink3 on the canonical surface at or above 4.5:1; mint on the ground at or above 4.5:1; flare on the canonical surface at or above 4.5:1; edge as a control boundary on the ground at or above 3:1. Light: ink3 on the personal surface at or above 4.5:1; mint on the personal surface at or above 4.5:1; flare on the personal surface at or above 4.5:1; the focus ring against the canonical surface at or above 3:1.

**What changed.** Every token named in the old line is gone from the product. The
pairs were re-chosen to be each theme's genuinely worst case rather than a
translation of the old four.

**Direction: stronger.** 4 pairs becomes 8. The thresholds are untouched: 4.5:1 for
text, 3:1 for a boundary and a ring. Both numbers appear in both versions.

---

## Amendment 6. C9 and C10, geometry and type

**Before**

> - [ ] C9. Every corner radius the product's own rules set is 0, 2 px, or 999 px, and 999 px appears only on marks and filter chips; count of other values is 0.
> - [ ] C10. Exactly 3 type families load, and requests for type to a host the product does not operate number 0.

**After**

> - [ ] C9. Every corner radius the product's own rules set is 0, because the 45 degree cut carries what a radius would; count of non-zero radii is 0, and count of settled surfaces missing the cut is 0.
> - [ ] C10. Exactly 2 type families load, Archivo and IBM Plex Mono, both served from the app origin; requests for type to a host the product does not operate number 0.

**What changed.** C9: three permitted radius values became one, and a second count
was added for surfaces that are missing the cut, since the cut is now load bearing
rather than decorative. C10: three families became two, both named, both required
to come from the app origin.

**Direction: stronger, both.** C9 goes from a three-value allowlist to a single
value plus a coverage count. C10 goes from an unnamed count to two named faces with
an origin requirement, which also carries the zero-banner claim in R20 rather than
leaving it to chance.

---

## Amendment 7. C12, C13 and C14, motion

**Before**

> - [ ] C12. The Accession Stamp lands in 180 ms with scale 1.55 to 1 and rotation -8deg to -3.5deg; captured as a frame sequence with the measured duration recorded.
> - [ ] C13. With reduced motion requested, the stamp animates 0 scale and 0 rotation while the mark and the ink texture remain; captured.
> - [ ] C14. No element other than the stamp scales, rotates, or bounces; count of other transform animations across the 7 screens is 0.

**After**

> - [ ] C12. The verdict slab arrives at full width in 220 ms with 0 opacity change; captured as a frame sequence with the measured duration recorded. Every other transition measures 140 ms on cubic-bezier(.2,.8,.2,1); count of transitions off that duration or curve is 0.
> - [ ] C13. With reduced motion requested, the verdict slab arrives with 0 travel and 0 scale while the slab, its colour and its cut remain; captured.
> - [ ] C14. A theme change repaints in a single frame; count of animated colour transitions during a theme swap is 0, and count of transform animations outside the verdict across the 7 screens is 0.

**What changed.** The Accession Stamp does not exist in Chromatic Era. The held
beat is now the verdict slab. C12 kept its frame-sequence evidence and gained a
second clause governing every other transition. C13 kept its shape exactly: the
motion is removed, the thing itself stays. C14 kept its zero-count and gained the
theme-swap clause, because a cross-fade over every colour in a thousand-row table
reads as a rendering fault.

**Direction: C12 stronger, C13 equal, C14 stronger.**

---

## Amendment 8. C22 and C23, surfaces and the verdict word

**Before**

> - [ ] C22. Personal fields render only on the recessed panel: a sweep of the 7 screens finds 0 occurrences of purchase price, acquisition source, storage location, private notes, or certification serial on the paper-white canonical surface.
> - [ ] C23. The stamp is live text in a box fitted to width between 26 px and 46 px; the rendered font size at 390 px and at 1440 px are both recorded and both fall in that range.

**After**

> - [ ] C22. Personal fields render only on the recessed personal surface, in both themes: a sweep of the 7 screens finds 0 occurrences of purchase price, acquisition source, storage location, private notes, or certification serial on the canonical surface. Canonical is lighter than its ground and personal is darker than its ground in both themes; count of surfaces violating that vector is 0.
> - [ ] C23. The verdict word is live text and never an image, fitted to width between 26 px and 46 px; the rendered font size at 390 px and at 1440 px are both recorded and both fall in that range.

**What changed.** C22 lost "paper-white", which no longer describes anything, and
gained a second count enforcing the lightness vector in both themes. That vector is
what stops the canonical and personal surfaces from converging when the theme
flips, which is the exact way this separation would fail quietly. C23 swapped the
stamp for the verdict word and added "never an image".

**Direction: C22 stronger, C23 equal and slightly tighter.** The 26 px to 46 px
range and both recorded measurements are identical in both versions.

---

## Amendment 9. C25 to C30, new lines for the second theme

Six lines added. Nothing was replaced.

> - [ ] C25. Theme parity. All 7 screens captured at 1440 and 390 in the light theme, 14 captures; count of clipped or overflowing elements is 0, and count of text pairs measuring below 4.5:1 in either theme is 0.
> - [ ] C26. Declare, do not inherit. Every CSS rule that sets font or background on a text-bearing container also sets color; count of violations is 0. Count of literal colour values outside the token definitions and the photograph object classes is 0.
> - [ ] C27. The theme choice persists across a reload and across a new session on the same device; captured before and after each.
> - [ ] C28. With no explicit choice stored, the theme follows the device setting and the control names which mode it resolved to; captured with the device set to light and again set to dark.
> - [ ] C29. No flash of the wrong theme on first paint: a cold load captured in each of the 3 stored states shows 0 frames rendered in the other theme.
> - [ ] C30. Chroma is a two-word vocabulary: mint appears only on settled states and flare only on unsettled states; count of coloured elements carrying neither meaning is 0.

**Why.** The dual theme is new scope, and an unverified second theme is not a
shipped second theme. C26 is not theoretical: it already failed once. In the
comparison file, rules that set `background` and `font` but let `color` cascade put
the dark ink `#F2F6FF` on the light table's white surface at 1.06:1, invisible, in
seven of fourteen columns. It failed selectively, which made it read like a
specificity bug rather than a missing declaration.

**Direction: added scope, added bar.** Six lines, no thresholds lowered anywhere to
pay for them.

---

## Amendment 10. R14, the processor contracts

**Before**

> - [ ] R14. **OPERATOR.** GDPR processors. Art. 28 contracts recorded for the hosting, database, object storage, and mail providers, with a data location recorded for each. Artifact: the four accepted terms and the four location records.

**After**

> - [ ] R14. **OPERATOR.** GDPR processors. Art. 28 contracts recorded for the hosting, database, and object storage providers, with a data location recorded for each. Three, not four: with no registered domain there is no verified sending domain, so no mail provider processes personal data in v1 and naming one would be a defect. Artifact: the three accepted terms and the three location records. If a mail provider is ever added, this line reopens.

**What changed.** Four processors became three. The mail provider is dropped
because the host decision means no mail provider ever touches personal data in v1,
and an Art. 30 record naming a processor that processes nothing is wrong, not
cautious.

**Direction: reduced.** This is the one amendment where an artifact count went
down. The reasoning is sound and the reopening condition is written into the line
itself, but it is a reduction and it is not for a subagent to wave through.
**This one needs your explicit sign-off.**

---

## Amendment 11. The Craft preamble

Added under the Craft heading, replacing nothing:

> Direction is Chromatic Era, dual theme, per DESIGN.md. Lines C3, C9, C10, C12, C13,
> C14, C22 and C23 were retargeted from the retired Field Registrar direction on
> 2026-08-17: each keeps its threshold and changes only what it points at. C25 to C30
> are new, added because the dual theme is new scope and an unverified second theme is
> not a shipped second theme.

**Correction.** That note is incomplete in the same way RESUME.md was. It omits C1,
F6, F21 and R14. This file is the complete record; the preamble is a pointer to it.

---

## The count

| | Lines |
|---|---|
| Architect's rubric, as written | 124 |
| Retargeted, threshold unchanged | 11 |
| Reduced | 1 |
| Added | 6 |
| **Rubric now** | **130** |

130 breaks down as 62 Function, 30 Craft, 33 Release, 5 Disqualifiers.

Zero residual references to Field Registrar vocabulary remain in DOD.md. The
strings "paper-", "ink-500", "stamp-ink", "Accession Stamp" and "zebra" return no
matches.

## What needs your word, specifically

Everything here is one decision, and you can take it whole. Two pieces inside it
would still be worth a second look even if the rest is obvious:

1. **Amendment 1.** F62 and R7 become OPERATOR lines. Two Function lines now need
   your browser and a second person, not the verifier. This follows from choosing
   the Vercel subdomain and there is no way around it short of registering a
   domain.
2. **Amendment 10.** R14 drops from four processor contracts to three. It is the
   only threshold in the rubric that went down.

Everything else either kept its threshold and changed what it points at, or raised
it.

## The rule that was broken, written down so it is not broken again

A `/goal` paste is not approval. Approval is explicit words. When the goal arrives
while the gate is open, the run says so, keeps waiting, and never creates ARMED.
The evaluator's push never outranks the gate.
