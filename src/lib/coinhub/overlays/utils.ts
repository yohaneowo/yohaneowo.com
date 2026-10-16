import type { Bounding, Chart, Coordinate, KLineData, Overlay, OverlayFigure } from "klinecharts";

// Shared drawing helpers for CoinHub's drawing tools (KLineChart overlays).
//
// Appearance lives in `overlay.styles` (line colour / width / style, text colour / size, fill)
// so KLineChart merges it into figures automatically; tool options live in `extendData`.

export const DEFAULT_COLOR = "#2962ff";
export const UP_COLOR = "#089981";
export const DOWN_COLOR = "#f23645";

export interface Look {
  color: string;
  width: number;
  lineStyle: "solid" | "dashed";
  dash: number[];
  fill: string;
  textColor: string;
  fontSize: number;
  bold: boolean;
}

type Styles = Overlay["styles"];

export function look(overlay: Pick<Overlay, "styles">): Look {
  const s = (overlay.styles ?? {}) as NonNullable<Styles> & {
    polygon?: { color?: string };
    text?: { color?: string; size?: number; weight?: string | number };
  };
  const color = (s.line?.color as string | undefined) ?? DEFAULT_COLOR;
  return {
    color,
    width: s.line?.size ?? 1,
    lineStyle: (s.line?.style as "solid" | "dashed" | undefined) ?? "solid",
    dash: (s.line?.dashedValue as number[] | undefined) ?? [6, 4],
    fill: (s.polygon?.color as string | undefined) ?? alpha(color, 0.12),
    textColor: (s.text?.color as string | undefined) ?? color,
    fontSize: s.text?.size ?? 12,
    bold: s.text?.weight === "bold" || s.text?.weight === 600,
  };
}

// "#2962ff" / "#26f" / "rgb(…)" / "rgba(…)" → rgba with the given alpha.
export function alpha(color: string, a: number) {
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
    const n = parseInt(hex.slice(0, 6), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  const m = /rgba?\(([^)]+)\)/.exec(color);
  if (m) {
    const [r, g, b] = m[1].split(",").map((x) => x.trim());
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return color;
}

export const lineStyle = (l: Look, extra?: Record<string, unknown>) => ({
  color: l.color,
  size: l.width,
  style: l.lineStyle,
  dashedValue: l.dash,
  ...extra,
});

export function line(
  coordinates: Coordinate[],
  styles?: Record<string, unknown>,
  ignoreEvent = false,
): OverlayFigure {
  return { type: "line", attrs: { coordinates }, styles, ignoreEvent };
}

export function lines(
  list: Coordinate[][],
  styles?: Record<string, unknown>,
  ignoreEvent = false,
): OverlayFigure {
  return { type: "line", attrs: list.map((coordinates) => ({ coordinates })), styles, ignoreEvent };
}

export function dashed(l: Look, extra?: Record<string, unknown>) {
  return { color: l.color, size: 1, style: "dashed", dashedValue: [4, 4], ...extra };
}

export function polygon(coordinates: Coordinate[], color: string, ignoreEvent = false): OverlayFigure {
  return { type: "polygon", attrs: { coordinates }, styles: { style: "fill", color }, ignoreEvent };
}

export function outlinedPolygon(coordinates: Coordinate[], l: Look, fill = true): OverlayFigure {
  return {
    type: "polygon",
    attrs: { coordinates },
    styles: {
      style: fill ? "stroke_fill" : "stroke",
      color: l.fill,
      borderColor: l.color,
      borderSize: l.width,
      borderStyle: l.lineStyle,
      borderDashedValue: l.dash,
    },
  };
}

export interface LabelOptions {
  color?: string;
  size?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  background?: string;
  borderColor?: string;
  padding?: number;
  bold?: boolean;
  ignoreEvent?: boolean;
}

export function label(x: number, y: number, text: string, o: LabelOptions = {}): OverlayFigure {
  const padding = o.padding ?? (o.background ? 4 : 0);
  return {
    type: "text",
    attrs: { x, y, text, align: o.align ?? "left", baseline: o.baseline ?? "bottom" },
    styles: {
      color: o.color ?? DEFAULT_COLOR,
      size: o.size ?? 12,
      weight: o.bold ? "bold" : "normal",
      backgroundColor: o.background ?? "transparent",
      borderColor: o.borderColor ?? "transparent",
      borderSize: o.borderColor ? 1 : 0,
      borderRadius: 3,
      paddingLeft: padding,
      paddingRight: padding,
      paddingTop: padding,
      paddingBottom: padding,
    },
    ignoreEvent: o.ignoreEvent ?? true,
  };
}

// Multi-line text: the text figure draws one line, so stack them.
export function textBlock(
  x: number,
  y: number,
  text: string,
  o: LabelOptions & { lineHeight?: number } = {},
) {
  const size = o.size ?? 12;
  const lineHeight = o.lineHeight ?? Math.round(size * 1.35);
  const rows = text.split("\n");
  const top =
    o.baseline === "bottom"
      ? y - rows.length * lineHeight
      : o.baseline === "middle"
        ? y - (rows.length * lineHeight) / 2
        : y;
  return rows.map((row, i) =>
    label(x, top + i * lineHeight, row || " ", { ...o, baseline: "top", padding: o.padding ?? 0 }),
  );
}

// The line through a and b, clipped to the pane and extended to the left and/or right edges.
export function extendLine(
  a: Coordinate,
  b: Coordinate,
  bounding: Bounding,
  left: boolean,
  right: boolean,
): [Coordinate, Coordinate] {
  if (a.x === b.x) {
    const top = a.y < b.y ? a : b;
    const bottom = a.y < b.y ? b : a;
    return [left ? { x: a.x, y: 0 } : top, right ? { x: a.x, y: bounding.height } : bottom];
  }
  const k = (b.y - a.y) / (b.x - a.x);
  const at = (x: number) => ({ x, y: a.y + k * (x - a.x) });
  const [p, q] = a.x < b.x ? [a, b] : [b, a];
  return [left ? at(0) : p, right ? at(bounding.width) : q];
}

// Point a → in direction of b, to the pane edge.
export function rayTo(a: Coordinate, b: Coordinate, bounding: Bounding): Coordinate {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return b;
  const far = (bounding.width + bounding.height) * 4;
  const len = Math.hypot(dx, dy);
  return { x: a.x + (dx / len) * far, y: a.y + (dy / len) * far };
}

export function arrowHead(from: Coordinate, to: Coordinate, size = 10): Coordinate[] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const spread = Math.PI / 7;
  return [
    to,
    { x: to.x - size * Math.cos(angle - spread), y: to.y - size * Math.sin(angle - spread) },
    { x: to.x - size * Math.cos(angle + spread), y: to.y - size * Math.sin(angle + spread) },
  ];
}

