# Plan

Goal: a catalogue of everything ever sold or handed out under the Tomb Raider and
Lara Croft marks, plus collection management and public collector profiles, on a
schema that takes a second franchise as rows and not as a rewrite.

Done level: deployed plus launch assets. Deploy target: Vercel. The ship skill's
Vercel runbook applies as written.

## The stack

| Layer | Choice | Fixed by |
|---|---|---|
| Framework | Next.js, App Router | architect |
| Host | Vercel Hobby | brief, scout C |
| Database | Neon Postgres, EU Frankfurt | scout C |
| ORM | Drizzle | architect |
| Auth | Better Auth: GitHub and Google OAuth, email link when a domain exists | architect |
| Object storage | Cloudflare R2 | scout C |
| Mail | Resend | scout C |
| Search | Postgres `tsvector` plus `pg_trgm` | scout C |
| Currency rates | ECB daily reference rates, no key | architect |
| Analytics | no client script; server-side aggregate counters | architect |

Next.js App Router on Vercel with Drizzle over Neon, because the catalogue and all
380 specimen sheets generate statically and are then served without waking a
scale-to-zero database, while every image byte comes from R2 and none from the app
origin, which is the one shape that clears both free-tier walls at once: Neon's
0.5 GB and Vercel's 100 GB of transfer. Drizzle over an engine-backed ORM because
this schema needs SQL a reviewer can read and a migration can carry plainly,
generated `tsvector` columns, GIN indexes on `jsonb`, `pg_trgm` operator classes,
partial indexes, and a check constraint on a nullable pair, none of which should be
fought through a generator, and because no query-engine binary loads into a function
budget capped at 4 CPU-hours a month. Better Auth over a hosted identity service
because accounts, sessions, and collections then sit in one Postgres, which makes
account deletion a single transaction with no second vendor to reconcile, and which
avoids exactly the coupling that disqualified Supabase.

Version rule: resolve every dependency to its current stable release at install
time. Pin nothing from memory. Record resolved versions in REPORT.md.

### The offline boundary, which is what the framework choice turns on

Offline is a product requirement, not an optimisation, and server-driven routing is
where an App Router build normally breaks offline. The boundary is drawn once, here.
The builder does not move it.

- **Offline routes**, rendered on the client from the on-device copy with no server
  round trip in the read path: CHECK, COLLECTION, a collection item, and the offline
  catalogue index. Client-rendered leaves under a shared shell. A navigation between
  them never touches the network.
- **Online routes**, server-rendered and statically generated: catalogue browse,
  specimen sheet, public profile, lists, About, privacy, transparency. With the
  network down these render the designed offline state, never a browser error page.
- **On-device stores**: a compact catalogue index (public id, title, year, category,
  provenance, identifiers) budgeted at 400 KB compressed at 4,000 variants; the
  user's own copies in full; thumbnails as blobs; an outbox of pending writes; a meta
  record holding the sync cursor and the anonymous device id.
- **Writes** carry a client-generated operation id. The server keeps applied ids, so
  a replay after reconnect never double-writes.
- **Anonymous mode** writes only to the device. Nothing leaves the device until the
  user creates an account and chooses to claim.

The duplicate check reads the on-device copy first, every time. A network call may
refine a verdict. It may never gate one.

### Sign-in, and the domain question for the greenlight

Resend can only send to arbitrary recipients from a verified domain. On a
`*.vercel.app` host there is no domain to verify, so an email sign-in link cannot
carry public sign-up on day one.

Sign-in ships as GitHub OAuth plus Google OAuth. Both are free, neither caps at this
scale, and both are top-level redirects rather than subresource requests, so neither
touches the zero-banner claim. OAuth avatars are copied into R2 at first sign-in and
never hotlinked, so no third-party host appears in a page load. The email sign-in
link is built and stays disabled until a sending domain is verified; enabling it is a
configuration change, not a rewrite.

Greenlight decision: register a domain, or launch on the Vercel subdomain with two
OAuth paths. Either satisfies the mark-free hostname requirement. Nothing else in the
plan changes.

