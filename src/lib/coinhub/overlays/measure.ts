import type { Coordinate, KLineData, OverlayFigure, OverlayTemplate } from "klinecharts";
import { tool, type FigureParams } from "./factory";
import {
  alpha,
  arrowHead,
  barCount,
  DOWN_COLOR,
  ext,
  fmtDuration,
  fmtPercent,
  fmtPrice,
  fmtVolume,
  indexAt,
  label,
  line,
  look,
  polygon,
  textBlock,
  UP_COLOR,
} from "./utils";

// Position (risk / reward) tools, range measurements and volume-based tools.

export type PositionOptions = {
  accountSize: number;
  riskPercent: number;
  quantityPrecision: number;
};

export const POSITION_DEFAULTS: PositionOptions = { accountSize: 1000, riskPercent: 1, quantityPrecision: 4 };

function rect(a: Coordinate, b: Coordinate, color: string, ignoreEvent = false): OverlayFigure {
  return polygon([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }], color, ignoreEvent);
}

function position(name: string, side: "long" | "short"): OverlayTemplate {
  return tool(
    name,
    3,
    ({ chart, coordinates, overlay }) => {
      if (coordinates.length < 3) return [];
      const [entry, target, stop] = overlay.points.map((p) => p.value ?? 0);
      const o = ext(overlay, POSITION_DEFAULTS);
      const [c0, c1, c2] = coordinates;
      const left = Math.min(c0.x, c1.x);
      const right = Math.max(c0.x, c1.x, left + 40);
      const sign = side === "long" ? 1 : -1;
      const reward = (target - entry) * sign;
      const risk = (entry - stop) * sign;
      const qty = risk > 0 ? (o.accountSize * o.riskPercent) / 100 / risk : 0;
      const pct = (v: number) => fmtPercent(entry ? ((v - entry) / entry) * 100 : 0);
      const rr = risk > 0 ? reward / risk : 0;
      const box = (y: number, text: string, color: string, below: boolean) =>
        textBlock((left + right) / 2, y + (below ? 4 : -4), text, {
          align: "center",
          baseline: below ? "top" : "bottom",
          background: color,
          color: "#fff",
          padding: 3,
          size: 11,
        });
      const targetBelow = c1.y > c0.y;
      const stopBelow = c2.y > c0.y;
      return [
        rect({ x: left, y: c0.y }, { x: right, y: c1.y }, alpha(UP_COLOR, 0.2)),
        rect({ x: left, y: c0.y }, { x: right, y: c2.y }, alpha(DOWN_COLOR, 0.2)),
        line(
          [
            { x: left, y: c0.y },
            { x: right, y: c0.y },
          ],
          { color: "#787b86", size: 1 },
        ),
        ...box(
          c1.y,
          `Target: ${fmtPrice(chart, target)} (${pct(target)}) ${fmtPrice(chart, Math.abs(target - entry))}, Amount: ${(qty * reward).toFixed(2)}`,
          UP_COLOR,
          targetBelow,
        ),
        ...box(
          c2.y,
          `Stop: ${fmtPrice(chart, stop)} (${pct(stop)}) ${fmtPrice(chart, Math.abs(entry - stop))}, Amount: ${(qty * risk).toFixed(2)}`,
          DOWN_COLOR,
          stopBelow,
        ),
        ...box(
          c0.y,
          `${side === "long" ? "Long" : "Short"} ${fmtPrice(chart, entry)}  Qty: ${qty.toFixed(o.quantityPrecision)}\nRisk/Reward Ratio: ${rr.toFixed(2)}`,
          "#787b86",
          !targetBelow,
        ),
      ];
    },
    {
      // The target and stop share the right edge.
      performEventPressedMove: ({ points, performPointIndex }) => {
        if (performPointIndex === 1 || performPointIndex === 2) {
          const other = performPointIndex === 1 ? 2 : 1;
          points[other].timestamp = points[performPointIndex].timestamp;
          points[other].dataIndex = points[performPointIndex].dataIndex;
        }
      },
    },
  );
}

// One click places a position; the chart then swaps it for a full long / short drawing.
const positionPlacer = tool("positionPlacer", 1, () => [], {
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
});

