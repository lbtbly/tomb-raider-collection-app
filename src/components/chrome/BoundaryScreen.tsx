"use client";

import type { ReactNode } from "react";

// The shared body of the three route boundaries: src/app/error.tsx,
// src/app/not-found.tsx and src/app/global-error.tsx. One component so all
// three carry the same tokens, the same 56px controls and the same
// heading / lead / action shape every other screen uses, instead of three
// near-copies drifting apart the first time one of them is touched.
//
// It holds no strings of its own. Every word arrives already through t(),
// so a boundary transforms under the pseudo-locale and gets swept for em
// dashes exactly like the rest of the product (C16, C19).
export function BoundaryScreen({
  lead,
  action,
  actions,
  footnote,
}: {
  lead: string;
  action: string;
  // Never optional. A boundary with no control is the dead end F56 counts
  // at zero, and making it optional is how one ships by accident.
  actions: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <div className="stack">
      <div>
        <h1 className="pageh1">{lead}</h1>
        <p style={{ margin: 0, color: "var(--ink2)" }}>{action}</p>
      </div>
      <div className="card stack" style={{ gap: 12 }}>
        {actions}
      </div>
      {footnote}
    </div>
  );
}
