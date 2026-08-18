"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { BoundaryScreen } from "@/components/chrome/BoundaryScreen";

// Unmatched URLs, for the whole app: the root not-found.tsx catches both an
// explicit notFound() and any address that resolves to no route at all.
// This matters more than a 404 usually does here, because permalinks are the
// product's contract (DESIGN.md: "no permalink ever 404s") and a mistyped id
// is exactly how a collector reaches it.
//
// Nests inside the root layout, so the theme, the nav and the one footer
// disclaimer line come with it.
//
// A client component because every string reads from the catalogue through
// t(). It costs nothing: the route holds no server data.
export default function NotFound() {
  const t = useT();

  return (
    <BoundaryScreen
      lead={t("notFound.lead")}
      action={t("notFound.action")}
      actions={
        <>
          <div className="fw block">
            <Link href="/" className="btn pri b56 full cut8">
              {t("notFound.cta")}
            </Link>
          </div>
          <div className="fw block">
            <Link href="/collection" className="btn sec b56 full">
              {t("notFound.collection")}
            </Link>
          </div>
        </>
      }
    />
  );
}
