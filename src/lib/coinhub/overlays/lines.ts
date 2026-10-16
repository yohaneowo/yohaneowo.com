import type { Coordinate, OverlayFigure, OverlayTemplate } from "klinecharts";
import { fmtTime, tool, type FigureParams } from "./factory";
import {
  alpha,
  arrowHead,
  barCount,
  dashed,
  ext,
  extendLine,
  fmtDuration,
  fmtPercent,
  fmtPrice,
  indexAt,
  label,
  line,
  lines,
  look,
  mid,
  polygon,
  rayTo,
  textBlock,
} from "./utils";

// Trend lines, horizontal / vertical lines, channels and pitchforks.

export type LineOptions = {
  extendLeft: boolean;
  extendRight: boolean;
  text: string;
  showStats: boolean;
  arrowStart: boolean;
  arrowEnd: boolean;
  showPrice: boolean;
};

const LINE_DEFAULTS: LineOptions = {
  extendLeft: false,
  extendRight: false,
  text: "",
  showStats: false,
  arrowStart: false,
  arrowEnd: false,
  showPrice: true,
};

function stats({ chart, overlay, coordinates }: FigureParams, a: Coordinate, b: Coordinate) {
  const [p1, p2] = overlay.points;
  if (p1?.value === undefined || p2?.value === undefined) return [];
  const diff = p2.value - p1.value;
  const pct = p1.value ? (diff / Math.abs(p1.value)) * 100 : 0;
  const bars = barCount(chart, coordinates[0].x, coordinates[1].x);
  const time = p1.timestamp && p2.timestamp ? fmtDuration(p2.timestamp - p1.timestamp) : "";
  const angle = (Math.atan2(a.y - b.y, b.x - a.x) * 180) / Math.PI;
  const l = look(overlay);
  return textBlock(
    b.x + 8,
    b.y,
    `${fmtPrice(chart, diff)} (${fmtPercent(pct)})\n${bars} bars, ${time}\n∠ ${angle.toFixed(1)}°`,
    { color: "#fff", background: alpha(l.color, 0.85), baseline: "middle", padding: 4, size: 11 },
  );
}

function lineText(params: FigureParams, a: Coordinate, b: Coordinate, text: string): OverlayFigure[] {
  if (!text) return [];
  const l = look(params.overlay);
  const m = mid(a, b);
  return textBlock(m.x, m.y - 6, text, {
    color: l.textColor,
    size: l.fontSize,
    align: "center",
    baseline: "bottom",
    bold: l.bold,
  });
}

function withArrows(a: Coordinate, b: Coordinate, o: LineOptions, color: string, width: number) {
  const size = 8 + width * 2;
  const out: OverlayFigure[] = [];
  if (o.arrowEnd) out.push(polygon(arrowHead(a, b, size), color, true));
  if (o.arrowStart) out.push(polygon(arrowHead(b, a, size), color, true));
  return out;
}

const trendLine = tool("trendLine", 2, (params) => {
  const { coordinates, bounding, overlay } = params;
  if (coordinates.length < 2) return [];
  const o = ext(overlay, LINE_DEFAULTS);
  const l = look(overlay);
  const [p, q] = coordinates;
  const [a, b] =
    o.extendLeft || o.extendRight ? extendLine(p, q, bounding, o.extendLeft, o.extendRight) : [p, q];
  return [
    line([a, b]),
    ...withArrows(p, q, o, l.color, l.width),
    ...lineText(params, p, q, o.text),
    ...(o.showStats ? stats(params, p, q) : []),
  ];
});

const ray = tool("ray", 2, (params) => {
  const { coordinates, bounding, overlay } = params;
  if (coordinates.length < 2) return [];
  const o = ext(overlay, LINE_DEFAULTS);
  const [p, q] = coordinates;
  return [
    line([p, rayTo(p, q, bounding)]),
    ...lineText(params, p, q, o.text),
    ...(o.showStats ? stats(params, p, q) : []),
  ];
});

const extendedLine = tool("extendedLine", 2, (params) => {
  const { coordinates, bounding, overlay } = params;
  if (coordinates.length < 2) return [];
  const o = ext(overlay, LINE_DEFAULTS);
  const [p, q] = coordinates;
  return [line(extendLine(p, q, bounding, true, true)), ...lineText(params, p, q, o.text)];
});

