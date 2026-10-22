"use client";

import {
  CopyIcon,
  LockIcon,
  LockOpenIcon,
  PaintBucketIcon,
  SettingsIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react";
import { useState } from "react";
import type { Overlay } from "klinecharts";
import { cn } from "cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocale } from "@/i18n/locale-provider";
import type { ChartController } from "@/lib/coinhub/chart-controller";
import { alpha, look } from "@/lib/coinhub/overlays/utils";
import { TEXT_TOOLS, TOOL_OPTIONS } from "./tool-catalog";
import { ToolIcon } from "./tool-icons";
import { openDialog } from "./ui-store";

// The palette, like TradingView's: a row of greys, then ten hues from light to dark.
const GREYS = [
  "#ffffff",
  "#d1d4dc",
  "#b2b5be",
  "#9598a1",
  "#787b86",
  "#5d606b",
  "#434651",
  "#2a2e39",
  "#131722",
  "#000000",
];
const HUES = [0, 24, 48, 125, 165, 195, 220, 260, 290, 335];
const SHADES: Array<[number, number]> = [
  [100, 60],
  [90, 82],
  [90, 72],
  [85, 60],
  [80, 50],
  [80, 40],
  [80, 30],
];

function hsl(h: number, sat: number, light: number) {
  const a = (sat / 100) * Math.min(light / 100, 1 - light / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = light / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export const SWATCHES = [...GREYS, ...SHADES.flatMap(([sat, light]) => HUES.map((h) => hsl(h, sat, light)))];

// A colour as "#rrggbb" plus its opacity (0–1); rgba() strings are read, anything else is left as is.
function parseColor(value: string | undefined): { hex: string; opacity: number } {
  if (!value) return { hex: "#2962ff", opacity: 1 };
  const m = /rgba?\(([^)]+)\)/.exec(value);
  if (m) {
    const [r, g, b, a = "1"] = m[1].split(",").map((x) => x.trim());
    const hex = `#${[r, g, b].map((x) => Number(x).toString(16).padStart(2, "0")).join("")}`;
    return { hex, opacity: Math.max(0, Math.min(1, Number(a))) };
  }
  if (value.startsWith("#") && value.length === 9)
    return { hex: value.slice(0, 7), opacity: parseInt(value.slice(7), 16) / 255 };
  return {
    hex: value.length === 4 ? `#${[...value.slice(1)].map((c) => c + c).join("")}` : value,
    opacity: 1,
  };
}

const withOpacity = (hex: string, opacity: number) =>
  opacity >= 1 ? hex : alpha(hex, Math.round(opacity * 100) / 100);

const RECENT_KEY = "coinhub:v1:colors";

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 8) : [];
  } catch {
    return [];
  }
}

