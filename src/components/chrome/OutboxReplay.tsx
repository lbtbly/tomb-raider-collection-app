"use client";

import { useEffect } from "react";
import { replayOutbox } from "@/lib/device/collection";

// A write made offline replays on reconnect and creates exactly one row
// (F15). This has no UI of its own: it fires once on load and again on
// every "online" event, and the server dedupes on the operation id, so
// calling it more than strictly necessary is harmless.
export function OutboxReplay() {
  useEffect(() => {
    void replayOutbox().catch(() => {});
    const onOnline = () => {
      void replayOutbox().catch(() => {});
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
  return null;
}