### Where the free tier stops, in numbers

- Neon 0.5 GB. Catalogue at 4,000 items and 8,000 variants with indexes lands near
  60 MB. A user copy row is roughly 400 bytes, so 100,000 copies is 40 MB. Photos
  never touch Postgres, only R2 keys do. Ceiling watched at 350 MB.
- R2 10 GB. Each photograph stores three derivatives: thumb 200 px, card 600 px, full
  1400 px, roughly 250 KB per set. A cap of 5 photographs per copy gives about 40,000
  sets, which is 40 collectors at 200 items with a photograph on every one.
- Vercel 100 GB transfer. With images on R2, a catalogue page costs the app origin
  around 120 KB on first load and 25 KB on subsequent navigation, so the wall sits
  past 800,000 first loads.
- Vercel image transformations: 5,000 a month, so zero are used. Thumbnails are
  produced on the device at upload by canvas re-encode, which also strips EXIF.
- Vercel Hobby cron: once per day per job. Two jobs, both daily: ECB rates, and the
  active-recipient rollup with its 32-day purge.
- Vercel Hobby forbids commercial use. No ads, no donations, no payments, no
  affiliate links ship. Nothing in this plan introduces one.
- Fonts are served from the app origin. Three Google faces loaded from a Google host
  would put a third-party request on every page and has already been ruled against in
  Germany, which would cost the zero-banner claim for nothing.

## The name

**Vitrine.** Chosen by the user at the greenlight. It carries no trademark, and it
survives a second franchise.

It exists in code as a single entry in the `en` message catalogue, read by the
wordmark, the browser tab title, the social card generator, the About page, and the
launch copy. No other occurrence.

The name means a glass display case, which tilts the product toward display rather
than toward the ledger. The chosen art direction answers that rather than ignoring
it: a display case with a ledger underneath, not a ledger with a window.

## The host

**The Vercel subdomain.** Chosen by the user at the greenlight. No domain is
registered, so Resend has no domain to verify and the email sign-in link is built but
never enabled. Sign-in is GitHub OAuth plus Google OAuth.

Consequence for the rubric: F62 and R7 join R14 as OPERATOR lines, because proving a
sign-in needs a real OAuth consent screen in a browser the verifier does not have.
Recorded at the head of DOD.md.

## Schema

Four layers, and one rule that makes them generalise: **franchise, category, and
variant axis are rows, never columns.** Adding a second franchise inserts rows into
six tables and alters none.

Every public row carries a `public_id`: ten characters of Crockford base32, minted
once, never reused. URLs are `/i/{public_id}/{slug}` and the slug is decorative.
Resolution goes through `permalink`, so a rename, a merge, or a split redirects
forever and nothing 404s.

### Layer 1: taxonomy and vocabulary

```
franchise            id, public_id, slug, name, summary, created_at
category             id, slug, name, parent_id, sort        -- global tree, franchise-free
provenance_type      id, key, label_key, is_sold bool, mark_style, sort
                     -- seeded: retail(sold, filled), promotional(pill),
                     --   press(square), convention_exclusive(double rule),
                     --   preorder_bonus(dashed). mark_style binds the design.
identifier_kind      id, key, label_key, validator
                     -- barcode_ean13, barcode_upca, catalogue_number, sku,
                     --   matrix_runout, asin, isbn, part_number
attribute_def        id, key, label_key, help_key, datatype, unit,
                     is_variant_axis bool, sort
                     -- datatype: text|integer|decimal|date|year|bool|enum|url
attribute_option     id, attribute_def_id, value, label_key, sort
category_attribute   category_id, attribute_def_id, required bool, sort
```

`attribute_def` is where per-category vocabulary lives: region code and label edition
on games, matrix and runout on vinyl, print run and edition number on statues, issue
number on comics. A new category with a new axis is rows in `attribute_def`,
`attribute_option`, and `category_attribute`. No migration.

