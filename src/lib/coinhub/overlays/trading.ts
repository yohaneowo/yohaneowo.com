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

// A real fill (or the fills of one candle) from the user's exchange account: a triangle at the
// price, pointing up under a buy and down over a sell, with the quantity beside it. Futures fills
// are hollow. Not draggable; a click opens the fills list.
export type FillMarkOptions = {
  side: "BUY" | "SELL";
  text: string;
  hollow: boolean;
};

const fillMark: OverlayTemplate = tool(
  "fillMark",
  1,
  ({ coordinates, overlay }) => {
    const o = ext(overlay, { side: "BUY", text: "", hollow: false } as FillMarkOptions);
    const { x, y } = coordinates[0];
    const buy = o.side === "BUY";
    const color = buy ? "#089981" : "#f23645";
    const s = 5;
    // The apex sits on the price; the base is away from the candle body.
    const tri = buy
      ? [
          { x, y: y + 2 },
          { x: x - s, y: y + 2 + s * 1.6 },
          { x: x + s, y: y + 2 + s * 1.6 },
        ]
      : [
          { x, y: y - 2 },
          { x: x - s, y: y - 2 - s * 1.6 },
          { x: x + s, y: y - 2 - s * 1.6 },
        ];
    const figures: OverlayFigure[] = [
      o.hollow
        ? {
            type: "polygon",
            attrs: { coordinates: tri },
            styles: { style: "stroke_fill", color: alpha(color, 0.15), borderColor: color, borderSize: 1.5 },
          }
        : { type: "polygon", attrs: { coordinates: tri }, styles: { style: "fill", color } },
    ];
    if (o.text)
      figures.push(
        label(x + s + 3, buy ? y + 2 + s * 0.8 : y - 2 - s * 0.8, o.text, {
          color,
          size: 10,
          baseline: "middle",
          ignoreEvent: true,
        }),
      );
    return figures;
  },
  { needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false },
);

export const TRADING_OVERLAYS: OverlayTemplate[] = [
  priceTagLine("alertLine"),
  priceTagLine("orderLine"),
  fillMark,
];
