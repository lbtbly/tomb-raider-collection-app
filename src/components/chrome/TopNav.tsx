"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { ThemeSwitch } from "./ThemeSwitch";

export function TopNav() {
  const t = useT();
  return (
    <header className="topnav nav">
      <Link href="/" className="wm" aria-label={t("app.name")}>
        {t("app.name")}
      </Link>
      <nav className="navlinks" aria-label={t("app.name")}>
        <Link href="/">{t("nav.check")}</Link>
        <Link href="/collection">{t("nav.collection")}</Link>
        <Link href="/catalogue">{t("nav.catalogue")}</Link>
      </nav>
      <ThemeSwitch />
    </header>
  );
}
