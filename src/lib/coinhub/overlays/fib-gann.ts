import type { Coordinate, OverlayFigure, OverlayTemplate } from "klinecharts";
import { tool } from "./factory";
import {
  alpha,
  dashed,
  ext,
  fmtPrice,
  label,
  lerp,
  line,
  lines,
  look,
  makeLevels,
  polygon,
  rayTo,
  type Level,
} from "./utils";

// Fibonacci and Gann tools. Price levels are converted through the y axis, so they stay correct on
// log and percentage scales.

export type FibOptions = {
  levels: Level[];
  extendLeft: boolean;
  extendRight: boolean;
  reverse: boolean;
  showPrices: boolean;
  showLevels: boolean;
  fill: boolean;
};

export const FIB_RETRACEMENT_LEVELS = makeLevels(
  [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236],
  [-0.618, -0.272, 0.705, 1.272, 1.414, 2, 3],
);
export const FIB_EXTENSION_LEVELS = makeLevels(
  [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236],
  [1.272, 1.414, 2, 3],
);
export const FIB_CHANNEL_LEVELS = makeLevels(
  [0, 0.382, 0.618, 1, 1.618],
  [0.236, 0.5, 0.786, 2.618, 3.618, 4.236],
);
export const FIB_TIME_LEVELS = makeLevels(
  [0, 0.382, 0.5, 0.618, 1, 1.382, 1.618, 2, 2.618, 3, 4.236],
  [0.236, 0.786, 3.618],
);
export const FIB_CIRCLE_LEVELS = makeLevels(
  [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618],
  [3.618, 4.236],
);
export const FIB_FAN_LEVELS = makeLevels([0, 0.25, 0.382, 0.5, 0.618, 0.75, 1]);
export const GANN_LEVELS = makeLevels([0, 0.25, 0.382, 0.5, 0.618, 0.75, 1]);
const ARC_LEVELS = makeLevels([0.236, 0.382, 0.5, 0.618, 0.786, 1]);
const PITCHFAN_LEVELS = makeLevels([0, 0.25, 0.382, 0.5, 0.618, 0.75, 1]);

// Starting levels per tool, for the settings dialog when a drawing has no custom levels yet.
export const DEFAULT_LEVELS: Record<string, Level[]> = {
  fibRetracement: FIB_RETRACEMENT_LEVELS,
  fibExtension: FIB_EXTENSION_LEVELS,
  fibChannel: FIB_CHANNEL_LEVELS,
  fibTrendTime: FIB_TIME_LEVELS,
  fibSpeedFan: FIB_FAN_LEVELS,
  fibCircles: FIB_CIRCLE_LEVELS,
  fibArcs: ARC_LEVELS,
  fibWedge: ARC_LEVELS,
  pitchfan: PITCHFAN_LEVELS,
  gannBox: GANN_LEVELS,
};

const FIB_DEFAULTS = (levels: Level[]): FibOptions => ({
  levels,
  extendLeft: false,
  extendRight: false,
  reverse: false,
  showPrices: true,
  showLevels: true,
  fill: true,
});

const visible = (levels: Level[]) => levels.filter((l) => l.visible).sort((a, b) => a.value - b.value);

function levelText(o: FibOptions, level: number, price: string) {
  const parts = [];
  if (o.showLevels) parts.push(String(level));
  if (o.showPrices) parts.push(o.showLevels ? `(${price})` : price);
  return parts.join(" ");
}

// Horizontal fib levels between x1 and x2, with fills between neighbours.
function priceLevels(
  params: Parameters<Parameters<typeof tool>[2]>[0],
  priceAt: (level: number) => number,
  xFrom: number,
  xTo: number,
  o: FibOptions,
): OverlayFigure[] {
  const { chart, bounding, yAxis } = params;
  if (!yAxis) return [];
  const left = o.extendLeft ? 0 : Math.min(xFrom, xTo);
  const right = o.extendRight ? bounding.width : Math.max(xFrom, xTo);
  const rows = visible(o.levels).map((lv) => {
    const price = priceAt(lv.value);
    return { ...lv, price, y: yAxis.convertToPixel(price) };
  });
  const out: OverlayFigure[] = [];
  if (o.fill) {
    for (let i = 1; i < rows.length; i++) {
      const [a, b] = [rows[i - 1], rows[i]];
      out.push(
        polygon(
          [
            { x: left, y: a.y },
            { x: right, y: a.y },
            { x: right, y: b.y },
            { x: left, y: b.y },
          ],
          alpha(b.color, 0.1),
          true,
        ),
      );
    }
  }
  for (const r of rows) {
    out.push(
      line(
        [
          { x: left, y: r.y },
          { x: right, y: r.y },
        ],
        { color: r.color },
      ),
    );
    const text = levelText(o, r.value, fmtPrice(chart, r.price));
    if (text)
      out.push(
        label(left + 4, r.y - 2, text, { color: r.color, align: "left", baseline: "bottom", size: 11 }),
      );
  }
  return out;
}

