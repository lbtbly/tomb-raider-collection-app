"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { getCopy } from "@/lib/device/collection";
import type { UserCopy } from "@/lib/device/schema";
import { PhotoFrame } from "@/components/check/PhotoFrame";

// A single collection item (PLAN.md's offline boundary): client-rendered
// from the on-device userCopies store, keyed by the copy's own id rather
// than a catalogue public_id, so it resolves an Unfiled copy (no variant
// attached) the same way it resolves a matched one. Three real states:
// loading, not-found (F56 -- a next action, never a dead end), and error.
type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "notFound" }
  | { kind: "ready"; copy: UserCopy };

export function CollectionItemScreen({ id }: { id: string }) {
  const t = useT();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const copy = await getCopy(id);
      setState(copy ? { kind: "ready", copy } : { kind: "notFound" });
    } catch {
      setState({ kind: "error" });
    }
  }, [id]);

  useEffect(() => {
    // Reading IndexedDB is an external, async system, so this necessarily
    // lands its state after mount rather than during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <p className="vlead" role="status">
        {t("check.checking")}
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="card stack" style={{ gap: 12 }}>
        <p className="vlead">{t("error.generic.lead")}</p>
        <div className="fw block">
          <button type="button" className="btn sec b56 full" onClick={() => void load()}>
            {t("error.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === "notFound") {
    return (
      <div className="card stack" style={{ gap: 12 }}>
        <p className="vlead">{t("collection.item.notFound.lead")}</p>
        <p style={{ margin: 0, color: "var(--ink2)" }}>{t("collection.item.notFound.action")}</p>
        <div className="fw block">
          <Link href="/collection" className="btn sec b56 full">
            {t("collection.item.back")}
          </Link>
        </div>
      </div>
    );
  }

  const { copy } = state;
  return (
    <div className="stack">
      <div className="fw">
        <Link href="/collection" className="btn sec">
          {t("collection.item.back")}
        </Link>
      </div>

      <PhotoFrame photoId={copy.photoId} title={copy.itemTitle} />

      <div>
        <h1 className="pageh1">{copy.itemTitle}</h1>
        {copy.variantName ? <p style={{ margin: "0 0 4px", color: "var(--ink2)" }}>{copy.variantName}</p> : null}
      </div>

      <div className="drw" style={{ padding: 16 }}>
        <dl className="stack" style={{ gap: 8, margin: 0 }}>
          {copy.year ? (
            <div className="priv">
              <p style={{ margin: 0 }}>{t("collection.item.year", { year: copy.year })}</p>
            </div>
          ) : null}
          <div className="priv">
            <p style={{ margin: 0 }}>{t("collection.item.provenance", { provenance: copy.provenanceType })}</p>
          </div>
          {copy.unfiledIdentifier ? (
            <div className="priv">
              <p className="mono" style={{ margin: 0 }}>
                {copy.unfiledIdentifier}
              </p>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
