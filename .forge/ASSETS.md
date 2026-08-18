# Operator assets

## The operator's own collection photographs

**Path:** `/Users/lambertbouley/Claude/My collection`
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
