"use client";

import { useSyncExternalStore } from "react";
import type { Overlay } from "klinecharts";
import type { ChartController } from "@/lib/coinhub/chart-controller";
import type { PriceAlert } from "@/lib/coinhub/store";

// Non-persisted terminal UI state: open dialogs, the selected drawing, and the chart controllers.

export type Dialog =
  | { type: "symbol"; mode: "change" | "compare" | "watchlist"; query?: string }
  | { type: "indicators" }
  | { type: "indicatorSettings"; chart: number; id: string }
  | { type: "settings" }
  | {
      type: "alert";
      alert?: PriceAlert;
      price?: number;
      symbolId?: string;
      line?: [number, number, number, number];
    }
  | { type: "goto" }
  | { type: "drawingSettings"; chart: number; id: string }
  | { type: "interval"; text: string };

export interface UiState {
  dialog: Dialog | null;
  selection: { chart: number; overlay: Overlay } | null;
  fullscreen: boolean;
  // Emoji placed by the emoji tool.
  emoji: string;
  // Bumped when a controller is added or removed, so hooks re-read the registry.
  controllers: number;
}

function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch: Partial<T> | ((s: T) => Partial<T>)) => {
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

export const ui = createStore<UiState>({
  dialog: null,
  selection: null,
  fullscreen: false,
  emoji: "🚀",
  controllers: 0,
});

export function useUi<T>(selector: (s: UiState) => T): T {
  return useSyncExternalStore(
    ui.subscribe,
    () => selector(ui.get()),
    () => selector(ui.get()),
  );
}

export const openDialog = (dialog: Dialog) => ui.set({ dialog });
export const closeDialog = () => ui.set({ dialog: null });

const controllers = new Map<number, ChartController>();

export const registry = {
  set(index: number, controller: ChartController) {
    controllers.set(index, controller);
    ui.set((s) => ({ controllers: s.controllers + 1 }));
  },
  delete(index: number, controller: ChartController) {
    if (controllers.get(index) !== controller) return;
    controllers.delete(index);
    ui.set((s) => ({ controllers: s.controllers + 1 }));
  },
  get(index: number) {
    return controllers.get(index) ?? null;
  },
  all() {
    return [...controllers.entries()];
  },
};

export function useController(index: number) {
  useUi((s) => s.controllers);
  return registry.get(index);
}
