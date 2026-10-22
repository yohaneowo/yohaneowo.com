"use client";

import { type PointerEvent, useRef, useState } from "react";
import {
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  ListTreeIcon,
  LockIcon,
  LockOpenIcon,
  MagnetIcon,
  PencilIcon,
  SmileIcon,
  StarIcon,
  Trash2Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { cn } from "cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocale } from "@/i18n/locale-provider";
import { getState, setState, updateChart, useTerminal, type CursorMode } from "@/lib/coinhub/store";
import { EMOJIS, TOOL_GROUPS, TOOL_HOTKEYS, type ToolGroup } from "./tool-catalog";
import { ToolIcon } from "./tool-icons";
import { registry, ui, useUi } from "./ui-store";

const button =
  "relative flex size-9 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary";

function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function selectTool(name: string | null) {
  const s = getState();
  if (name === null || s.tool === name) {
    setState({ tool: null });
    return;
  }
  const group = TOOL_GROUPS.find((g) => g.sections.some((sec) => sec.tools.includes(name)));
  setState({
    tool: name,
    cursor: s.cursor === "eraser" ? "cross" : s.cursor,
    lastTools: group ? { ...s.lastTools, [group.id]: name } : s.lastTools,
  });
}

function toggleFavorite(name: string) {
  setState((s) => {
    const tools = s.favorites.tools.includes(name)
      ? s.favorites.tools.filter((t) => t !== name)
      : [...s.favorites.tools, name];
    return { favorites: { ...s.favorites, tools } };
  });
}

function GroupButton({ group }: { group: ToolGroup }) {
  const { t } = useLocale();
  const tools = t.coinhub.tools;
  const current = useTerminal((s) => s.lastTools[group.id]) ?? group.sections[0].tools[0];
  const active = useTerminal((s) => s.tool);
  const favorites = useTerminal((s) => s.favorites.tools);
  const [open, setOpen] = useState(false);
  const inGroup = group.sections.some((sec) => sec.tools.includes(active ?? ""));
  return (
    <div className="group/tool relative">
      <Tip label={tools.names[current]}>
        <button
          type="button"
          className={button}
          data-active={inGroup}
          onClick={() => selectTool(inGroup ? null : current)}
        >
          <ToolIcon name={inGroup && active ? active : current} />
        </button>
      </Tip>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="absolute top-0 right-0 flex h-9 w-2.5 items-center justify-center rounded-r-md text-muted-foreground opacity-0 group-hover/tool:opacity-100 hover:bg-muted"
          aria-label={tools.groups[group.id]}
        >
          <ChevronRightIcon className="size-3" />
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="max-h-[80vh] w-72 gap-0 overflow-y-auto p-1">
          {group.sections.map((section) => (
            <div key={section.id} className="py-1">
              <div className="px-2 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {tools.sections[section.id]}
              </div>
              {section.tools.map((name) => (
                <div
                  key={name}
                  className={cn(
                    "group/item flex items-center rounded-md hover:bg-muted",
                    active === name && "bg-primary/10 text-primary",
                  )}
                >
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-2.5 px-2 py-1.5 text-left text-sm"
                    onClick={() => {
                      selectTool(name);
                      setOpen(false);
                    }}
                  >
                    <ToolIcon name={name} className="size-5 shrink-0" />
                    <span className="flex-1">{tools.names[name]}</span>
                    {TOOL_HOTKEYS[name] && (
                      <span className="text-xs text-muted-foreground">{TOOL_HOTKEYS[name]}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "mr-1 rounded p-1",
                      favorites.includes(name)
                        ? "text-amber-500"
                        : "text-muted-foreground opacity-0 group-hover/item:opacity-100",
                    )}
                    onClick={() => toggleFavorite(name)}
                    aria-label={tools.favorites}
                  >
                    <StarIcon className={cn("size-3.5", favorites.includes(name) && "fill-current")} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

const CURSORS: CursorMode[] = ["cross", "dot", "arrow", "eraser"];

export function DrawingToolbar() {
  const { t } = useLocale();
  const tt = t.coinhub.tools;
  const cursor = useTerminal((s) => s.cursor);
  const tool = useTerminal((s) => s.tool);
  const magnet = useTerminal((s) => s.magnet);
  const stay = useTerminal((s) => s.stayInDrawing);
  const locked = useTerminal((s) => s.drawingsLocked);
  const hidden = useTerminal((s) => s.drawingsHidden);
  const indicatorsHidden = useTerminal((s) => s.indicatorsHidden);
  const active = useTerminal((s) => s.active);
  const emoji = useUi((s) => s.emoji);
  const favoritesBar = useTerminal((s) => s.favoritesBar);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const controller = () => registry.get(getState().active);

  return (
    <div className="flex h-full w-11 shrink-0 [scrollbar-width:none] flex-col items-center gap-0.5 overflow-y-auto border-r bg-background py-1">
      <Popover>
        <Tip label={tt.names[cursor]}>
          <PopoverTrigger className={button} data-active={!tool}>
            <ToolIcon name={cursor} />
          </PopoverTrigger>
        </Tip>
        <PopoverContent side="right" align="start" className="w-44 gap-0 p-1">
          {CURSORS.map((c) => (
            <button
              key={c}
              type="button"
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                cursor === c && "bg-primary/10 text-primary",
              )}
              onClick={() => setState({ cursor: c, tool: null })}
            >
              <ToolIcon name={c} className="size-5" />
              {tt.names[c]}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      {TOOL_GROUPS.map((group) => (
        <GroupButton key={group.id} group={group} />
      ))}
      <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
        <Tip label={tt.groups.icons}>
          <PopoverTrigger className={button} data-active={tool === "emoji"}>
            {tool === "emoji" ? (
              <span className="text-base leading-none">{emoji}</span>
            ) : (
              <SmileIcon className="size-5" strokeWidth={1.5} />
            )}
          </PopoverTrigger>
        </Tip>
        <PopoverContent side="right" align="start" className="w-56">
          <div className="grid grid-cols-5 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className="rounded-md p-1 text-xl hover:bg-muted"
                onClick={() => {
                  ui.set({ emoji: e });
                  setState({ tool: "emoji" });
                  setEmojiOpen(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Separator className="my-1 w-7" />
      <Tip label={tt.measureHint}>
        <button
          type="button"
          className={button}
          data-active={tool === "measure"}
          onClick={() => selectTool("measure")}
        >
          <ToolIcon name="measure" />
        </button>
      </Tip>
      <Tip label={tt.zoomIn}>
        <button type="button" className={button} onClick={() => controller()?.zoom(1.25)}>
          <ZoomInIcon className="size-5" strokeWidth={1.5} />
        </button>
      </Tip>
      <Tip label={tt.zoomOut}>
        <button type="button" className={button} onClick={() => controller()?.zoom(0.8)}>
          <ZoomOutIcon className="size-5" strokeWidth={1.5} />
        </button>
      </Tip>
      <Separator className="my-1 w-7" />
      <Popover>
        <Tip
          label={magnet === "normal" ? tt.magnet : magnet === "weak_magnet" ? tt.weakMagnet : tt.strongMagnet}
        >
          <PopoverTrigger className={button} data-active={magnet !== "normal"}>
            <MagnetIcon className="size-5" strokeWidth={1.5} />
            {magnet === "strong_magnet" && (
              <span className="absolute right-1 bottom-1 text-[8px] font-bold">S</span>
            )}
          </PopoverTrigger>
        </Tip>
        <PopoverContent side="right" align="start" className="w-44 gap-0 p-1">
          {(
            [
              ["normal", tt.magnetOff],
              ["weak_magnet", tt.weakMagnet],
              ["strong_magnet", tt.strongMagnet],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={cn(
                "rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                magnet === mode && "bg-primary/10 text-primary",
              )}
              onClick={() => setState({ magnet: mode })}
            >
              {label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      <Tip label={tt.stayInDrawing}>
        <button
          type="button"
          className={button}
          data-active={stay}
          onClick={() => setState({ stayInDrawing: !stay })}
        >
          <PencilIcon className="size-5" strokeWidth={1.5} />
        </button>
      </Tip>
      <Tip label={locked ? tt.unlockAll : tt.lockAll}>
        <button
          type="button"
          className={button}
          data-active={locked}
          onClick={() => setState({ drawingsLocked: !locked })}
        >
          {locked ? (
            <LockIcon className="size-5" strokeWidth={1.5} />
          ) : (
            <LockOpenIcon className="size-5" strokeWidth={1.5} />
          )}
        </button>
      </Tip>
      <Popover>
        <Tip label={hidden ? tt.showAll : tt.hideAll}>
          <PopoverTrigger className={button} data-active={hidden || indicatorsHidden}>
            {hidden ? (
              <EyeOffIcon className="size-5" strokeWidth={1.5} />
            ) : (
              <EyeIcon className="size-5" strokeWidth={1.5} />
            )}
          </PopoverTrigger>
        </Tip>
        <PopoverContent side="right" align="start" className="w-48 gap-0 p-1">
          <button
            type="button"
            className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            onClick={() => setState({ drawingsHidden: !hidden })}
          >
            {hidden ? tt.showAll : tt.hideAll}
          </button>
          <button
            type="button"
            className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            onClick={() => setState({ indicatorsHidden: !indicatorsHidden })}
          >
            {indicatorsHidden ? tt.showIndicators : tt.hideIndicators}
          </button>
        </PopoverContent>
      </Popover>
      <Popover>
        <Tip label={tt.removeDrawings}>
          <PopoverTrigger className={cn(button, "hover:text-destructive")}>
            <Trash2Icon className="size-5" strokeWidth={1.5} />
          </PopoverTrigger>
        </Tip>
        <PopoverContent side="right" align="start" className="w-56 gap-0 p-1">
          <button
            type="button"
            className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            onClick={() => controller()?.removeAllDrawings()}
          >
            {tt.removeDrawings}
          </button>
          <button
            type="button"
            className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            onClick={() => updateChart(active, { indicators: [] })}
          >
            {tt.removeIndicators}
          </button>
          <button
            type="button"
            className="rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-muted"
            onClick={() => {
              controller()?.removeAllDrawings();
              updateChart(active, { indicators: [] });
            }}
          >
            {tt.removeAll}
          </button>
        </PopoverContent>
      </Popover>
      <Separator className="my-1 w-7" />
      <Tip label={tt.favorites}>
        <button
          type="button"
          className={button}
          data-active={favoritesBar}
          onClick={() => setState((s) => ({ favoritesBar: !s.favoritesBar }))}
        >
          <StarIcon className="size-5" strokeWidth={1.5} />
        </button>
      </Tip>
      <Tip label={tt.objectTree}>
        <button
          type="button"
          className={button}
          onClick={() => setState((s) => ({ panel: s.panel === "objects" ? null : "objects" }))}
        >
          <ListTreeIcon className="size-5" strokeWidth={1.5} />
        </button>
      </Tip>
    </div>
  );
}

// Floating bar with the favourite tools, over the chart (TradingView's "favorites toolbar").
// Keeps a floating panel inside the chart area.
function clampToParent(el: HTMLDivElement, point: { x: number; y: number }) {
  const bounds = el.parentElement!.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(point.x, bounds.width - el.offsetWidth)),
    y: Math.max(0, Math.min(point.y, bounds.height - el.offsetHeight)),
  };
}

// The favourite tools over the chart, like TradingView's: dragged by the grip at its left, the
// spot remembered with the workspace (null: top centre).
export function FavoritesBar() {
  const { t } = useLocale();
  const favorites = useTerminal((s) => s.favorites.tools);
  const tool = useTerminal((s) => s.tool);
  const show = useTerminal((s) => s.favoritesBar);
  const saved = useTerminal((s) => s.favoritesBarPos);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; dx: number; dy: number; point: { x: number; y: number } } | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  if (!show || favorites.length === 0) return null;
  const start = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !e.isPrimary) return;
    const el = root.current!;
    const rect = el.getBoundingClientRect();
    drag.current = {
      id: e.pointerId,
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      point: { x: el.offsetLeft, y: el.offsetTop },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPosition(drag.current.point);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== e.pointerId) return;
    const el = root.current!;
    const rect = el.parentElement!.getBoundingClientRect();
    current.point = clampToParent(el, {
      x: e.clientX - rect.left - current.dx,
      y: e.clientY - rect.top - current.dy,
    });
    setPosition(current.point);
  };
  const finish = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const point = clampToParent(root.current!, drag.current.point);
    drag.current = null;
    setState({ favoritesBarPos: point });
    setPosition(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const at = position ?? saved;
  const style = at
    ? { left: at.x, top: at.y, transform: "none" }
    : { left: "50%", top: "3rem", transform: "translateX(-50%)" };
  return (
    <div
      ref={root}
      style={style}
      className="absolute z-30 flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "flex h-8 w-4 shrink-0 touch-none items-center justify-center text-muted-foreground",
          position ? "cursor-grabbing" : "cursor-grab",
        )}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        aria-label={t.coinhub.toolbar.dragBar}
        title={t.coinhub.toolbar.dragBar}
      >
        <GripVerticalIcon className="size-3.5" />
      </div>
      {favorites.map((name) => (
        <Tip key={name} label={t.coinhub.tools.names[name] ?? name}>
          <button
            type="button"
            className={cn(button, "size-8")}
            data-active={tool === name}
            onClick={() => selectTool(name)}
          >
            <ToolIcon name={name} />
          </button>
        </Tip>
      ))}
    </div>
  );
}
