"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRingIcon, PauseIcon, PencilIcon, PlayIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/i18n/locale-provider";
import { fmtPrice } from "@/lib/coinhub/format";
import { alertPrice, getState, newId, setState, useTerminal, type PriceAlert } from "@/lib/coinhub/store";
import { watchTicker } from "@/lib/coinhub/tickers";
import { useActiveSymbol, useResolved } from "./hooks";
import { openDialog } from "./ui-store";

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // No audio in this context.
  }
}

// Checks every active alert against live tickers while the page is open.
export function useAlertEngine(labels: { fired: (display: string, price: string) => string }) {
  const alerts = useTerminal((s) => s.alerts);
  const ids = [...new Set(alerts.filter((a) => a.active).map((a) => a.symbolId))];
  const symbols = useResolved(ids);
  const key = Object.keys(symbols).sort().join(",");

  useEffect(() => {
    const last = new Map<string, number>();
    const offs = Object.values(symbols).map((symbol) =>
      watchTicker(symbol, (ticker) => {
        const prev = last.get(symbol.id);
        last.set(symbol.id, ticker.last);
        if (prev === undefined) return;
        const now = Date.now();
        const fired: PriceAlert[] = [];
        for (const a of getState().alerts) {
          if (!a.active || a.symbolId !== symbol.id) continue;
          if (a.trigger === "every" && a.firedAt && now - a.firedAt < 60_000) continue;
          const level = alertPrice(a, now);
          const up = prev < level && ticker.last >= level;
          const down = prev > level && ticker.last <= level;
          const hit =
            a.condition === "crossing"
              ? up || down
              : a.condition === "crossingUp"
                ? up
                : a.condition === "crossingDown"
                  ? down
                  : a.condition === "greater"
                    ? ticker.last > level
                    : ticker.last < level;
          if (hit) fired.push(a);
        }
        if (!fired.length) return;
        setState((s) => ({
          alerts: s.alerts.map((a) =>
            fired.some((f) => f.id === a.id) ? { ...a, firedAt: now, active: a.trigger === "every" } : a,
          ),
          alertLog: [
            ...fired.map((a) => ({
              id: newId(),
              alertId: a.id,
              display: a.display,
              message: a.message,
              price: ticker.last,
              at: now,
            })),
            ...s.alertLog,
          ].slice(0, 200),
        }));
        for (const a of fired) {
          const title = labels.fired(a.display, fmtPrice(ticker.last, symbol.pricePrecision));
          toast.warning(title, { description: a.message, duration: 15_000 });
          beep();
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification(title, { body: a.message, tag: a.id });
            } catch {
              // Some browsers only allow notifications from a service worker.
            }
          }
        }
      }),
    );
    return () => offs.forEach((off) => off());
    // Re-subscribe when the set of symbols changes, not on every alert edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export function AlertsPanel() {
  const { t } = useLocale();
  const a = t.coinhub.alerts;
  const alerts = useTerminal((s) => s.alerts);
  const log = useTerminal((s) => s.alertLog);
  const { symbolId } = useActiveSymbol();
  const [permission, setPermission] = useState<string>(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">{t.coinhub.panels.alerts}</span>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => openDialog({ type: "alert", symbolId })}
          aria-label={a.create}
        >
          <PlusIcon />
        </Button>
      </div>
      <Tabs defaultValue="list" className="min-h-0 flex-1 gap-0">
        <TabsList variant="line" className="mx-3 mt-1">
          <TabsTrigger value="list">{t.coinhub.panels.alerts}</TabsTrigger>
          <TabsTrigger value="log">{a.log}</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            {alerts.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">{a.empty}</p>
            )}
            {alerts.map((al) => (
              <div key={al.id} className="group/alert flex items-start gap-2 border-b px-3 py-2 text-xs">
                <span
                  className={cn(
                    "mt-1 size-2 shrink-0 rounded-full",
                    al.active ? "bg-amber-500" : "bg-muted-foreground/40",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {al.display} · {a.conditions[al.condition]}{" "}
                    {al.line ? `↗ ${fmtPrice(alertPrice(al))}` : fmtPrice(al.price)}
                  </div>
                  {al.message && <div className="truncate text-muted-foreground">{al.message}</div>}
                  <div className="text-muted-foreground">{al.active ? a.active : a.stopped}</div>
                </div>
                <div className="flex opacity-0 group-hover/alert:opacity-100">
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-muted"
                    title={al.active ? a.stop : a.restart}
                    onClick={() =>
                      setState((s) => ({
                        alerts: s.alerts.map((x) => (x.id === al.id ? { ...x, active: !x.active } : x)),
                      }))
                    }
                  >
                    {al.active ? <PauseIcon className="size-3.5" /> : <PlayIcon className="size-3.5" />}
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-muted"
                    title={a.edit}
                    onClick={() => openDialog({ type: "alert", alert: al })}
                  >
                    <PencilIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-muted hover:text-destructive"
                    title={a.remove}
                    onClick={() => setState((s) => ({ alerts: s.alerts.filter((x) => x.id !== al.id) }))}
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </ScrollArea>
        </TabsContent>
        <TabsContent value="log" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            {log.map((l) => (
              <div key={l.id} className="border-b px-3 py-2 text-xs">
                <div className="font-medium">
                  {l.display} · {fmtPrice(l.price)}
                </div>
                {l.message && <div className="text-muted-foreground">{l.message}</div>}
                <div className="text-muted-foreground">{new Date(l.at).toLocaleString()}</div>
              </div>
            ))}
            {log.length > 0 && (
              <div className="p-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setState({ alertLog: [] })}
                >
                  {a.clearLog}
                </Button>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
      <div className="shrink-0 space-y-2 border-t p-3 text-xs text-muted-foreground">
        <p>{a.hint}</p>
        {permission !== "unsupported" &&
          (permission === "granted" ? (
            <p className="flex items-center gap-1.5 text-foreground">
              <BellRingIcon className="size-3.5" />
              {a.notificationsOn}
            </p>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => Notification.requestPermission().then(setPermission)}
            >
              <BellRingIcon />
              {a.notifications}
            </Button>
          ))}
      </div>
    </div>
  );
}
