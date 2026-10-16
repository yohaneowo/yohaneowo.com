import type { ReactNode } from "react";

// Drawing-tool glyphs in TradingView's style: 20×20, 1.25px strokes, small hollow anchor dots.

const dot = (x: number, y: number) => (
  <circle key={`${x},${y}`} cx={x} cy={y} r={1.6} fill="var(--background)" />
);
const p = (d: string, extra?: Record<string, unknown>) => <path key={d} d={d} {...extra} />;
const dashed = (d: string) => p(d, { strokeDasharray: "2 2" });

const ICONS: Record<string, ReactNode> = {
  trendLine: [p("M4.5 15.5 15.5 4.5"), dot(4, 16), dot(16, 4)],
  ray: [p("M4.5 15.5 19 1"), dot(4, 16), dot(11, 9)],
  infoLine: [p("M3.5 15.5 12.5 6.5"), dot(3, 16), dot(13, 6), p("M12 11h6v6h-6z")],
  extendedLine: [p("M1 19 19 1"), dot(6, 14), dot(14, 6)],
  trendAngle: [p("M4 16 16 5"), p("M4 16h13"), p("M10 16a6 6 0 0 0-1.5-4"), dot(4, 16), dot(16, 5)],
  horizontalLine: [p("M1 10h18"), dot(10, 10)],
  horizontalRay: [p("M5.5 10H19"), dot(4, 10)],
  verticalLine: [p("M10 1v18"), dot(10, 10)],
  crossLine: [p("M1 10h18M10 1v18"), dot(10, 10)],
  arrowLine: [p("M4 16 15 5"), p("M10 5h5v5")],
  parallelChannel: [p("M2 13 13 2"), p("M7 18 18 7"), dashed("M4.5 15.5 15.5 4.5"), dot(2, 13), dot(18, 7)],
  regressionTrend: [p("M2 9 18 3"), p("M2 17 18 11"), dashed("M2 13 18 7")],
  flatTopBottom: [p("M2 15 18 5"), p("M2 5h16")],
  disjointChannel: [p("M2 4 18 9"), p("M2 16 18 11")],
  pitchfork: [p("M3 10h3"), p("M6 4v12"), p("M6 4h12M6 10h12M6 16h12"), dot(3, 10)],
  schiffPitchfork: [p("M3 13 7 4v12"), p("M7 4h11M7 10h11M7 16h11")],
  modifiedSchiffPitchfork: [p("M2 15 8 4v12"), p("M8 4h10M8 10h10M8 16h10")],
  fibRetracement: [p("M4 3h14M4 8h14M4 12h14M4 17h14"), dot(2.5, 3), dot(2.5, 17)],
  fibExtension: [p("M2 17 6 7l4 6"), p("M11 3h8M11 8h8M11 13h8")],
  fibChannel: [p("M1 9 9 1M1 14 14 1M3 17 17 3M8 18 18 8")],
  fibTimeZone: [p("M3 2v16M5 2v16M8 2v16M12 2v16M18 2v16")],
  fibSpeedFan: [p("M3 17 17 3M3 17 17 8M3 17 17 13M3 17 8 3M3 17 13 3"), dot(3, 17)],
  fibTrendTime: [p("M2 16 6 6l3 7"), p("M11 2v16M14 2v16M18 2v16")],
  fibCircles: [
    <circle key="a" cx="10" cy="10" r="8" />,
    <circle key="b" cx="10" cy="10" r="5" />,
    <circle key="c" cx="10" cy="10" r="2" />,
  ],
  fibSpiral: [
    p("M10 10a1.5 1.5 0 0 1 1.5 1.5 3 3 0 0 1-3 3 4.5 4.5 0 0 1-4.5-4.5A7 7 0 0 1 11 3a8.5 8.5 0 0 1 8 8.5"),
  ],
  fibArcs: [p("M2 17a8 8 0 0 1 16 0M5 17a5 5 0 0 1 10 0M8 17a2 2 0 0 1 4 0"), p("M10 17v-1")],
  fibWedge: [p("M3 17 17 3M3 17h15"), p("M9 17a6 6 0 0 0-1.8-4.3M14 17a11 11 0 0 0-3.2-7.8")],
  pitchfan: [p("M3 17 18 2M3 17 18 8M3 17 18 14M3 17 12 2"), dot(3, 17)],
  gannBox: [p("M3 3h14v14H3zM3 8h14M3 12h14M8 3v14M12 3v14")],
  gannSquare: [p("M3 3h14v14H3zM3 17 17 3M3 3l14 14")],
  gannFan: [p("M3 17 18 2M3 17 18 9M3 17 18 14M3 17 10 2M3 17 15 2"), dot(3, 17)],
  xabcd: [p("M2 14 6 4l3 7 5-8 4 14", { fill: "currentColor", fillOpacity: 0.12 })],
  cypher: [p("M2 15 5 5l4 6 3-9 6 14", { fill: "currentColor", fillOpacity: 0.12 })],
  headShoulders: [p("M1 14l3-5 2 4 4-10 4 10 2-4 3 5"), dashed("M2 13h16")],
  abcd: [p("M2 15 7 4l4 7 7-8")],
  trianglePattern: [p("M2 3 6 16l4-10 4 7 4-4"), dashed("M2 3l16 6M6 16l12-7")],
  threeDrives: [p("M1 16l3-5 2 3 4-7 2 3 4-8 3 4")],
  elliottImpulse: [
    p("M1 17 5 9l3 4 5-10 2 5 4-5"),
    <text key="t" x="12" y="18" fontSize="6" stroke="none" fill="currentColor">
      5
    </text>,
  ],
  elliottCorrection: [
    p("M2 4 8 15l4-6 6 8"),
    <text key="t" x="13" y="7" fontSize="6" stroke="none" fill="currentColor">
      C
    </text>,
  ],
  elliottTriangle: [p("M1 3 5 15l3-9 3 7 3-5 3 4 2-2")],
  elliottDoubleCombo: [p("M2 3 7 13l4-5 7 9")],
  elliottTripleCombo: [p("M1 3 5 11l3-4 3 6 3-3 5 6")],
  cyclicLines: [p("M3 2v16M8 2v16M13 2v16M18 2v16")],
  timeCycles: [p("M1 15a4 4 0 0 1 8 0 4 4 0 0 1 8 0"), p("M1 17h18")],
  sineLine: [p("M1 10c2.5-8 5.5-8 8 0s5.5 8 8 0"), dot(4.5, 4), dot(13.5, 16)],
  longPosition: [
    p("M3 3h14v7H3z", { fill: "#089981", fillOpacity: 0.35, stroke: "#089981" }),
    p("M3 10h14v6H3z", { fill: "#f23645", fillOpacity: 0.35, stroke: "#f23645" }),
  ],
  shortPosition: [
    p("M3 4h14v6H3z", { fill: "#f23645", fillOpacity: 0.35, stroke: "#f23645" }),
    p("M3 10h14v7H3z", { fill: "#089981", fillOpacity: 0.35, stroke: "#089981" }),
  ],
  priceRange: [p("M3 3h14M3 17h14M10 4v12M7 7l3-3 3 3")],
  dateRange: [p("M3 3v14M17 3v14M4 10h12M13 7l3 3-3 3")],
  datePriceRange: [p("M3 3h14v14H3z", { fill: "currentColor", fillOpacity: 0.1 }), p("M10 5v10M5 10h10")],
  measure: [p("M2 14 14 2l4 4L6 18z"), p("M5 11l2 2M8 8l2 2M11 5l2 2")],
  anchoredVwap: [p("M3 15c4-1 6-6 8-6s4 3 7 1"), p("M3 13v4"), dot(3, 15)],
  fixedRangeVolumeProfile: [p("M3 2v16"), p("M3 4h9M3 7h13M3 10h7M3 13h11M3 16h5", { strokeWidth: 2 })],
  brush: [p("M3 16c1-2 2-3 4-3 1.5 0 2 1.5 1 2.5S5 17 3 16zM8 12l8-9 1.5 1.5-9 8")],
  highlighter: [p("M5 14l3 3M4 18h4l9-9-4-4-9 9z")],
  arrowMarker: [p("M3 14 12 5l-3-1 8-2-2 8-1-3-9 9z")],
  arrowMarkUp: [p("M10 3 5 9h3v8h4V9h3z", { fill: "#089981", stroke: "#089981" })],
  arrowMarkDown: [p("M10 17l5-6h-3V3H8v8H5z", { fill: "#f23645", stroke: "#f23645" })],
  rectangle: [p("M3 5h14v10H3z"), dot(3, 5), dot(17, 15)],
  rotatedRectangle: [p("M2 11 9 3l9 6-7 8z")],
  circle: [<circle key="c" cx="10" cy="10" r="7.5" />, dot(10, 10)],
  ellipse: [<ellipse key="e" cx="10" cy="10" rx="8.5" ry="5.5" />],
  triangle: [p("M10 3 18 17H2z")],
  parallelogram: [p("M6 4h12l-4 12H2z")],
  arc: [p("M2 16Q10 0 18 16"), dot(2, 16), dot(18, 16)],
  curve: [p("M2 16C6 1 14 1 18 12"), dot(2, 16), dot(18, 12)],
  doubleCurve: [p("M2 14c3-10 6-10 8-4s5 6 8-4")],
  text: [p("M4 4h12M10 4v13M7 17h6")],
  note: [p("M3 3h14v10l-4 4H3z"), p("M13 17v-4h4"), p("M6 7h8M6 10h5")],
  callout: [p("M2 3h16v10H9l-4 4v-4H2z")],
  priceLabel: [p("M2 10l4-5h12v10H6z"), dot(6, 10)],
  priceNote: [p("M3 16l6-6"), dot(3, 16), p("M9 7h9v6H9z")],
  signpost: [p("M10 18V8"), p("M4 3h12v5H4z"), dot(10, 18)],
  flagMark: [p("M5 18V2"), p("M5 3h11l-3 4 3 4H5")],
  emoji: [<circle key="c" cx="10" cy="10" r="8" />, p("M6.5 12a4 4 0 0 0 7 0"), dot(7.5, 8), dot(12.5, 8)],
  cross: [p("M10 2v16M2 10h16")],
  dot: [<circle key="d" cx="10" cy="10" r="2.5" fill="currentColor" />],
  arrow: [p("M5 2v14l4-4 3 6 2-1-3-6h5z")],
  eraser: [p("M8 17h10M3 13l8-9 6 6-7 7H7z"), p("M7 8l6 6")],
};

