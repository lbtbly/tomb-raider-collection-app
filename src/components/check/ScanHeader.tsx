"use client";

import { useT } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/locale";

// .scanh: the drawer-ground strip above the verdict, carrying a barcode
// graphic, the identifier in mono, and the match time (handoff-screen-01.md).
export function ScanHeader({ identifier, checkedAt }: { identifier: string; checkedAt: Date }) {
  const t = useT();
  return (
    <div className="scanh">
      <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden="true" focusable="false">
        <rect x="0" y="0" width="2" height="20" fill="currentColor" />
        <rect x="4" y="0" width="1" height="20" fill="currentColor" />
        <rect x="7" y="0" width="3" height="20" fill="currentColor" />
        <rect x="12" y="0" width="1" height="20" fill="currentColor" />
        <rect x="15" y="0" width="2" height="20" fill="currentColor" />
        <rect x="19" y="0" width="1" height="20" fill="currentColor" />
        <rect x="22" y="0" width="3" height="20" fill="currentColor" />
        <rect x="26" y="0" width="2" height="20" fill="currentColor" />
      </svg>
      <span className="mono tabular" style={{ fontSize: 15 }}>
        {identifier}
      </span>
      <span
        className="mono"
        style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink3)" }}
        suppressHydrationWarning
      >
        {formatDate(checkedAt)} · {checkedAt.toLocaleTimeString()}
      </span>
      <span className="srOnly">{t("check.checking")}</span>
    </div>
  );
}
