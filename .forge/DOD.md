# Definition of done

PASS exists only at 100 percent of the lines below, each closed with a command
output, a capture, or a live URL recorded in EVIDENCE.md. A line without evidence is
not checked. No line is softened to reach PASS.

Sentinel setup, once, before verification: seed one test account whose purchase
price, total paid, acquisition source, storage location, private notes, and
certification serial each hold a unique string. Those six strings are the sentinels
referenced below.

OPERATOR lines, three, settled at the greenlight. Their proof needs console or
browser access the verifier does not hold, so the operator supplies the evidence:
**R14** (processor contracts), **F62** (two independent sign-in methods), and **R7**
(a sign-in by someone other than the operator). F62 and R7 are OPERATOR because the
host is the Vercel subdomain: with no verified sending domain the email link cannot
be enabled, so both sign-in methods are OAuth and proving either needs a real consent
screen in a browser.

**Validated by the operator on 2026-08-18.** R14 dropping from four processor
contracts to three was validated in the same breath; the reasoning is on the R14 line
itself and the line reopens if a mail provider is ever added.

## Settled readings

Three lines were tested against the built screens and the reading was settled by the
operator on 2026-08-18. **No threshold moved and no line text changed.** Each of these
says where a line was already drawn, so a verifier applies it the same way the design
was held to it. The full record is in AMENDMENTS.md.

- **C23.** The range stands at 26 px to 46 px. The 1440 aisle check had been drawn at
  64 px and the design was brought down to 46, not the line up to 64. The rubric
  governed the drawing.
- **C8.** The line reads *margin and padding*, and that is its reach. `gap` is outside
  it: values of 6, 7, 10, 14, 18 and 34 survive on `.wm`, `.chip`, `.pmr`, `.panh`,
  `.itm`, `.tot`, `.gr2`, `.gr3` and the footer link row, and they are legal. This is a
  known hole in how the line was drawn, recorded rather than quietly widened. A
  verifier does not count gap under C8, and does not get to invent it.
- **C22.** The line counts **surfaces**. A hover is a state, not a surface. In light,
  canonical cells are `#FFFFFF` and nothing is lighter than white, so any visible row
  hover is darker than the ground; the alternative measured at a five percent luminance
  step, which is no hover at all. The resting composition is what the vector protects.

Nothing else in this file is subject to interpretation. Every other line is counted
exactly as written.

Every amendment made to this rubric after the architect handed it over is recorded in
AMENDMENTS.md with the text before and the text after, and all of them were validated
by the operator on 2026-08-18. The rubric now stands at 130 lines and is closed to
further amendment: from here it is verified, not negotiated.

## Function

