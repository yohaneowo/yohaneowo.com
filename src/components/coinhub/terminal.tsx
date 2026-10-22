"use client";

import { useEffect } from "react";
import { cn } from "cn";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useLocale } from "@/i18n/locale-provider";
import { CANDLE_PANE } from "@/lib/coinhub/chart-controller";
import {
  getState,
  LAYOUT_COUNT,
  setChartSymbol,
  setState,
  updateChart,
  useTerminal,
  type LayoutKey,
} from "@/lib/coinhub/store";
import { useAlertEngine } from "./alerts-panel";
import { BottomBar } from "./bottom-bar";
import { ChartPanel } from "./chart-panel";
import {
  AlertDialog,
  DrawingSettingsDialog,
  GoToDialog,
  IndicatorSettingsDialog,
  IndicatorsDialog,
  IntervalDialog,
  SettingsDialog,
} from "./dialogs";
import { DrawingToolbar, FavoritesBar, selectTool } from "./drawing-toolbar";
import { MarketPanel } from "./market-panel";
import { SideIconBar, SidePanelContent } from "./side-panel";
import { SymbolDialog } from "./symbol-dialog";
import { TOOL_HOTKEYS } from "./tool-catalog";
import { TopToolbar } from "./top-toolbar";
import { usePaperEngine } from "./trading-panel";
import { useWorkspaceSync } from "@/lib/coinhub/sync";
import { loadConnections } from "@/lib/coinhub/trade";
import { openDialog, registry, ui } from "./ui-store";

const GRID: Record<LayoutKey, string> = {
  "1": "grid-cols-1 grid-rows-1",
  "2h": "grid-cols-2 grid-rows-1",
  "2v": "grid-cols-1 grid-rows-2",
  "3": "grid-cols-2 grid-rows-2 [&>*:first-child]:row-span-2",
  "4": "grid-cols-2 grid-rows-2",
};

const HOTKEY_TOOLS = Object.fromEntries(
  Object.entries(TOOL_HOTKEYS).map(([tool, key]) => [key.toLowerCase(), tool]),
);

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)
  );
}