const fibRetracement = tool("fibRetracement", 2, (params) => {
  const { coordinates, overlay } = params;
  if (coordinates.length < 2) return [];
  const o = ext(overlay, FIB_DEFAULTS(FIB_RETRACEMENT_LEVELS));
  const [v1, v2] = [overlay.points[0]?.value, overlay.points[1]?.value];
  if (v1 === undefined || v2 === undefined) return [];
  const [from, to] = o.reverse ? [v2, v1] : [v1, v2];
  const l = look(overlay);
  return [
    line([coordinates[0], coordinates[1]], dashed(l, { color: alpha("#787b86", 0.8) }), true),
    ...priceLevels(params, (level) => to + (from - to) * level, coordinates[0].x, coordinates[1].x, o),
  ];
});

const fibExtension = tool("fibExtension", 3, (params) => {
  const { coordinates, overlay } = params;
  if (coordinates.length < 2) return [];
  const l = look(overlay);
  const guide = line(coordinates.slice(0, 3), dashed(l, { color: alpha("#787b86", 0.8) }), true);
  if (coordinates.length < 3) return [guide];
  const o = ext(overlay, FIB_DEFAULTS(FIB_EXTENSION_LEVELS));
  const [v1, v2, v3] = overlay.points.map((p) => p.value);
  if (v1 === undefined || v2 === undefined || v3 === undefined) return [guide];
  const x3 = coordinates[2].x;
  const width = Math.max(60, Math.abs(coordinates[1].x - coordinates[0].x));
  const move = o.reverse ? v1 - v2 : v2 - v1;
  return [guide, ...priceLevels(params, (level) => v3 + move * level, x3, x3 + width, o)];
});

const fibChannel = tool("fibChannel", 3, ({ coordinates, bounding, overlay }) => {
  if (coordinates.length < 2) return [];
  const [p1, p2] = coordinates;
  if (coordinates.length < 3) return [line([p1, p2])];
  const o = ext(overlay, { ...FIB_DEFAULTS(FIB_CHANNEL_LEVELS), extendRight: true });
  const k = p1.x === p2.x ? 0 : (p2.y - p1.y) / (p2.x - p1.x);
  const dy = coordinates[2].y - (p1.y + k * (coordinates[2].x - p1.x));
  const left = o.extendLeft ? 0 : p1.x;
  const right = o.extendRight ? bounding.width : p2.x;
  const yAt = (x: number, level: number) => p1.y + k * (x - p1.x) + dy * level;
  const rows = visible(o.levels);
  const out: OverlayFigure[] = [];
  rows.forEach((lv, i) => {
    const a = { x: left, y: yAt(left, lv.value) };
    const b = { x: right, y: yAt(right, lv.value) };
    if (o.fill && i > 0) {
      const prev = rows[i - 1].value;
      out.push(
        polygon(
          [{ x: left, y: yAt(left, prev) }, { x: right, y: yAt(right, prev) }, b, a],
          alpha(lv.color, 0.1),
          true,
        ),
      );
    }
    out.push(line([a, b], { color: lv.color }));
    if (o.showLevels)
      out.push(
        label(a.x + 4, a.y - 2, String(lv.value), {
          color: lv.color,
          align: "left",
          baseline: "bottom",
          size: 11,
        }),
      );
  });
  return out;
});

