"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { BoundaryScreen } from "@/components/chrome/BoundaryScreen";

// Route-level errors. This nests inside the root layout, so it inherits the
// theme scope the head script already applied, the top nav and the one
// footer disclaimer line (C24 / R26 hold here by the same construction they
// hold everywhere else).
//
// It catches a throw from a page or a nested layout below the root. A throw
// from the root layout itself escapes upward to src/app/global-error.tsx,
// which has to rebuild the document by hand.
//
// `retry` rather than `reset`: Next 16.3 made `retry` the stable prop and
// names `reset` the narrower one. `retry` re-fetches and re-renders the
// boundary's children, which is what a collector pressing "Try again"
// expects; `reset` only clears the error state and would re-render the same
// failed contents.
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useT();

  return (
    <BoundaryScreen
      lead={t("error.generic.lead")}
      action={t("error.route.action")}
      actions={
        <>
          {/* .fw because clip-path clips an element's own outline: a cut
              control's focus ring lives on the wrapper (DESIGN.md note 7). */}
          <div className="fw block">
            <button type="button" className="btn pri b56 full cut8" onClick={() => retry()}>
              {t("error.retry")}
            </button>
          </div>
          <div className="fw block">
            <Link href="/" className="btn sec b56 full">
              {t("error.route.home")}
            </Link>
          </div>
        </>
      }
      footnote={
        error.digest ? (
          <p className="mono" style={{ margin: 0, color: "var(--ink3)", fontSize: 13 }}>
            {t("error.reference", { digest: error.digest })}
          </p>
        ) : null
      }
    />
  );
}
