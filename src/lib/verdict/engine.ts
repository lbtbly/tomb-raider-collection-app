// The verdict engine. Pure and dependency-free on purpose (no DOM, no
// IndexedDB, no fetch) so it is unit-testable on its own and so the check
// screen can call it synchronously against whatever is already on the
// device: PLAN.md is explicit that the match runs against the on-device
// copy first, every time, and a network call may refine a verdict but must
// never gate one.
//
// Three verdicts, never two, never a fourth:
//   OWNED               exact identifier, exactly one matching variant,
//                        and the user already holds a copy of it.
//   UNCERTAIN            an identifier collision (2+ variants share it) or
//                        a title search that does not resolve to one
//                        variant. Never infer a variant from a partial
//                        match.
//   NOT_IN_COLLECTION    everything else: a variant recognised in the
//                        catalogue but not yet owned, or nothing found at
//                        all (which renders the three doors).

import { normalizeIdentifier } from "@/lib/identifiers/normalize";
import { identifierLookupForms } from "@/lib/identifiers/lookup";
import type { CatalogueIndexRow } from "@/lib/device/schema";

export type Candidate = CatalogueIndexRow & { owned: boolean };

// "identifier": the query matched an exact identifier on 2+ variants, so
// the differing-field sentence is meaningful (two pressings of the same
// release). "title": the query was a partial title that matched 2+ rows,
// which can easily be unrelated items rather than two pressings of one
// release, so the UI reads this differently and does not lean on
// differingFields the same way.
export type UncertainMatchKind = "identifier" | "title";

export type Verdict =
  | { kind: "OWNED"; candidate: Candidate }
  | {
      kind: "UNCERTAIN";
      matchKind: UncertainMatchKind;
      candidates: Candidate[];
      more: Candidate[];
      differingFields: string[];
      /** What actually distinguishes the two shown candidates, as data --
       * not a sentence. The engine names the one thing a collector can
       * check against the object in hand ("provenance", with the two
       * values) rather than rendering prose itself; the caller turns this
       * into words through the message catalogue so the sentence goes
       * through the same t() pipeline as everything else on screen (see
       * `Difference` below). Null when there are not exactly 2 displayed
       * candidates, or nothing meaningfully differs. */
      difference: Difference | null;
    }
  | { kind: "NOT_IN_COLLECTION"; recognized: Candidate | null };

// What differs between two candidates, as data the caller renders through
// the message catalogue -- never as English prose. Keeping this a plain
// discriminated union (rather than a formatted string) is what keeps the
// engine free of hardcoded language: a pure, dependency-free module can
// still express "the one thing a collector can check" without writing a
// sentence about it. The two values (`a`, `b`) line up with the two
// candidates the caller is comparing, in the same order.
export type Difference =
  | { kind: "provenance"; a: string; b: string }
  | { kind: "variantName"; a: string; b: string }
  | { kind: "year"; a: number | null; b: number | null }
  | { kind: "title"; a: string; b: string };

const DIFF_FIELDS: { key: keyof CatalogueIndexRow; label: string }[] = [
  { key: "title", label: "title" },
  { key: "variantName", label: "variant" },
  { key: "provenanceType", label: "provenance" },
  { key: "year", label: "release year" },
];

// Which fields actually differ across every candidate, derived from the
// data rather than written per case: the coordinator's real UNCERTAIN pairs
// (a 1996 first pressing against a Greatest Hits reprint sharing SLUS-00152;
// a retail Chronicles disc against its promotional, not-for-resale twin
// sharing SLUS-01311) differ on different field sets, so a hardcoded
// sentence for one would be wrong for the other.
export function describeDifference(candidates: readonly CatalogueIndexRow[]): string[] {
  if (candidates.length < 2) return [];
  const out: string[] = [];
  for (const { key, label } of DIFF_FIELDS) {
    const values = new Set(candidates.map((c) => String(c[key] ?? "")));
    if (values.size > 1) out.push(label);
  }
  return out;
}

