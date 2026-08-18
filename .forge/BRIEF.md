# Brief
Goal: an app for tomb raider merchandising collectors to see everything that has ever been sold or handed out branded tomb raider or lara croft, to manage their collection, including which items they have, when they purchased it and at what cost, and browsing other collectors collection

## Done level
Deployed plus launch assets. Live public URL, real database, real accounts, seeded
catalogue, plus the launch-kit assets: landing copy, screenshots, social cards, and
a launch post aimed at collector communities.

## Hard constraints
- Web app, mobile-first. Responsive, designed for a phone in a collector's hand at
  a flea market or convention. Works on desktop. No native app store build.
- EU / GDPR jurisdiction. Operator is in the EU. Lawful basis, cookie consent,
  data export and delete, and processor terms must be right.
- Free tier hosting only. Vercel free tier plus a free Postgres tier. No paid
  services, no per-seat costs.
- Professional-grade design and UX/UI. Not a hobby build. The interface quality is
  a hard constraint, not a nice to have.
- Catalogue schema must generalize. The product is Tomb Raider first, but the data
  model and the UI must extend to other collectible franchises later without a
  rewrite.

Resolved by scout research, now binding (see Research and .forge/research/D):
- The product name and domain carry no trademark. "Tomb Raider" and "Lara Croft"
  appear only in descriptive copy. This also serves the generalization constraint.
- Zero official art ships. Catalogue entries are text-first. Item images are the
  users' own photographs of their own items.
- One persistent unofficial-and-unaffiliated disclaimer, footer and About.
- No money moves in v1. No ads, no donations, no marketplace. That keeps Vercel
  Hobby lawful, keeps DSA trader-traceability and PSD2 out, and keeps nominative
  fair use strong.

## Taste references
- Discogs. The canon. A definitive community catalogue with releases and variants,
  and a per-user collection carrying purchase date and price. Dense, data first.
- Letterboxd. Warm, opinionated, social. A grid worth browsing, lists, and profiles
  with personality. The reason someone opens the app when they are not logging.
- Notion / Airtable. Flexible views, filters, and saved queries. Power-user data
  management underneath the browsing layer.
- Plus: survey what collection-management products ship today (as of 2026-08) and
  adopt what is table stakes. Scope research to current products, primary sources
  first. Comprehensiveness is the bar.

## Research

Four scout dispatches, 2026-08-17. Full returns in .forge/research/A through D.

### The subject: what is actually out there

Thirty years of goods, 1996 to now. Games with regional and label variants (PAL,
NTSC, NTSC-J; Black Label vs Platinum and Greatest Hits reprints; Collector's,
Limited, Survival editions whose bundle contents differed by retailer and region).
Statues and figures from Playmates, ToyBiz, Sideshow, Gaming Heads, PCS, the 2026
Hasbro G.I. Joe crossover, the Tonner boxed doll, TUBBZ, Funko. Comics from Top Cow,
Dark Horse, IDW. Tie-in novels. Two Paramount films and the 2018 reboot, with VHS,
DVD, Blu-ray steelbooks, prop replicas, lithographs. Soundtracks and vinyl including
the 2025 first pressing of Nathan McCree's 1996 score. Trading cards, a pinball
machine, board games. Sponsorship tie-ins: Lucozade and the 1998 Larazade
bottle-in-box, SEAT and Land Rover for the 2001 film.

And the long tail collectors actually chase, which is the whole point of the goal:
things never sold. E3 giveaways, cardboard standees, press kits (the Chronicles kit
with its Scarab of Darkness challenge disc), retailer preorder bonuses, convention
exclusives, magazine subscription premiums like the French Official Fact Files resin
partwork. **Sold versus handed out is a first-class field, not a tag.**

Size: no authoritative count exists. PriceCharting alone lists about 100 distinct TR
game SKUs. Across every category and territory the realistic total is **1,500 to
4,000 distinct catalogue entries**, comparable to a mid-size Discogs discography.

### The gap

Nothing combines structure, completeness, and collection management. The existing
resources are prose galleries (tombraiderchronicles, virtuallara, a merch Tumblr),
one collector's personal showcase, a gameplay-oriented hub (tombraiders.net), and a
fan wiki with inconsistent merch coverage. Collectors currently use **saved eBay
searches as their database.** That is the opening.

### The vocabulary that must be modeled

