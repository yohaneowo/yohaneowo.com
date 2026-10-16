import type { Coordinate, OverlayFigure, OverlayTemplate } from "klinecharts";
import { tool } from "./factory";
import {
  alpha,
  DOWN_COLOR,
  ext,
  fmtPrice,
  label,
  line,
  look,
  mid,
  outlinedPolygon,
  polygon,
  textBlock,
  UP_COLOR,
} from "./utils";

// Freehand, geometric shapes and annotations.

function freehand(name: string, highlighter: boolean): OverlayTemplate {
  return {
    name,
    totalStep: 2,
    drawingMode: "continuous",
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates, overlay }) => {
      if (coordinates.length < 2) return [];
      const l = look(overlay);
      return [
        line(coordinates, {
          color: highlighter ? alpha(l.color, 0.35) : l.color,
          size: highlighter ? Math.max(10, l.width * 6) : l.width,
          style: "solid",
          lineCap: "round",
          lineJoin: "round",
        }),
      ];
    },
  };
}

type ShapeOptions = { text: string; fill: boolean };
const SHAPE_DEFAULTS: ShapeOptions = { text: "", fill: true };

function centerText(center: Coordinate, text: string, overlay: Parameters<typeof look>[0]): OverlayFigure[] {
  if (!text) return [];
  const l = look(overlay);
  return textBlock(center.x, center.y, text, {
    color: l.textColor,
    size: l.fontSize,
    align: "center",
    baseline: "middle",
    bold: l.bold,
  });
}

const rectangle = tool("rectangle", 2, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const o = ext(overlay, SHAPE_DEFAULTS);
  const [a, b] = coordinates;
  const corners = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
  return [outlinedPolygon(corners, look(overlay), o.fill), ...centerText(mid(a, b), o.text, overlay)];
});

const rotatedRectangle = tool("rotatedRectangle", 3, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const [a, b] = coordinates;
  if (coordinates.length < 3) return [line([a, b])];
  const c = coordinates[2];
  // Offset of c perpendicular to a→b.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const d = (c.x - a.x) * nx + (c.y - a.y) * ny;
  const o = ext(overlay, SHAPE_DEFAULTS);
  const corners = [a, b, { x: b.x + nx * d, y: b.y + ny * d }, { x: a.x + nx * d, y: a.y + ny * d }];
  return [
    outlinedPolygon(corners, look(overlay), o.fill),
    ...centerText(mid(a, corners[2]), o.text, overlay),
  ];
});

const parallelogram = tool("parallelogram", 3, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const [a, b] = coordinates;
  if (coordinates.length < 3) return [line([a, b])];
  const c = coordinates[2];
  const d = { x: a.x + (c.x - b.x), y: a.y + (c.y - b.y) };
  const o = ext(overlay, SHAPE_DEFAULTS);
  return [outlinedPolygon([a, b, c, d], look(overlay), o.fill), ...centerText(mid(a, c), o.text, overlay)];
});

const triangle = tool("triangle", 3, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  if (coordinates.length < 3) return [line(coordinates)];
  const o = ext(overlay, SHAPE_DEFAULTS);
  const [a, b, c] = coordinates;
  const centroid = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
  return [outlinedPolygon(coordinates, look(overlay), o.fill), ...centerText(centroid, o.text, overlay)];
});

const circle = tool("circle", 2, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const [c, p] = coordinates;
  const l = look(overlay);
  const o = ext(overlay, SHAPE_DEFAULTS);
  return [
    {
      type: "circle",
      attrs: { x: c.x, y: c.y, r: Math.hypot(p.x - c.x, p.y - c.y) },
      styles: {
        style: o.fill ? "stroke_fill" : "stroke",
        color: o.fill ? l.fill : "transparent",
        borderColor: l.color,
        borderSize: l.width,
        borderStyle: l.lineStyle,
        borderDashedValue: l.dash,
      },
    },
    ...centerText(c, o.text, overlay),
  ];
});

function ellipsePoints(a: Coordinate, b: Coordinate, steps = 72) {
  const c = mid(a, b);
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  return Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * Math.PI * 2;
    return { x: c.x + rx * Math.cos(t), y: c.y + ry * Math.sin(t) };
  });
}

const ellipse = tool("ellipse", 2, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const o = ext(overlay, SHAPE_DEFAULTS);
  const [a, b] = coordinates;
  return [
    outlinedPolygon(ellipsePoints(a, b), look(overlay), o.fill),
    ...centerText(mid(a, b), o.text, overlay),
  ];
});

function quadratic(p0: Coordinate, c: Coordinate, p1: Coordinate, steps = 48) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
    };
  });
}

// Arc: passes through the third point; curve: the third point is the control point.
const arc = tool("arc", 3, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const [a, b] = coordinates;
  if (coordinates.length < 3) return [line([a, b])];
  const m = mid(a, b);
  const control = { x: 2 * coordinates[2].x - m.x, y: 2 * coordinates[2].y - m.y };
  const pts = quadratic(a, control, b);
  const l = look(overlay);
  return [polygon(pts, l.fill), line(pts)];
});