function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || ui.get().dialog) return;
      const s = getState();
      const ctrl = registry.get(s.active);
      const key = e.key;
      const combo = `${e.altKey ? "alt+" : ""}${e.shiftKey ? "shift+" : ""}${e.code.replace(/^Key/, "").toLowerCase()}`;
      if (key === "Escape") {
        setState({ tool: null });
        ctrl?.removeMeasures();
        if (ctrl?.getReplay().mode === "selecting") ctrl.stopReplay();
        return;
      }
      if ((key === "Delete" || key === "Backspace") && ui.get().selection) {
        const sel = ui.get().selection!;
        registry.get(sel.chart)?.removeDrawing(sel.overlay.id);
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.code === "KeyZ" && !e.shiftKey) {
          e.preventDefault();
          ctrl?.undo();
        } else if (e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey)) {
          e.preventDefault();
          ctrl?.redo();
        } else if (e.code === "KeyK") {
          e.preventDefault();
          openDialog({ type: "symbol", mode: "change" });
        }
        return;
      }
      if (e.altKey) {
        const tool = HOTKEY_TOOLS[combo];
        if (tool) {
          e.preventDefault();
          selectTool(tool);
          return;
        }
        const config = s.charts[s.active];
        const actions: Record<string, () => void> = {
          a: () => {
            const list = ctrl?.chart.getDataList() ?? [];
            openDialog({ type: "alert", price: list[list.length - 1]?.close, symbolId: config.symbolId });
          },
          r: () => ctrl?.resetView(),
          l: () => updateChart(s.active, { scale: config.scale === "logarithm" ? "normal" : "logarithm" }),
          p: () => updateChart(s.active, { scale: config.scale === "percentage" ? "normal" : "percentage" }),
          i: () => updateChart(s.active, { invert: !config.invert }),
          g: () => openDialog({ type: "goto" }),
          w: () =>
            setState((st) => ({
              watchlist: st.watchlist.includes(config.symbolId)
                ? st.watchlist
                : [...st.watchlist, config.symbolId],
            })),
        };
        const action = actions[e.code.replace(/^Key/, "").toLowerCase()];
        if (action && !e.shiftKey) {
          e.preventDefault();
          action();
        }
        return;
      }
      if (key === "/") {
        e.preventDefault();
        openDialog({ type: "indicators" });
        return;
      }
      // Typing on the chart: letters open symbol search, digits the interval box (like TradingView).
      if (/^[a-zA-Z]$/.test(key)) {
        e.preventDefault();
        openDialog({ type: "symbol", mode: "change", query: key.toUpperCase() });
      } else if (/^[0-9,]$/.test(key)) {
        e.preventDefault();
        openDialog({ type: "interval", text: key === "," ? "" : key });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

// Crosshair in one chart moves the others to the same time.
function useCrosshairSync() {
  const sync = useTerminal((s) => s.sync.crosshair);
  const layout = useTerminal((s) => s.layout);
  const controllers = registry.all().length;
  useEffect(() => {
    if (!sync || LAYOUT_COUNT[layout] < 2) return;
    let syncing = false;
    const offs = registry.all().map(([index, ctrl]) =>
      ctrl.on("crosshair", (ch) => {
        if (syncing) return;
        syncing = true;
        for (const [other, target] of registry.all()) {
          if (other === index || other >= LAYOUT_COUNT[getState().layout]) continue;
          if (!ch?.timestamp) {
            target.chart.executeAction("onCrosshairChange", {});
            continue;
          }
          const px = target.chart.convertToPixel({ timestamp: ch.timestamp }, { paneId: CANDLE_PANE }) as {
            x?: number;
          };
          if (px.x !== undefined)
            target.chart.executeAction("onCrosshairChange", { x: px.x, paneId: CANDLE_PANE });
        }
        syncing = false;
      }),
    );
    return () => offs.forEach((off) => off());
  }, [sync, layout, controllers]);
}

export function Terminal() {
  const { t } = useLocale();
  const layout = useTerminal((s) => s.layout);
  const active = useTerminal((s) => s.active);
  const count = LAYOUT_COUNT[layout];

  const syncStatus = useWorkspaceSync();
  // The exchange accounts, so the charts can mark the fills before the panel is ever opened.
  useEffect(() => {
    void loadConnections();
  }, []);
  useHotkeys();
  useCrosshairSync();
  useAlertEngine({ fired: t.coinhub.alerts.fired });
  usePaperEngine({
    filled: t.coinhub.trading.filled,
    buy: t.coinhub.trading.buy,
    sell: t.coinhub.trading.sell,
  });

  // /coinhub?symbol=INDEX:BTC.D opens that symbol.
  useEffect(() => {
    // Dev-only handle for automated UI checks.
    if (process.env.NODE_ENV !== "production")
      Object.assign(window, { __coinhub: { registry, getState, setState, ui } });
    const symbol = new URLSearchParams(window.location.search).get("symbol");
    if (symbol) setChartSymbol(getState().active, symbol);
    const onFullscreen = () => ui.set({ fullscreen: !!document.fullscreenElement });
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  return (
    <TooltipProvider delay={400}>
      <div id="coinhub-root" className="flex h-full min-h-0 flex-col bg-background text-foreground">
        <TopToolbar syncStatus={syncStatus} />
        <div className="relative flex min-h-0 flex-1">
          <DrawingToolbar />
          <div className="relative flex min-w-0 flex-1 flex-col">
            <div className={cn("grid min-h-0 flex-1 gap-px bg-border", GRID[layout])}>
              {Array.from({ length: count }, (_, i) => (
                <div
                  key={i}
                  className="min-h-0 min-w-0"
                  onPointerDownCapture={() => i !== getState().active && setState({ active: i, tool: null })}
                >
                  <ChartPanel index={i} active={i === active} highlight={count > 1 && i === active} />
                </div>
              ))}
            </div>
            <FavoritesBar />
            <MarketPanel />
            <BottomBar />
          </div>
          <SidePanelContent />
          <SideIconBar />
        </div>
      </div>
      <SymbolDialog />
      <IndicatorsDialog />
      <IndicatorSettingsDialog />
      <SettingsDialog />
      <AlertDialog />
      <GoToDialog />
      <IntervalDialog />
      <DrawingSettingsDialog />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
