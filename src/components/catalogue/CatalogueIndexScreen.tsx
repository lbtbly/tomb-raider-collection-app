"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";
import type { CatalogueIndexRow } from "@/lib/device/schema";
import { listCatalogueIndex, syncCatalogueIndex, getCatalogueIndexSize } from "@/lib/device/sync";

// The offline catalogue index (PLAN.md's offline boundary): the same
// on-device store the check screen matches against, browsable directly.
// Distinct from slice 2's server-rendered catalogue browse, which this
// route grows into without moving; for now it is entirely client-rendered
// from what has synced to this device, which is what makes it usable with
// the network disabled (F12, F16) in the first place.
type LoadState = "loading" | "error" | "ready";

export function CatalogueIndexScreen() {
  const t = useT();
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>("loading");
  const [rows, setRows] = useState<CatalogueIndexRow[]>([]);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [indexRows] = await Promise.all([listCatalogueIndex(), getCatalogueIndexSize()]);
      setRows(indexRows);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    // Reading IndexedDB is an external, async system, so this necessarily
    // lands its state after mount rather than during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function onSyncNow() {
    setSyncing(true);
    setSyncError(false);
    try {
      await syncCatalogueIndex();
      await load();
    } catch {
      setSyncError(true);
    } finally {
      setSyncing(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) => r.title.toLowerCase().includes(needle) || r.variantName.toLowerCase().includes(needle),
    );
  }, [rows, query]);

  return (
    <div className="stack">
      <div>
        <h1 className="pageh1">{t("catalogue.heading")}</h1>
        <p style={{ color: "var(--ink2)", margin: 0 }}>{t("catalogue.lead")}</p>
      </div>

      {state === "loading" ? (
        <p className="vlead" role="status">
          {t("check.checking")}
        </p>
      ) : state === "error" ? (
        <div className="card stack" style={{ gap: 12 }}>
          <p className="vlead">{t("error.generic.lead")}</p>
          <div className="fw block">
            <button type="button" className="btn sec b56 full" onClick={() => void load()}>
              {t("error.retry")}
            </button>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="card stack" style={{ gap: 12 }}>
          <p className="vlead">{t("catalogue.empty.lead")}</p>
          <p style={{ margin: 0, color: "var(--ink2)" }}>{t("catalogue.empty.action")}</p>
          <div className="fw block">
            <button type="button" className="btn pri b56 full cut8" onClick={() => void onSyncNow()} disabled={syncing}>
              {syncing ? t("catalogue.syncing") : t("catalogue.syncNow")}
            </button>
          </div>
          {syncError ? <p className="vlead">{t("catalogue.syncError")}</p> : null}
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="catalogue-search">{t("catalogue.search.label")}</label>
              <input
                id="catalogue-search"
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("catalogue.search.placeholder")}
                autoComplete="off"
              />
            </div>
            <div className="fw">
              <button type="button" className="btn sec b56" onClick={() => void onSyncNow()} disabled={syncing}>
                {syncing ? t("catalogue.syncing") : t("catalogue.syncNow")}
              </button>
            </div>
          </div>
          {syncError ? <p className="vlead">{t("catalogue.syncError")}</p> : null}
          <p className="mono" style={{ margin: 0, color: "var(--ink2)", fontSize: 13 }}>
            {t("catalogue.count", { count: rows.length })}
          </p>

          {filtered.length === 0 ? (
            // A search with no matches is an empty state, so it names its next
            // action and carries the control for it (C20), same shape as the
            // not-synced-yet state above. Clearing returns focus to the search
            // field because the button that took the click unmounts with the
            // state, and focus would otherwise fall to the body.
            <div className="card stack" style={{ gap: 12 }}>
              <p className="vlead">{t("catalogue.noResults", { query })}</p>
              <p style={{ margin: 0, color: "var(--ink2)" }}>{t("catalogue.noResults.action")}</p>
              <div className="fw block">
                <button
                  type="button"
                  className="btn sec b56 full"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                >
                  {t("catalogue.noResults.cta")}
                </button>
              </div>
            </div>
          ) : (
            <ul className="stack" style={{ gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
              {filtered.map((row) => (
                <li
                  key={row.variantPublicId}
                  style={{ border: "1px solid var(--hair)", padding: 12 }}
                  className="stack"
                >
                  <span style={{ fontWeight: 700 }}>{row.title}</span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--ink2)" }}>
                    {row.variantName}
                    {row.year ? ` · ${row.year}` : ""} · {row.category}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
