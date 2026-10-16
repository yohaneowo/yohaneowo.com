"use client";

import { useEffect, useState } from "react";
import {
  getState,
  onDrawingsSaved,
  saveDrawings,
  setState,
  subscribe,
  type SavedDrawing,
  type TerminalState,
} from "./store";

// Keeps the browser's CoinHub workspace in the signed-in user's account: the newer side wins when
// the page opens, and every change afterwards is pushed (debounced). Signed-out visitors keep the
// localStorage copy only.

export type SyncStatus = "off" | "syncing" | "synced" | "error";

const DRAWINGS_PREFIX = "coinhub:v1:drawings:";
const SYNCED_AT = "coinhub:v1:syncedAt";
const MODIFIED_AT = "coinhub:v1:modifiedAt";

interface Workspace {
  terminal: Partial<TerminalState>;
  drawings: Record<string, SavedDrawing[]>;
}

function read(key: string) {
  try {
    return Number(window.localStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage unavailable: syncing still works for this page view.
  }
}

function snapshot(): Workspace {
  const { tool: _tool, ...terminal } = getState();
  void _tool;
  const drawings: Record<string, SavedDrawing[]> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(DRAWINGS_PREFIX)) continue;
    try {
      drawings[key.slice(DRAWINGS_PREFIX.length)] = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    } catch {
      // Skip a corrupt entry.
    }
  }
  return { terminal, drawings };
}

let applying = false;

function apply(workspace: Workspace) {
  applying = true;
  try {
    const current = getState();
    const t = workspace.terminal;
    setState({
      ...t,
      settings: { ...current.settings, ...t.settings },
      sync: { ...current.sync, ...t.sync },
      favorites: { ...current.favorites, ...t.favorites },
      charts: t.charts?.length ? t.charts : current.charts,
      tool: null,
    });
    const keep = new Set(Object.keys(workspace.drawings));
    for (const key of Object.keys(snapshot().drawings)) if (!keep.has(key)) saveDrawings(key, []);
    for (const [symbolId, list] of Object.entries(workspace.drawings)) saveDrawings(symbolId, list);
  } finally {
    applying = false;
  }
}

export function useWorkspaceSync() {
  const [status, setStatus] = useState<SyncStatus>("off");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let signedIn = false;

    const push = async () => {
      timer = null;
      if (!signedIn) return;
      setStatus("syncing");
      try {
        const res = await fetch("/api/coinhub/workspace", {
          method: "PUT",
          body: JSON.stringify(snapshot()),
        });
        if (!res.ok) throw new Error(String(res.status));
        const { updatedAt } = (await res.json()) as { updatedAt: number };
        write(SYNCED_AT, updatedAt);
        write(MODIFIED_AT, updatedAt);
        if (!cancelled) setStatus("synced");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    const changed = () => {
      if (applying) return;
      write(MODIFIED_AT, Date.now());
      if (!signedIn) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(push, 3000);
    };

    const offState = subscribe(changed);
    const offDrawings = onDrawingsSaved(changed);

    (async () => {
      try {
        const res = await fetch("/api/coinhub/workspace");
        if (!res.ok) return;
        const remote = (await res.json()) as { signedIn: boolean; data: Workspace | null; updatedAt: number };
        if (!remote.signedIn) return;
        signedIn = true;
        if (cancelled) return;
        const syncedAt = read(SYNCED_AT);
        const modifiedAt = read(MODIFIED_AT);
        if (
          remote.data &&
          remote.updatedAt > syncedAt &&
          (modifiedAt <= syncedAt || remote.updatedAt > modifiedAt)
        ) {
          // The account has newer work (another device): take it.
          apply(remote.data);
          write(SYNCED_AT, remote.updatedAt);
          write(MODIFIED_AT, remote.updatedAt);
          setStatus("synced");
        } else if (!remote.data || modifiedAt > syncedAt) {
          await push();
        } else {
          setStatus("synced");
        }
      } catch {
        if (!cancelled && signedIn) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      offState();
      offDrawings();
      if (timer) {
        clearTimeout(timer);
        void push();
      }
    };
  }, []);

  return status;
}
