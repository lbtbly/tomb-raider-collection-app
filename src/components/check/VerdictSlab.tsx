"use client";

import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/en";
import { formatAge } from "@/lib/i18n/locale";
import type { Difference, Verdict } from "@/lib/verdict/engine";
import { CandidateRow } from "./CandidateRow";
import { Doors } from "./Doors";
import { PhotoFrame } from "./PhotoFrame";

// Maps the raw provenanceType data the engine returns to the message key
// that names it in words. Kept here, not in the engine, so the engine never
// has to know a message catalogue exists: this is "how to say it", which is
// exactly the part that belongs in the component per the fix for C16 (a
// hardcoded English sentence inside the pure engine never passed through
// t(), so it rendered untransformed under the pseudo-locale sweep).
const PROVENANCE_MESSAGE_KEY: Record<string, MessageKey> = {
  retail: "verdict.provenance.retail",
  promotional: "verdict.provenance.promotional",
  press: "verdict.provenance.press",
  convention_exclusive: "verdict.provenance.conventionExclusive",
  preorder_bonus: "verdict.provenance.preorderBonus",
};

// Turns the engine's Difference into the one sentence DESIGN.md calls for:
// naming the thing a collector can check against the object in hand, not a
// schema field name. Priority and the redundant-title rule live in the
// engine (computeDifference); this only chooses words for what the engine
// already decided to say.
function renderDifference(t: ReturnType<typeof useT>, difference: Difference): string {
  switch (difference.kind) {
    case "provenance": {
      const phrase = (key: string) => {
        const messageKey = PROVENANCE_MESSAGE_KEY[key];
        return messageKey ? t(messageKey) : key;
      };
      return t("verdict.difference.provenance", { a: phrase(difference.a), b: phrase(difference.b) });
    }
    case "variantName":
      return t("verdict.difference.variantName", { a: difference.a, b: difference.b });
    case "year": {
      const label = (year: number | null) =>
        year === null ? t("verdict.difference.year.unrecorded") : String(year);
      return t("verdict.difference.year", { a: label(difference.a), b: label(difference.b) });
    }
    case "title":
      return t("verdict.difference.title", { a: difference.a, b: difference.b });
  }
}

// "Tomb Raider: Chronicles - NTSC-U (United States)": the same stable label
// used for an OWNED copy and a recognized-but-not-owned candidate. Composed
// through t() (verdict.candidateLabel) rather than concatenated in code, so
// the separator is never an untransformed literal outside the pipeline.
function candidateLabel(t: ReturnType<typeof useT>, row: { title: string; variantName: string }): string {
  return t("verdict.candidateLabel", { title: row.title, variantName: row.variantName });
}

