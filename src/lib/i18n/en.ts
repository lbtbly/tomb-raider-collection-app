// The message catalogue. Every user-visible string in the product reads
// from here; nothing is hardcoded in a component. "Vitrine" itself appears
// in exactly one place below (app.name) and every other surface -- the
// wordmark, the tab title, the About page, the launch copy -- reads that
// single entry, per DESIGN.md.
//
// Placeholders use {token} and are filled by src/lib/i18n/format.ts. A
// placeholder token is never translated and the pseudo-locale in
// src/lib/i18n/pseudo.ts leaves it untouched.

export const en = {
  "app.name": "Vitrine",
  "app.tagline": "The aisle check",
  // The browser tab title: composed here, not concatenated with an em dash
  // in layout.tsx, so C19 (em dashes in shipped strings) has nothing to
  // find and every user-visible string still reads from one place.
  "app.titleTag": "{name} - {tagline}",

  "footer.disclaimer":
    "Vitrine is unofficial and not affiliated with, endorsed by, or sponsored by any rights holder named in this catalogue.",

  "nav.check": "Check",
  "nav.collection": "Collection",
  "nav.catalogue": "Catalogue",

  "theme.label": "Theme",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.system": "System",
  "theme.resolved": "Following the device, {mode} right now",

  "offline.banner": "You are offline. Showing what is saved on this device.",

  "check.heading": "Aisle check",
  "check.lead": "Scan or type what is in your hand. The verdict comes from what is already saved on this device, so it works with no signal.",
  "check.input.label": "Barcode or catalogue number",
  "check.input.placeholder": "Type a barcode or catalogue number",
  "check.submit": "Check",
  "check.scan.open": "Scan with camera",
  "check.scan.close": "Stop camera",
  "check.scan.unsupported": "This browser cannot scan a barcode with the camera. Type the identifier above instead.",
  "check.scan.error": "The camera could not be read. Type the identifier above instead.",
  "check.scan.hint": "Point the camera at a barcode.",
  // The three states the original five keys did not name. Every one of them
  // renders through t(), because a sentence assembled inside a component
  // neither transforms under the pseudo-locale nor gets swept for em dashes
  // (C16, C19).
  "check.scan.starting": "Starting the camera…",
  "check.scan.viewLabel": "Live camera view",
  "check.scan.detected": "Scanned with the camera: {identifier}",
  "check.checking": "Checking…",

  "check.cacheAge": "Catalogue snapshot is {age} old",
  "check.cacheAge.fresh": "Catalogue snapshot synced {age} ago",

  // The candidate/copy label: "Tomb Raider: Chronicles - NTSC-U (United
  // States)". Composed here, not in the verdict engine, so the separator is
  // never hardcoded English (or an em dash -- CLAUDE.md's writing style,
  // C19) sitting outside the t() pipeline (C16).
  "verdict.candidateLabel": "{title} - {variantName}",

  "verdict.owned.word": "OWNED",
  "verdict.owned.lead": "Already in your collection.",
  "verdict.owned.addedOn": "Added to your collection {date}",
  "verdict.owned.quantity": "You have {count, one {# copy} other {# copies}}.",

  "verdict.uncertain.word": "UNCERTAIN",
  "verdict.uncertain.lead.identifier": "This identifier matches more than one release.",
  "verdict.uncertain.lead.title": "More than one release matches “{query}”. Type the barcode from the object in your hand for an exact match.",
  "verdict.uncertain.differs": "They differ by {field}.",
  "verdict.uncertain.candidateOwned": "Already in your collection",
  "verdict.uncertain.candidateNotOwned": "Not in your collection yet",
  "verdict.uncertain.pick": "This is the one in my hand",
  "verdict.uncertain.thirdDoor": "Neither. Add a new variant.",
  "verdict.uncertain.more": "{count, one {# more release also matches} other {# more releases also match}}. Type the barcode from the object in your hand for an exact match.",
  // The dashed rule and caution line above the two candidate photographs,
  // matching .forge/directions/5-chromatic-3-verdicts.jpg's identifier
  // collision panel. Generalised from the comp's own worked example
  // ("Check the spine band before you pay"), which names a detail specific
  // to that one jewel-case pairing; the catalogue holds provenance and
  // format collisions too, where a spine band is nothing to check.
  "verdict.uncertain.caution": "Check the item in your hand before you decide.",
  // The comp's closing line under the third door, unchanged in meaning: no
  // candidate is selected by default and neither pick button carries more
  // weight than the other.
  "verdict.uncertain.closingNote":
    "Nothing is selected for you here. Two answers are live and Vitrine will not guess between them.",

  // Renders the verdict engine's Difference (src/lib/verdict/engine.ts):
  // the engine names *what* differs between the two candidates on screen
  // (provenance, pressing name, release year, or title), and these keys
  // supply the words, so the sentence goes through the same t() pipeline,
  // and pseudo-locale sweep, as everything else in the product.
  "verdict.difference.provenance": "One is {a}; the other is {b}.",
  "verdict.difference.variantName": "One is the “{a}” pressing; the other is “{b}”.",
  "verdict.difference.year": "One released in {a}; the other in {b}.",
  "verdict.difference.year.unrecorded": "an unrecorded year",
  "verdict.difference.title": "One is titled “{a}”; the other “{b}”.",

  // How a collector would name a provenance type, not the schema's key.
  // Used only to fill {a}/{b} in verdict.difference.provenance above; the
  // candidate badge (owned / not owned) reads separate keys.
  "verdict.provenance.retail": "the retail release",
  "verdict.provenance.promotional": "a promotional copy, not sold at retail",
  "verdict.provenance.press": "a press copy",
  "verdict.provenance.conventionExclusive": "a convention-exclusive copy",
  "verdict.provenance.preorderBonus": "a preorder bonus",

  "verdict.notInCollection.word": "NOT IN COLLECTION",
  "verdict.notInCollection.known.lead": "Recognised, but not yet in your collection.",
  "verdict.notInCollection.unknown.lead": "No entry found for this identifier.",
  "verdict.notInCollection.doors.search": "Search by title",
  "verdict.notInCollection.doors.start": "Start an entry",
  "verdict.notInCollection.doors.unfiled": "Add to Unfiled",

  "check.addToCollection": "Add to collection",
  "check.addedConfirm": "Saved to your collection.",
  "check.addToWantlist": "Add to wantlist",
  "check.addedToWantlistConfirm": "Saved to your wantlist.",
  "check.viewCollection": "View your collection",
  "check.checkAnother": "Check another item",
  "check.reverse": "Undo, this is not the one",

  "collection.heading": "Your collection",
  "collection.lead": "Copies saved on this device. Nothing here has left your device unless you sign in and sync.",
  "collection.search.label": "Search your collection",
  "collection.search.placeholder": "Search by title",
  "collection.count": "{count, one {# copy} other {# copies}} saved",
  "collection.empty.lead": "Nothing saved yet.",
  "collection.empty.action": "Run the aisle check to add your first copy.",
  "collection.empty.cta": "Go to the aisle check",
  "collection.noResults": "No saved copy matches “{query}”.",
  // A search that returns nothing is an empty state too, so it names its
  // next action like every other one (C20). The action is clearing the
  // search because the query is what emptied the view, and the count of
  // what comes back is already on screen above.
  "collection.noResults.action": "Clear the search to see every saved copy again.",
  "collection.noResults.cta": "Clear the search",
  "collection.item.notFound.lead": "This copy is not on this device.",
  "collection.item.notFound.action": "It may have been saved on a different device, or removed.",
  "collection.item.back": "Back to your collection",
  "collection.item.provenance": "Provenance: {provenance}",
  "collection.item.year": "Released {year}",

  "catalogue.heading": "Catalogue index",
  "catalogue.lead": "The compact catalogue snapshot cached on this device for the offline check.",
  "catalogue.count": "{count, one {# variant} other {# variants}} cached on this device",
  "catalogue.empty.lead": "The catalogue has not synced to this device yet.",
  "catalogue.empty.action": "Connect to the network once, then the index works offline from then on.",
  "catalogue.syncNow": "Sync now",
  "catalogue.syncing": "Syncing…",
  "catalogue.syncError": "The catalogue could not sync. The last saved snapshot is still in use.",
  "catalogue.search.label": "Search the catalogue index",
  "catalogue.search.placeholder": "Search by title",
  "catalogue.noResults": "No cached variant matches “{query}”.",
  "catalogue.noResults.action": "Clear the search to see every cached variant again.",
  "catalogue.noResults.cta": "Clear the search",

  "error.generic.lead": "That did not load.",
  "error.generic.action": "Try again.",
  "error.retry": "Try again",

  // The three route-level boundaries: src/app/error.tsx (a thrown render
  // error), src/app/not-found.tsx (an unmatched URL) and
  // src/app/global-error.tsx (the root layout itself failing). Every one of
  // them names a next action, because a boundary with nothing to press is
  // the dead end F56 counts at zero.
  "error.route.action": "Try the page again. Nothing saved on this device was lost.",
  "error.route.home": "Go to the aisle check",
  // Next.js hashes a server error and hands back the digest. It is the only
  // string on the page that matches a server log line, so it is shown
  // rather than swallowed, labelled rather than dumped bare.
  "error.reference": "Reference {digest}",
  // The global boundary replaces the root layout, so recovery there is a
  // full document load rather than a client re-render. {name} reads
  // app.name, the one place the product is named.
  "error.global.reload": "Reload {name}",

  "notFound.lead": "That page is not here.",
  "notFound.action":
    "The address may be mistyped, or the page may have moved. Everything saved on this device is still where you left it.",
  "notFound.cta": "Go to the aisle check",
  "notFound.collection": "Go to your collection",

  "photo.none.alt": "No photograph saved for this copy.",
  "photo.owned.alt": "Your photograph of {title}.",
  // The no-photo empty state's own lead/action pair, following the same
  // convention as collection.empty.* and catalogue.empty.* (C20): a
  // statement of what is missing, then the next action, both real DOM text
  // rather than clipped to 1x1 behind photo.none.alt's aria-label. Wording
  // is .forge/directions/5-chromatic-3-verdicts.jpg's NOT IN COLLECTION
  // panel, verbatim: it holds for any catalogue entry with nothing filed
  // yet, owned or not, since photo.none.alt / this pair both describe the
  // entry's photograph record, not who is looking at it.
  "photo.none.lead": "No photograph filed for this entry.",
  "photo.none.action": "Yours would be the first.",
  // The 56px collection-row thumbnail (.thumb.np) has no room for the pair
  // above; this is its own short, real, visible label rather than a second
  // copy of photo.none.alt rendered small. See CollectionThumb.tsx for why
  // it stops there rather than repeating the next action at that size.
  "photo.none.short": "No photo",

  "a11y.sortAscending": "Sort {column} ascending",
  "a11y.sortDescending": "Sort {column} descending",
} as const;

export type MessageKey = keyof typeof en;