const infoLine = tool("infoLine", 2, (params) => {
  const { coordinates } = params;
  if (coordinates.length < 2) return [];
  const [p, q] = coordinates;
  return [line([p, q]), ...stats(params, p, q)];
});

const trendAngle = tool("trendAngle", 2, (params) => {
  const { coordinates, overlay } = params;
  if (coordinates.length < 2) return [];
  const [p, q] = coordinates;
  const l = look(overlay);
  const len = Math.max(30, Math.min(80, Math.hypot(q.x - p.x, q.y - p.y) / 2));
  const angle = Math.atan2(q.y - p.y, q.x - p.x);
  const deg = (-angle * 180) / Math.PI;
  return [
    line([p, q]),
    line([p, { x: p.x + len + 20, y: p.y }], dashed(l), true),
    {
      type: "arc",
      attrs: { x: p.x, y: p.y, r: len, startAngle: Math.min(0, angle), endAngle: Math.max(0, angle) },
      styles: { color: l.color, size: 1 },
      ignoreEvent: true,
    },
    label(p.x + len + 6, p.y + (angle < 0 ? -2 : 14), `${deg.toFixed(1)}°`, { color: l.textColor }),
  ];
});

function priceTag(params: FigureParams, y: number): OverlayFigure[] {
  const { chart, overlay } = params;
  const value = overlay.points[0]?.value;
  if (value === undefined) return [];
  const l = look(overlay);
  return [
    label(0, y, fmtPrice(chart, value), {
      color: "#fff",
      background: l.color,
      baseline: "middle",
      padding: 3,
      size: 11,
    }),
  ];
}

const horizontalLine = tool(
  "horizontalLine",
  1,
  (params) => {
    const { coordinates, bounding, overlay } = params;
    const o = ext(overlay, LINE_DEFAULTS);
    const l = look(overlay);
    const y = coordinates[0].y;
    return [
      line([
        { x: 0, y },
        { x: bounding.width, y },
      ]),
      ...(o.text
        ? [
            label(bounding.width - 8, y - 4, o.text, {
              color: l.textColor,
              size: l.fontSize,
              align: "right",
              bold: l.bold,
            }),
          ]
        : []),
    ];
  },
  {
    needDefaultYAxisFigure: false,
    createYAxisFigures: (params) =>
      ext(params.overlay, LINE_DEFAULTS).showPrice ? priceTag(params, params.coordinates[0].y) : [],
  },
);

const horizontalRay = tool(
  "horizontalRay",
  1,
  (params) => {
    const { coordinates, bounding, overlay } = params;
    const o = ext(overlay, LINE_DEFAULTS);
    const l = look(overlay);
    const { x, y } = coordinates[0];
    return [
      line([
        { x, y },
        { x: bounding.width, y },
      ]),
      ...(o.text
        ? [label(x + 4, y - 4, o.text, { color: l.textColor, size: l.fontSize, bold: l.bold })]
        : []),
    ];
  },
  {
    needDefaultYAxisFigure: false,
    createYAxisFigures: (params) =>
      ext(params.overlay, LINE_DEFAULTS).showPrice ? priceTag(params, params.coordinates[0].y) : [],
  },
);

function timeTag(params: FigureParams): OverlayFigure[] {
  const { chart, overlay, coordinates } = params;
  const t = overlay.points[0]?.timestamp;
  if (!t) return [];
  const l = look(overlay);
  return [
    label(coordinates[0].x, 2, fmtTime(chart, t), {
      color: "#fff",
      background: l.color,
      align: "center",
      baseline: "top",
      padding: 3,
      size: 11,
    }),
  ];
}

const verticalLine = tool(
  "verticalLine",
  1,
  ({ coordinates, bounding, overlay }) => {
    const o = ext(overlay, LINE_DEFAULTS);
    const l = look(overlay);
    const x = coordinates[0].x;
    return [
      line([
        { x, y: 0 },
        { x, y: bounding.height },
      ]),
      ...(o.text
        ? [label(x + 4, 16, o.text, { color: l.textColor, size: l.fontSize, baseline: "top", bold: l.bold })]
        : []),
    ];
  },
  { needDefaultXAxisFigure: false, createXAxisFigures: timeTag },
);

