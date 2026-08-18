"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { I18nProvider, resolveLocale } from "@/lib/i18n";

// Reads `?locale=pseudo` from the request. useSearchParams renders during
// the server pass too (App Router requires the Suspense boundary this is
// wrapped in from layout.tsx), so the pseudo catalogue is already in effect
// on the very first paint rather than swapping in after hydration.
export function LocaleFromUrl({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const locale = resolveLocale(searchParams.get("locale"));
  return <I18nProvider locale={locale}>{children}</I18nProvider>;
}