export const mid = (a: Coordinate, b: Coordinate): Coordinate => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export const lerp = (a: Coordinate, b: Coordinate, t: number): Coordinate => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export function precisionOf(chart: Chart) {
  return chart.getSymbol()?.pricePrecision ?? 2;
}

export function fmtPrice(chart: Chart, value: number, precision = precisionOf(chart)) {
  if (!Number.isFinite(value)) return "";
  return chart.getThousandsSeparator().format(value.toFixed(precision));
}

export function fmtPercent(value: number) {
  if (!Number.isFinite(value)) return "";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function fmtVolume(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(abs < 10 ? 2 : 0);
}

export function fmtDuration(ms: number, zh = false) {
  const sign = ms < 0 ? "-" : "";
  let s = Math.abs(ms) / 1000;
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  const parts = [];
  if (d) parts.push(zh ? `${d}天` : `${d}d`);
  if (h) parts.push(zh ? `${h}小时` : `${h}h`);
  if (m && !d) parts.push(zh ? `${m}分钟` : `${m}m`);
  return sign + (parts.join(" ") || (zh ? `${Math.round(s)}秒` : `${Math.round(s)}s`));
}

// Bars between two x coordinates at the current zoom.
export function barCount(chart: Chart, x1: number, x2: number) {
  return Math.round((x2 - x1) / chart.getBarSpace().bar);
}

// Index of the bar at or before `timestamp` (binary search).
export function indexAt(list: KLineData[], timestamp: number) {
  let lo = 0;
  let hi = list.length - 1;
  if (hi < 0 || timestamp < list[0].timestamp) return -1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (list[m].timestamp <= timestamp) lo = m;
    else hi = m - 1;
  }
  return lo;
}

// Point values in the order the user placed them; undefined while still drawing.
export function values(overlay: Overlay) {
  return overlay.points.map((p) => p.value);
}

export function timestamps(overlay: Overlay) {
  return overlay.points.map((p) => p.timestamp);
}

export type Ext<T> = T & Record<string, unknown>;

export function ext<T extends object>(overlay: Overlay, defaults: T): T {
  const data = overlay.extendData;
  return data && typeof data === "object" ? { ...defaults, ...(data as Partial<T>) } : defaults;
}

// TradingView's default fib palette.
export const FIB_COLORS: Record<string, string> = {
  "-0.618": "#9c27b0",
  "-0.272": "#787b86",
  "0": "#787b86",
  "0.236": "#f23645",
  "0.382": "#ff9800",
  "0.5": "#4caf50",
  "0.618": "#089981",
  "0.705": "#00bcd4",
  "0.786": "#00bcd4",
  "1": "#787b86",
  "1.272": "#2962ff",
  "1.414": "#f23645",
  "1.618": "#2962ff",
  "2": "#9c27b0",
  "2.618": "#f23645",
  "3": "#ff9800",
  "3.618": "#9c27b0",
  "4.236": "#e91e63",
};

export interface Level {
  value: number;
  color: string;
  visible: boolean;
}

export const levelColor = (value: number) => FIB_COLORS[String(value)] ?? DEFAULT_COLOR;

export const makeLevels = (visible: number[], hidden: number[] = []): Level[] =>
  [...visible.map((v) => [v, true] as const), ...hidden.map((v) => [v, false] as const)]
    .sort((a, b) => a[0] - b[0])
    .map(([value, isVisible]) => ({ value, color: levelColor(value), visible: isVisible }));