// Vertical lines at x1 + (x2 - x1) × n.
function timeLines(
  base: number,
  unit: number,
  marks: Array<{ value: number; color: string }>,
  height: number,
  showLabels: boolean,
): OverlayFigure[] {
  const out: OverlayFigure[] = [];
  for (const m of marks) {
    const x = base + unit * m.value;
    out.push(
      line(
        [
          { x, y: 0 },
          { x, y: height },
        ],
        { color: m.color },
      ),
    );
    if (showLabels) out.push(label(x + 3, height - 4, String(m.value), { color: m.color, size: 11 }));
  }
  return out;
}

const FIB_SEQUENCE = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

const fibTimeZone = tool(
  "fibTimeZone",
  2,
  ({ coordinates, bounding, overlay }) => {
    if (coordinates.length < 2) return [];
    const l = look(overlay);
    const unit = coordinates[1].x - coordinates[0].x;
    if (Math.abs(unit) < 1) return [];
    const marks = FIB_SEQUENCE.map((value, i) => ({ value, color: i < 2 ? l.color : alpha(l.color, 0.9) }));
    return [
      line([coordinates[0], coordinates[1]], dashed(l), true),
      ...timeLines(coordinates[0].x, unit, marks, bounding.height, true),
    ];
  },
  { needDefaultYAxisFigure: false },
);

const fibTrendTime = tool(
  "fibTrendTime",
  3,
  ({ coordinates, bounding, overlay }) => {
    if (coordinates.length < 2) return [];
    const l = look(overlay);
    const guide = line(coordinates.slice(0, 3), dashed(l), true);
    if (coordinates.length < 3) return [guide];
    const o = ext(overlay, FIB_DEFAULTS(FIB_TIME_LEVELS));
    const unit = coordinates[1].x - coordinates[0].x;
    return [guide, ...timeLines(coordinates[2].x, unit, visible(o.levels), bounding.height, o.showLevels)];
  },
  { needDefaultYAxisFigure: false },
);

const fibSpeedFan = tool("fibSpeedFan", 2, ({ coordinates, bounding, overlay }) => {
  if (coordinates.length < 2) return [];
  const o = ext(overlay, FIB_DEFAULTS(FIB_FAN_LEVELS));
  const [p1, p2] = coordinates;
  const rows = visible(o.levels);
  const out: OverlayFigure[] = [];
  const grid: Coordinate[][] = [];
  for (const lv of rows) {
    const y = p1.y + (p2.y - p1.y) * lv.value;
    const x = p1.x + (p2.x - p1.x) * lv.value;
    grid.push(
      [
        { x: p1.x, y },
        { x: p2.x, y },
      ],
      [
        { x, y: p1.y },
        { x, y: p2.y },
      ],
    );
    if (lv.value === 0) continue;
    out.push(line([p1, rayTo(p1, { x: p2.x, y }, bounding)], { color: lv.color }));
    out.push(line([p1, rayTo(p1, { x, y: p2.y }, bounding)], { color: lv.color }));
    if (o.showLevels) {
      out.push(
        label(p2.x + 4, y, String(+(1 - lv.value).toFixed(3)), {
          color: lv.color,
          baseline: "middle",
          size: 10,
        }),
      );
      out.push(
        label(x, p2.y + (p2.y > p1.y ? 4 : -4), String(+(1 - lv.value).toFixed(3)), {
          color: lv.color,
          align: "center",
          baseline: p2.y > p1.y ? "top" : "bottom",
          size: 10,
        }),
      );
    }
  }
  out.unshift(lines(grid, { color: alpha("#787b86", 0.35), size: 1 }, true));
  return out;
});

const fibCircles = tool("fibCircles", 2, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const o = ext(overlay, FIB_DEFAULTS(FIB_CIRCLE_LEVELS));
  const [p1, p2] = coordinates;
  const c = lerp(p1, p2, 0.5);
  const r = Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2;
  const l = look(overlay);
  return [
    line([p1, p2], dashed(l), true),
    ...visible(o.levels).map((lv): OverlayFigure => ({
      type: "circle",
      attrs: { x: c.x, y: c.y, r: r * lv.value },
      styles: { style: "stroke", borderColor: lv.color, borderSize: 1, color: "transparent" },
    })),
  ];
});

const PHI = (1 + Math.sqrt(5)) / 2;