Region and language variant. Print and label (first print vs reprint, Black Label
vs Platinum). Edition name with exact bundle contents. Completeness: Sealed vs CIB
vs loose, manual present, seal intact, box wear. Grading as three separate fields:
company (WATA, now PSA Video Games, with split box and seal grades; VGA's 100-point
combined; CGC), numeric grade, certification serial. Provenance type: retail,
promotional, press, convention exclusive, preorder bonus. Publisher era (Core
Design, Eidos, Crystal Dynamics, Square Enix), which feeds authenticity arguments.
Print run and numbering. SKU, barcode, catalogue number, vinyl matrix/runout.
Release year distinct from the copyright year printed on packaging.

### The competitive bar

Table stakes, strict, from surveying Discogs, CLZ, hobbyDB, Colnect, BrickLink,
Brickify, Collectr, Ludex, Card Ladder, VGCollect, PriceCharting, Backloggd:
canonical item separate from the user's copy, with real variant support; per-copy
condition, purchase date, purchase price, quantity, location, notes, photo;
wantlist separate from owned; a collection value computed from market data, not
just the sum of receipts; CSV export; a public browsable profile; search and filter
across the catalogue; a mobile entry flow where camera capture is now an
expectation; and a free tier that is genuinely usable, not a trial.

Differentiators only the best ship: scan-to-catalogue with a confidence score,
automatic wantlist matching across the community, price history from real sales,
passive value-change notification, direct trade between two users, and one schema
spanning categories.

What people complain about: broken search and sort, session bugs, and above all the
**double paywall**, where cataloguing costs one subscription and knowing what your
stuff is worth costs another. And fragmentation: three tools for inventory, value,
and social, because none does all three.

**Schema lesson, four layers**: Franchise/Category, then CatalogueItem (canonical,
community-edited through a moderation queue), then Variant as its own entity and
never a free-text field, then UserCopy carrying everything personal. Treating
Variant as an entity is precisely what lets this generalize past Tomb Raider,
because franchise, category, and variant axis become data rather than columns.

### The platform, and where free stops being free

Vercel Hobby: 100 GB transfer, 1M function invocations, 4 CPU-hours, **5K image
transformations per month**, and a commercial-use restriction that a donate button
alone would trip. Vercel Postgres no longer exists; it became Neon in 2024.
Neon Free: 0.5 GB, 100 CU-hours, EU Frankfurt, scale-to-zero after 5 min idle, and
critically **pause not delete**. Supabase Free pauses the entire project, database,
storage and auth together, after one quiet week, which is disqualifying for a slow
launch. Cloudflare R2: 10 GB and **free egress for everyone**, the only storage with
real headroom, at the cost of no free transform pipeline, so thumbnail at upload.
Resend: 3,000/month, the only durable free email tier left; SendGrid's became a
60-day trial. Search is Postgres `tsvector` plus `pg_trgm`; no free search service
survives at this row count.

**First wall: Neon's 0.5 GB.** Photos must never touch Postgres. Second wall on a
launch spike: Vercel's 100 GB transfer, eaten by thumbnail grids on cache misses.

### What the law actually requires

**Fires.** GDPR in full: contract as the basis for the account and collection,
consent only for the non-essential; export and deletion that work end to end;
retention stated per category; processor contracts with Neon, R2, and Resend. A
purchase price for a hobby item is ordinary personal data, not Art. 9 sensitive, so
do not over-engineer it. The real vector is uploaded photos that incidentally
capture another person, which needs a prompt in the upload flow and a report path.

DSA Art. 16 and 17 fire regardless of size, because this hosts user content: a
notice-and-action mechanism and a statement of reasons on removal. Art. 19's micro
exemption reaches Section 3, so no complaint system, no out-of-court settlement, no
transparency report, **except Art. 24(3), publishing average monthly active
recipients.**

**Does not fire.** The European Accessibility Act: its Annex I enumerates covered
services and a free non-transactional tracker is in none of them. WCAG 2.1 AA stays
as a craft floor by choice, not as a legal Release line. The Cyber Resilience Act:
the 11 September 2026 date is confirmed, but the Commission's March 2026 guidance
puts browser-only web services outside scope absent a companion product. No SBOM
obligation. Both flip the moment a downloadable client ships.

**Cookies.** The Digital Omnibus is still in trilogue; build against ePrivacy as it
stands. A lawful **zero-banner** path exists: strictly-necessary cookies only plus
first-party cookieless analytics setting no identifier. Any third-party SDK brings
the banner back.

**Trademark.** Nominative fair use under Directive 2015/2436 Art. 14(1)(c) lets the
catalogue name the marks descriptively, and requires that it not adopt them as its
own identity. Facts are free: titles, years, and variants carry no copyright, and
compiling them yourself creates no database-right exposure. Official art does carry
copyright, so none of it ships. Discogs and Brickset are the models: user
photographs, conspicuous disclaimer, franchise named only descriptively. Enforcement
history is tolerant of disclaimed non-commercial fan projects and hostile to leaks
and commerce. The takedown path runs through the same Art. 16 mechanism the DSA
already demands, so it is one system.

