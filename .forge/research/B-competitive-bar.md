# Scout B: the competitive feature bar

Raw scout return, verified current 2026-08-17. Synthesized into BRIEF.md.

## Direct comparables

**Discogs** (music). Canonical catalogue of releases and variants (master release
to specific pressing), separate per-user Collection carrying purchase date and
price, Wantlist with price-drop alerts, marketplace with price-range stats
(min/median/max from sales history). Community-edited catalogue with a submission
and moderation queue. Best in class: the release/variant data model and
price-history-backed valuation.

**CLZ / Collectorz.com** (comics, books, music, movies, games). Per-vertical apps,
barcode and cover-camera scanning against a central database, condition fields,
custom fields, price lookups via third parties (GoCollect, CovrPrice).
Subscription $1.99/mo or $19.99/yr per vertical, plus paid price-guide add-ons
($89.95/yr for CovrPrice values). Best in class: fast scan-to-catalogue entry with
rich pre-filled metadata.

**hobbyDB / Pop Price Guide** (general collectibles, Funko heavy). Community
catalogue, personal collection, wantlist, trading, marketplace, now merged into
one product. Weekly "Collection Value" email tracks worth over time. Premium from
$2.50/mo. Best in class: value-over-time as a routine push, not a dashboard you
must seek out.

## Adjacent models worth stealing from

- **Colnect** (coins, stamps, 400+ categories). 62-language catalogue, automatic
  wantlist/swaplist matching between collectors. Cross-collector matching as a
  first-class feature.
- **BrickLink / Rebrickable / Brickset / Brickify** (LEGO). Split ecosystem:
  BrickLink is the marketplace of record with price guide, Rebrickable adds the
  MOC library, Brickify (newest) does AI camera scan in under 2 seconds with a
  confidence score and live eBay comps. Shows where the category is heading.
- **Collectr / Ludex / Card Ladder** (trading and sports cards, newest entrants).
  AI photo-scan intake fills identity, condition, and set in seconds. Population
  reports from PSA/BGS/SGC. Live comps. Collectr is explicitly the multi-category
  "one app for everything" play, the closest sibling to this project's later
  ambition. Free tier plus $5-25/mo paid tiers.
- **VGCollect / PriceCharting / Backloggd** (video games). VGCollect is pure
  collection tracking, PriceCharting is pure pricing (45,000+ items, daily,
  lot calculator, eBay deal scanner), Backloggd is the social and journal layer.
  The category is split three ways. A gap this project can close.
- **Letterboxd**. No catalogue relevance, but the taste reference holds: warm
  profile pages, curated lists, a browsable grid, diary entries with short takes.
  This is the reason to open the app when you are not logging a purchase.

## TABLE STAKES (strict, these become rubric lines)

1. Canonical catalogue item, separate from the user's owned copy (item vs
   instance), with variant and edition support.
2. Per-copy fields: condition, purchase date, purchase price, quantity,
   storage location, free-text notes, at least one photo.
3. Wantlist separate from owned collection.
4. Collection value total, computed from current market data, not only the sum of
   purchase prices.
5. CSV export at minimum. Import is a differentiator but expected soon after launch.
6. Public profile and browsable collection page. Every product in this category
   treats "browse other collectors" as core, not bonus.
7. Search and filter across the catalogue, by variant, era, category.
8. Mobile-usable entry flow. Barcode or photo capture is now an expectation, not a
   nicety, after Brickify and Collectr.
9. A free tier that is genuinely usable, not a trial. Every reviewed product with a
   hard paywall on core cataloguing draws complaints.

## DIFFERENTIATORS (only the best do this)

- AI photo or barcode scan-to-catalogue with a confidence score (Brickify, Collectr).
- Automatic wantlist-to-listing matching across the community (Discogs, Colnect, hobbyDB).
- Price-history charts backed by real sales data, not static guide numbers.
- Periodic passive value-change notification rather than a dashboard you must visit.
- Trade and swap workflow between two specific users, not just a marketplace listing.
- Multi-category unification under one schema. Very few do it well. CLZ literally
  ships separate apps per media type.

## KNOWN COMPLAINTS (cited)

- Login/session bugs and broken list-sort and search reported against CLZ and
  Discogs-adjacent tools in 2026 reviews.
  https://recordscanner.com/blog/which-vinyl-tracker-to-choose-in-2026
- Forum debate over whether PriceCharting is trustworthy as a collection-organizing
  tool, because pricing tools built for market comps get misused as inventory
  systems and the two purposes fight each other.
  https://www.videogamesage.com/forums/topic/10968-pricecharting-as-a-collection-organizing-tool-good-or-bad/
- Recurring theme across CLZ and price-guide add-ons: core cataloguing is fine, but
  real value data sits behind a second paid subscription stacked on the app fee
  (CLZ plus CovrPrice at $89.95/yr extra). Users resent the double paywall for one
  answer: what is my stuff worth.
- Fragmentation across the video-game category: three tools for inventory, value,
  and social, because no single product does all three.

## SCHEMA LESSONS

The pattern repeating across Discogs releases, Colnect catalogue items, BrickLink
sets and parts, CLZ records, and Collectr cross-category items is a strict split:

1. **CatalogueItem**. The canonical, franchise-agnostic thing. Owned by the
   platform and community, editable through a moderated submission queue, never
   duplicated per user.
2. **Variant**. A child of CatalogueItem for differences that change identity or
   value: region, print run, packaging, colorway, limited edition number. This is
   the layer every single-vertical tool gets weakest at, because they conflate item
   and edition. Treating Variant as its own entity, not a free-text field, is what
   lets the schema generalize past Tomb Raider, because franchise, category, and
   variant axis become metadata rather than hardcoded columns.
3. **UserCopy (instance)**. The user's specific owned unit, referencing
   CatalogueItem plus Variant, carrying condition, purchase date and price,
   quantity, storage location, personal notes, personal photos, for-sale and
   for-trade flags. Never conflate this with the catalogue layer or moderation and
   pricing integrity break.
4. **Franchise / Category**. A top-level, user-agnostic taxonomy node above
   CatalogueItem, so "Tomb Raider" is a row in a table, not an assumption baked
   into the schema. Present in the strongest general products, absent from most
   single-vertical ones.

## Platform and legal notes surfaced here

- **GDPR cookie enforcement is a live 2026 focus**: accept-all, reject-all, and
  granular manage-preferences, no dark patterns, no pre-ticked boxes. Consent
  events logged with timestamp and banner version for accountability.
- **DSA**: micro and small enterprises get lighter obligations, but if
  "browse other collectors" ever grows a peer-to-peer trade or sale layer,
  trader-traceability rules fire. Staying strictly non-transactional at launch
  keeps clear of them.
- **Payments**: not needed at launch. If added, PSD2 (moving to PSD3 in 2026)
  brings SCA, KYC/AML on sellers, and fund safeguarding the moment the platform
  routes money between two users. That is why Discogs, Whatnot, and Vinted all use
  Stripe Connect or Adyen-style multiparty rails.
- **Nominative fair use** lets a fan catalogue reference the marks to identify and
  describe merchandise, but the protection weakens the moment the site looks
  commercial or competes with official licensed merchandise. A documented,
  monitored takedown path is the practical mitigation.

## The opening

Every close comparable is single-vertical, paywalls the value layer separately
from the cataloguing layer, and splits inventory, valuation, and social browsing
across three products. A new entrant wins by shipping one free, mobile-first tool
that unifies capture, honest valuation, and a genuinely browsable social
collection page for an unserved niche, on a schema built to generalize from day one.