export function ToolIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-5"}
      aria-hidden
    >
      {ICONS[name] ?? ICONS.trendLine}
    </svg>
  );
}

const CHART_TYPE_ICONS: Record<string, ReactNode> = {
  candles: [p("M6 3v14M14 3v14"), p("M4 6h4v7H4z", { fill: "currentColor" }), p("M12 8h4v5h-4z")],
  hollow: [p("M6 3v14M14 3v14"), p("M4 6h4v7H4z"), p("M12 8h4v5h-4z", { fill: "currentColor" })],
  bars: [p("M6 3v14M4 6h2M6 14h2M14 4v12M12 13h2M14 7h2")],
  line: [p("M2 15l5-6 4 3 7-8")],
  area: [p("M2 15l5-6 4 3 7-8v14H2z", { fill: "currentColor", fillOpacity: 0.2 }), p("M2 15l5-6 4 3 7-8")],
  baseline: [p("M2 14l4-7 4 9 4-6 4 3"), p("M1 11h18", { strokeDasharray: "2 2" })],
  heikinAshi: [
    p("M6 2v16M14 2v16"),
    p("M4 5h4v9H4z", { fill: "currentColor", fillOpacity: 0.5 }),
    p("M12 7h4v6h-4z", { fill: "currentColor", fillOpacity: 0.5 }),
  ],
  columns: [p("M3 10h3v8H3zM8.5 6h3v12h-3zM14 12h3v6h-3z", { fill: "currentColor", fillOpacity: 0.5 })],
  highLow: [p("M4 6h3v8H4zM9 3h3v9H9zM14 8h3v9h-3z")],
  stepLine: [p("M2 15h4V9h4v3h4V4h4")],
  lineMarkers: [p("M2 15l5-6 4 3 7-8"), dot(2, 15), dot(7, 9), dot(11, 12), dot(18, 4)],
};

export function ChartTypeIcon({ type, className }: { type: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-5"}
      aria-hidden
    >
      {CHART_TYPE_ICONS[type] ?? CHART_TYPE_ICONS.candles}
    </svg>
  );
}
