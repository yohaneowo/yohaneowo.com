"use client";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { ChevronDownIcon, GripVerticalIcon, Loader2Icon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocale } from "@/i18n/locale-provider";
import { fmtCompact, fmtNumber, fmtPercent } from "@/lib/coinhub/format";
import { getState, setChartSymbol, setState, useTerminal } from "@/lib/coinhub/store";
import type { MarketOverview } from "@/lib/coinhub/types";
type Position = { x: number; y: number };
type RowOptions = {
  change?: number | null;
  hint?: string;
  delta?: (v: number) => string;
  tint?: number | null;
};
const color = (v?: number | null) =>
  v == null ? "text-muted-foreground" : v >= 0 ? "text-[#089981]" : "text-[#f23645]";
const format = (v: number | null | undefined, fn = fmtNumber) => (v == null ? "—" : fn(v));
const dollars = (v: number) => `$${fmtNumber(v)}`;
const compactDollars = (v: number) => `${v < 0 ? "-" : ""}$${fmtCompact(Math.abs(v))}`;
const multiple = (v: number) => `${fmtNumber(v, 3)}×`;
const signed = (v: number, digits = 2) => `${v >= 0 ? "+" : ""}${fmtNumber(v, digits)}`;
// alternative.me's bands: extreme fear ≤ 24, fear ≤ 44, neutral ≤ 55, greed ≤ 74, extreme greed.
const FG_BANDS: Array<[number, number, string]> = [
  [0, 25, "#f23645"],
  [25, 45, "#ff9800"],
  [45, 56, "#9598a1"],
  [56, 75, "#7cb342"],
  [75, 100, "#089981"],
];
const fgBand = (value: number | null | undefined) =>
  value == null ? "transparent" : (FG_BANDS.find(([, to]) => value < to)?.[2] ?? "#089981");

// Half-circle gauge like TradingView's and alternative.me's: coloured bands with a needle.
function FearGreedGauge({ value, label }: { value: number | null; label: string }) {
  const cx = 50;
  const cy = 50;
  const r = 42;
  const point = (pct: number, radius: number) => {
    const a = Math.PI * (1 - pct / 100);
    return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)] as const;
  };
  const arc = (from: number, to: number) => {
    const [x0, y0] = point(from, r);
    const [x1, y1] = point(to, r);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  };
  const [nx, ny] = point(value ?? 50, r - 14);
  return (
    <div className="flex w-28 shrink-0 flex-col items-center">
      <svg viewBox="0 0 100 52" className="w-full">
        {FG_BANDS.map(([from, to, color]) => (
          <path key={from} d={arc(from, to)} stroke={color} strokeWidth={8} fill="none" />
        ))}
        {value != null && (
          <>
            <line
              x1={cx}
              y1={cy}
              x2={nx}
              y2={ny}
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={3} fill="currentColor" />
          </>
        )}
      </svg>
      <span className="text-base leading-none font-semibold">{value ?? "—"}</span>
      <span className="text-[10px] font-medium" style={{ color: fgBand(value) }}>
        {label}
      </span>
    </div>
  );
}