const fibSpiral = tool("fibSpiral", 2, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const [c, p] = coordinates;
  const { counterClockwise } = ext(overlay, { counterClockwise: false });
  const r0 = Math.hypot(p.x - c.x, p.y - c.y);
  if (r0 < 1) return [];
  const a0 = Math.atan2(p.y - c.y, p.x - c.x);
  const dir = counterClockwise ? -1 : 1;
  const pts: Coordinate[] = [];
  // r grows by φ every quarter turn; from deep inside to a few turns out.
  for (let theta = -6 * Math.PI; theta <= 3 * Math.PI; theta += Math.PI / 48) {
    const r = r0 * PHI ** ((2 * theta) / Math.PI);
    if (r > 20000) break;
    pts.push({ x: c.x + r * Math.cos(a0 + dir * theta), y: c.y + r * Math.sin(a0 + dir * theta) });
  }
  return [line([c, p], dashed(look(overlay)), true), line(pts)];
});

function arcs(
  center: Coordinate,
  radius: number,
  start: number,
  end: number,
  levels: Level[],
): OverlayFigure[] {
  return levels.map((lv) => ({
    type: "arc",
    attrs: { x: center.x, y: center.y, r: radius * lv.value, startAngle: start, endAngle: end },
    styles: { color: lv.color, size: 1 },
  }));
}

const fibArcs = tool("fibArcs", 2, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const o = ext(overlay, FIB_DEFAULTS(ARC_LEVELS));
  const [p1, p2] = coordinates;
  const r = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  // Half circles around p2, opening towards p1.
  const towards = Math.atan2(p1.y - p2.y, p1.x - p2.x);
  return [
    line([p1, p2], dashed(look(overlay)), true),
    ...arcs(p2, r, towards - Math.PI / 2, towards + Math.PI / 2, visible(o.levels)),
  ];
});

const fibWedge = tool("fibWedge", 3, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const [c, p2] = coordinates;
  if (coordinates.length < 3) return [line([c, p2])];
  const p3 = coordinates[2];
  const o = ext(overlay, FIB_DEFAULTS(ARC_LEVELS));
  const r = Math.hypot(p2.x - c.x, p2.y - c.y);
  let a1 = Math.atan2(p2.y - c.y, p2.x - c.x);
  let a2 = Math.atan2(p3.y - c.y, p3.x - c.x);
  if (a2 < a1) [a1, a2] = [a2, a1];
  if (a2 - a1 > Math.PI) [a1, a2] = [a2, a1 + 2 * Math.PI];
  const far = (a: number) => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  return [line([c, far(a1)]), line([c, far(a2)]), ...arcs(c, r, a1, a2, visible(o.levels))];
});

const pitchfan = tool("pitchfan", 3, ({ coordinates, bounding, overlay }) => {
  if (coordinates.length < 2) return [];
  const [p1, p2] = coordinates;
  if (coordinates.length < 3) return [line([p1, p2])];
  const p3 = coordinates[2];
  const o = ext(overlay, FIB_DEFAULTS(PITCHFAN_LEVELS));
  const l = look(overlay);
  return [
    line([p2, p3], dashed(l), true),
    ...visible(o.levels).map((lv) =>
      line([p1, rayTo(p1, lerp(p2, p3, lv.value), bounding)], { color: lv.color }),
    ),
  ];
});

// ---------------------------------------------------------------------------------------------
// Gann

const gannBox = tool("gannBox", 2, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const o = ext(overlay, { levels: GANN_LEVELS, showLevels: true, fill: true });
  const [p1, p2] = coordinates;
  const rows = visible(o.levels);
  const out: OverlayFigure[] = [];
  if (o.fill) {
    for (let i = 1; i < rows.length; i++) {
      const y1 = p1.y + (p2.y - p1.y) * rows[i - 1].value;
      const y2 = p1.y + (p2.y - p1.y) * rows[i].value;
      out.push(
        polygon(
          [
            { x: p1.x, y: y1 },
            { x: p2.x, y: y1 },
            { x: p2.x, y: y2 },
            { x: p1.x, y: y2 },
          ],
          alpha(rows[i].color, 0.08),
          true,
        ),
      );
    }
  }
  for (const lv of rows) {
    const y = p1.y + (p2.y - p1.y) * lv.value;
    const x = p1.x + (p2.x - p1.x) * lv.value;
    out.push(
      line(
        [
          { x: p1.x, y },
          { x: p2.x, y },
        ],
        { color: lv.color },
      ),
    );
    out.push(
      line(
        [
          { x, y: p1.y },
          { x, y: p2.y },
        ],
        { color: lv.color },
      ),
    );
    if (o.showLevels) {
      out.push(
        label(Math.min(p1.x, p2.x) - 4, y, String(lv.value), {
          color: lv.color,
          align: "right",
          baseline: "middle",
          size: 10,
        }),
      );
      out.push(
        label(x, Math.min(p1.y, p2.y) - 3, String(lv.value), {
          color: lv.color,
          align: "center",
          baseline: "bottom",
          size: 10,
        }),
      );
    }
  }
  return out;
});

