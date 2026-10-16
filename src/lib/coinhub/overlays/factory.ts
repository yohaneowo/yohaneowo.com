import type { Chart, OverlayCreateFiguresCallbackParams, OverlayFigure, OverlayTemplate } from "klinecharts";

export type FigureParams = OverlayCreateFiguresCallbackParams<unknown>;

// A drawing tool: `points` clicks, figures rebuilt from pixel coordinates on every frame.
export function tool(
  name: string,
  points: number,
  createPointFigures: (params: FigureParams) => OverlayFigure[],
  extra: Partial<OverlayTemplate> = {},
): OverlayTemplate {
  return {
    name,
    totalStep: points + 1,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: (params) => {
      if (params.coordinates.length === 0) return [];
      try {
        return createPointFigures(params);
      } catch {
        // A half-placed drawing can produce NaN geometry; skip the frame rather than break the chart.
        return [];
      }
    },
    ...extra,
  };
}

// Formats a timestamp the way the chart's x axis does, in the chart's timezone.
export function fmtTime(chart: Chart, timestamp: number, withTime = true) {
  const period = chart.getPeriod();
  const daily = period && ["day", "week", "month", "year"].includes(period.type);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: chart.getTimezone(),
    year: "2-digit",
    month: "short",
    day: "2-digit",
    ...(withTime && !daily ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
  }).format(timestamp);
}