function rangeStats(params: FigureParams, kind: "price" | "date" | "both") {
  const { chart, coordinates, overlay } = params;
  const [p1, p2] = overlay.points;
  const lines: string[] = [];
  if (kind !== "date" && p1?.value !== undefined && p2?.value !== undefined) {
    const diff = p2.value - p1.value;
    const precision = chart.getSymbol()?.pricePrecision ?? 2;
    const ticks = Math.round(diff * 10 ** precision);
    lines.push(
      `${fmtPrice(chart, diff)} (${fmtPercent(p1.value ? (diff / Math.abs(p1.value)) * 100 : 0)}) ${ticks}`,
    );
  }
  if (kind !== "price" && p1?.timestamp && p2?.timestamp) {
    const bars = barCount(chart, coordinates[0].x, coordinates[1].x);
    const zh = chart.getLocale().startsWith("zh");
    const span = fmtDuration(p2.timestamp - p1.timestamp, zh);
    lines.push(zh ? `${bars} 根 K 线, ${span}` : `${bars} bars, ${span}`);
    const list = chart.getDataList();
    const i1 = indexAt(list, Math.min(p1.timestamp, p2.timestamp));
    const i2 = indexAt(list, Math.max(p1.timestamp, p2.timestamp));
    let volume = 0;
    for (let i = Math.max(0, i1); i <= i2 && i < list.length; i++) volume += list[i].volume ?? 0;
    if (volume > 0) lines.push(`Vol ${fmtVolume(volume)}`);
  }
  return lines.join("\n");
}

function range(name: string, kind: "price" | "date" | "both", byDirection = false): OverlayTemplate {
  return tool(name, 2, (params) => {
    const { coordinates, overlay } = params;
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates;
    const up = (overlay.points[1]?.value ?? 0) >= (overlay.points[0]?.value ?? 0);
    const forward = b.x >= a.x;
    const color = byDirection
      ? kind === "date"
        ? forward
          ? "#2962ff"
          : DOWN_COLOR
        : up
          ? "#2962ff"
          : DOWN_COLOR
      : look(overlay).color;
    const out: OverlayFigure[] = [rect(a, b, alpha(color, 0.18))];
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    if (kind !== "date") {
      out.push(
        line(
          [
            { x: midX, y: a.y },
            { x: midX, y: b.y },
          ],
          { color, size: 1 },
          true,
        ),
      );
      out.push(polygon(arrowHead({ x: midX, y: a.y }, { x: midX, y: b.y }, 8), color, true));
    }
    if (kind !== "price") {
      out.push(
        line(
          [
            { x: a.x, y: midY },
            { x: b.x, y: midY },
          ],
          { color, size: 1 },
          true,
        ),
      );
      out.push(polygon(arrowHead({ x: a.x, y: midY }, { x: b.x, y: midY }, 8), color, true));
    }
    const text = rangeStats(params, kind);
    const below = b.y > a.y;
    out.push(
      ...textBlock(midX, b.y + (below ? 6 : -6), text, {
        align: "center",
        baseline: below ? "top" : "bottom",
        background: color,
        color: "#fff",
        padding: 4,
        size: 11,
      }),
    );
    return out;
  });
}

// ---------------------------------------------------------------------------------------------
// Volume tools

const anchoredVwap = tool(
  "anchoredVwap",
  1,
  ({ chart, overlay, xAxis, yAxis }) => {
    const t = overlay.points[0]?.timestamp;
    if (!t || !xAxis || !yAxis) return [];
    const list = chart.getDataList();
    const start = Math.max(0, indexAt(list, t));
    const { from, to } = chart.getVisibleRange();
    const l = look(overlay);
    const { bands } = ext(overlay, { bands: false });
    let pv = 0;
    let vol = 0;
    let pv2 = 0;
    const mid: Coordinate[] = [];
    const upper: Coordinate[] = [];
    const lower: Coordinate[] = [];
    for (let i = start; i < Math.min(list.length, to + 1); i++) {
      const k = list[i];
      const tp = (k.high + k.low + k.close) / 3;
      const v = k.volume ?? 0;
      pv += tp * v;
      vol += v;
      pv2 += tp * tp * v;
      if (i < from - 1 || vol === 0) continue;
      const vwap = pv / vol;
      const x = xAxis.convertToPixel(i);
      mid.push({ x, y: yAxis.convertToPixel(vwap) });
      if (bands) {
        const sd = Math.sqrt(Math.max(0, pv2 / vol - vwap * vwap));
        upper.push({ x, y: yAxis.convertToPixel(vwap + sd) });
        lower.push({ x, y: yAxis.convertToPixel(vwap - sd) });
      }
    }
    const out: OverlayFigure[] = [line(mid, { color: l.color, size: Math.max(1, l.width) })];
    if (bands && upper.length > 1) {
      out.push(polygon([...upper, ...lower.reverse()], alpha(l.color, 0.08), true));
      out.push(line(upper, { color: alpha(l.color, 0.6) }, true));
      out.push(line(lower.reverse(), { color: alpha(l.color, 0.6) }, true));
    }
    const last = mid[mid.length - 1];
    if (last) out.push(label(last.x + 4, last.y, "VWAP", { color: l.color, baseline: "middle", size: 11 }));
    return out;
  },
  { needDefaultYAxisFigure: false },
);

