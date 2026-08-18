# Operator assets

## The operator's own collection photographs

**Path:** `~/Claude/My collection`
**Contents:** 1,334 files, 3.6 GB. 1,328 JPEG, 6 MOV. Sampled at 4284 by 5712, so
24 megapixel phone photographs, flat in one directory, `IMG_nnnn` names, no subfolders.

Supplied by the operator on 2026-08-18 as photographs of items they actually own.

### Why this matters more than test fixtures

**1. In-hand photographs are the strongest verification method in the rubric.**
PLAN.md ranks verification methods and puts *an in-hand photograph of the artefact
showing the number* at the top, above publisher archives and auction records. R10
requires every seeded row to carry a verification row naming a method. Where one of
these photographs shows a spine, a barcode or a catalogue number legibly, it verifies
that row better than any web source can, because the operator holds the object.

This is worth a pass before slice 2 grows the catalogue to 220. It is not a substitute
for the web research, it is the strongest tier of it.

**2. Real photographs for the upload path, slice 5.** The upload flow resizes on the
device to three derivatives, thumb 200, card 600, full 1400, and that re-encode is what
strips EXIF. A 24 megapixel source is the honest input for that: it exercises the resize,
the memory ceiling and the upload time far better than a small fixture would.

**3. R28 wants five launch screenshots carrying real catalogue content.** These make
that real rather than staged.

### Sampled, 2026-08-18, three photographs across the set

What they actually contain, so nobody plans a pass on an assumption:

- A **Tomb Raider Colossal Collection Volume One** hardcover, photographed in its
  shipping box. Front cover, title and volume legible.
- A **Lara Croft Tomb Raider: The Cradle of Life** statue on a water-splash base, with
  a branded wristwatch and a Land Rover Defender model in the same frame.

Three things follow.

**They are hero and shelf shots, not evidence shots.** Both samples show the front or
the display face. Neither shows a spine, a back cover or a barcode. So an in-hand pass
over these verifies **identity and existence**, which is real and useful, but it does
not by itself verify a catalogue number or an EAN. Some of the 1,334 may show backs; a
survey would establish how many. Do not plan on it until counted.

**They reach categories the web cannot.** PLAN.md names the sponsorship tie-ins as
coverage targets, specifically Larazade and the SEAT and Land Rover 2001 items, and a
Land Rover model is sitting in the second sample. Merchandise like a branded watch or a
film-era statue is exactly the material that retailer archives never listed and that
databases record badly. **This collection is the best available source for the
handed-out and sponsorship rows, which are the hardest 60 variants in the plan.**

**Several items per photograph.** A shelf shot showing four items is four rows of
evidence, not one, and one photograph can serve several catalogue entries.

### Surveyed 2026-08-18: an evenly spaced sample of 40, counted

| Bucket | n=40 | projected over 1,334 |
|---|---|---|
| **A** identifier legible and transcribable | 13 (32.5%) | ~434 |
| **B** identifier present but unreadable | 1 (2.5%) | ~33 |
| **C** no identifier, item identifiable | 23 (57.5%) | ~767 |
| **D** not confidently identifiable | 3 (7.5%) | ~100 |

At n=40 the 95 percent interval on that 32.5 percent is roughly 18 to 47 percent. Order
of magnitude, not a precise count.

**The answer to the question: only some, and the split is mechanical rather than
random.** An identifier is legible whenever **packaging is in the frame**: a box, a
blister pack, a shrink-wrapped label, a shipping carton, or printed matter shot by its
cover or back cover. It is absent whenever the item was photographed **unboxed on a
shelf**, front-facing, because the operator shot the display face rather than the
paperwork face once an item had been unpacked.

So this is a targeting problem, not a write-off.

### Thirteen identifiers already usable, no re-shoot needed

Read verbatim from the sample. These are in-hand verification at the strongest tier
and can seed catalogue rows immediately.

| File | Item | Identifier |
|---|---|---|
| IMG_0436 | Timex Tomb Raider watch | P.991-093236, D.990-093133 |
| IMG_0953 | Comix 2000 supplement | ISBN 88-8290-114-9, EAN 9788829011419 |
| IMG_3320 | China SatCom Lara Croft phone cards | JL-06-W-P36(4-1) through (4-4) |
| IMG_3476 | Dark Horse Lara Croft PVC statue carton | ITEM NUMBER 3014-202 |
| IMG_3569 | Semic Comics Tomb Raider, French | N°6, 25F |
| IMG_4325 | Nokia 3310 faceplates | 9054862061010, 4250043108195 |
| IMG_4427 | Underworld board game / video game | 3760017146650 |
| IMG_4676 | SWTOYS 1:6 figure | NO: FS061 |
| IMG_6154 | Shark Robot packing slip | Order 1745723, itemised |
| IMG_6879 | GameTap dog tags | 1, 4, 6 and 7 OF 7 |
| IMG_8067 | Tomb Raider backpack | STYLE TRBK0001-UK, EAN 671803582538 |
| IMG_8192 | Shadow of the Tomb Raider novel | ISBN 9781785659911 |
| IMG_9834 | Playmates Lara in Jungle Outfit | STOCK NO. 72002 |