const crossLine = tool(
  "crossLine",
  1,
  ({ coordinates, bounding }) => {
    const { x, y } = coordinates[0];
    return [
      lines([
        [
          { x: 0, y },
          { x: bounding.width, y },
        ],
        [
          { x, y: 0 },
          { x, y: bounding.height },
        ],
      ]),
    ];
  },
  {
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createXAxisFigures: timeTag,
    createYAxisFigures: (params) => priceTag(params, params.coordinates[0].y),
  },
);

const arrowLine = tool("arrowLine", 2, (params) => {
  const { coordinates, overlay } = params;
  if (coordinates.length < 2) return [];
  const [p, q] = coordinates;
  const l = look(overlay);
  const o = ext(overlay, LINE_DEFAULTS);
  return [
    line([p, q]),
    polygon(arrowHead(p, q, 10 + l.width * 2), l.color, true),
    ...lineText(params, p, q, o.text),
  ];
});

// ---------------------------------------------------------------------------------------------
// Channels

type ChannelOptions = { extendLeft: boolean; extendRight: boolean; showMiddle: boolean; fill: boolean };
const CHANNEL_DEFAULTS: ChannelOptions = {
  extendLeft: false,
  extendRight: false,
  showMiddle: true,
  fill: true,
};

function offsetLine(a: Coordinate, b: Coordinate, through: Coordinate): [Coordinate, Coordinate] {
  // Same slope as a→b, passing through `through` (vertical offset).
  const k = a.x === b.x ? 0 : (b.y - a.y) / (b.x - a.x);
  const yAt = a.y + k * (through.x - a.x);
  const dy = through.y - yAt;
  return [
    { x: a.x, y: a.y + dy },
    { x: b.x, y: b.y + dy },
  ];
}

const parallelChannel = tool("parallelChannel", 3, ({ coordinates, bounding, overlay }) => {
  if (coordinates.length < 2) return [];
  const o = ext(overlay, CHANNEL_DEFAULTS);
  const l = look(overlay);
  const [p1, p2] = coordinates;
  const ex = (a: Coordinate, b: Coordinate) => extendLine(a, b, bounding, o.extendLeft, o.extendRight);
  const main = ex(p1, p2);
  if (coordinates.length < 3) return [line(main)];
  const [q1, q2] = offsetLine(p1, p2, coordinates[2]);
  const other = ex(q1, q2);
  const middle = ex(mid(p1, q1), mid(p2, q2));
  return [
    ...(o.fill ? [polygon([main[0], main[1], other[1], other[0]], l.fill)] : []),
    line(main),
    line(other),
    ...(o.showMiddle ? [line(middle, dashed(l), true)] : []),
  ];
});

const flatTopBottom = tool("flatTopBottom", 3, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const l = look(overlay);
  const [p1, p2] = coordinates;
  if (coordinates.length < 3) return [line([p1, p2])];
  const y = coordinates[2].y;
  const f1 = { x: p1.x, y };
  const f2 = { x: p2.x, y };
  return [polygon([p1, p2, f2, f1], l.fill), line([p1, p2]), line([f1, f2])];
});

const disjointChannel = tool("disjointChannel", 3, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const l = look(overlay);
  const [p1, p2] = coordinates;
  if (coordinates.length < 3) return [line([p1, p2])];
  const q1 = { x: p1.x, y: coordinates[2].y };
  const q2 = { x: p2.x, y: q1.y - (p2.y - p1.y) };
  return [polygon([p1, p2, q2, q1], l.fill), line([p1, p2]), line([q1, q2])];
});