### Layer 2: canonical catalogue, community-edited

```
catalogue_item       id, public_id, slug, franchise_id, category_id,
                     title, subtitle, release_year, copyright_year,
                     publisher, developer, description_md,
                     attrs jsonb, search_tsv tsvector GENERATED,
                     status(published|merged|withdrawn), merged_into_id,
                     revision int, created_by, created_at, updated_at
variant              id, public_id, catalogue_item_id, name,
                     provenance_type_id NOT NULL, region_note, release_date,
                     print_run int, edition_number text,
                     attrs jsonb, search_tsv tsvector GENERATED,
                     status, merged_into_id, revision, created_by, timestamps
variant_identifier   id, variant_id, identifier_kind_id, value,
                     normalized text GENERATED, source_id
                     -- btree on normalized, NOT unique: two variants may share a
                     -- barcode, and that collision is exactly the UNCERTAIN verdict
bundle_component     id, variant_id, sort, label, qty, note,
                     retailer, retailer_region, source_id
                     -- the bundle manifest, per-row retailer attribution,
                     -- per-row citation so a row cannot be stripped silently
item_attribute       catalogue_item_id, attribute_def_id, value_text, value_num,
                     value_date, option_id
variant_attribute    variant_id, attribute_def_id, value_text, value_num,
                     value_date, option_id
catalogue_photo      id, variant_id, catalogue_item_id, key_thumb, key_card,
                     key_full, width, height, bytes,
                     credit_name text NOT NULL, credit_user_id, source_photo_id
```

Provenance sits on the **variant**, not the item, because one release can have a
retail pressing and a press copy. `catalogue_item.attrs` carries a denormalised array
of its variants' provenance types, so the sold and handed-out control at the top of
the catalogue filters in one indexed read.

Two representations on purpose. `item_attribute` and `variant_attribute` rows are the
source of truth, because a field-level diff needs discrete fields. `attrs jsonb` with
a GIN index is maintained by trigger and is what facets query. Diffs need rows, facets
need documents.

Every catalogue item has at least one variant. An item entered with no known variant
gets one named from the message catalogue's default, so a user copy always points at a
variant.

### Layer 3: sources and verification

```
source        id, kind, url, title, publisher, retrieved_on date, note
              -- kind: primary_scan | publisher_page | retailer_archive |
              --   press_archive | auction_lot | photograph | database_entry
verification  id, target_table, target_id, method, source_id, verified_on,
              verified_by, note
              -- method: in_hand_photograph | publisher_archive |
              --   retailer_archive | press_archive | auction_lot_record |
              --   two_independent_databases
source_link   source_id, target_table, target_id, field_key
```

This exists so seed accuracy is a query, not a claim. One SQL statement counts seeded
rows with no verification. The rubric requires that count at zero.

### Layer 4: the user's copies, on a separate surface

```
user_account      id, public_id, email citext unique, handle citext unique,
                  display_name, bio, avatar_key, locale, country,
                  created_at, deleted_at
user_copy         id, public_id, user_id,
                  variant_id NULL, unfiled_title NULL, unfiled_identifier NULL,
                  CHECK (variant_id IS NOT NULL OR unfiled_title IS NOT NULL),
                  status(owned|wanted|ordered|sold|for_trade), quantity,
                  condition_id, completeness_id, seal_intact, box_wear_note,
                  acquired_on, acquisition_source_id, acquisition_detail,
                  price_amount numeric(12,2), price_currency char(3),
                  price_includes_shipping bool,
                  storage_location, private_notes,
                  grading_company_id, grade_value, certification_serial,
                  show_market_value_publicly bool DEFAULT false,
                  created_at, updated_at, deleted_at
grading_subgrade  user_copy_id, label, value    -- WATA's split box and seal
user_copy_custom  user_copy_id, key, value      -- an importer's own variant codes,
                                                -- kept as data, never discarded
user_copy_photo   id, user_copy_id, key_thumb, key_card, key_full,
                  width, height, bytes, caption, taken_on, sort, is_primary,
                  credit_name text NOT NULL, credit_user_id, created_at
saved_view        id, user_id, name, scope(collection|catalogue),
                  query jsonb, sort jsonb, columns jsonb, is_default
list, list_item   id, user_id, public_id, title, note, is_public / list_id, ...
follow            follower_id, followee_id, created_at
client_op         id uuid PK, user_id, applied_at    -- write idempotency
```

