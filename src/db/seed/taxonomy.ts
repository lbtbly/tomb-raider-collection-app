// Taxonomy is vocabulary, not catalogue fact: a category label or an
// identifier kind does not carry a barcode, a date, or a specific product,
// so it seeds directly rather than waiting on the research agent's verified
// starter catalogue.

export const provenanceTypes = [
  { key: "retail", labelKey: "provenance.retail", isSold: true, markStyle: "filled", sort: 1 },
  { key: "promotional", labelKey: "provenance.promotional", isSold: false, markStyle: "pill", sort: 2 },
  { key: "press", labelKey: "provenance.press", isSold: false, markStyle: "square", sort: 3 },
  { key: "convention_exclusive", labelKey: "provenance.convention_exclusive", isSold: false, markStyle: "double_rule", sort: 4 },
  { key: "preorder_bonus", labelKey: "provenance.preorder_bonus", isSold: false, markStyle: "dashed", sort: 5 },
] as const;

export const identifierKinds = [
  { key: "barcode_ean13", labelKey: "identifier.barcode_ean13", validator: "ean13" },
  { key: "barcode_upca", labelKey: "identifier.barcode_upca", validator: "upca" },
  { key: "catalogue_number", labelKey: "identifier.catalogue_number", validator: null },
  { key: "sku", labelKey: "identifier.sku", validator: null },
  { key: "matrix_runout", labelKey: "identifier.matrix_runout", validator: null },
  { key: "asin", labelKey: "identifier.asin", validator: null },
  { key: "isbn", labelKey: "identifier.isbn", validator: null },
  { key: "part_number", labelKey: "identifier.part_number", validator: null },
] as const;

// General-purpose collectible categories, franchise-free per the schema
// rule. Slice 1 seeds the tree; slice 2 attaches attribute_def rows to it.
export const categories = [
  { slug: "games", name: "Games", parentId: null, sort: 1 },
  { slug: "statues-and-figures", name: "Statues and figures", parentId: null, sort: 2 },
  { slug: "comics", name: "Comics", parentId: null, sort: 3 },
  { slug: "novels", name: "Novels", parentId: null, sort: 4 },
  { slug: "vinyl-and-soundtracks", name: "Vinyl and soundtracks", parentId: null, sort: 5 },
  { slug: "film-and-home-video", name: "Film and home video", parentId: null, sort: 6 },
  { slug: "trading-cards-and-games", name: "Trading cards and games", parentId: null, sort: 7 },
  { slug: "apparel", name: "Apparel", parentId: null, sort: 8 },
  { slug: "guides-and-books", name: "Guides and books", parentId: null, sort: 9 },
  { slug: "prop-replicas", name: "Prop replicas", parentId: null, sort: 10 },
  { slug: "promotional-items", name: "Promotional items", parentId: null, sort: 11 },
  { slug: "sponsorship-tie-ins", name: "Sponsorship tie-ins", parentId: null, sort: 12 },
] as const;

export const franchises = [
  {
    slug: "tomb-raider",
    name: "Tomb Raider",
    summary:
      "Every item ever sold or handed out under the Tomb Raider and Lara Croft marks.",
  },
] as const;
