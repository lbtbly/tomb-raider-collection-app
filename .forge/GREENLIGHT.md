# Greenlight

This is a summary for approving away from the desk. It is never a replacement for
the plan and the rubric. Approving means the full rubric applies, all 130 lines,
exactly as written in `.forge/DOD.md`, with no line softened later to reach PASS.

**The run is not armed.** A `/goal` line was pasted on 2026-08-17 and wrongly treated
as approval. `.forge/ARMED` was removed, the Stop gate is off, no builder is running,
and no rubric line is checked. Approval is your words. The `/goal` line arms the run
afterwards.

## The build in one line

Next.js App Router on Vercel Hobby, Drizzle over Neon Postgres in EU Frankfurt,
Cloudflare R2 for every image byte, Better Auth on GitHub and Google, search on
Postgres tsvector and pg_trgm. No mail provider, because there is no domain.

## Size

10 slices. 130 rubric lines: 62 Function, 30 Craft, 33 Release, 5 Disqualifiers.
Catalogue seeds at 220 items and 380 variants, every row carrying a cited source
with a retrieved-on date. Zero unverified rows ship.

## The screens

https://claude.ai/design/p/c986ef97-6be8-47d1-96b4-215caaea7581

Comment access. Start at `00 Vitrine.dc.html`: direction, information architecture,
both token scopes, the thirteen rules a builder may not improvise, the motion
register, and a link to each screen.

Direction is **Chromatic Era**, dual theme. Seven screens, one file each, both themes
in every file, three viewports, plus loading, empty, error and offline states.

Every screen was authored, patched under a fourteen-part kit patch, then **measured in
a browser**. Final sweep, 2026-08-18:

| Screen | Frames | Overflow | Contrast | Tap <44 | Radii |
|---|---|---|---|---|---|
| 01 Aisle check | 14 | 0 | 0 | 0 | 0 |
| 02 Catalogue | 11 | 0 | 0 | 0 | 0 |
| 03 Specimen sheet | 11 | 0 | 0 | 0 | 0 |
| 04 My collection | 11 | 0 | 0 | 0 | 0 |
| 05 Public profile | 10 | 0 | 0 | 0 | 0 |
| 06 Contributor | 10 | 0 | 0 | 0 | 0 |
| 07 Landing | 13 | 0 | 0 | 0 | 0 |

Before that pass, six of seven files overflowed, worst 948 px inside a 1440 px frame;
there were 56 contrast failures, ten interactive targets under 44 px, and focus rings
that had never once been visible anywhere in the product. None of it was visible in
the source.

Files `0` to `5` are the record of direction selection. They are not the screen set.

## Settled by you already, in words

- **The name: Vitrine.** No trademark, survives a second franchise, one token.
- **The host: the Vercel subdomain.** No domain registered.
- **The direction: Chromatic Era, light and dark as equals.**
- **The three rubric readings, 2026-08-18.** C23 keeps its 26 to 46 px range and the
  design came down to meet it. C8 reaches margin and padding and not `gap`, recorded
  as a known hole rather than quietly widened. C22 counts surfaces, and a hover is a
  state. All three are written at the head of DOD.md so the verifier applies them the
  same way. No threshold moved and no line text changed.

## The amendments, validated

Eighteen rubric lines changed after the architect handed the rubric over, while the
gate was open, which should not have happened. Every one is recorded in
`.forge/AMENDMENTS.md` with the real before-and-after text, recovered verbatim from the
session transcript rather than reconstructed from memory. Eleven were retargeted at
unchanged thresholds, six were added for the second theme, one was reduced. 124 becomes
130.

**All validated by you on 2026-08-18**, including the two that were not neutral:

1. **F62 and R7 become OPERATOR lines.** With no domain there is no verified sending
   domain, so both sign-in methods are OAuth. Proving either needs a real consent
   screen in your browser, and R7 needs a second person. Two Function lines now wait on
   you rather than on the verifier. Your consoles checklist is `.forge/OPERATOR.md`.
2. **R14 drops from four processor contracts to three.** The mail provider goes,
   because none processes personal data in v1 and naming one that processes nothing is
   wrong rather than cautious. The only threshold in the rubric that went down. It
   reopens if a mail provider is ever added.

**The rubric is now closed to amendment.** From here it is verified, not negotiated.
No line is softened to reach PASS; when quality misses, the model escalates or the
slice is re-planned.

## The three rubric lines most likely to be contentious

- **R10. Every seeded row carries a source with a URL and a retrieved_on date, and a
  verification row naming a method. Count of rows missing any of these is 0.**
  This is why the catalogue seeds at 220 and not at the 1,500 to 4,000 the research
  estimates. A wrong SLES number in a product selling itself on completeness is the
  first thing a collector finds. A bigger day-one catalogue trades directly against
  R10 and R11, and settling it here is cheaper than amending later.

- **F17. Signed out with storage cleared, all 7 public actions complete, and the count
  of sign-in prompts, interstitials, route guards, and locked controls encountered
  is 0.** The whole duplicate check, including saving the copy, works with no account.
  Market value, totals, CSV export and CSV import are never behind a wall (F19). Three
  collectors independently named the double paywall as the line that ends the trial.

- **F22. A second franchise is added to the live database by row inserts only, with a
  checksum over information_schema.columns identical before and after.**
  Your generalization constraint, made checkable. It forces franchise, category and
  variant axis to be rows rather than columns, which costs real work in slices 1 and 2.

## What is deliberately absent

Nothing was added for the European Accessibility Act or the Cyber Resilience Act. Both
were checked against primary sources. WCAG 2.1 AA holds as a craft floor under C3 to
C7, by choice.

No cookie banner, and R20 checks the claim: a first-load network capture must reach no
host outside the two the product operates. It is why both typefaces are self-hosted and
OAuth avatars are copied into R2.

No ads, no donations, no payments. Vercel Hobby forbids commercial use broadly enough
that a donate button alone would force a paid plan.

## The working tree

Clean. The pre-gate Next.js scaffold was removed on 2026-08-18 at your instruction:
`package.json`, `package-lock.json`, `node_modules/`, `next.config.ts`, `tsconfig.json`,
`tsconfig.tsbuildinfo`, `eslint.config.mjs`, and the empty `src/` and `public/` trees.
Zero product source ever existed, no commit was made, nothing was deployed. The build
starts from nothing.

## Everything is settled except the one thing that cannot be

Name, host, direction, the three rubric readings, and all eighteen amendments: settled
in words. The screens are drawn, measured and clean. The rubric is 130 lines, closed,
none of them checked. The working tree is empty.

The greenlight is the last item, and it is the one thing in this pipeline that is never
automated and never inferred. A run that can approve its own plan has no gate.

## To approve

Say so in words.

On your word the lead creates `.forge/ARMED`, which activates the Stop gate. Then paste
this line, which sets the goal condition the run drives to:

/goal Every line of .forge/DOD.md checked, with evidence recorded in .forge/EVIDENCE.md, and a PASS verdict from the verifier agent.
