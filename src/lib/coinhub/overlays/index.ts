import { registerOverlay } from "klinecharts";
import { FIB_TOOLS } from "./fib-gann";
import { LINE_TOOLS } from "./lines";
import { MEASURE_TOOLS } from "./measure";
import { PATTERN_TOOLS } from "./patterns";
import { SHAPE_TOOLS } from "./shapes";
import { TRADING_OVERLAYS } from "./trading";

export const DRAWING_TOOLS = [
  ...LINE_TOOLS,
  ...FIB_TOOLS,
  ...PATTERN_TOOLS,
  ...MEASURE_TOOLS,
  ...SHAPE_TOOLS,
];

let registered = false;

// KLineChart keeps overlays in a global registry; register CoinHub's once per page.
export function registerDrawingTools() {
  if (registered) return;
  registered = true;
  [...DRAWING_TOOLS, ...TRADING_OVERLAYS].forEach((template) => registerOverlay(template));
}
