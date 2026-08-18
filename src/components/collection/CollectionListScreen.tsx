"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { listCopies } from "@/lib/device/collection";
import type { UserCopy } from "@/lib/device/schema";
import { CollectionThumb } from "./CollectionThumb";

// The collection list: an offline route (PLAN.md's offline boundary), read
// entirely from the on-device userCopies store with no server round trip.
// Three real states beyond the happy path -- loading, empty, error -- per
// the offline shell's F12/F16 requirement that a route never shows a
// browser default instead of its designed state.
type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; copies: UserCopy[] };

export function CollectionListScreen() {
  const t = useT();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const copies = await listCopies();
      setState({ kind: "ready", copies });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    // Reading IndexedDB is an external, async system, so this necessarily
    // lands its state after mount rather than during render (same pattern
    // as CheckScreen's initial device-state read).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (state.kind !== "ready") return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return state.copies;
    return state.copies.filter((c) => c.itemTitle.toLowerCase().includes(needle));
  }, [state, query]);

  return (
    <div className="stack">
      <div>
        <h1 className="pageh1">{t("collection.heading")}</h1>
        <p style={{ color: "var(--ink2)", margin: 0 }}>{t("collection.lead")}</p>
      </div>

      {state.kind === "loading" ? (
        <p className="vlead" role="status">
          {t("check.checking")}
        </p>
      ) : state.kind === "error" ? (
        <div className="card stack" style={{ gap: 12 }}>
          <p className="vlead">{t("error.generic.lead")}</p>
          <div className="fw block">
            <button type="button" className="btn sec b56 full" onClick={() => void load()}>
              {t("error.retry")}
            </button>
          </div>
        </div>
      ) : state.copies.length === 0 ? (
        <div className="card stack" style={{ gap: 12 }}>
          <p className="vlead">{t("collection.empty.lead")}</p>
          <p style={{ margin: 0, color: "var(--ink2)" }}>{t("collection.empty.action")}</p>
          <div className="fw block">
            <Link href="/" className="btn pri b56 full cut8">
              {t("collection.empty.cta")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="collection-search">{t("collection.search.label")}</label>
            <input
              id="collection-search"
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("collection.search.placeholder")}
              autoComplete="off"
            />
          </div>
          <p className="mono" style={{ margin: 0, color: "var(--ink2)", fontSize: 13 }}>
            {t("collection.count", { count: state.copies.length })}
          </p>

          {filtered.length === 0 ? (
            // A search with no matches is an empty state, so it names its next
            // action and carries the control for it (C20), same shape as the
            // nothing-saved-yet state above. Clearing returns focus to the
            // search field because the button that took the click unmounts
            // with the state, and focus would otherwise fall to the body.
            <div className="card stack" style={{ gap: 12 }}>
              <p className="vlead">{t("collection.noResults", { query })}</p>
              <p style={{ margin: 0, color: "var(--ink2)" }}>{t("collection.noResults.action")}</p>
              <div className="fw block">
                <button
                  type="button"
                  className="btn sec b56 full"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                >
                  {t("collection.noResults.cta")}
                </button>
              </div>
            </div>
          ) : (
            <ul className="stack" style={{ gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
              {filtered.map((copy) => (
                <li key={copy.id}>
                  <Link
                    href={`/collection/${copy.id}`}
                    className="row"
                    style={{
                      alignItems: "center",
                      textDecoration: "none",
                      border: "1px solid var(--hair)",
                      padding: 12,
                    }}
                  >
                    <CollectionThumb photoId={copy.photoId} title={copy.itemTitle} />
                    <span className="stack" style={{ gap: 2 }}>
                      <span style={{ fontWeight: 700 }}>{copy.itemTitle}</span>
                      <span className="mono" style={{ fontSize: 12, color: "var(--ink2)" }}>
                        {copy.variantName ?? copy.category}
                        {copy.year ? ` · ${copy.year}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