const regressionTrend = tool(
  "regressionTrend",
  2,
  ({ chart, coordinates, overlay, yAxis }) => {
    if (coordinates.length < 2 || !yAxis) return [];
    const l = look(overlay);
    const { deviation, extendRight } = ext(overlay, { deviation: 2, extendRight: false });
    const [t1, t2] = [overlay.points[0]?.timestamp, overlay.points[1]?.timestamp];
    if (!t1 || !t2) return [];
    const list = chart.getDataList();
    let i1 = indexAt(list, Math.min(t1, t2));
    const i2 = indexAt(list, Math.max(t1, t2));
    i1 = Math.max(0, i1);
    const n = i2 - i1 + 1;
    if (n < 2) return [line([coordinates[0], coordinates[1]])];
    let sx = 0;
    let sy = 0;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < n; i++) {
      const y = list[i1 + i].close;
      sx += i;
      sy += y;
      sxy += i * y;
      sxx += i * i;
    }
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const intercept = (sy - slope * sx) / n;
    let variance = 0;
    for (let i = 0; i < n; i++) variance += (list[i1 + i].close - (intercept + slope * i)) ** 2;
    const sd = Math.sqrt(variance / n);
    const [xa, xb] =
      coordinates[0].x < coordinates[1].x
        ? [coordinates[0].x, coordinates[1].x]
        : [coordinates[1].x, coordinates[0].x];
    const span = n - 1;
    const xEnd = extendRight ? xa + ((xb - xa) / span) * span * 50 : xb;
    const endIndex = extendRight ? span * 50 : span;
    const at = (offset: number) => [
      { x: xa, y: yAxis.convertToPixel(intercept + offset) },
      { x: xEnd, y: yAxis.convertToPixel(intercept + slope * endIndex + offset) },
    ];
    const up = at(deviation * sd);
    const down = at(-deviation * sd);
    const base = at(0);
    return [
      polygon([up[0], up[1], base[1], base[0]], alpha(l.color, 0.1), true),
      polygon([base[0], base[1], down[1], down[0]], alpha("#f23645", 0.1), true),
      line(base),
      line(up, { color: l.color }),
      line(down, { color: l.color }),
    ];
  },
  { needDefaultYAxisFigure: false },
);

// ---------------------------------------------------------------------------------------------
// Pitchforks

type PitchKind = "andrews" | "schiff" | "modifiedSchiff";

function pitchfork(name: string, kind: PitchKind): OverlayTemplate {
  return tool(name, 3, ({ coordinates, bounding, overlay }) => {
    if (coordinates.length < 2) return [];
    const l = look(overlay);
    const [p1, p2] = coordinates;
    if (coordinates.length < 3) return [line([p1, p2])];
    const p3 = coordinates[2];
    const m = mid(p2, p3);
    const origin =
      kind === "andrews" ? p1 : kind === "schiff" ? { x: p1.x, y: (p1.y + p2.y) / 2 } : mid(p1, p2);
    const dir = { x: m.x - origin.x, y: m.y - origin.y };
    const from = (p: Coordinate) => rayTo(p, { x: p.x + dir.x, y: p.y + dir.y }, bounding);
    const half2 = mid(m, p2);
    const half3 = mid(m, p3);
    return [
      polygon([p2, from(p2), from(half2), half2], alpha(l.color, 0.08), true),
      polygon([half2, from(half2), from(m), m], alpha("#089981", 0.08), true),
      polygon([m, from(m), from(half3), half3], alpha("#089981", 0.08), true),
      polygon([half3, from(half3), from(p3), p3], alpha(l.color, 0.08), true),
      line([p1, p2], dashed(l)),
      line([origin, from(m)]),
      line([p2, from(p2)]),
      line([p3, from(p3)]),
      line([p2, p3]),
      lines(
        [
          [half2, from(half2)],
          [half3, from(half3)],
        ],
        dashed(l),
        true,
      ),
    ];
  });
}

export const LINE_TOOLS: OverlayTemplate[] = [
  trendLine,
  ray,
  infoLine,
  extendedLine,
  trendAngle,
  horizontalLine,
  horizontalRay,
  verticalLine,
  crossLine,
  arrowLine,
  parallelChannel,
  regressionTrend,
  flatTopBottom,
  disjointChannel,
  pitchfork("pitchfork", "andrews"),
  pitchfork("schiffPitchfork", "schiff"),
  pitchfork("modifiedSchiffPitchfork", "modifiedSchiff"),
];