const curve = tool("curve", 3, ({ coordinates }) => {
  if (coordinates.length < 2) return [];
  const [a, b] = coordinates;
  if (coordinates.length < 3) return [line([a, b])];
  return [line(quadratic(a, coordinates[2], b))];
});

const doubleCurve = tool("doubleCurve", 3, ({ coordinates }) => {
  if (coordinates.length < 2) return [];
  const [a, b] = coordinates;
  if (coordinates.length < 3) return [line([a, b])];
  // An S curve: the control point mirrored around the midpoint for the second half.
  const m = mid(a, b);
  const c = coordinates[2];
  const c2 = { x: 2 * m.x - c.x, y: 2 * m.y - c.y };
  return [line([...quadratic(a, c, m), ...quadratic(m, c2, b).slice(1)])];
});

// Fat arrow from p1 to p2.
const arrowMarker = tool("arrowMarker", 2, ({ coordinates, overlay }) => {
  if (coordinates.length < 2) return [];
  const [a, b] = coordinates;
  const l = look(overlay);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 2) return [];
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const w = Math.max(4, Math.min(14, len / 8));
  const head = Math.min(len * 0.45, w * 3);
  const base = { x: b.x - ux * head, y: b.y - uy * head };
  const n = { x: -uy, y: ux };
  const shape = [
    { x: a.x + n.x * (w / 2), y: a.y + n.y * (w / 2) },
    { x: base.x + n.x * (w / 2), y: base.y + n.y * (w / 2) },
    { x: base.x + n.x * w * 1.4, y: base.y + n.y * w * 1.4 },
    b,
    { x: base.x - n.x * w * 1.4, y: base.y - n.y * w * 1.4 },
    { x: base.x - n.x * (w / 2), y: base.y - n.y * (w / 2) },
    { x: a.x - n.x * (w / 2), y: a.y - n.y * (w / 2) },
  ];
  const o = ext(overlay, SHAPE_DEFAULTS);
  return [
    polygon(shape, l.color),
    ...(o.text
      ? textBlock(a.x, a.y + (b.y < a.y ? 6 : -6), o.text, {
          color: l.textColor,
          size: l.fontSize,
          align: "center",
          baseline: b.y < a.y ? "top" : "bottom",
        })
      : []),
  ];
});

function arrowMark(name: string, up: boolean): OverlayTemplate {
  return tool(
    name,
    1,
    ({ coordinates, overlay }) => {
      const { x, y } = coordinates[0];
      const l = look(overlay);
      const color = overlay.styles?.line?.color ? l.color : up ? UP_COLOR : DOWN_COLOR;
      const s = up ? 1 : -1;
      // Up marks sit below the point, pointing at it; down marks above.
      const tip = { x, y: y + s * 4 };
      const shape = [
        tip,
        { x: x + 9, y: tip.y + s * 11 },
        { x: x + 4, y: tip.y + s * 11 },
        { x: x + 4, y: tip.y + s * 24 },
        { x: x - 4, y: tip.y + s * 24 },
        { x: x - 4, y: tip.y + s * 11 },
        { x: x - 9, y: tip.y + s * 11 },
      ];
      const o = ext(overlay, SHAPE_DEFAULTS);
      return [
        polygon(shape, color),
        ...(o.text
          ? textBlock(x, tip.y + s * 28, o.text, {
              color,
              size: l.fontSize,
              align: "center",
              baseline: up ? "top" : "bottom",
            })
          : []),
      ];
    },
    { needDefaultXAxisFigure: false, needDefaultYAxisFigure: false },
  );
}

// ---------------------------------------------------------------------------------------------
// Annotations

const text = tool(
  "text",
  1,
  ({ coordinates, overlay }) => {
    const { x, y } = coordinates[0];
    const l = look(overlay);
    const o = ext(overlay, { text: "Text", background: false, border: false });
    return textBlock(x, y, o.text || " ", {
      color: l.textColor,
      size: l.fontSize,
      bold: l.bold,
      baseline: "bottom",
      background: o.background ? l.fill : undefined,
      borderColor: o.border ? l.color : undefined,
      padding: o.background || o.border ? 4 : 0,
      ignoreEvent: false,
    });
  },
  { needDefaultXAxisFigure: false, needDefaultYAxisFigure: false },
);

