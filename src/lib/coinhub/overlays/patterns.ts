import type { Coordinate, OverlayFigure, OverlayTemplate } from "klinecharts";
import { tool, type FigureParams } from "./factory";
import { alpha, dashed, extendLine, label, line, look, mid, polygon } from "./utils";

// Harmonic and chart patterns, Elliott waves and cycles.

// Above local highs, below local lows (in pixels, smaller y is higher).
function pointLabels(coordinates: Coordinate[], names: string[], color: string): OverlayFigure[] {
  return coordinates.flatMap((c, i) => {
    const name = names[i];
    if (!name) return [];
    const neighbours = [coordinates[i - 1], coordinates[i + 1]].filter(Boolean);
    const isHigh = neighbours.length === 0 || c.y <= Math.min(...neighbours.map((n) => n.y));
    return [
      label(c.x, c.y + (isHigh ? -6 : 6), name, {
        color: "#fff",
        background: color,
        align: "center",
        baseline: isHigh ? "bottom" : "top",
        padding: 3,
        size: 11,
        bold: true,
      }),
    ];
  });
}

type Ratio = { from: [number, number]; leg: [number, number]; base: [number, number] };

function ratioLines(params: FigureParams, ratios: Ratio[]): OverlayFigure[] {
  const { coordinates, overlay } = params;
  const l = look(overlay);
  const v = overlay.points.map((p) => p.value);
  return ratios.flatMap(({ from: [a, b], leg, base }) => {
    if (!coordinates[a] || !coordinates[b]) return [];
    const lv = (i: number) => v[i];
    const legSize = Math.abs((lv(leg[1]) ?? 0) - (lv(leg[0]) ?? 0));
    const baseSize = Math.abs((lv(base[1]) ?? 0) - (lv(base[0]) ?? 0));
    const out: OverlayFigure[] = [line([coordinates[a], coordinates[b]], dashed(l), true)];
    if (baseSize > 0 && coordinates[Math.max(...leg)]) {
      const m = mid(coordinates[a], coordinates[b]);
      out.push(
        label(m.x, m.y, (legSize / baseSize).toFixed(3), {
          color: l.color,
          align: "center",
          baseline: "middle",
          size: 11,
        }),
      );
    }
    return out;
  });
}

function harmonic(name: string, names: string[], ratios: Ratio[]): OverlayTemplate {
  return tool(name, names.length, (params) => {
    const { coordinates, overlay } = params;
    const l = look(overlay);
    const out: OverlayFigure[] = [];
    // Two filled triangles: X-A-B and B-C-D.
    if (coordinates.length >= 3) out.push(polygon(coordinates.slice(0, 3), alpha(l.color, 0.15)));
    if (coordinates.length >= 5) out.push(polygon(coordinates.slice(2, 5), alpha(l.color, 0.15)));
    out.push(line(coordinates));
    out.push(...ratioLines(params, ratios));
    out.push(...pointLabels(coordinates, names, l.color));
    return out;
  });
}

const xabcd = harmonic(
  "xabcd",
  ["X", "A", "B", "C", "D"],
  [
    { from: [0, 2], leg: [1, 2], base: [0, 1] },
    { from: [1, 3], leg: [2, 3], base: [1, 2] },
    { from: [2, 4], leg: [3, 4], base: [2, 3] },
    { from: [0, 4], leg: [1, 4], base: [0, 1] },
  ],
);

const cypher = harmonic(
  "cypher",
  ["X", "A", "B", "C", "D"],
  [
    { from: [0, 2], leg: [1, 2], base: [0, 1] },
    { from: [1, 3], leg: [0, 3], base: [0, 1] },
    { from: [0, 4], leg: [3, 4], base: [0, 3] },
  ],
);

const abcd = tool("abcd", 4, (params) => {
  const { coordinates, overlay } = params;
  const l = look(overlay);
  return [
    line(coordinates),
    ...ratioLines(params, [
      { from: [0, 2], leg: [1, 2], base: [0, 1] },
      { from: [1, 3], leg: [2, 3], base: [1, 2] },
    ]),
    ...pointLabels(coordinates, ["A", "B", "C", "D"], l.color),
  ];
});

const trianglePattern = tool("trianglePattern", 4, ({ coordinates, overlay }) => {
  const l = look(overlay);
  const out: OverlayFigure[] = [];
  if (coordinates.length >= 4) out.push(polygon(coordinates, alpha(l.color, 0.12)));
  out.push(line(coordinates));
  if (coordinates.length >= 3) out.push(line([coordinates[0], coordinates[2]], dashed(l), true));
  if (coordinates.length >= 4) out.push(line([coordinates[1], coordinates[3]], dashed(l), true));
  out.push(...pointLabels(coordinates, ["A", "B", "C", "D"], l.color));
  return out;
});

const threeDrives = tool("threeDrives", 7, ({ coordinates, overlay }) => {
  const l = look(overlay);
  return [line(coordinates), ...pointLabels(coordinates, ["", "1", "A", "2", "B", "3", ""], l.color)];
});

