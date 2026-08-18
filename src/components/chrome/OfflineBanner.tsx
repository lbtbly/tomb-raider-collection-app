"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

// "You are offline" reads from navigator.onLine and the online/offline
// events rather than from a failed fetch, so it is accurate even on routes
// that make no network call at all (the check screen never does).
//
// The server always renders nothing (it has no navigator.onLine to read),
// and the first client render must match that exactly or React discards
// and regenerates the whole tree on a hydration mismatch -- which is not
// just a console error, it is a real cost against F1's 100ms verdict-paint
// budget on every load. A `mounted` gate that starts false and flips true
// in an effect guarantees the first client render agrees with the server
// (both render null) regardless of whether the device is actually online
// or offline at that instant; the real state applies one tick later, which
// costs nothing for a status banner that is usually absent anyway. Reading
// navigator.onLine directly (even guarded by `typeof window`) does not
// have this property: on a genuinely offline cold load -- the exact case
// F10 and F16 test -- the first client render would disagree with the
// server's "assume online" render and reintroduce the same mismatch.
export function OfflineBanner() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Deliberate: this is the mount gate described above, syncing with
    // navigator.onLine (an external, browser-only system) for the first
    // time now that the client is actually mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!mounted || online) return null;
  return (
    <div className="offlineBanner" role="status">
      {t("offline.banner")}
    </div>
  );
}