- [ ] F1. On the live URL in a clean profile with no account, a typed identifier for a variant the device holds paints a verdict within 100 ms of submit; median and maximum over 10 runs recorded, maximum at or under 250 ms.
- [x] F2. With the network disabled after one sync, 10 typed identifiers return verdicts and the network log records 0 requests during those 10 runs.
- [x] F3. With the network throttled to 30 kbit/s and 2,000 ms latency, the verdict paints before any network response arrives; the timestamped network log is captured.
- [x] F4. Three verdicts exist and never two: OWNED, UNCERTAIN, NOT IN COLLECTION, each captured at 390 px.
- [ ] F5. An identifier matching exactly one owned variant renders OWNED over the user's own cached photograph; count of community photographs rendered in the OWNED frame is 0.
- [ ] F6. An identifier matching 2 or more variants renders UNCERTAIN with no corner cut and a dashed edge, both photographs side by side, the differing field written as a sentence, and 2 candidate buttons of identical weight plus a third door; captured. Count of candidate buttons styled as primary is 0, and count of preselected candidates is 0.
- [x] F7. Both outcomes of UNCERTAIN reverse from the item in 2 taps or fewer; captured before and after.
- [x] F8. An unknown identifier renders 3 doors: search by title, start an entry, add to Unfiled. Count of paths with no next action is 0.
- [x] F9. When the on-device copy is older than 24 hours its age prints under the verdict in the same position on all 3 verdicts; captured for each.
- [x] F10. From a cold app open with the network disabled, a scan or typed identifier reaches a verdict and a saved copy in 4 taps or fewer and 20 seconds or less; the slowest of 5 timed runs recorded.
- [x] F11. Every primary control in the check flow measures at least 56 px on its shortest side at 390 px width; count under 56 px is 0.
- [ ] F12. After one sync with the network disabled, the collection list, its thumbnails, the collection search field, a collection item, and the catalogue index all render; count of the 5 offline routes that fail is 0.
- [x] F13. A copy created signed out survives a hard reload and a full browser restart with the network disabled; both captured.
- [ ] F14. The on-device catalogue index measures at or under 400 KB compressed at the shipped catalogue size; the measured size recorded.
- [x] F15. A write made with the network disabled and replayed on reconnect creates exactly 1 row; a count query for that operation id returns 1.
- [x] F16. With the network disabled, every route renders the designed offline state; count of routes showing a browser error page is 0.
- [ ] F17. Signed out with storage cleared, all 7 public actions complete: browse, search, apply a facet, open a specimen sheet, pick a variant, open a public profile, run a duplicate check and save the copy. Count of sign-in prompts, interstitials, route guards, and locked controls encountered is 0. Capture series.
- [ ] F18. The account offer appears on exactly 2 triggers, below a completed save and on a second device, dismisses to the same screen, and appears 0 times on load.
- [ ] F19. Market value, collection totals, CSV export, and CSV import are each reachable with no account; count of these 4 behind any wall is 0.
- [ ] F20. The sold and handed-out control filters from the top of the catalogue in 1 tap and its counts equal the same counts from SQL; both numbers recorded.
- [ ] F21. All 5 provenance types render a mark at 390 px in both themes; converted to greyscale, count of pairs sharing a fill-and-shape combination is 0, and count of marks carrying hue is 0.
- [ ] F22. A second franchise with 2 categories, 1 new variant axis, and 3 items is added to the live database by row inserts only; a checksum over information_schema.columns is identical before and after, and both franchises appear in the catalogue franchise facet. Both checksums and the capture recorded.
- [ ] F23. Every permanent ID minted in the database returns 200 or a redirect chain ending in 200; count of 404s is 0 and count of chains over 2 hops is 0.
- [ ] F24. A merge and a rename each leave the pre-change permanent ID resolving to the surviving entry; both captured.
- [ ] F25. A specimen sheet shows the bundle manifest with a retailer named on each row that had one; after an edit by a second account, a before-and-after query shows 0 manifest rows lost and 0 retailer values cleared.
- [ ] F26. 20 queries covering title, catalogue number, barcode, and a one-word misspelling each return the expected entry; count of misses is 0.
- [ ] F27. With the database compute idle for 10 minutes, the catalogue and a specimen sheet each return a complete page in under 1.5 s; median of 5 runs recorded for each.
- [ ] F28. A collection of 1,000 copies paints its first screen within 1.0 s and records 0 tasks over 200 ms while scrolling to the last row; both recorded.
- [ ] F29. The collection table exposes at least 12 columns, sort on every one, and 3 saved views restored by name after a reload; captured.
- [ ] F30. Grading company, numeric grade, and certification serial each save independently; a copy with a company and no grade saves and renders, and a copy with a serial and no company saves and renders. Both captured.
- [ ] F31. Purchase price and market value render as 2 separate columns on the same row; captured.
- [ ] F32. A collection holding 3 currencies produces a total in the chosen currency equal to the same computation from the stored rate table; both numbers recorded.
- [ ] F33. For 30 variants with no recorded sale, the value cell states the basis in words; count rendering a dash, a zero, an error, or a blank is 0.
- [ ] F34. Every market value shown names its basis and its observation period; count missing either is 0.
- [ ] F35. An export of a 1,000-row collection re-imported into an empty account produces 1,000 rows; count of differing cells between the source export and the re-export is 0.
- [ ] F36. The export carries every user copy field including custom fields and has no row cap; the exported row count equals the SQL row count.
- [ ] F37. A 41-column source file imports with column mapping; count of dropped columns is 0, and each unmapped column appears as a named field on the copy detail screen and as a column in the next export.
- [ ] F38. An import with 5 malformed rows reports each failing row number and its reason and imports the remaining rows; captured with both counts.
- [ ] F39. Duplicate from similar produces a new copy with every field except the identifier pre-filled in 2 taps; 10 consecutive entries complete in under 3 minutes, timed.
- [ ] F40. A saved template applies to a new catalogue variant; 5 near-identical variants are entered from it with 5 or fewer fields typed per entry, counted.
- [ ] F41. A new catalogue entry is publicly readable at its permanent ID before any review; the save timestamp and the successful fetch timestamp are both recorded.
- [ ] F42. A suggestion renders on the entry page as a field-level diff, the contributor's written reason, the editor's written reason, and a reply; all four captured on one screen.
- [ ] F43. A declined suggestion stays readable and reopens; captured in both states.
- [ ] F44. A canonical field overwritten by a second account restores from history in 3 actions or fewer; the before, after, and restored values recorded.
- [ ] F45. Contributor credit renders as body text under the photograph and is byte-identical after a merge and a variant restructure; captured before and after.
- [ ] F46. A moderator's view of a suggestion contains 0 occurrences of the 6 sentinels.
- [ ] F47. The response of every public route (catalogue, specimen sheet, public profile, list, recent additions) contains 0 occurrences of the 6 sentinels; the swept route list recorded.
- [ ] F48. No setting makes a collection total public; count of controls that do is 0.
- [ ] F49. A public profile browsed signed out shows the other collector's copies, their photographs, and the credit under each; captured.
- [ ] F50. A wantlist match between 2 accounts surfaces on both profiles; captured.
- [ ] F51. A photograph carrying GPS EXIF is uploaded and fetched back with 0 EXIF tags; the before and after metadata dumps recorded.
- [ ] F52. Every image on every route loads from the image host named in the privacy notice; count of image bytes served from the app origin is 0, from a network capture.
- [ ] F53. Photographs per copy cap at 5 and the cap is stated on screen before the sixth upload; captured.
- [ ] F54. Before the file picker opens, the upload flow states that photographs must be of the user's own items and names the report path for people in the frame; captured.
- [ ] F55. An in-progress filter, a saved view, and an open variant picker each survive a refresh with state intact; all three captured before and after.
- [ ] F56. Every error state offers a next action; count of dead ends across the 7 screens is 0.
- [ ] F57. Every control that starts work either finishes within 100 ms or shows progress within 100 ms; count doing neither across the 7 screens is 0.
- [x] F58. A camera scan resolves an identifier on a device with a camera, and typed entry reaches the same verdict on a device without one; both captured.
- [ ] F59. A copy saved signed out and then claimed at sign-in produces the same row count before and after; both counts recorded.
- [ ] F60. The wantlist is a view of the collection sharing its columns and its saved views; captured beside the owned view.
- [ ] F61. Quantity on a copy accepts a value above 1 and the collection total counts it; the entered quantity and the total recorded.
- [ ] F62. Sign-in completes on the live URL by at least 2 independent methods and the session survives a browser restart; both captured.

