# Next browser pass

**There isn't one. Everything this file previously listed is done.**

Kept as a record rather than deleted, because the next person to want a browser
pass should see what the last one cost and what it produced.

## What it asked for, and what happened

| Asked | Outcome |
|---|---|
| Rebuild, because `.next` predated the F6 and C20 work | Built `U_TSj0yB6qLS3TQKwtvZ6`, since superseded by `YzDsr6hHAGTXS-1fwnrSm` |
| F6's clauses captured | Every clause measured and rendered. **Still refused**: `img` count inside the two frames is 0, and no photograph can exist until slice 5 |
| C20's no-photo frame re-measured | 318 x 238.5 px, was 0 visible text nodes, now 2, each painted at 21 of 21 hit-test points. **Still refused** on the 56 px thumbnail |
| The 165 px clipping risk | Answered: worst overflow `-8.00`, 0 scroll overflow. It fits |
| C26 wired into the gate | Done, and **red on its first run**: 4 rules setting font or background without colour |
| Re-run what the grid change could move | `check:ui` 0 across 48 combinations. No regression |

## What it did not anticipate, and cost the most

**The capture stopped above its subject.** `f6-uncertain-390.png` was a correct
390 x 844 viewport capture of a screen whose candidate frames sit at y 871.3. It
showed the dashed edge and the difference sentence and stopped before the
photographs, the buttons and the third door. The JSON read as complete. It took
opening the PNG.

The harness now has `measureSubjectInCapture` and `assertSubjectInCapture` for
exactly this. **Use them.** A capture that does not contain what it evidences is
not evidence, and nothing about the file's name, size or dimensions will say so.

## If you are planning another pass

Nothing measurable remains at slice 1. Every unchecked line waits on the deploy,
on a later slice building its subject, on the four unbuilt screens, on
photographs, or on a human decision. `.forge/DEFECTS.md` groups them by which.

Before starting one anyway, read **"Before you run check:all"** in
`.forge/VERIFIER-BRIEF.md`. A rebuild landing under a running server has cost
this project two rounds of re-measurement.