function clamp(panel: HTMLDivElement, point: Position): Position {
  const bounds = panel.parentElement!.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(point.x, bounds.width - panel.offsetWidth)),
    y: Math.max(0, Math.min(point.y, bounds.height - panel.offsetHeight)),
  };
}
export function MarketPanel() {
  const { t } = useLocale();
  const p = t.coinhub.marketPanel;
  const panel = useTerminal((s) => s.marketPanel);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; dx: number; dy: number; point: Position } | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [data, setData] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      setLoading(true);
      try {
        const response = await fetch("/api/coinhub/overview", { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const next: MarketOverview = await response.json();
        if (!controller.signal.aborted) {
          setData(next);
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!panel.open) return;
    const resize = () => {
      const el = root.current;
      if (!el || window.matchMedia("(max-width: 639px)").matches) return;
      const saved = getState().marketPanel;
      const next = clamp(el, drag.current?.point ?? { x: saved.x ?? el.offsetLeft, y: saved.y ?? 8 });
      if (drag.current) {
        drag.current.point = next;
        setPosition(next);
      }
      if ((saved.x !== null && saved.x !== next.x) || (saved.y ?? 8) !== next.y)
        setState((s) => ({
          marketPanel: { ...s.marketPanel, x: saved.x === null ? null : next.x, y: next.y },
        }));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root.current!);
    observer.observe(root.current!.parentElement!);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [panel.open]);
  const start = (e: PointerEvent<HTMLDivElement>) => {
    if (
      e.button !== 0 ||
      !e.isPrimary ||
      (e.target as HTMLElement).closest("button") ||
      window.matchMedia("(max-width: 639px)").matches
    )
      return;
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
    current.point = clamp(el, {
      x: e.clientX - rect.left - current.dx,
      y: e.clientY - rect.top - current.dy,
    });
    setPosition(current.point);
  };
  const finish = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const point = clamp(root.current!, drag.current.point);
    drag.current = null;
    setState((s) => ({ marketPanel: { ...s.marketPanel, ...point } }));
    setPosition(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  if (!panel.open) return null;
  const fg = data?.fearGreed.now;
  const yesterday = data?.fearGreed.yesterday;
  const g = data?.global;
  const s = data?.strategy;
  const b = data?.bitcoin;
  const funding = data?.derivatives.funding.find((r) => r.symbol === "BTCUSDT");
  const ls = data?.derivatives.longShort.find((r) => r.symbol === "BTCUSDT");
  const oi = data?.derivatives.openInterest;
  const row = (label: string, value: ReactNode, symbol?: string, options: RowOptions = {}) => {
    const { change, hint, delta = fmtPercent, tint } = options;
    const Tag = symbol ? "button" : "div";
    const labelNode = <span className="text-muted-foreground">{label}</span>;
    return (
      <Tag
        key={label}
        type={symbol ? "button" : undefined}
        title={symbol ? p.openChart : undefined}
        onClick={symbol ? () => setChartSymbol(getState().active, symbol) : undefined}
        className={cn(
          "grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-1 text-left tabular-nums",
          symbol && "hover:bg-muted/60",
        )}
      >
        {hint ? (
          <Tooltip>
            <TooltipTrigger render={labelNode} tabIndex={symbol ? undefined : 0} />
            <TooltipContent>{hint}</TooltipContent>
          </Tooltip>
        ) : (
          labelNode
        )}
        <span className={cn("text-right font-medium", tint != null && color(tint))}>{value}</span>
        <span className={color(change)} title={p.vsYesterday}>
          {change === undefined ? null : format(change, delta)}
        </span>
      </Tag>
    );
  };
  const group = (key: string, children: ReactNode) => {
    const collapsed = panel.collapsed.includes(key);
    const toggle = () =>
      setState((st) => {
        const keys = st.marketPanel.collapsed;
        return {
          marketPanel: {
            ...st.marketPanel,
            collapsed: keys.includes(key) ? keys.filter((v) => v !== key) : [...keys, key],
          },
        };
      });
    return (
      <section key={key}>
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={toggle}
          className="flex h-7 w-full items-center justify-between px-3 text-[10px] text-muted-foreground uppercase hover:bg-muted/60"
        >
          {p.groups[key]}
          <ChevronDownIcon className={cn("size-3 transition-transform", collapsed && "-rotate-90")} />
        </button>
        {!collapsed && children}
      </section>
    );
  };
  const wholeDollars = (v: number) => `$${fmtNumber(v, 0)}`;
  const btcAmount = (v: number) => `\u20bf${fmtNumber(v, 0)}`;
  const drawdown = (v: number) => fmtPercent(v, 1, false);
  const fixed3 = (v: number) => fmtNumber(v, 3);
  const percent = (v: number) => fmtPercent(v, 2, false);
  const fgLabel = (point: { label: string } | null | undefined) =>
    point ? (p.fgLabels[point.label] ?? point.label) : "—";
  const sentiment = (
    <button
      key="fg"
      type="button"
      title={p.openChart}
      onClick={() => setChartSymbol(getState().active, "INDEX:FEAR.GREED")}
      className="flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-muted/60"
    >
      <FearGreedGauge value={fg?.value ?? null} label={fgLabel(fg)} />
      <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 tabular-nums">
        {(
          [
            [p.yesterday, yesterday],
            [p.lastWeek, data?.fearGreed.lastWeek],
            [p.lastMonth, data?.fearGreed.lastMonth],
          ] as const
        ).map(([label, point]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="flex items-center justify-end gap-1 text-right">
              <span className="size-1.5 rounded-full" style={{ background: fgBand(point?.value) }} />
              <span className="font-medium">{point ? fmtNumber(point.value, 0) : "—"}</span>
              <span className="text-[10px] text-muted-foreground">{fgLabel(point)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </button>
  );
  const longShort = ls ? (
    <>
      {ls.ratio.toFixed(2)}
      <span className="block text-[10px] text-muted-foreground">
        {percent(ls.long * 100)}/{percent(ls.short * 100)}
      </span>
    </>
  ) : (
    "\u2014"
  );
  const interest = oi?.length ? oi.reduce((sum, r) => sum + r.value, 0) : null;
  const groups: Record<string, ReactNode[]> = {
    sentiment: [sentiment],
    dominance: [
      ...(["btc", "eth", "usdt"] as const).map((coin) => {
        const label = `${coin.toUpperCase()}.D`;
        return row(label, format(g?.[`${coin}Dominance`], percent), `INDEX:${label}`, {
          change: g?.[`${coin}DominanceChange`],
          delta: signed,
        });
      }),
      row(p.totalMarketCap, format(g?.totalMarketCap, compactDollars), "INDEX:TOTAL", {
        change: g?.marketCapChange24h,
      }),
    ],
    strategy: s
      ? [
          row(p.mnav, format(s.mNav, multiple), undefined, {
            change: s.mNavChangePercent,
            hint: p.mnavHint,
          }),
          row(p.mcMnav, format(s.marketCapMNav, multiple), "INDEX:MSTR.MNAV", { hint: p.mcMnavHint }),
          row(p.netMnav, format(s.netMNav, multiple), "INDEX:MSTR.MNAV.NET", { hint: p.netMnavHint }),
          row(p.evMnav, format(s.evMNav, multiple), "INDEX:MSTR.MNAV.EV", { hint: p.evMnavHint }),
          row(p.holdings, format(s.btcHoldings, btcAmount)),
          row(p.mstrPrice, format(s.mstrPrice, dollars), "YAHOO:MSTR", { change: s.mstrChangePercent }),
          s.balanceSheetDate && (
            <p key="date" className="px-3 py-1 text-[10px] text-muted-foreground">
              {p.balanceSheet(s.balanceSheetDate)}
            </p>
          ),
        ]
      : [],
    bitcoin: [
      row(p.ahr999, format(b?.ahr999, fixed3), "INDEX:BTC.AHR999", { hint: p.ahr999Hint }),
      row(p.mayer, format(b?.mayerMultiple, fixed3), "INDEX:BTC.MAYER", { hint: p.mayerHint }),
      row(p.ma200w, format(b?.ma200w, wholeDollars)),
      row(
        p.realizedPrice,
        format(b?.realizedPrice, (v) => `$${fmtNumber(v, 0)}`),
      ),
      row(p.drawdown, format(b?.drawdownFromAth, drawdown)),
      row(p.etfFlows7d, format(b?.etfNetFlows7d, compactDollars), undefined, { tint: b?.etfNetFlows7d }),
    ],
    derivatives: [
      row(
        p.funding,
        format(funding?.rate, (v) => fmtPercent(v * 100, 4)),
        "BINANCE:BTCUSDT.P",
        { hint: p.fundingHint, tint: funding?.rate },
      ),
      row(p.openInterest, format(interest, compactDollars), undefined, { hint: p.openInterestHint }),
      row(p.longShort, longShort),
    ],
  };
  const x = position?.x ?? panel.x;
  const y = position?.y ?? panel.y ?? 8;
  const style = {
    "--panel-left": x === null ? "auto" : `${x}px`,
    "--panel-right": x === null ? "8px" : "auto",
    "--panel-top": `${y}px`,
  } as CSSProperties;
  const time = data ? new Date(data.updatedAt).toTimeString().slice(0, 5) : null;
  return (
    <div
      ref={root}
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="absolute top-(--panel-top) right-(--panel-right) left-(--panel-left) z-30 flex max-h-[calc(100%-1rem)] w-[272px] flex-col rounded-lg border bg-popover/95 text-xs shadow-md backdrop-blur max-sm:inset-x-2 max-sm:top-auto max-sm:bottom-2 max-sm:max-h-[50%] max-sm:w-auto"
    >
      <div
        className={cn(
          "flex h-8 shrink-0 touch-none items-center gap-1 border-b px-2 max-sm:cursor-default",
          position ? "cursor-grabbing" : "cursor-grab",
        )}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
      >
        <GripVerticalIcon className="size-3 shrink-0 text-muted-foreground" aria-label={p.drag} />
        <span className="font-medium">{p.title}</span>
        {loading && <Loader2Icon className="size-3 shrink-0 animate-spin text-muted-foreground" />}
        <span className="ml-auto text-[10px] text-muted-foreground">{time && p.updated(time)}</span>
        <button
          type="button"
          aria-label={p.close}
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted/60"
          onClick={() => setState((st) => ({ marketPanel: { ...st.marketPanel, open: false } }))}
        >
          <XIcon className="size-3" />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        {!data && failed ? (
          <p className="p-3 text-muted-foreground">{p.unavailable}</p>
        ) : (
          Object.entries(groups).map(([key, rows]) => rows.length > 0 && group(key, rows))
        )}
        <p className="border-t px-3 py-2 text-[10px] text-muted-foreground">
          {p.sources}: alternative.me · CoinGecko · strategy.com · cebetracker.io · Binance
        </p>
      </div>
    </div>
  );
}
