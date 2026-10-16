// Left toolbar groups (TradingView's order) and per-tool options for the drawing settings.

export interface ToolSection {
  id: string;
  tools: string[];
}

export interface ToolGroup {
  id: string;
  sections: ToolSection[];
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "lines",
    sections: [
      {
        id: "lines",
        tools: [
          "trendLine",
          "ray",
          "infoLine",
          "extendedLine",
          "trendAngle",
          "horizontalLine",
          "horizontalRay",
          "verticalLine",
          "crossLine",
        ],
      },
      { id: "channels", tools: ["parallelChannel", "regressionTrend", "flatTopBottom", "disjointChannel"] },
      { id: "pitchforks", tools: ["pitchfork", "schiffPitchfork", "modifiedSchiffPitchfork"] },
    ],
  },
  {
    id: "fib",
    sections: [
      {
        id: "fibonacci",
        tools: [
          "fibRetracement",
          "fibExtension",
          "fibChannel",
          "fibTimeZone",
          "fibSpeedFan",
          "fibTrendTime",
          "fibCircles",
          "fibSpiral",
          "fibArcs",
          "fibWedge",
          "pitchfan",
        ],
      },
      { id: "gann", tools: ["gannBox", "gannSquare", "gannFan"] },
    ],
  },
  {
    id: "patterns",
    sections: [
      {
        id: "chartPatterns",
        tools: ["xabcd", "cypher", "headShoulders", "abcd", "trianglePattern", "threeDrives"],
      },
      {
        id: "elliott",
        tools: [
          "elliottImpulse",
          "elliottCorrection",
          "elliottTriangle",
          "elliottDoubleCombo",
          "elliottTripleCombo",
        ],
      },
      { id: "cycles", tools: ["cyclicLines", "timeCycles", "sineLine"] },
    ],
  },
  {
    id: "forecasting",
    sections: [
      { id: "projection", tools: ["longPosition", "shortPosition"] },
      { id: "measurer", tools: ["priceRange", "dateRange", "datePriceRange"] },
      { id: "volume", tools: ["anchoredVwap", "fixedRangeVolumeProfile"] },
    ],
  },
  {
    id: "shapes",
    sections: [
      { id: "brushes", tools: ["brush", "highlighter"] },
      { id: "arrows", tools: ["arrowMarker", "arrowLine", "arrowMarkUp", "arrowMarkDown"] },
      {
        id: "shapes",
        tools: [
          "rectangle",
          "rotatedRectangle",
          "circle",
          "ellipse",
          "triangle",
          "parallelogram",
          "arc",
          "curve",
          "doubleCurve",
        ],
      },
    ],
  },
  {
    id: "annotations",
    sections: [
      { id: "text", tools: ["text", "note", "callout", "priceLabel", "priceNote", "signpost", "flagMark"] },
    ],
  },
];

export const TOOL_GROUP_OF: Record<string, string> = Object.fromEntries(
  TOOL_GROUPS.flatMap((g) => g.sections.flatMap((s) => s.tools.map((tool) => [tool, g.id]))),
);

// TradingView's drawing hotkeys.
export const TOOL_HOTKEYS: Record<string, string> = {
  trendLine: "Alt+T",
  horizontalLine: "Alt+H",
  horizontalRay: "Alt+J",
  verticalLine: "Alt+V",
  crossLine: "Alt+C",
  fibRetracement: "Alt+F",
  rectangle: "Alt+Shift+R",
};

export const EMOJIS = [
  "🚀",
  "📈",
  "📉",
  "💰",
  "🔥",
  "⚠️",
  "✅",
  "❌",
  "💎",
  "🐋",
  "🐂",
  "🐻",
  "🎯",
  "⭐",
  "👀",
  "🤡",
  "🧠",
  "⏰",
  "🏁",
  "💀",
];

export type OptionType = "bool" | "number" | "text";

export interface ToolOption {
  key: string;
  type: OptionType;
  // Key under the dictionary's coinhub.drawing section.
  label: string;
  min?: number;
  step?: number;
}

const b = (key: string, label = key): ToolOption => ({ key, type: "bool", label });
const n = (key: string, label: string, min = 0, step = 1): ToolOption => ({
  key,
  type: "number",
  label,
  min,
  step,
});
const t = (key = "text"): ToolOption => ({ key, type: "text", label: "text" });

const LINE = [t(), b("extendLeft"), b("extendRight"), b("showStats")];
const FIB = [
  b("extendLeft"),
  b("extendRight"),
  b("reverse"),
  b("showPrices"),
  b("showLevels"),
  b("fill", "background"),
];
const SHAPE = [t(), b("fill", "background")];

export const TOOL_OPTIONS: Record<string, ToolOption[]> = {
  trendLine: [...LINE, b("arrowStart"), b("arrowEnd")],
  ray: [t(), b("showStats")],
  extendedLine: [t()],
  arrowLine: [t()],
  horizontalLine: [t(), b("showPrice")],
  horizontalRay: [t(), b("showPrice")],
  verticalLine: [t()],
  parallelChannel: [b("extendLeft"), b("extendRight"), b("showMiddle"), b("fill", "background")],
  regressionTrend: [n("deviation", "deviation", 0.5, 0.5), b("extendRight")],
  fibRetracement: FIB,
  fibExtension: FIB,
  fibChannel: [b("extendLeft"), b("extendRight"), b("showLevels"), b("fill", "background")],
  fibTrendTime: [b("showLevels")],
  fibSpeedFan: [b("showLevels")],
  fibSpiral: [b("counterClockwise", "reverse")],
  gannBox: [b("showLevels"), b("fill", "background")],
  gannFan: [b("showLevels")],
  longPosition: [n("accountSize", "accountSize", 1, 100), n("riskPercent", "risk", 0.1, 0.5)],
  shortPosition: [n("accountSize", "accountSize", 1, 100), n("riskPercent", "risk", 0.1, 0.5)],
  anchoredVwap: [b("bands")],
  fixedRangeVolumeProfile: [n("rows", "rows", 4, 1), n("valueArea", "valueArea", 10, 5)],
  rectangle: SHAPE,
  rotatedRectangle: SHAPE,
  circle: SHAPE,
  ellipse: SHAPE,
  triangle: SHAPE,
  parallelogram: SHAPE,
  arrowMarker: [t()],
  arrowMarkUp: [t()],
  arrowMarkDown: [t()],
  text: [t(), b("background"), b("border")],
  note: [t()],
  callout: [t()],
  signpost: [t()],
};

// Tools with editable levels.
export const LEVEL_TOOLS = new Set([
  "fibRetracement",
  "fibExtension",
  "fibChannel",
  "fibTrendTime",
  "fibSpeedFan",
  "fibCircles",
  "fibArcs",
  "fibWedge",
  "pitchfan",
  "gannBox",
]);

// Tools that show text, so they get text colour / size controls.
export const TEXT_TOOLS = new Set([
  "text",
  "note",
  "callout",
  "signpost",
  "priceLabel",
  "priceNote",
  "arrowMarker",
  "arrowMarkUp",
  "arrowMarkDown",
  "trendLine",
  "ray",
  "extendedLine",
  "arrowLine",
  "horizontalLine",
  "horizontalRay",
  "verticalLine",
  "rectangle",
  "rotatedRectangle",
  "circle",
  "ellipse",
  "triangle",
  "parallelogram",
]);
