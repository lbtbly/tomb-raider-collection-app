"use client";

import { useEffect } from "react";

// Registers the offline shell's service worker (public/sw.js). Runs
// unconditionally: PLAN.md draws the offline boundary as a day-one
// requirement, not something gated behind a flag. Registration itself is
// harmless under `next dev` (it just registers the worker file, same as
// production); what is NOT validated under `next dev` is the worker's own
// behaviour, since Turbopack's dev asset pipeline and a service worker are
// known to fight (.forge dispatch note) -- that is proven separately
// against `npm run build && npm run start`.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration can fail (unsupported browser, blocked by an
      // extension). The offline routes' on-device stores are the real
      // source of truth and already work with no server round trip; the
      // worker adds the ability to reach them from a cold, offline load of
      // the page itself, so a failure here stays silent rather than
      // surfacing an error for something that never gates the read path.
    });
  }, []);
  return null;
}