Grading is three independent fields: `grading_company_id`, `grade_value`,
`certification_serial`. Any one saves without the others. `grading_subgrade` carries
WATA's box and seal split without inventing a fourth required field.

`user_copy_photo.credit_name` is denormalised text on the **photograph**, so credit
survives a merge, a rename, or a variant restructure. Moderator tools never read this
table.

### Market value, free and honest

```
market_value  id, variant_id, condition_bucket(sealed|cib|loose|graded),
              amount numeric NULL, currency, basis, sample_size,
              observed_from, observed_to, source_id, computed_at
              -- basis: completed_sale | auction_result | dealer_asking |
              --   community_estimate | no_recorded_sale
fx_rate       base, quote, rate numeric, as_of date, source_id
```

`amount NULL` with `basis = no_recorded_sale` is correct data for a press kit or an E3
giveaway. The interface renders the basis in words. It does not render a dash, a zero,
or an error. Value data comes from cited comps entered against a `source`. No paid API.
Rates come from the ECB daily reference feed, which needs no key and is the right
provenance for an EU product.

### Contribution, moderation, and the notice mechanism

```
suggestion          id, public_id, target_table, target_id,
                    kind(edit|new_item|new_variant|merge|split|photo),
                    author_id, reason_md NOT NULL,
                    status(open|applied|declined|withdrawn|reopened),
                    decided_by, decided_reason_md, decided_at, created_at
suggestion_field    suggestion_id, field_key, before_value jsonb, after_value jsonb
suggestion_reply    id, suggestion_id, author_id, body_md, created_at
revision            id, target_table, target_id, revision int, changed_by,
                    suggestion_id, before jsonb, after jsonb, created_at
permalink           id, public_id unique, target_table, target_id,
                    is_canonical bool, created_at
notice              id, public_ref, target_table, target_id, category,
                    reporter_name, reporter_email, reporter_is_rights_holder,
                    statement_of_accuracy bool NOT NULL,
                    substantiation text NOT NULL, location_url text NOT NULL,
                    status, created_at, decided_at
                    -- carries DSA Art. 16(2)(a) through (d)
statement_of_reason id, notice_id, target_table, target_id,
                    action, ground, legal_ground, contractual_ground,
                    facts_and_circumstances, automated_detection bool,
                    automated_decision bool, redress_info, created_at,
                    sent_to_user_id
                    -- carries DSA Art. 17
recipient_day       day date, visitor_hash bytea, PRIMARY KEY(day, visitor_hash)
mar_month           month date, average_monthly_active_recipients int,
                    method_note, published_at
import_job          id, user_id, filename, row_count, mapping jsonb,
                    status, error_count, created_at, finished_at
import_row_issue    import_job_id, row_number, column_name, message
```

Entry creation is publish then review. A new item or variant goes live on save and
lands in the queue afterward. A `revision` row is written on every canonical write, so
a stripped bundle manifest is restored from history rather than retyped from a box
that no longer exists.

The rights-takedown path is the same `notice` table with
`category = intellectual_property`. One system, not two.

`recipient_day` holds a per-day hash of address and user agent under a salt derived
from the date, retained 32 days, then deleted. It sets nothing on the device, so it
triggers no banner. Its lawful basis is Art. 6(1)(c), compliance with a legal
obligation, because DSA Art. 24(3) requires the figure to be published.

### How franchise-agnosticism is achieved, and how it is proved

Nothing in the schema names Tomb Raider. The words appear in exactly two places: a row
in `franchise`, and descriptive copy in the message catalogue.