export type VolumeProfileOptions = { rows: number; valueArea: number; upColor: string; downColor: string };

function profile(list: KLineData[], from: number, to: number, rows: number) {
  let low = Infinity;
  let high = -Infinity;
  for (let i = from; i <= to; i++) {
    low = Math.min(low, list[i].low);
    high = Math.max(high, list[i].high);
  }
  const step = (high - low) / rows || 1;
  const up = new Array<number>(rows).fill(0);
  const down = new Array<number>(rows).fill(0);
  for (let i = from; i <= to; i++) {
    const k = list[i];
    const v = k.volume ?? 0;
    const r0 = Math.min(rows - 1, Math.floor((k.low - low) / step));
    const r1 = Math.min(rows - 1, Math.floor((k.high - low) / step));
    const share = v / (r1 - r0 + 1);
    for (let r = r0; r <= r1; r++) (k.close >= k.open ? up : down)[r] += share;
  }
  return { low, step, up, down };
}

const fixedRangeVolumeProfile = tool(
  "fixedRangeVolumeProfile",
  2,
  ({ chart, coordinates, overlay, yAxis }) => {
    if (coordinates.length < 2 || !yAxis) return [];
    const [t1, t2] = [overlay.points[0]?.timestamp, overlay.points[1]?.timestamp];
    if (!t1 || !t2) return [];
    const o = ext(overlay, {
      rows: 24,
      valueArea: 70,
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
    } as VolumeProfileOptions);
    const list = chart.getDataList();
    const from = Math.max(0, indexAt(list, Math.min(t1, t2)));
    const to = indexAt(list, Math.max(t1, t2));
    if (to < from) return [];
    const { low, step, up, down } = profile(list, from, to, o.rows);
    const totals = up.map((u, i) => u + down[i]);
    const max = Math.max(...totals);
    if (!max) return [];
    const poc = totals.indexOf(max);
    // Value area: grow outward from the POC until it holds valueArea% of the volume.
    const all = totals.reduce((s, v) => s + v, 0);
    let lo = poc;
    let hi = poc;
    let inside = totals[poc];
    while (inside < (all * o.valueArea) / 100 && (lo > 0 || hi < totals.length - 1)) {
      const below = lo > 0 ? totals[lo - 1] : -1;
      const above = hi < totals.length - 1 ? totals[hi + 1] : -1;
      if (above >= below) inside += totals[++hi];
      else inside += totals[--lo];
    }
    const left = Math.min(coordinates[0].x, coordinates[1].x);
    const right = Math.max(coordinates[0].x, coordinates[1].x);
    const width = (right - left) * 0.35;
    const out: OverlayFigure[] = [];
    totals.forEach((_, r) => {
      const yTop = yAxis.convertToPixel(low + step * (r + 1));
      const yBottom = yAxis.convertToPixel(low + step * r);
      const gap = Math.abs(yBottom - yTop) > 3 ? 1 : 0;
      const inVa = r >= lo && r <= hi;
      const wUp = (up[r] / max) * width;
      const wDown = (down[r] / max) * width;
      const a = inVa ? 0.55 : 0.25;
      if (wUp > 0)
        out.push(
          rect({ x: left, y: yTop + gap }, { x: left + wUp, y: yBottom - gap }, alpha(o.upColor, a), true),
        );
      if (wDown > 0)
        out.push(
          rect(
            { x: left + wUp, y: yTop + gap },
            { x: left + wUp + wDown, y: yBottom - gap },
            alpha(o.downColor, a),
            true,
          ),
        );
    });
    const pocY = yAxis.convertToPixel(low + step * (poc + 0.5));
    out.push(
      line(
        [
          { x: left, y: pocY },
          { x: right, y: pocY },
        ],
        { color: "#ff9800", size: 1 },
      ),
    );
    out.push(
      rect(
        { x: left, y: yAxis.convertToPixel(low + step * (hi + 1)) },
        { x: right, y: yAxis.convertToPixel(low + step * lo) },
        alpha("#2962ff", 0.05),
      ),
    );
    out.push(
      label(right + 4, pocY, `POC ${fmtPrice(chart, low + step * (poc + 0.5))}`, {
        color: "#ff9800",
        baseline: "middle",
        size: 10,
      }),
    );
    return out;
  },
  { needDefaultYAxisFigure: false },
);

export const MEASURE_TOOLS: OverlayTemplate[] = [
  position("longPosition", "long"),
  position("shortPosition", "short"),
  positionPlacer,
  range("priceRange", "price"),
  range("dateRange", "date"),
  range("datePriceRange", "both"),
  range("measure", "both", true),
  anchoredVwap,
  fixedRangeVolumeProfile,
];