// The colour picker: the palette, the custom colours picked lately with a "+" for a new one, and
// an opacity slider; the chosen colour comes back as hex, or rgba() when not fully opaque.
export function ColorGrid({ value, onChange }: { value?: string; onChange: (color: string) => void }) {
  const { t } = useLocale();
  const d = t.coinhub.drawing;
  const { hex, opacity } = parseColor(value);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const pick = (next: string) => onChange(withOpacity(next.toLowerCase(), opacity));
  const custom = (next: string) => {
    const list = [next.toLowerCase(), ...recent.filter((c) => c !== next.toLowerCase())].slice(0, 8);
    setRecent(list);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
      // Nothing to do without storage.
    }
    pick(next);
  };
  const swatch = (c: string) => (
    <button
      key={c}
      type="button"
      className={cn(
        "size-5 rounded-sm border border-black/10 hover:scale-110",
        hex.toLowerCase() === c && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
      )}
      style={{ background: c }}
      onClick={() => pick(c)}
      aria-label={c}
    />
  );
  return (
    <div className="flex w-[232px] flex-col gap-2">
      <div className="grid grid-cols-10 gap-1">{SWATCHES.map(swatch)}</div>
      <div className="flex items-center gap-1">
        {recent.map(swatch)}
        <label
          className="relative flex size-5 cursor-pointer items-center justify-center rounded-sm border border-dashed text-muted-foreground hover:text-foreground"
          title={d.customColor}
        >
          +
          <input
            type="color"
            value={hex.startsWith("#") && hex.length === 7 ? hex : "#2962ff"}
            onChange={(e) => custom(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={d.customColor}
          />
        </label>
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span>{d.opacity}</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(e) => onChange(withOpacity(hex, Number(e.target.value) / 100))}
            className="h-1.5 flex-1 cursor-pointer accent-primary"
            style={{ background: `linear-gradient(to right, transparent, ${hex})` }}
            aria-label={d.opacity}
          />
          <span className="w-10 rounded border px-1 py-0.5 text-right text-foreground tabular-nums">
            {Math.round(opacity * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

const btn = "flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 text-sm hover:bg-muted";

export function SelectionToolbar({
  chart,
  controller,
  overlay,
}: {
  chart: number;
  controller: ChartController;
  overlay: Overlay;
}) {
  const { t } = useLocale();
  const d = t.coinhub.drawing;
  const l = look(overlay);
  const ext = (overlay.extendData ?? {}) as { locked?: boolean };
  const hasFill =
    (TOOL_OPTIONS[overlay.name] ?? []).some((o) => o.key === "fill") ||
    ["xabcd", "cypher", "headShoulders", "trianglePattern", "arc", "gannSquare"].includes(overlay.name);
  const hasText = TEXT_TOOLS.has(overlay.name);
  const update = (patch: Parameters<ChartController["updateDrawing"]>[1]) =>
    controller.updateDrawing(overlay.id, patch);

  return (
    <div className="pointer-events-auto absolute top-10 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
      <span className="px-1 text-muted-foreground">
        <ToolIcon name={overlay.name} className="size-4" />
      </span>
      <Popover>
        <Tip label={d.color}>
          <PopoverTrigger className={btn}>
            <span className="size-4 rounded-sm border" style={{ background: l.color }} />
          </PopoverTrigger>
        </Tip>
        <PopoverContent className="w-56">
          <ColorGrid value={l.color} onChange={(color) => update({ styles: { line: { color } } })} />
        </PopoverContent>
      </Popover>
      {hasFill && (
        <Popover>
          <Tip label={d.fill}>
            <PopoverTrigger className={btn}>
              <PaintBucketIcon className="size-4" />
              <span className="h-1 w-3 rounded-sm" style={{ background: l.fill }} />
            </PopoverTrigger>
          </Tip>
          <PopoverContent className="w-56">
            <ColorGrid
              value={l.fill}
              onChange={(color) => update({ styles: { polygon: { color: alpha(color, 0.2) } } })}
            />
          </PopoverContent>
        </Popover>
      )}
      <Popover>
        <Tip label={d.lineWidth}>
          <PopoverTrigger className={btn}>
            <span className="w-4 rounded-full bg-current" style={{ height: l.width }} />
            <span className="text-xs">{l.width}px</span>
          </PopoverTrigger>
        </Tip>
        <PopoverContent className="w-32 gap-1 p-1">
          {[1, 2, 3, 4].map((w) => (
            <button
              key={w}
              type="button"
              className={cn(btn, "justify-start gap-2", w === l.width && "bg-muted")}
              onClick={() => update({ styles: { line: { size: w } } })}
            >
              <span className="w-8 rounded-full bg-current" style={{ height: w }} />
              {w}px
            </button>
          ))}
        </PopoverContent>
      </Popover>
      <Popover>
        <Tip label={d.lineStyle}>
          <PopoverTrigger className={btn}>
            <svg
              viewBox="0 0 20 4"
              className="h-1 w-5"
              stroke="currentColor"
              strokeWidth={2}
              strokeDasharray={l.lineStyle === "dashed" ? "4 3" : undefined}
            >
              <path d="M0 2h20" />
            </svg>
          </PopoverTrigger>
        </Tip>
        <PopoverContent className="w-32 gap-1 p-1">
          {(["solid", "dashed"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={cn(btn, "justify-start gap-2", s === l.lineStyle && "bg-muted")}
              onClick={() => update({ styles: { line: { style: s, dashedValue: [6, 4] } } })}
            >
              <svg
                viewBox="0 0 20 4"
                className="h-1 w-8"
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray={s === "dashed" ? "4 3" : undefined}
              >
                <path d="M0 2h20" />
              </svg>
              {d[s]}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      {hasText && (
        <Popover>
          <Tip label={d.textColor}>
            <PopoverTrigger className={btn}>
              <TypeIcon className="size-4" style={{ color: l.textColor }} />
              <span className="text-xs">{l.fontSize}</span>
            </PopoverTrigger>
          </Tip>
          <PopoverContent className="w-56">
            <ColorGrid value={l.textColor} onChange={(color) => update({ styles: { text: { color } } })} />
            <div className="flex flex-wrap gap-1">
              {[10, 11, 12, 14, 16, 20, 24, 28, 32, 40].map((size) => (
                <button
                  key={size}
                  type="button"
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs hover:bg-muted",
                    size === l.fontSize && "bg-muted",
                  )}
                  onClick={() => update({ styles: { text: { size } } })}
                >
                  {size}
                </button>
              ))}
              <button
                type="button"
                className={cn("rounded px-1.5 py-0.5 text-xs font-bold hover:bg-muted", l.bold && "bg-muted")}
                onClick={() => update({ styles: { text: { weight: l.bold ? "normal" : "bold" } } })}
              >
                B
              </button>
            </div>
          </PopoverContent>
        </Popover>
      )}
      <Tip label={d.settings}>
        <button
          type="button"
          className={btn}
          onClick={() => openDialog({ type: "drawingSettings", chart, id: overlay.id })}
        >
          <SettingsIcon className="size-4" />
        </button>
      </Tip>
      <Tip label={ext.locked ? d.unlock : d.lock}>
        <button type="button" className={btn} onClick={() => update({ lock: !ext.locked })}>
          {ext.locked ? <LockIcon className="size-4" /> : <LockOpenIcon className="size-4" />}
        </button>
      </Tip>
      <Tip label={d.clone}>
        <button type="button" className={btn} onClick={() => controller.cloneDrawing(overlay.id)}>
          <CopyIcon className="size-4" />
        </button>
      </Tip>
      <Tip label={d.remove}>
        <button
          type="button"
          className={cn(btn, "hover:text-destructive")}
          onClick={() => controller.removeDrawing(overlay.id)}
        >
          <Trash2Icon className="size-4" />
        </button>
      </Tip>
    </div>
  );
}