Adding a second franchise, with two categories it does not share and one variant axis
that does not exist yet, is:

```
INSERT INTO franchise ...                 -- 1 row
INSERT INTO category ...                  -- 2 rows
INSERT INTO attribute_def ...             -- 1 row
INSERT INTO attribute_option ...          -- n rows
INSERT INTO category_attribute ...        -- 2 rows
INSERT INTO catalogue_item, variant ...   -- the entries
```

The proof is a rubric line: perform that insert against the live database and show a
checksum over `information_schema.columns` identical before and after, while both
franchises appear in the catalogue's franchise facet.

## Seed data: how much, and how it is verified

The designer's mock numbers are plausible and unverified. A wrong SLES number in a
catalogue that sells itself on completeness is the first thing a collector finds, so
nothing plausible ships.

**Chosen: a smaller catalogue, fully verified.** 220 catalogue items and 380 variants,
every one carrying a `verification` row with a method and a `source` with a URL and a
`retrieved_on` date. Zero unverified rows ship. The About page states the number and
the methods in the interface, so the count is a feature and not a secret. The
contributor path is how the catalogue grows past 220, which is why slice 7 exists.

The 220 exercise every axis the schema claims rather than padding a total:

- Main series across PAL, NTSC, and NTSC-J, Black Label against Platinum and Greatest
  Hits reprints, and Collector's, Limited, and Survival editions carrying bundle
  manifests with per-retailer rows.
- Handed out, never sold: at least 60 variants. The Chronicles press kit with its
  challenge disc, E3 giveaways, a cardboard standee, GAME and GameStop preorder
  bonuses, convention exclusives, the Shadow press survival kit, the French Fact Files
  resin partwork.
- Vinyl and soundtracks including the 2025 McCree first pressing, with matrix and
  runout as a category attribute.
- Comics from Top Cow, Dark Horse, and IDW. Tie-in novels.
- Statues and figures: Playmates, ToyBiz, Sideshow, Gaming Heads, PCS, the 2026 Hasbro
  crossover, the Tonner boxed doll, TUBBZ, Funko.
- Film and home video: two Paramount films and the 2018 reboot on VHS, DVD, and Blu-ray
  steelbook.
- Sponsorship: the 1998 Larazade bottle-in-box, SEAT and Land Rover 2001.
- At least 12 categories and all 5 provenance types present.

Verification methods, in descending strength: an in-hand photograph of the artefact
showing the number; a publisher or retailer archive page; a press archive; an auction
lot record with a photograph; two independent databases agreeing. A single forum post
is not a method.

Machine checks that run against the shipped database: every `barcode_ean13` and
`barcode_upca` value passes its check digit; every seeded row has a verification row;
every source has a URL and a `retrieved_on` date. A human check runs on a sample of 20
variants re-opened against their cited URL.

Market value seeds at 80 rows with a cited basis, of which at least 30 carry
`no_recorded_sale`, so the honest-empty path exists in production data on day one.

## Compliance posture

Fires, and each gets a Release line naming its artifact: GDPR in full (basis per
purpose, export, deletion, retention per category, processor contracts, and the
photograph-of-another-person vector); DSA Art. 16 notice-and-action; DSA Art. 17
statement of reasons; DSA Art. 24(3) published active-recipient figure; the IP
constraints (mark-free name and hostname, zero official art, persistent disclaimer,
rights path through the Art. 16 mechanism).

Does not fire, and adding it is a defect: the European Accessibility Act, out of scope
by Annex I Section IV; the Cyber Resilience Act, out of scope by the Commission's
March 2026 browser-only guidance. WCAG 2.1 AA stays as a Craft floor by choice.

Zero cookie banner is claimed and made checkable: strictly-necessary cookies only, no
client analytics script, self-hosted fonts, R2-copied avatars, so a page load reaches
no host outside the two the product operates.

