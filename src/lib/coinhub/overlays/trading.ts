import type { OverlayTemplate } from "klinecharts";
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

export const TRADING_OVERLAYS: OverlayTemplate[] = [priceTagLine("alertLine"), priceTagLine("orderLine")];