// A title that differs only by a trailing parenthetical, such as
// "Tomb Raider: Chronicles" against "Tomb Raider: Chronicles (Promo Only)",
// is usually just spelling out a distinction another field already carries
// (here, provenance). Reporting it as its own difference is technically
// true and practically misleading: it reads as "the titles differ" when
// the titles differ *because* one is promotional, not for an unrelated
// reason. Stripped and compared so that redundant case is recognised.
function stripTrailingParenthetical(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

// Exactly one leading difference, not an accurate list of every field that
// differs: DESIGN.md's own worked example ("They differ only in label
// edition. Black Label is the 1998 first print...") names the one thing a
// collector can check on the object in hand, not a schema field name.
// Priority: provenance and variant name are physically checkable on the
// object; release year is checkable but less immediate; title alone is
// the weakest signal and is often redundant with provenance (see above).
//
// Returns data, not prose: naming the phrase is the caller's job (through
// the message catalogue), so this stays a pure comparison the engine can
// own without smuggling English into it.
export function computeDifference(a: CatalogueIndexRow, b: CatalogueIndexRow): Difference | null {
  if (a.provenanceType !== b.provenanceType) {
    return { kind: "provenance", a: a.provenanceType, b: b.provenanceType };
  }
  if (a.variantName !== b.variantName) {
    return { kind: "variantName", a: a.variantName, b: b.variantName };
  }
  if (a.year !== b.year) {
    return { kind: "year", a: a.year, b: b.year };
  }
  if (stripTrailingParenthetical(a.title) !== stripTrailingParenthetical(b.title)) {
    return { kind: "title", a: a.title, b: b.title };
  }
  return null;
}

// The check screen shows at most 2 candidate buttons of identical weight,
// per DESIGN.md and F6: promoting a third to visible-primary status is the
// exact failure UNCERTAIN exists to prevent. A collision wider than 2 is
// rare (identifier collisions found so far are always pairs) and is
// surfaced as an overflow count rather than a silently truncated list.
const MAX_UNCERTAIN_CANDIDATES = 2;

function toCandidate(row: CatalogueIndexRow, ownedVariantIds: ReadonlySet<string>): Candidate {
  return { ...row, owned: ownedVariantIds.has(row.variantPublicId) };
}

export function computeVerdict(
  rawQuery: string,
  index: readonly CatalogueIndexRow[],
  ownedVariantIds: ReadonlySet<string>,
): Verdict {
  const query = rawQuery.trim();
  const normalized = normalizeIdentifier(query);

  // The query as normalized, plus every equivalent spelling of it (see
  // src/lib/identifiers/lookup.ts). Two rules, both narrow. A UPC-A printed
  // on a pack as 743175952919 is reported by macOS Vision as the EAN-13
  // 0743175952919, and the catalogue holds both kinds. A book barcode
  // scans as an ISBN-13 while its copyright page prints the ISBN-10, and
  // 8 of the 23 ISBN-carrying variants hold only one of the two.
  // Normalization itself is untouched: it mirrors a Postgres generated
  // column and must not drift.
  const forms = identifierLookupForms(normalized);

  // One pass over the index, matching on ANY form. A row that carries both
  // spellings is still one row, so it is counted once. Two DIFFERENT
  // variants reached through different forms stay two matches and render
  // UNCERTAIN: the catalogue really does hold 848064011972 on one variant
  // and 0848064011972 on another, and picking one of them silently is the
  // exact failure UNCERTAIN exists to prevent.
  const identifierMatches =
    forms.length > 0
      ? index.filter((row) =>
          forms.some((form) => row.normalizedIdentifiers.includes(form)),
        )
      : [];

  if (identifierMatches.length === 1) {
    return resolveSingle(identifierMatches, ownedVariantIds);
  }
  if (identifierMatches.length >= 2) {
    return toUncertain(identifierMatches, ownedVariantIds, "identifier");
  }

  // No identifier resolved this query at all. Try it as a title fragment:
  // never infer a variant from a partial title match, so 1 result still
  // resolves and 2+ or 0 fall through the same way an identifier would.
  const needle = query.toLowerCase();
  const titleMatches =
    needle.length >= 2
      ? index.filter((row) => row.title.toLowerCase().includes(needle))
      : [];

  if (titleMatches.length === 1) {
    return resolveSingle(titleMatches, ownedVariantIds);
  }
  if (titleMatches.length >= 2) {
    return toUncertain(titleMatches, ownedVariantIds, "title");
  }

  return { kind: "NOT_IN_COLLECTION", recognized: null };
}

function resolveSingle(
  rows: readonly CatalogueIndexRow[],
  ownedVariantIds: ReadonlySet<string>,
): Verdict {
  const row = rows[0];
  if (!row) return { kind: "NOT_IN_COLLECTION", recognized: null };
  const candidate = toCandidate(row, ownedVariantIds);
  return candidate.owned
    ? { kind: "OWNED", candidate }
    : { kind: "NOT_IN_COLLECTION", recognized: candidate };
}

function toUncertain(
  rows: readonly CatalogueIndexRow[],
  ownedVariantIds: ReadonlySet<string>,
  matchKind: UncertainMatchKind,
): Verdict {
  const withOwnership = rows.map((r) => toCandidate(r, ownedVariantIds));
  // Owned candidates are never truncated away: if 3 or more variants share
  // an identifier and the user already owns one of them, that candidate
  // must be one of the (at most 2) shown, or the screen can tell someone
  // they do not own something they do. Array.prototype.sort is a stable
  // sort in every engine this ships to, so ties preserve index order.
  const ordered = [...withOwnership].sort((a, b) => Number(b.owned) - Number(a.owned));
  const candidates = ordered.slice(0, MAX_UNCERTAIN_CANDIDATES);
  const more = ordered.slice(MAX_UNCERTAIN_CANDIDATES);
  const first = candidates[0];
  const second = candidates[1];
  return {
    kind: "UNCERTAIN",
    matchKind,
    candidates,
    more,
    // Computed over what is actually shown, not the full collision set: the
    // difference explains the 2 buttons on screen, not the ones in `more`.
    differingFields: describeDifference(candidates),
    difference: first && second ? computeDifference(first, second) : null,
  };
}