**CRA trigger:** the moment a downloadable client ships, meaning a native build, a
desktop binary, a store submission, or any component distributed as a file rather than
executed in a browser, the Cyber Resilience Act's reporting duties (in force since
11 September 2026) and an SBOM obligation fire and this plan reopens; an installable
progressive web app served over the web stays browser-executed and does not flip that
classification on its own.

## Slices

Ten slices. Each crosses data, server, client, and the live URL. Each is independently
shippable and independently verifiable. The core loop is first.

### 1. The aisle check, signed out and offline

The one-handed twenty-second job, on the live URL, with no account and no signal.

Data: taxonomy tables, `provenance_type` and `identifier_kind` seeded,
`catalogue_item`, `variant`, `variant_identifier`, `source`, `verification`, plus a
60-item verified starter catalogue. Server: the catalogue index endpoint with a delta
cursor. Client: screen 01 in full, typed identifier and camera scan, three verdicts,
the verdict slab on its exact motion spec, add to collection writing to the device,
the collection list reading from the device, the three doors on no entry found, the
cache-age line. Offline: precache of shell and index, on-device stores, anonymous
device id. Also: the Chromatic Era token scopes, both themes, the message catalogue
and pseudo-locale, the
footer disclaimer, the icon and tab title.

Closes on: the live URL; the A1 through A4 clean-session capture series completed with
no account and the network disabled; verdict painted within 100 ms of submit, median
and maximum over 10 runs recorded; the stamp landing captured, and captured again with
reduced motion; all three verdicts captured at 390, 768, and 1440; the check-digit
query returning zero failures; zero console errors.

### 2. Catalogue, specimen sheet, and permanent IDs

Data: attributes, `bundle_component`, `permalink`, `tsvector` and `pg_trgm` indexes,
seed to the full 220 items and 380 variants. Server: static generation of every
specimen sheet, the search endpoint, facet counts, permalink resolution with
redirects. Client: screens 02 and 03, the sold and handed-out control at the top of
the screen, facet rail on desktop and sheet on phone, variant picker, bundle manifest
with per-row retailer attribution, the five provenance marks.

Closes on: search counts matching SQL; a permalink sweep over every minted id
returning zero 404s; cold-database page timings recorded; every screen at three
viewports with loading, empty, error, and offline states captured; the
franchise-agnosticism insert performed with an identical column checksum.

### 3. Accounts, sync, claim, and the wall in exactly two places

Data: Better Auth tables, `client_op`, sync cursors. Server: GitHub and Google OAuth,
the email link path built and gated on a verified domain, sync endpoints, claim of an
anonymous collection, avatar copy into R2. Client: sign-in, the account offer card at
exactly two triggers, dismissible to the same screen.

Closes on: a collection built signed out on device A, claimed on sign-in with zero rows
lost, appearing on device B; the offer card counted at exactly two appearances and zero
on load; a route sweep over the public routes showing zero sign-in redirects; a write
made offline and replayed on reconnect creating exactly one row.

### 4. The sofa: collection, value, CSV in and out

Data: `user_copy` in full, grading fields, `market_value`, `fx_rate`, `saved_view`,
`import_job`, `user_copy_custom`. Server: export, import with column mapping, totals,
the daily ECB rate job. Client: screen 04, the dense table at 1,000 rows, saved views,
purchase price beside market value, duplicate from similar, multi-currency totals.

Closes on: a 1,000-row export re-imported into an empty account with zero differing
cells; a 41-column source file importing with zero dropped columns, the unmapped ones
named on the copy and present in the next export; totals matching SQL; the
no-recorded-sale rendering captured; value, totals, export, and import all reachable
with no account.

### 5. Photographs and the notice mechanism

Data: `user_copy_photo`, `catalogue_photo`, `notice`, `statement_of_reason`. Server:
direct-to-R2 upload with short-lived credentials, notice intake, statement delivery.
Client: upload with on-device resize to three derivatives, the prompt about other
people in the frame, credit as body text under the photograph, the report path from
any photograph and any entry.