## Craft

References screens 01 aisle check, 02 catalogue, 03 specimen sheet, 04 my collection,
05 public profile, 06 contributor from DESIGN.md, plus the landing page, and the
standards skill.

Direction is Chromatic Era, dual theme, per DESIGN.md. Lines C3, C9, C10, C12, C13,
C14, C22 and C23 were retargeted from the retired Field Registrar direction on
2026-08-17: each keeps its threshold and changes only what it points at. C25 to C30
are new, added because the dual theme is new scope and an unverified second theme is
not a shipped second theme.

- [ ] C1. All 7 screens captured at 390, 768, and 1440 in the dark theme; count of clipped or overflowing elements is 0. 21 captures.
- [ ] C2. All 7 screens captured in loading, empty, error, and offline states; count rendering an unstyled browser default is 0. 28 captures.
- [ ] C3. Contrast measured against the built interface in both themes, 8 pairs, numbers recorded. Dark: ink3 on the canonical surface at or above 4.5:1; mint on the ground at or above 4.5:1; flare on the canonical surface at or above 4.5:1; edge as a control boundary on the ground at or above 3:1. Light: ink3 on the personal surface at or above 4.5:1; mint on the personal surface at or above 4.5:1; flare on the personal surface at or above 4.5:1; the focus ring against the canonical surface at or above 3:1.
- [ ] C4. Every interactive control on the 7 screens shows a visible focus indicator; count without one is 0.
- [x] C5. Every form control carries a programmatic label; count without one is 0.
- [x] C6. Every image carries descriptive alternative text or is marked decorative; count with neither is 0.
- [x] C7. No interactive target measures under 44 px on its shortest side at 390 px; count of violations is 0.
- [x] C8. Every margin and padding value the product's own rules set is drawn from 4, 8, 12, 16, 20, 24, 32, 40, 56, 72; count of off-scale values is 0.
- [ ] C9. Every corner radius the product's own rules set is 0, because the 45 degree cut carries what a radius would; count of non-zero radii is 0, and count of settled surfaces missing the cut is 0.
- [x] C10. Exactly 2 type families load, Archivo and IBM Plex Mono, both served from the app origin; requests for type to a host the product does not operate number 0.
- [ ] C11. Numbers sitting in table columns render with tabular figures; count of numeric columns with proportional figures is 0.
- [ ] C12. The verdict slab arrives at full width in 220 ms with 0 opacity change; captured as a frame sequence with the measured duration recorded. Every other transition measures 140 ms on cubic-bezier(.2,.8,.2,1); count of transitions off that duration or curve is 0.
- [x] C13. With reduced motion requested, the verdict slab arrives with 0 travel and 0 scale while the slab, its colour and its cut remain; captured.
- [ ] C14. A theme change repaints in a single frame; count of animated colour transitions during a theme swap is 0, and count of transform animations outside the verdict across the 7 screens is 0.
- [ ] C15. Console errors across the 7 screens and the core loop number 0.
- [ ] C16. Under the pseudo-locale, every user-visible string renders transformed; count of untransformed strings across the 7 screens is 0.
- [ ] C17. At 40 percent text expansion, the 7 screens at 390, 768, and 1440 show 0 clipped or overflowing strings. 21 captures.
- [ ] C18. Dates, integers, decimals, and currency follow the browser locale: a de-DE capture shows 1.234,56 EUR and 17.08.2026, and the same rows in en-GB show the en-GB forms. Both captured.
- [x] C19. The shipped strings contain 0 em dashes, 0 emoji, and 0 occurrences of seamless, robust, delve, effortless, elevate, unlock.
- [ ] C20. Every empty state names the next action; count of empty states without one is 0.
- [ ] C21. The product name renders identically in the wordmark, the browser tab title, the social card, and the About page; 4 captures.
- [ ] C22. Personal fields render only on the recessed personal surface, in both themes: a sweep of the 7 screens finds 0 occurrences of purchase price, acquisition source, storage location, private notes, or certification serial on the canonical surface. Canonical is lighter than its ground and personal is darker than its ground in both themes; count of surfaces violating that vector is 0.
- [x] C23. The verdict word is live text and never an image, fitted to width between 26 px and 46 px; the rendered font size at 390 px and at 1440 px are both recorded and both fall in that range.
- [ ] C24. Every screen holds one footer line carrying the disclaimer; count of screens without it is 0.
- [ ] C25. Theme parity. All 7 screens captured at 1440 and 390 in the light theme, 14 captures; count of clipped or overflowing elements is 0, and count of text pairs measuring below 4.5:1 in either theme is 0.
- [ ] C26. Declare, do not inherit. Every CSS rule that sets font or background on a text-bearing container also sets color; count of violations is 0. Count of literal colour values outside the token definitions and the photograph object classes is 0.
- [x] C27. The theme choice persists across a reload and across a new session on the same device; captured before and after each.
- [x] C28. With no explicit choice stored, the theme follows the device setting and the control names which mode it resolved to; captured with the device set to light and again set to dark.
- [x] C29. No flash of the wrong theme on first paint: a cold load captured in each of the 3 stored states shows 0 frames rendered in the other theme.
- [ ] C30. Chroma is a two-word vocabulary: mint appears only on settled states and flare only on unsettled states; count of coloured elements carrying neither meaning is 0.

