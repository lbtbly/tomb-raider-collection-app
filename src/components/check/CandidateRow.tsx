"use client";

import { useT } from "@/lib/i18n";
import type { Candidate } from "@/lib/verdict/engine";
import { PhotoFrame } from "./PhotoFrame";

// UNCERTAIN's two candidates render as a photograph-led pair, side by side
// (F6, .forge/directions/5-chromatic-3-verdicts.jpg): a photograph, the
// candidate's own name, its identifier and year, an ownership line, then a
// "This one" pick button. Both pick buttons share .btn.sec.b56, identical
// weight: neither promoted to .pri, neither preselected (DESIGN.md,
// handoff-screen-01.md, and F6's own count -- primary-styled candidate
// buttons 0, preselected candidates 0).
export function CandidateRow({
  candidate,
  photoId,
  onPick,
}: {
  candidate: Candidate;
  /** The owning UserCopy's photoId for an already-owned candidate, looked
   * up by the caller (CheckScreen) the same way OWNED's is, because a
   * Candidate is catalogue data and never carries a photo itself (F5).
   * Null for a candidate not owned, and null for an owned one with no
   * photo filed yet -- both render PhotoFrame's own no-photo hatch, never
   * a community photograph. */
  photoId: string | null;
  onPick: (variantPublicId: string) => void;
}) {
  const t = useT();
  const identifier = candidate.identifiers[0]?.normalized ?? null;
  const year = candidate.year !== null ? String(candidate.year) : t("verdict.difference.year.unrecorded");
  // The raw " · " join, not a t() composition: ScanHeader.tsx joins a date
  // and a time the same way, because both sides are already-formatted data
  // (a catalogue identifier, a year) rather than English prose.
  const meta = identifier ? `${identifier} · ${year}` : year;
  return (
    <div className="candCard">
      <PhotoFrame photoId={photoId} title={candidate.title} />
      <p className="candName">
        {t("verdict.candidateLabel", { title: candidate.title, variantName: candidate.variantName })}
      </p>
      <p className="candMeta">{meta}</p>
      <p className="candOwn">
        {candidate.owned ? t("verdict.uncertain.candidateOwned") : t("verdict.uncertain.candidateNotOwned")}
      </p>
      <div className="fw block">
        <button
          type="button"
          className="btn sec b56 full"
          onClick={() => onPick(candidate.variantPublicId)}
        >
          {t("verdict.uncertain.pick")}
        </button>
      </div>
    </div>
  );
}