const note = tool(
  "note",
  1,
  ({ coordinates, overlay }) => {
    const { x, y } = coordinates[0];
    const l = look(overlay);
    const o = ext(overlay, { text: "Note" });
    const pin: OverlayFigure = {
      type: "circle",
      attrs: { x, y: y - 14, r: 7 },
      styles: { style: "fill", color: l.color },
    };
    return [
      polygon(
        [
          { x: x - 5, y: y - 10 },
          { x: x + 5, y: y - 10 },
          { x, y },
        ],
        l.color,
      ),
      pin,
      ...textBlock(x + 12, y - 14, o.text, {
        color: l.textColor === l.color ? "#fff" : l.textColor,
        background: alpha(l.color, 0.9),
        size: l.fontSize,
        baseline: "middle",
        padding: 5,
        ignoreEvent: false,
      }),
    ];
  },
  { needDefaultXAxisFigure: false, needDefaultYAxisFigure: false },
);

const callout = tool(
  "callout",
  2,
  ({ coordinates, overlay }) => {
    const l = look(overlay);
    const o = ext(overlay, { text: "Callout" });
    const anchor = coordinates[0];
    const box = coordinates[1] ?? { x: anchor.x + 40, y: anchor.y - 40 };
    return [
      line([anchor, box], { color: l.color }),
      ...textBlock(box.x, box.y, o.text, {
        color: "#fff",
        background: l.color,
        size: l.fontSize,
        align: "center",
        baseline: "middle",
        padding: 6,
        ignoreEvent: false,
      }),
    ];
  },
  { needDefaultXAxisFigure: false },
);

const priceLabel = tool(
  "priceLabel",
  1,
  ({ chart, coordinates, overlay }) => {
    const { x, y } = coordinates[0];
    const l = look(overlay);
    const value = overlay.points[0]?.value;
    return [
      polygon(
        [
          { x, y },
          { x: x + 6, y: y - 8 },
          { x: x - 6, y: y - 8 },
        ],
        l.color,
        true,
      ),
      label(x, y - 8, value === undefined ? "" : fmtPrice(chart, value), {
        color: "#fff",
        background: l.color,
        align: "center",
        baseline: "bottom",
        padding: 4,
        size: l.fontSize,
        ignoreEvent: false,
      }),
    ];
  },
  { needDefaultXAxisFigure: false },
);

const priceNote = tool("priceNote", 2, ({ chart, coordinates, overlay }) => {
  const l = look(overlay);
  const value = overlay.points[0]?.value;
  const a = coordinates[0];
  const b = coordinates[1] ?? a;
  return [
    line([a, b]),
    { type: "circle", attrs: { x: a.x, y: a.y, r: 3 }, styles: { style: "fill", color: l.color } },
    label(b.x, b.y, value === undefined ? "" : fmtPrice(chart, value), {
      color: l.textColor,
      size: l.fontSize,
      align: b.x >= a.x ? "left" : "right",
      baseline: "middle",
      padding: 4,
      ignoreEvent: false,
    }),
  ];
});

const signpost = tool(
  "signpost",
  1,
  ({ coordinates, overlay }) => {
    const { x, y } = coordinates[0];
    const l = look(overlay);
    const o = ext(overlay, { text: "Signpost" });
    const top = y - 60;
    return [
      line(
        [
          { x, y },
          { x, y: top },
        ],
        { color: l.color, style: "dashed", dashedValue: [3, 3] },
      ),
      { type: "circle", attrs: { x, y, r: 3 }, styles: { style: "fill", color: l.color } },
      ...textBlock(x, top, o.text, {
        color: "#fff",
        background: l.color,
        size: l.fontSize,
        align: "center",
        baseline: "bottom",
        padding: 5,
        ignoreEvent: false,
      }),
    ];
  },
  { needDefaultYAxisFigure: false },
);

const flagMark = tool(
  "flagMark",
  1,
  ({ coordinates, overlay }) => {
    const { x, y } = coordinates[0];
    const l = look(overlay);
    return [
      line(
        [
          { x, y },
          { x, y: y - 26 },
        ],
        { color: l.color, size: 2 },
      ),
      polygon(
        [
          { x, y: y - 26 },
          { x: x + 16, y: y - 21 },
          { x, y: y - 15 },
        ],
        l.color,
      ),
    ];
  },
  { needDefaultYAxisFigure: false },
);

const emoji = tool(
  "emoji",
  1,
  ({ coordinates, overlay }) => {
    const { x, y } = coordinates[0];
    const o = ext(overlay, { emoji: "🚀" });
    const size = overlay.styles?.text?.size ?? 28;
    return [
      label(x, y, o.emoji, { size, align: "center", baseline: "middle", color: "#000", ignoreEvent: false }),
    ];
  },
  { needDefaultXAxisFigure: false, needDefaultYAxisFigure: false },
);

export const SHAPE_TOOLS: OverlayTemplate[] = [
  freehand("brush", false),
  freehand("highlighter", true),
  arrowMarker,
  arrowMark("arrowMarkUp", true),
  arrowMark("arrowMarkDown", false),
  rectangle,
  rotatedRectangle,
  circle,
  ellipse,
  triangle,
  parallelogram,
  arc,
  curve,
  doubleCurve,
  text,
  note,
  callout,
  priceLabel,
  priceNote,
  signpost,
  flagMark,
  emoji,
];