Closes on: a file carrying GPS EXIF uploaded and fetched back with zero EXIF tags; a
network capture showing zero image bytes served from the app origin; thumbnails visible
with the network disabled; a notice filed end to end with the Art. 16 fields recorded
and a statement of reasons rendered to the affected account.

### 6. Community: profiles, lists, wantlist matching

Data: `list`, `list_item`, `follow`, wantlist as a status on `user_copy`. Server:
public profile routes, recent additions, cross-collector wantlist matching. Client:
screen 05, the browsable grid, lists, follow.

Closes on: another collector's shelf browsed signed out and captured; the forbidden
field sweep over every public route returning zero occurrences of six sentinel values;
a wantlist match surfaced between two seeded accounts.

### 7. Contributor trust

Data: `suggestion`, `suggestion_field`, `suggestion_reply`, `revision`, merge and split
with permalink rewrite. Server: publish then review, decision with a written reason,
restore from revision. Client: screen 06, the field-level diff on the entry page, the
written reason, the reply, batch entry from a template.

Closes on: a suggestion created, decided, replied to, all four rendered on the entry
page and captured; a merge performed with the old permalink returning a redirect chain
ending at 200; a bundle manifest overwritten and restored from history in three actions
or fewer; a photograph's credit text unchanged across the merge; a moderator view
containing zero personal sentinel values.

### 8. Rights, retention, and transparency

Data: `recipient_day`, `mar_month`, retention jobs. Server: data export, account
deletion, the daily rollup and 32-day purge. Client: privacy notice with a basis and a
retention period per data category, About with the disclaimer and the seed verification
statement, the transparency page, account settings carrying export and delete.

Closes on: an export downloaded and a deletion completed in a real session, both
captured, with the account's rows absent from every table afterward; a first-load
network capture reaching no host outside the two the product operates and setting no
non-essential storage; the transparency page live with the figure, the method, and the
period.

### 9. The front door

Data: catalogue rows feeding social cards. Server: social card images generated at
build for every specimen sheet and profile. Client: the landing page, one screen above
the fold with the name, one sentence, one action, and the core loop shown as a capture
rather than described; the icon at 48 px.

Closes on: the landing page captured at 390, 768, and 1440; the icon captured at 48 px;
ten sampled social card URLs each returning a 1200 by 630 image carrying the entry
title; zero competing calls to action above the fold.

### 10. Launch and the full sweep

The `launch/` folder: five screenshots with real catalogue content and a four-word
caption strip on each, the launch post aimed at collector communities, the landing
copy, REPORT.md with environment variable names, the rollback command with this
project's ids, and the deployment URL. Then the full rubric sweep: every screen at
three viewports, the pseudo-locale pass at 40 percent expansion, the four contrast
pairs measured against the built interface, and the console-error sweep.

Closes on: `launch/` present and listed in REPORT.md; the rollback command recorded
with real ids and exercised once; every Craft line closed with a capture; DOD.md at
100 percent.

## What the builder does not improvise

Direction is **Chromatic Era**, dual theme. The six interaction notes in DESIGN.md
are binding: three verdicts and never two; the wall sits after the work and only in
front of sync; canonical and personal are separate surfaces and credit is text;
chroma is a two-word vocabulary and nothing else is coloured; the theme switch has
three states with System naming what it resolved to; and a token scope declares
rather than inherits.

The motion register is binding: the verdict slab arrives at full width in 220 ms
with no opacity change, everything else travels 140 ms on
`cubic-bezier(.2,.8,.2,1)`, and a theme change repaints in a single frame with no
cross-fade.

The token tables in DESIGN.md are binding, both scopes. Three tokens are shared
across the themes and no others: the two bright fills and the dark text that sits on
them. The accents are re-derived for light rather than reused, because `#00E0A4`
measures 1.7:1 on white. Both typefaces are self-hosted from the app origin; loading
them from a Google host would cost the zero-banner claim in R20.

/goal Every line of .forge/DOD.md checked, with evidence recorded in .forge/EVIDENCE.md, and a PASS verdict from the verifier agent.
