"use client";

import { useEffect } from "react";
import { type Pick, setPicks, usePicks } from "../compare-tray";

// The compare page's address is the truth: the tray follows it (opening a shared link fills it).
export function SyncPicks({ picks }: { picks: Pick[] }) {
  const current = usePicks();
  const want = picks.map((p) => p.id).join(",");
  const have = current.map((p) => p.id).join(",");
  useEffect(() => {
    if (want !== have) setPicks(picks);
    // Only when the address changes, not on every tray change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);
  return null;
}
