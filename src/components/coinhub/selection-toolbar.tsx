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

export const SWATCHES = [
  "#f23645",
  "#ff9800",
  "#ffeb3b",
  "#4caf50",
  "#089981",
  "#00bcd4",
  "#2962ff",
  "#673ab7",
  "#9c27b0",
  "#e91e63",
  "#ffffff",
  "#d1d4dc",
  "#9598a1",
  "#787b86",
  "#434651",
  "#131722",
];

export function ColorGrid({ value, onChange }: { value?: string; onChange: (color: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1">
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          className={cn(
            "size-5 rounded border border-border",
            value?.toLowerCase() === c && "ring-2 ring-ring",
          )}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
      <label className="relative col-span-8 mt-1 flex h-6 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <input
          type="color"
          value={value?.startsWith("#") && value.length === 7 ? value : "#2962ff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-5 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        {value}
      </label>
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
