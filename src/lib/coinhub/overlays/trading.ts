import type { OverlayFigure, OverlayTemplate } from "klinecharts";
import { tool } from "./factory";
import { alpha, ext, fmtPrice, label, line } from "./utils";

// Lines the terminal manages itself (not user drawings): price alerts and paper-trading orders /
// positions. They span the pane, carry a tag on the left and a price on the axis, and can be
// dragged up and down (the terminal listens for the drag end and saves the new price).

export type TagOptions = { text: string; color: string; dashed: boolean };

function priceTagLine(name: string): OverlayTemplate {
  return tool(
    name,
    1,
    ({ coordinates, bounding, overlay }) => {
      const o = ext(overlay, { text: "", color: "#ff9800", dashed: true } as TagOptions);
      const y = coordinates[0].y;
      return [
        line(
          [
            { x: 0, y },
            { x: bounding.width, y },
          ],
          {
            color: o.color,
            size: 1,
            style: o.dashed ? "dashed" : "solid",
            dashedValue: [6, 4],
          },
        ),
        ...(o.text
          ? [
              label(8, y, o.text, {
                color: o.color,
                background: alpha(o.color, 0.12),
                borderColor: o.color,
                baseline: "middle",
                padding: 3,
                size: 11,
                ignoreEvent: false,
              }),
            ]
          : []),
      ];
    },
    {
      needDefaultPointFigure: false,
      needDefaultXAxisFigure: false,
      needDefaultYAxisFigure: false,
      createYAxisFigures: ({ chart, coordinates, overlay }) => {
        const o = ext(overlay, { text: "", color: "#ff9800", dashed: true } as TagOptions);
        const value = overlay.points[0]?.value;
        if (value === undefined) return [];
        return [
          label(0, coordinates[0].y, fmtPrice(chart, value), {
            color: "#fff",
            background: o.color,
            baseline: "middle",
            padding: 3,
            size: 11,
          }),
        ];
      },
      // Only vertical moves: keep the timestamp.
      performEventPressedMove: ({ points, performPoint }) => {
        points[0].timestamp = performPoint.timestamp;
      },
    },
  );
}

// A real fill (or the fills of one candle) from the user's exchange account, like Binance's own
// marks: a badge with "B" under the candle's low for a buy, "S" over its high for a sell (the point
// is that low or high). Futures fills are hollow. Not draggable; a click opens the fills list.
export type FillMarkOptions = {
  side: "BUY" | "SELL";
  text: string;
  hollow: boolean;
};

const fillMark: OverlayTemplate = tool(
  "fillMark",
  1,
  ({ coordinates, overlay }) => {
    const o = ext(overlay, { side: "BUY", text: "B", hollow: false } as FillMarkOptions);
    const { x, y } = coordinates[0];
    const buy = o.side === "BUY";
    const color = buy ? "#089981" : "#f23645";
    const height = 16;
    const width = Math.max(height, o.text.length * 7 + 6);
    const gap = 5;
    const top = buy ? y + gap : y - gap - height;
    const figures: OverlayFigure[] = [
      {
        type: "rect",
        attrs: { x: x - width / 2, y: top, width, height },
        styles: o.hollow
          ? {
              style: "stroke_fill",
              color: alpha(color, 0.15),
              borderColor: color,
              borderSize: 1.5,
              borderRadius: 4,
            }
          : { style: "fill", color, borderRadius: 4 },
      },
      label(x, top + height / 2, o.text, {
        color: o.hollow ? color : "#fff",
        size: 10,
        align: "center",
        baseline: "middle",
        ignoreEvent: true,
      }),
    ];
    return figures;
  },
  { needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false },
);

export const TRADING_OVERLAYS: OverlayTemplate[] = [
  priceTagLine("alertLine"),
  priceTagLine("orderLine"),
  fillMark,
];
