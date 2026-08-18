"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { addUnfiledCopy, saveDraftEntry } from "@/lib/device/collection";

// No entry found renders three doors, and no path ends without a next
// action (F8, DESIGN.md note 1): search the on-device catalogue index by
// title, start a locally-saved draft entry, or save the identifier as an
// Unfiled copy. All three do something real on this device; none of them
// need the network or an account.
export function Doors({ query }: { query: string }) {
  const t = useT();
  const [draftTitle, setDraftTitle] = useState(query);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [unfiledSaved, setUnfiledSaved] = useState(false);
  const [unfiledSaving, setUnfiledSaving] = useState(false);

  async function submitDraft(e: React.FormEvent) {
    e.preventDefault();
    await saveDraftEntry({ title: draftTitle.trim() || query, identifier: query || null });
    setDraftSaved(true);
  }

  async function submitUnfiled() {
    setUnfiledSaving(true);
    await addUnfiledCopy({ identifier: query, title: query || "Unfiled item" });
    setUnfiledSaving(false);
    setUnfiledSaved(true);
  }

  return (
    <div className="doorList">
      <div className="fw block">
        <Link
          href={`/catalogue?q=${encodeURIComponent(query)}`}
          className="btn sec b56 full"
        >
          {t("verdict.notInCollection.doors.search")}
        </Link>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {draftSaved ? (
          <p className="vlead">{t("check.addedConfirm")}</p>
        ) : draftOpen ? (
          <form onSubmit={submitDraft} className="stack" style={{ gap: 8 }}>
            <div className="field">
              <label htmlFor="draft-title">{t("verdict.notInCollection.doors.start")}</label>
              <input
                id="draft-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="fw block">
              <button type="submit" className="btn pri b56 full cut8">
                {t("check.addToCollection")}
              </button>
            </div>
          </form>
        ) : (
          <div className="fw block">
            <button type="button" className="btn sec b56 full" onClick={() => setDraftOpen(true)}>
              {t("verdict.notInCollection.doors.start")}
            </button>
          </div>
        )}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {unfiledSaved ? (
          <p className="vlead">
            {t("check.addedConfirm")}{" "}
            <Link href="/collection">{t("check.viewCollection")}</Link>
          </p>
        ) : (
          <div className="fw block">
            <button
              type="button"
              className="btn sec b56 full"
              onClick={submitUnfiled}
              disabled={unfiledSaving}
            >
              {t("verdict.notInCollection.doors.unfiled")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