### Check-digit verification of the transcribed identifiers: three of six FAILED

Run before any of this reached the catalogue. The result changes what should be done
with it.

| File | Item | Value read | Result |
|---|---|---|---|
| IMG_8192 | Shadow of the Tomb Raider novel | 9781785659911 | **PASS** |
| IMG_8067 | Tomb Raider backpack | 671803582538 | **PASS** |
| IMG_4325 | Nokia 3310 faceplate B | 4250043108195 | **PASS** |
| IMG_0953 | Comix 2000 supplement | 9788829011419 | **FAIL** |
| IMG_4325 | Nokia 3310 faceplate A | 9054862061010 | **FAIL** |
| IMG_4427 | Underworld board and video game | 3760017146650 | **FAIL** |

The Comix 2000 case shows what went wrong, and it is transcription rather than a fake
barcode. Its printed **ISBN-10, 88-8290-114-9, validates correctly**. The EAN-13 for
that ISBN is **9788882901141**. The survey recorded **9788829011419**: a digit dropped
and the tail transposed. The object is real and the number on it is right; the reading
of it is not.

**So these were not added to the catalogue.** A 50 percent transcription failure rate
means the identifiers are two removes from the object here, a survey reading a
photograph and the lead reading the survey, and R11 re-opens twenty sampled variants
against their cited sources. Seeding numbers at this confidence would put exactly the
kind of wrong digit into the catalogue that the 220-item decision was made to avoid.

**What to do instead**, in order of value:

1. **Re-read the identifiers directly from the photographs at full resolution**, one
   pass, treating each as evidence rather than a note. Check-digit every barcode at the
   point of reading and re-read any that fails rather than recording it.
2. Prefer identifiers that carry their own check digit, and where an ISBN-10 and an
   EAN-13 both appear, record the ISBN and derive the EAN rather than reading both.
3. Only then seed, with `in_hand_photograph` verification and a `photograph` source
   naming the file.

The prize is still real and still worth the pass: **the catalogue currently holds zero
apparel and zero sponsorship tie-ins**, and these photographs cover both, including the
China SatCom phone cards and the GameTap dog tags that no retailer archive ever listed.

### The handed-out category is not the bottleneck it was assumed to be

Six confident and one possible handed-out or sponsorship item in a sample of 40, so 15
to 17.5 percent. Projected over the collection that is well past the **fifteen**
handed-out variants slice 1 needs and comfortably toward the **sixty** the full plan
wants.

Named in the sample: the "Virtual Challenges" Conqueror hoodie, a Tomb Raider
Experience Seattle shirt, the **China SatCom phone cards** (a 2001 film telecom
sponsorship tie-in, exactly the `sponsorship-tie-ins` category), GameTap artist dog tags
numbered X of 7, a Glénat Dark Aeons store standee, and a REVISIONED dog tag.

These are items retailer archives never listed. **This collection is the primary source
for them, not a supplement to one.**

### The targeted second pass, if the operator wants to spend twenty minutes

Do not re-shoot 1,334 photographs. Three specific shots convert most of bucket C:

1. **The underside of standing statue and figure bases.** Limited editions are numbered
   there, often as "144 of 500", which is both an identifier and an edition size.
2. **Hang tags on unpacked apparel.** The sewn wash label rarely carries a barcode; the
   hang tag does, where it survived.
3. **Back covers of anything shot front-only**, for books, comics and home video.

Anything still boxed or shrink-wrapped is already covered.

### Constraints

- **These are the operator's personal files. They stay local.** Do not copy the
  directory into the repository, do not commit any of it, and do not upload any of it
  anywhere except through the product's own upload path against a local or operator-owned
  bucket. `evidence/screens/` is gitignored; 3.6 GB must not enter git history.
- **F51 needs a photograph that carries GPS EXIF.** A Spotlight check on a sample
  returned no latitude or longitude, so these may already be stripped. F51 tests that
  upload removes EXIF, so if none of these carry GPS, the test must synthesise a file
  that does. Testing against an already-clean file proves nothing.
- Check orientation. Phone photographs carry an EXIF orientation flag, and a resize that
  ignores it silently rotates the image. That is a real defect the derivatives would bake in.
