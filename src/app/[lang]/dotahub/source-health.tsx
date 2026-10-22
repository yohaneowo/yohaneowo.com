"use client";

import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocale } from "@/i18n/locale-provider";
import type { DotaSource, HealthState, SourceHealth } from "@/lib/dota/health";
import { cn } from "@/lib/utils";

const SOURCES: [DotaSource, string][] = [
  ["opendota", "OpenDota"],
  ["stratz", "STRATZ"],
  ["steam", "Steam"],
];
const DOT: Record<HealthState, string> = {
  ok: "bg-emerald-500",
  slow: "bg-amber-500",
  down: "bg-red-500",
  unknown: "bg-muted-foreground/40",
};
const REFRESH_MS = 60 * 1000;

// A dot per data source at the end of DotaHub's navigation: green answers, amber is slow or failed
// lately, red failed last time. Hovering shows the latency and the quota left.
export function SourceHealthDots() {
  const { t: dict } = useLocale();
  const t = dict.dotahub.health;
  const [health, setHealth] = useState<Record<DotaSource, SourceHealth> | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/dotahub/health", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!alive) return;
          setHealth(data);
          setNow(Date.now());
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div role="list" aria-label={t.label} className="flex items-center gap-3 text-xs">
      {SOURCES.map(([source, name]) => {
        const h = health?.[source];
        const state = h?.state ?? "unknown";
        return (
          <Tooltip key={source}>
            <TooltipTrigger
              render={
                <span
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${name}: ${t.states[state]}`}
                  className="flex cursor-default items-center gap-1.5 text-muted-foreground outline-none focus-visible:text-foreground"
                />
              }
            >
              <span className={cn("size-2 rounded-full", DOT[state])} aria-hidden />
              <span className="hidden md:inline">{name}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex flex-col items-start gap-0.5 text-left">
              <span className="font-medium">
                {name} · {t.states[state]}
              </span>
              {h?.ms != null && <span>{t.latency((h.ms / 1000).toFixed(1))}</span>}
              {h?.error && <span>{t.error(h.error)}</span>}
              {h?.keyUntil != null && (
                <span>
                  {t.paidKey(
                    new Date(h.keyUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  )}
                </span>
              )}
              {h &&
                Object.entries(h.quota).map(([key, value]) => (
                  <span key={key}>{t.quota(t.periods[key as keyof typeof t.periods] ?? key, value)}</span>
                ))}
              {h?.at != null && now > 0 && (
                <span>{t.checked(Math.max(0, Math.round((now - h.at) / 60000)))}</span>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