export function VerdictSlab({
  verdict,
  query,
  cacheAgeMs,
  ownedPhotoId,
  candidatePhotoIds,
  resultId,
  onAddToCollection,
  onAddToWantlist,
  onPickCandidate,
  onAddNewVariant,
  adding,
  added,
  addingWantlist,
  addedWantlist,
}: {
  verdict: Verdict;
  query: string;
  cacheAgeMs: number | null;
  /** The owning UserCopy's photoId, looked up by the caller (CheckScreen)
   * because the verdict engine's Candidate is catalogue data, not personal
   * data, and never carries a photo itself. Null renders the no-photo
   * hatch, never a community photograph (F5). */
  ownedPhotoId: string | null;
  /** The same lookup, keyed by variantPublicId, for whichever of UNCERTAIN's
   * (at most 2) shown candidates the device already owns. A candidate not
   * owned has no entry and renders the no-photo hatch, same as an owned one
   * with nothing filed yet. */
  candidatePhotoIds: Record<string, string | null>;
  /** A value the caller changes on every submit (a counter, not a clock
   * read), so the wipe-in key below stays a pure function of props instead
   * of calling Date.now() during render. */
  resultId: string | number;
  onAddToCollection: () => void;
  onAddToWantlist: () => void;
  onPickCandidate: (variantPublicId: string) => void;
  onAddNewVariant: () => void;
  adding: boolean;
  added: boolean;
  addingWantlist: boolean;
  addedWantlist: boolean;
}) {
  const t = useT();

  const cacheLine =
    cacheAgeMs !== null && cacheAgeMs > 24 * 60 * 60 * 1000
      ? t("check.cacheAge", { age: formatAge(cacheAgeMs) })
      : null;

  // Remounting on every new verdict replays the 220ms wipe-in animation
  // (DESIGN.md motion register); a stable key across verdicts of the same
  // kind would let the browser skip the re-trigger.
  const wipeKey = `${verdict.kind}-${resultId}`;

  // Every branch below carries data-testid="verdict" with a data-verdict of
  // the engine's own kind, plus data-testid="verdict-word". The evidence
  // harness identified the verdict by its styling classes (.v-own, .v-unc,
  // .v-not, .vword), so a rename in the stylesheet would have blinded the
  // test suite without failing anything. These attributes are contract, not
  // decoration: data-verdict is the Verdict union's kind verbatim, so a new
  // verdict kind cannot silently reuse an old name.

  if (verdict.kind === "OWNED") {
    return (
      <div className="vslabWipe" key={wipeKey}>
        {/* aria-live="polite" announces this region's content in DOM
            order, so the verdict word has to come first: a collector
            standing in a shop needs the answer before a note about
            missing media. The photograph (or its honest no-photo hatch)
            sits below the verdict text, matching the design. */}
        <section
          className="vslab v-own cut20"
          aria-live="polite"
          data-testid="verdict"
          data-verdict="OWNED"
        >
          <p className="vword" role="status" data-testid="verdict-word">
            {t("verdict.owned.word")}
          </p>
          <p className="vlead">{t("verdict.owned.lead")}</p>
          <p className="vlead mono">{candidateLabel(t, verdict.candidate)}</p>
          <PhotoFrame photoId={ownedPhotoId} title={verdict.candidate.title} />
          {cacheLine ? <p className="vcache">{cacheLine}</p> : null}
        </section>
      </div>
    );
  }

  if (verdict.kind === "UNCERTAIN") {
    const lead =
      verdict.matchKind === "identifier"
        ? t("verdict.uncertain.lead.identifier")
        : t("verdict.uncertain.lead.title", { query });
    return (
      <div className="vslabWipe" key={wipeKey}>
        <section
          className="vslab v-unc"
          aria-live="polite"
          data-testid="verdict"
          data-verdict="UNCERTAIN"
        >
          <p className="vword" role="status" data-testid="verdict-word">
            {t("verdict.uncertain.word")}
          </p>
          <div style={{ padding: "0 20px 20px" }}>
            <p className="vlead">{lead}</p>
            {verdict.matchKind === "identifier" && verdict.difference ? (
              <p className="vlead">{renderDifference(t, verdict.difference)}</p>
            ) : null}
            {verdict.matchKind === "identifier" ? (
              <p className="vcaution">{t("verdict.uncertain.caution")}</p>
            ) : null}
            {/* Both candidate photographs, side by side (F6): a two-column
                grid, never a stack. .candidateRow keeps its name so the
                harness's existing "section.vslab .candidateRow .btn"
                selector still finds exactly the two pick buttons, one per
                card, even though each card is no longer itself a button. */}
            <div className="candidateRow" style={{ marginTop: 16 }}>
              {verdict.candidates.map((c) => (
                <CandidateRow
                  key={c.variantPublicId}
                  candidate={c}
                  photoId={candidatePhotoIds[c.variantPublicId] ?? null}
                  onPick={onPickCandidate}
                />
              ))}
            </div>
            {verdict.more.length > 0 ? (
              <p className="vcache" style={{ marginTop: 12 }}>
                {t("verdict.uncertain.more", { count: verdict.more.length })}
              </p>
            ) : null}
            <div className="fw block" style={{ marginTop: 16 }}>
              <button type="button" className="btn sec b56 full" onClick={onAddNewVariant}>
                {t("verdict.uncertain.thirdDoor")}
              </button>
            </div>
            <p className="vnote">{t("verdict.uncertain.closingNote")}</p>
            {cacheLine ? <p className="vcache">{cacheLine}</p> : null}
          </div>
        </section>
      </div>
    );
  }

  // NOT_IN_COLLECTION
  const recognized = verdict.recognized;
  return (
    <div className="vslabWipe" key={wipeKey}>
      <section
        className="vslab v-not cut18"
        aria-live="polite"
        data-testid="verdict"
        data-verdict="NOT_IN_COLLECTION"
      >
        <p className="vword" role="status" data-testid="verdict-word">
          {t("verdict.notInCollection.word")}
        </p>
        {recognized ? (
          <>
            <p className="vlead">{t("verdict.notInCollection.known.lead")}</p>
            <p className="vlead mono">{candidateLabel(t, recognized)}</p>
            <div className="row" style={{ marginTop: 16 }}>
              {added ? (
                <p className="vlead">{t("check.addedConfirm")}</p>
              ) : (
                <div className="fw block" style={{ flex: 1 }}>
                  <button
                    type="button"
                    className="btn pri b56 full cut8"
                    onClick={onAddToCollection}
                    disabled={adding}
                  >
                    {adding ? t("check.checking") : t("check.addToCollection")}
                  </button>
                </div>
              )}
              {addedWantlist ? (
                <p className="vlead">{t("check.addedToWantlistConfirm")}</p>
              ) : (
                <div className="fw block" style={{ flex: 1 }}>
                  <button
                    type="button"
                    className="btn sec b56 full"
                    onClick={onAddToWantlist}
                    disabled={addingWantlist || added}
                  >
                    {addingWantlist ? t("check.checking") : t("check.addToWantlist")}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="vlead">{t("verdict.notInCollection.unknown.lead")}</p>
            <Doors query={query} />
          </>
        )}
        {cacheLine ? <p className="vcache">{cacheLine}</p> : null}
      </section>
    </div>
  );
}