const gannSquare = tool("gannSquare", 2, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const l = look(overlay);
  const [p1, p2] = coordinates;
  const grid: Coordinate[][] = [];
  for (const t of [0.25, 0.5, 0.75]) {
    grid.push([
      { x: p1.x + (p2.x - p1.x) * t, y: p1.y },
      { x: p1.x + (p2.x - p1.x) * t, y: p2.y },
    ]);
    grid.push([
      { x: p1.x, y: p1.y + (p2.y - p1.y) * t },
      { x: p2.x, y: p1.y + (p2.y - p1.y) * t },
    ]);
  }
  const fan: Coordinate[][] = [];
  for (const t of [0.25, 0.5, 0.75]) {
    fan.push([p1, { x: p2.x, y: p1.y + (p2.y - p1.y) * t }], [p1, { x: p1.x + (p2.x - p1.x) * t, y: p2.y }]);
  }
  return [
    polygon([p1, { x: p2.x, y: p1.y }, p2, { x: p1.x, y: p2.y }], l.fill),
    lines([[p1, { x: p2.x, y: p1.y }, p2, { x: p1.x, y: p2.y }, p1]]),
    lines(grid, { color: alpha(l.color, 0.4) }, true),
    lines(
      [
        [p1, p2],
        [
          { x: p2.x, y: p1.y },
          { x: p1.x, y: p2.y },
        ],
      ],
      { color: "#ff9800" },
      true,
    ),
    lines(fan, { color: alpha("#089981", 0.8) }, true),
  ];
});

const GANN_RATIOS: Array<[number, number, string]> = [
  [1, 8, "1/8"],
  [1, 4, "1/4"],
  [1, 3, "1/3"],
  [1, 2, "1/2"],
  [1, 1, "1/1"],
  [2, 1, "2/1"],
  [3, 1, "3/1"],
  [4, 1, "4/1"],
  [8, 1, "8/1"],
];
const GANN_COLORS = [
  "#9c27b0",
  "#2962ff",
  "#00bcd4",
  "#089981",
  "#787b86",
  "#4caf50",
  "#ff9800",
  "#f23645",
  "#e91e63",
];

const gannFan = tool("gannFan", 2, ({ coordinates, bounding, overlay }) => {
  if (coordinates.length < 2) return [];
  const [p1, p2] = coordinates;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const { showLevels } = ext(overlay, { showLevels: true });
  const out: OverlayFigure[] = [];
  GANN_RATIOS.forEach(([t, p, name], i) => {
    // t time units for p price units: 1/1 passes through p2.
    const dir = p >= t ? { x: p1.x + (dx * t) / p, y: p1.y + dy } : { x: p1.x + dx, y: p1.y + (dy * p) / t };
    out.push(line([p1, rayTo(p1, dir, bounding)], { color: GANN_COLORS[i] }));
    if (showLevels)
      out.push(label(dir.x + 3, dir.y, name, { color: GANN_COLORS[i], baseline: "middle", size: 10 }));
  });
  return out;
});

export const FIB_TOOLS: OverlayTemplate[] = [
  fibRetracement,
  fibExtension,
  fibChannel,
  fibTimeZone,
  fibSpeedFan,
  fibTrendTime,
  fibCircles,
  fibSpiral,
  fibArcs,
  fibWedge,
  pitchfan,
  gannBox,
  gannSquare,
  gannFan,
];