const headShoulders = tool("headShoulders", 7, ({ coordinates, bounding, overlay }) => {
  const l = look(overlay);
  const out: OverlayFigure[] = [];
  if (coordinates.length >= 5) {
    const [n1, n2] = [coordinates[2], coordinates[4]];
    const [a, b] = extendLine(n1, n2, bounding, false, false);
    const neck = [
      { x: Math.min(coordinates[0].x, a.x), y: a.y },
      { x: Math.max(coordinates[coordinates.length - 1].x, b.x), y: b.y },
    ];
    const k = (n2.y - n1.y) / (n2.x - n1.x || 1);
    const yOn = (x: number) => n1.y + k * (x - n1.x);
    out.push(
      polygon([{ x: coordinates[0].x, y: yOn(coordinates[0].x) }, coordinates[1], n1], alpha(l.color, 0.15)),
    );
    out.push(polygon([n1, coordinates[3], n2], alpha(l.color, 0.15)));
    if (coordinates.length >= 7) {
      out.push(
        polygon(
          [n2, coordinates[5], { x: coordinates[6].x, y: yOn(coordinates[6].x) }],
          alpha(l.color, 0.15),
        ),
      );
    }
    out.push(
      line(extendLine(neck[0], neck[1], bounding, false, false), {
        color: l.color,
        style: "dashed",
        dashedValue: [6, 4],
      }),
    );
  }
  out.push(line(coordinates));
  out.push(...pointLabels(coordinates, ["", "Left Shoulder", "", "Head", "", "Right Shoulder", ""], l.color));
  return out;
});

function wave(name: string, names: string[]): OverlayTemplate {
  return tool(name, names.length, ({ coordinates, overlay }) => {
    const l = look(overlay);
    return [line(coordinates), ...pointLabels(coordinates, names, l.color)];
  });
}

// ---------------------------------------------------------------------------------------------
// Cycles

const cyclicLines = tool(
  "cyclicLines",
  2,
  ({ coordinates, bounding }) => {
    if (coordinates.length < 2) return [];
    const step = coordinates[1].x - coordinates[0].x;
    if (Math.abs(step) < 2) return [];
    const list: Coordinate[][] = [];
    for (
      let x = coordinates[0].x, i = 0;
      i < 400 && x >= -step && x <= bounding.width + Math.abs(step);
      x += step, i++
    ) {
      list.push([
        { x, y: 0 },
        { x, y: bounding.height },
      ]);
    }
    return [{ type: "line", attrs: list.map((c) => ({ coordinates: c })) }];
  },
  { needDefaultYAxisFigure: false },
);

const timeCycles = tool(
  "timeCycles",
  2,
  ({ coordinates, bounding, overlay }) => {
    if (coordinates.length < 2) return [];
    const l = look(overlay);
    const d = coordinates[1].x - coordinates[0].x;
    if (Math.abs(d) < 2) return [];
    const r = Math.abs(d) / 2;
    const y = coordinates[0].y;
    const out: OverlayFigure[] = [];
    for (
      let x = coordinates[0].x, i = 0;
      i < 200 && x <= bounding.width + r && x >= -Math.abs(d);
      x += d, i++
    ) {
      out.push({
        type: "arc",
        attrs: { x: x + d / 2, y, r, startAngle: Math.PI, endAngle: 2 * Math.PI },
        styles: { color: l.color, size: l.width },
      });
    }
    return out;
  },
  { needDefaultYAxisFigure: false },
);

const sineLine = tool("sineLine", 2, ({ coordinates, bounding }) => {
  if (coordinates.length < 2) return [];
  const [p1, p2] = coordinates;
  const half = p2.x - p1.x;
  if (Math.abs(half) < 2) return [line([p1, p2])];
  const center = (p1.y + p2.y) / 2;
  const amp = (p1.y - p2.y) / 2;
  const pts: Coordinate[] = [];
  for (let x = 0; x <= bounding.width; x += 2) {
    pts.push({ x, y: center + amp * Math.cos((Math.PI * (x - p1.x)) / half) });
  }
  return [line(pts)];
});

export const PATTERN_TOOLS: OverlayTemplate[] = [
  xabcd,
  cypher,
  headShoulders,
  abcd,
  trianglePattern,
  threeDrives,
  wave("elliottImpulse", ["(0)", "(1)", "(2)", "(3)", "(4)", "(5)"]),
  wave("elliottCorrection", ["(0)", "(A)", "(B)", "(C)"]),
  wave("elliottTriangle", ["(0)", "(A)", "(B)", "(C)", "(D)", "(E)"]),
  wave("elliottDoubleCombo", ["(0)", "(W)", "(X)", "(Y)"]),
  wave("elliottTripleCombo", ["(0)", "(W)", "(X)", "(Y)", "(X)", "(Z)"]),
  cyclicLines,
  timeCycles,
  sineLine,
];
