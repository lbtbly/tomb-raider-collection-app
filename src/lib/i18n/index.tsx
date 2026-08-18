"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { en, type MessageKey } from "./en";
import { buildPseudoCatalogue } from "./pseudo";
import { formatMessage, type Vars } from "./format";

const pseudo = buildPseudoCatalogue(en);

export type Locale = "en" | "pseudo";

// Never reached by a normal visit: the pseudo catalogue only loads behind an
// explicit `?locale=pseudo` query parameter, read once on the server so the
// very first paint already carries the transformed strings (no flash of
// English before it swaps).
export function resolveLocale(searchParam: string | null | undefined): Locale {
  return searchParam === "pseudo" ? "pseudo" : "en";
}

type TFn = (key: MessageKey, vars?: Vars) => string;

const I18nContext = createContext<{ t: TFn; locale: Locale }>({
  t: (key) => en[key],
  locale: "en",
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo(() => {
    const catalogue = locale === "pseudo" ? pseudo : en;
    const t: TFn = (key, vars) => formatMessage(catalogue[key] ?? en[key], vars, "en");
    return { t, locale };
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext).t;
}

export function useLocale() {
  return useContext(I18nContext).locale;
}
