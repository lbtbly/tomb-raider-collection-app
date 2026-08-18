"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { computeVerdict, type Candidate, type Verdict } from "@/lib/verdict/engine";
import type { CatalogueIndexRow } from "@/lib/device/schema";
import { listCatalogueIndex, syncCatalogueIndex, getSyncMeta } from "@/lib/device/sync";
import {
  addCopy,
  addToWantlist,
  getCopyByVariant,
  listOwnedVariantIds,
  saveDraftEntry,
} from "@/lib/device/collection";
import { VerdictSlab } from "./VerdictSlab";
import { ScanHeader } from "./ScanHeader";
import { ScanControl } from "./ScanControl";

type Checked = {
  seq: number;
  query: string;
  checkedAt: Date;
  verdict: Verdict;
  addedNow: boolean;
  addedWantlistNow: boolean;
  ownedPhotoId: string | null;
  /** UNCERTAIN's shown candidates that the device already owns, keyed by
   * variantPublicId, looked up the same way ownedPhotoId is above. Empty
   * for every other verdict kind and for a fresh UNCERTAIN result until the
   * lookups above resolve. */
  candidatePhotoIds: Record<string, string | null>;
  pickedFrom: Verdict | null;
  thirdDoorSaved: boolean;
};

export function CheckScreen() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<CatalogueIndexRow[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingWantlist, setAddingWantlist] = useState(false);
  const seqRef = useRef(0);

  const refreshDeviceState = useCallback(async () => {
    const [rows, ownedIds, meta] = await Promise.all([
      listCatalogueIndex(),
      listOwnedVariantIds(),
      getSyncMeta(),
    ]);
    setIndex(rows);
    setOwned(ownedIds);
    setLastSyncedAt(meta.lastSyncedAt);
  }, []);

  useEffect(() => {
    // The initial read of whatever the device already holds. Reading
    // IndexedDB is an external, async system, so this necessarily lands
    // its state after mount rather than during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    void refreshDeviceState();
    // Best-effort background sync: PLAN.md is explicit that a network call
    // may refine a verdict but must never gate one, so this never blocks
    // the initial read of whatever is already on the device.
    void syncCatalogueIndex()
      .then(() => refreshDeviceState())
      .catch(() => {
        // Offline or unreachable. Whatever is already cached on the device
        // stays in use; nothing here surfaces as an error to the user.
      });
  }, [refreshDeviceState]);

  const runCheck = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const t0 = performance.now();
      const verdict = computeVerdict(trimmed, index, owned);
      const t1 = performance.now();
      if (process.env.NODE_ENV !== "production") {
        // Dev-only timing evidence for F1/F2/F3: the verdict must paint
        // within 100ms of submit and must never wait on the network.
        console.debug(`[vitrine] verdict computed in ${(t1 - t0).toFixed(2)}ms`, verdict.kind);
      }
      seqRef.current += 1;
      setChecked({
        seq: seqRef.current,
        query: trimmed,
        checkedAt: new Date(),
        verdict,
        addedNow: false,
        addedWantlistNow: false,
        ownedPhotoId: null,
        candidatePhotoIds: {},
        pickedFrom: null,
        thirdDoorSaved: false,
      });
      if (verdict.kind === "OWNED") {
        const copy = await getCopyByVariant(verdict.candidate.variantPublicId);
        setChecked((prev) =>
          prev && prev.seq === seqRef.current ? { ...prev, ownedPhotoId: copy?.photoId ?? null } : prev,
        );
      }
      if (verdict.kind === "UNCERTAIN") {
        // At most 2 candidates are ever shown (engine.ts), so this is at
        // most 2 lookups, and never blocks the verdict that already
        // painted: each result lands independently as it resolves.
        for (const candidate of verdict.candidates) {
          if (!candidate.owned) continue;
          const variantPublicId = candidate.variantPublicId;
          void getCopyByVariant(variantPublicId).then((copy) => {
            setChecked((prev) =>
              prev && prev.seq === seqRef.current
                ? {
                    ...prev,
                    candidatePhotoIds: { ...prev.candidatePhotoIds, [variantPublicId]: copy?.photoId ?? null },
                  }
                : prev,
            );
          });
        }
      }
    },
    [index, owned],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runCheck(query);
  }

  // The camera decode and the typed submit meet here, one line apart, and
  // both leave through the same runCheck. F58 asks for "the same verdict"
  // from a scan and from typed entry; the only way to owe nothing on that
  // is for there to be one verdict path and two ways into it, never two
  // paths that agree today. The input is filled with the decoded value as
  // well, so the collector can see what the camera read and correct it.
  const onScanDecode = useCallback(
    (identifier: string) => {
      setQuery(identifier);
      void runCheck(identifier);
    },
    [runCheck],
  );

  async function onAddToCollection() {
    if (!checked || checked.verdict.kind !== "NOT_IN_COLLECTION" || !checked.verdict.recognized) return;
    const candidate = checked.verdict.recognized;
    setAdding(true);
    await addCopy({
      variantPublicId: candidate.variantPublicId,
      itemPublicId: candidate.itemPublicId,
      itemTitle: candidate.title,
      variantName: candidate.variantName,
      year: candidate.year,
      category: candidate.category,
      provenanceType: candidate.provenanceType,
    });
    setAdding(false);
    setOwned((prev) => new Set(prev).add(candidate.variantPublicId));
    setChecked((prev) => (prev ? { ...prev, addedNow: true } : prev));
  }

  async function onAddToWantlist() {
    if (!checked || checked.verdict.kind !== "NOT_IN_COLLECTION" || !checked.verdict.recognized) return;
    const candidate = checked.verdict.recognized;
    setAddingWantlist(true);
    await addToWantlist({
      variantPublicId: candidate.variantPublicId,
      itemPublicId: candidate.itemPublicId,
      itemTitle: candidate.title,
      variantName: candidate.variantName,
      year: candidate.year,
      category: candidate.category,
      provenanceType: candidate.provenanceType,
    });
    setAddingWantlist(false);
    // Deliberately not added to `owned`: a wantlist row must never make a
    // later check on the same identifier read as OWNED.
    setChecked((prev) => (prev ? { ...prev, addedWantlistNow: true } : prev));
  }

  function resolveToCandidate(candidate: Candidate, from: Verdict) {
    seqRef.current += 1;
    const resolved: Verdict = candidate.owned
      ? { kind: "OWNED", candidate }
      : { kind: "NOT_IN_COLLECTION", recognized: candidate };
    setChecked((prev) =>
      prev
        ? {
            ...prev,
            seq: seqRef.current,
            verdict: resolved,
            pickedFrom: from,
            addedNow: false,
            ownedPhotoId: null,
          }
        : prev,
    );
    if (resolved.kind === "OWNED") {
      void getCopyByVariant(candidate.variantPublicId).then((copy) => {
        setChecked((prev) =>
          prev && prev.seq === seqRef.current ? { ...prev, ownedPhotoId: copy?.photoId ?? null } : prev,
        );
      });
    }
  }

  function onPickCandidate(variantPublicId: string) {
    if (!checked || checked.verdict.kind !== "UNCERTAIN") return;
    const candidate = checked.verdict.candidates.find((c) => c.variantPublicId === variantPublicId);
    if (!candidate) return;
    resolveToCandidate(candidate, checked.verdict);
  }

  function onUndo() {
    if (!checked || !checked.pickedFrom) return;
    seqRef.current += 1;
    setChecked((prev) =>
      prev && prev.pickedFrom
        ? { ...prev, seq: seqRef.current, verdict: prev.pickedFrom, pickedFrom: null, addedNow: false }
        : prev,
    );
  }

  async function onAddNewVariant() {
    if (!checked) return;
    await saveDraftEntry({ title: checked.query, identifier: checked.query });
    setChecked((prev) => (prev ? { ...prev, thirdDoorSaved: true } : prev));
  }

  // "Now" for the cache-age line is anchored to the moment of the check
  // itself (checked.checkedAt, captured in the submit handler) rather than
  // Date.now() read during render, which the purity rule disallows and
  // which would also make every render compute a slightly different age.
  const cacheAgeMs =
    checked && lastSyncedAt ? checked.checkedAt.getTime() - new Date(lastSyncedAt).getTime() : null;

  return (
    <div className="stack">
      <div>
        <h1 className="pageh1">{t("check.heading")}</h1>
        <p style={{ color: "var(--ink2)", margin: 0 }}>{t("check.lead")}</p>
      </div>

      <form onSubmit={onSubmit} className="stack" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="check-identifier">{t("check.input.label")}</label>
          <input
            id="check-identifier"
            name="identifier"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("check.input.placeholder")}
            autoComplete="off"
            inputMode="text"
          />
        </div>
        <div className="row">
          <div className="fw block" style={{ flex: 1 }}>
            <button type="submit" className="btn pri b56 full cut8">
              {t("check.submit")}
            </button>
          </div>
        </div>
      </form>

      <ScanControl onDecode={onScanDecode} activeIdentifier={checked?.query ?? null} />

      {checked ? (
        <div className="stack" style={{ gap: 8 }}>
          <ScanHeader identifier={checked.query} checkedAt={checked.checkedAt} />
          <VerdictSlab
            verdict={checked.verdict}
            query={checked.query}
            cacheAgeMs={cacheAgeMs}
            ownedPhotoId={checked.ownedPhotoId}
            candidatePhotoIds={checked.candidatePhotoIds}
            resultId={checked.seq}
            onAddToCollection={onAddToCollection}
            onAddToWantlist={onAddToWantlist}
            onPickCandidate={onPickCandidate}
            onAddNewVariant={onAddNewVariant}
            adding={adding}
            added={checked.addedNow}
            addingWantlist={addingWantlist}
            addedWantlist={checked.addedWantlistNow}
          />
          {checked.pickedFrom ? (
            <div className="fw block">
              <button type="button" className="btn sec b56 full" onClick={onUndo}>
                {t("check.reverse")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
