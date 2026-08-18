"use client";

import { useT } from "@/lib/i18n";

// One footer line on every route (DESIGN.md, C24 / R26): rendered once in
// the root layout so every page under it carries it with no per-route
// duplication to forget.
export function Footer() {
  const t = useT();
  return (
    <footer className="foot">
      <p>{t("footer.disclaimer")}</p>
    </footer>
  );
}