## Release

- [ ] R1. The production URL returns 200 for the landing page, the catalogue, a specimen sheet, a public profile, and the check screen; the 5 status codes recorded.
- [ ] R2. A second deploy from a clean checkout reaches the same URL and those 5 routes return 200; the second deployment id recorded.
- [ ] R3. The rollback command with this project's real ids is recorded in REPORT.md, executed once against a prior deployment, then reversed; both outputs recorded.
- [ ] R4. Environment variable names are listed in REPORT.md and 0 values appear anywhere in the repository.
- [ ] R5. Database size on the live database is at or under 350 MB and object storage use is at or under 7 GB; both numbers recorded with the queries that produced them.
- [x] R6. No advertisement, donation control, payment control, or affiliate link appears on any route; count is 0.
- [ ] R7. A sign-in on the live URL completes for an account that is not the operator's own; captured.
- [ ] R8. The catalogue holds at least 220 items and 380 variants across at least 12 categories, with all 5 provenance types present and at least 60 handed-out variants; the counts recorded from SQL.
- [ ] R9. Every barcode value in the live database passes its check digit; count of failures is 0.
- [ ] R10. Every catalogue item, variant, identifier, and bundle component carries a linked source with a URL and a retrieved_on date and a verification row naming a method; count of rows missing any of these is 0.
- [ ] R11. 20 randomly sampled variants re-opened against their cited source match on title, year, and identifier; count of mismatches is 0, with the sample list recorded.
- [ ] R12. Market value holds at least 80 rows with a cited basis, of which at least 30 carry no recorded sale; both counts recorded.
- [ ] R13. The About page states the verified entry count and the verification methods on screen; captured.
- [ ] R14. **OPERATOR.** GDPR processors. Art. 28 contracts recorded for the hosting, database, and object storage providers, with a data location recorded for each. Three, not four: with no registered domain there is no verified sending domain, so no mail provider processes personal data in v1 and naming one would be a defect. Artifact: the three accepted terms and the three location records. If a mail provider is ever added, this line reopens.
- [ ] R15. GDPR lawful basis. The privacy notice names contract for the account and the collection, and consent for anything non-essential, purpose by purpose. Artifact: the live privacy notice URL, captured.
- [ ] R16. GDPR retention. The privacy notice states a retention period for each data category: account, collection rows, photographs, sign-in tokens, notices, and the active-recipient counter. Artifact: the retention table on the live page, captured.
- [ ] R17. GDPR export. An export completed in a real session on the live URL downloads a file holding every field of that account's data; the file and the session are captured, and the file's row counts equal the SQL row counts.
- [ ] R18. GDPR deletion. An account deletion completed in a real session on the live URL removes that account's rows from every table; the session is captured and a post-deletion query returns 0 rows across the named tables.
- [ ] R19. GDPR photograph vector. The upload flow shows the other-people prompt before the file picker, and a report path is reachable in 2 taps from any photograph. Artifact: both captured.
- [ ] R20. ePrivacy zero banner. A first load in a clean profile and a browse of catalogue, specimen sheet, and profile reach no host outside the two the product operates, and set 0 storage items beyond those the privacy notice names as strictly necessary. Artifact: the network and storage capture.
- [ ] R21. DSA Art. 16. The notice form collects a substantiated explanation, the exact location URL, the notifier's name and email, and a good-faith accuracy statement; a notice filed end to end shows all four in its stored record. Artifact: the form capture and the stored record.
- [ ] R22. DSA Art. 17. A removal produces a statement of reasons naming the action, the ground, the legal or contractual basis, the facts, whether detection or the decision was automated, and the redress route, delivered to the affected account inside the product. Artifact: the statement rendered in-product, captured.
- [ ] R23. DSA Art. 24(3). The transparency page publishes the average monthly active recipients figure, the counting method, and the period covered. Artifact: the live page, captured.
- [ ] R24. IP, name and hostname. The product name and the deployed hostname contain no trademark, and the franchise names appear only in descriptive copy. Artifact: the hostname plus a sweep of the wordmark, tab title, and social card returning 0 trademark occurrences.
- [ ] R25. IP, imagery. Every image on the live product is a user photograph or a product-generated asset; count of official rights-holder art is 0, confirmed by an inventory of every image key with its origin.
- [ ] R26. IP, disclaimer. The unofficial-and-unaffiliated line appears in the footer of every route and on About; count of routes without it is 0.
- [ ] R27. IP, takedown path. A rights complaint filed through the same form as an Art. 16 notice produces a record in the same store; count of separate takedown systems is 1.
- [ ] R28. launch/ holds 5 screenshots carrying real catalogue content with a caption strip of exactly 4 words on each; count of placeholder rows visible in any capture is 0.
- [ ] R29. The landing page above the fold at 390, 768, and 1440 carries the name, one sentence, and one action, and shows the core loop as a capture; count of competing calls to action above the fold is 0.
- [ ] R30. The icon reads at 48 px with one shape, two colours, and no text; captured at 48 px.
- [ ] R31. 10 sampled social card URLs each return a 1200 by 630 image carrying the entry title at a cap height of at least 40 px; count of blank or missing cards is 0.
- [ ] R32. The launch post in launch/ names the verified entry count and contains 0 em dashes and 0 emoji.
- [ ] R33. REPORT.md lists the launch/ contents, the deployment URL, the environment variable names, and the rollback command with real ids.

## Disqualifiers

Any one of these unchecked blocks PASS on its own.

- [ ] D1. Placeholder copy: count of lorem ipsum, TBD, Untitled, Example, and sample strings visible anywhere on the live product is 0.
- [ ] D2. Default favicon: the browser tab shows the product icon on all 7 screens; count of default marks is 0.
- [ ] D3. Unstyled empty or error states: across the 28 state captures, count rendering browser defaults or unstyled text is 0.
- [x] D4. TODO markers: count of TODO, FIXME, XXX, and HACK markers in shipped code is 0.
- [ ] D5. Single-viewport checking: every screen carries captures at 390, 768, and 1440; count of screens with fewer than 3 is 0.