## Panel

Three interviews, 2026-08-17. Marek Dvořák, aisle buyer, 210 items, works Czech and
cross-border fairs on one bar of signal. Sanne de Vries, archivist collector, 940
items in a 41-column spreadsheet, eight graded slabs, an insurance broker waiting on
a valuation. Camille Roux, ephemera contributor, photographs press kits and
convention giveaways that never had a barcode.

### Three findings

**1. The incumbent is not a competing product. It is a file they own that has never
failed them.** A phone album called Regál. A spreadsheet that survived four laptops.
A Tumblr shot on a grey sweep and tagged by hand. None of them spin, none of them
overwrite, none of them ask permission. Feature parity does not beat that. Only
reliability does. And the first failure is terminal, in all three transcripts, in
nearly the same words: watch it fail once in the hall and go back to shelf photos
for good, back in the spreadsheet within the hour and no second attempt for a year,
gone in the first five minutes. There is no second impression to spend. Put the
polish on first contact: first search, first import slice, first entry submitted.

**2. One schema, three speeds.** Marek needs twenty seconds, one hand, radio off,
one question answered: do I already own this. Sanne needs a thousand rows, saved
filter combinations, and fields clean enough to hand a broker. Camille needs to
enter three hundred near-identical objects with duplicate-from-similar and saved
templates. Same four-layer model underneath, three genuinely different surfaces on
top. Marek named the trap outright: the aisle and the sofa are two different jobs,
and most tools design only the second. A single density ships a product that is
wrong for two personas out of three.

**3. Churn is triggered by loss, not by absence.** Not one of them threatened to
leave over a missing feature. Every one of them described an irreversible loss and a
decision never to come back: a false "not in your collection" costing a real 900 CZK
duplicate, a moderator correction stripping a bundle manifest that existed nowhere
else because the box is long gone, a photo credit vanishing in a merge, a permalink
404 after a schema change. Sanne and Camille have each already lived a version of
this and each stopped filing. Durability and reversibility are retention work, not
hygiene.

One more, unprompted and unanimous: three people with almost nothing in common named
the double paywall as the line that ends the trial. It confirms the scout finding.

### Three table stakes

**1. The user's own collection works with the radio off.** Whole collection cached on
device after first sync, thumbnails included, search running against the local copy,
and a typed query that survives a dropped connection. The web-app constraint makes
this a service worker and a local store, not a later optimization. Duplicate checking
that needs a network call has not beaten the photo album, it has added steps to it.
Where matching is unsure, say so and show the thumbnail of what is already owned. A
confident false negative costs real money.

**2. Structured fields everywhere the rest of the market ships a notes box.**
Provenance type as controlled vocabulary (retail, promotional, press, convention
exclusive, preorder bonus), filterable, never a tag. Grading as three independent
fields: company, numeric grade, certification serial. Variant as an entity carrying a
bundle manifest with retailer attribution. Structured acquisition source,
multi-currency purchase price, quantity for deliberate duplicates. Plus a complete
CSV export, every field, no row cap, and a CSV import with column mapping that keeps
a collector's own variant codes as data instead of discarding them. The export is
what makes migration safe enough to attempt at all.

**3. A market value in the free tier, separate from what was paid, with a basis you
can point at.** Per item, from comparable sales, sitting beside purchase price rather
than replacing it. Sanne needs it for a broker. Marek needs it at a table deciding on
800 CZK. Behind a second subscription it is not a feature, and both said they would
be gone before entering ten items. It also has to degrade honestly: for a press kit
or a giveaway, an empty value is correct data, not an error state.

### One risk

**The community-edited canonical layer is what makes the catalogue complete and is
the single mechanism most likely to drive off the contributors who make it
complete.** The four-layer schema is right. The moderation queue sitting on top of it
is where the damage happens: a correction that overwrites a retailer-specific bundle
manifest, a merge that eats an attribution, a restructure that breaks a permalink.
The people most exposed are exactly the people entering the rarest items, the ones
nobody else can recreate. Camille will test that surface before testing anything else
and will not file a second entry into a black box. The mitigations belong in the
design, not in a later hardening pass: canonical entry strictly separate from the
user copy, so personal fields are never in a moderator's scope; a visible diff and a
written reason on the entry page, with a reply there, not a support email; permanent
IDs with redirects that survive merges and renames; contributor credit rendered as
visible text under the image, not a column nobody surfaces. Undesigned at the
greenlight, this gets discovered as churn after launch, and the data lost will be the
data that made the catalogue worth having.

