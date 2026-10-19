"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useLocale } from "@/i18n/locale-provider";
import type { DeathEvent } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { clock, MAP_IMAGE, mapPoint, orderColor } from "@/lib/dota/map";
import { cn } from "@/lib/utils";

// One match's deaths: numbered markers in order, and the list (time, killer, gold lost, wait).
export function DeathMap({
  events,
  heroes,
  className,
  compact = false,
}: {
  events: DeathEvent[];
  heroes: Record<number, HeroInfo>;
  className?: string;
  compact?: boolean;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.deaths;
  const ordered = [...events].sort((a, b) => a.t - b.t);
  return (
    <div className={cn("flex flex-col gap-4", !compact && "md:flex-row", className)}>
      <div
        className={cn(
          "relative aspect-square w-full shrink-0 overflow-hidden rounded-lg",
          !compact && "md:w-80",
        )}
      >
        <Image src={MAP_IMAGE} alt={t.mapAlt} fill unoptimized sizes="320px" className="object-cover" />
        {ordered.map((e, i) => {
          const p = mapPoint(e.x, e.y);
          const killer = heroes[e.by];
          return (
            <span
              key={`${e.t}-${i}`}
              title={`${i + 1} · ${clock(e.t)}${killer ? ` · ${killer[lang]}` : ""}`}
              className="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow"
              style={{
                left: `${p.left * 100}%`,
                top: `${p.top * 100}%`,
                background: orderColor(i, ordered.length),
              }}
            >
              {i + 1}
            </span>
          );
        })}
        {ordered.length === 0 && (
          <span className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            {t.none}
          </span>
        )}
      </div>
      {!compact && ordered.length > 0 && (
        <ol className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
          {ordered.map((e, i) => {
            const killer = heroes[e.by];
            return (
              <li key={`${e.t}-${i}`} className="flex items-center gap-2">
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: orderColor(i, ordered.length) }}
                >
                  {i + 1}
                </span>
                <span className="w-12 text-muted-foreground tabular-nums">{clock(e.t)}</span>
                {killer ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Image src={killer.icon} alt="" width={20} height={20} unoptimized className="size-5" />
                    <span className="truncate">{killer[lang]}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t.unknownKiller}</span>
                )}
                <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                  {t.lost(e.gold)} · {t.waited(e.dead)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// Many deaths blended into one heat map: each death adds a soft spot, then the accumulated density
// is colored on one hue from light to dark (sequential), over the map.
export function HeatMap({ events, className }: { events: { x: number; y: number }[]; className?: string }) {
  const { t } = useLocale();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const size = 512;
    target.width = size;
    target.height = size;
    const ctx = target.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    if (!events.length) return;
    // Density: soft black spots, more transparent the more deaths there are.
    const density = document.createElement("canvas");
    density.width = size;
    density.height = size;
    const d = density.getContext("2d")!;
    const radius = 22;
    const alpha = Math.max(0.06, Math.min(0.5, 6 / events.length));
    for (const e of events) {
      const p = mapPoint(e.x, e.y);
      const cx = p.left * size;
      const cy = p.top * size;
      const g = d.createRadialGradient(cx, cy, 0, cx, cy, radius);
      g.addColorStop(0, `rgba(0,0,0,${alpha})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      d.fillStyle = g;
      d.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    // Color: amber (few) to deep red (many), opacity following the density.
    const image = d.getImageData(0, 0, size, size);
    const px = image.data;
    let max = 0;
    for (let i = 3; i < px.length; i += 4) max = Math.max(max, px[i]);
    const from = [253, 224, 71];
    const to = [153, 27, 27];
    for (let i = 0; i < px.length; i += 4) {
      const v = px[i + 3] / (max || 1);
      if (v <= 0) continue;
      px[i] = Math.round(from[0] + (to[0] - from[0]) * v);
      px[i + 1] = Math.round(from[1] + (to[1] - from[1]) * v);
      px[i + 2] = Math.round(from[2] + (to[2] - from[2]) * v);
      px[i + 3] = Math.round(70 + 170 * v);
    }
    ctx.putImageData(image, 0, 0);
  }, [events]);
  return (
    <div className={cn("relative aspect-square w-full overflow-hidden rounded-lg", className)}>
      <Image
        src={MAP_IMAGE}
        alt={t.dotahub.deaths.mapAlt}
        fill
        unoptimized
        sizes="640px"
        className="object-cover"
      />
      <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden />
    </div>
  );
}
