import { registerIndicator, type IndicatorTemplate, type KLineData } from "klinecharts";

// Chart types KLineChart doesn't draw itself (baseline, columns, high-low, step line, line with
// markers) and symbol comparison, both as indicators on the price pane. The candles underneath are
// made transparent by the terminal's styles.

export type SeriesType = "baseline" | "columns" | "highLow" | "stepLine" | "lineMarkers";

export interface SeriesExtend {
  type: SeriesType;
  upColor: string;
  downColor: string;
  lineColor: string;
}

const seriesIndicator: IndicatorTemplate<Record<string, never>, number, SeriesExtend> = {
  name: "CH_SERIES",
  shortName: "",
  series: "price",
  calcParams: [],
  figures: [],
  calc: (list) => list.map(() => ({})),
  draw: ({ ctx, chart, indicator, xAxis, yAxis, bounding }) => {
    const list = chart.getDataList();
    const { from, to } = chart.getVisibleRange();
    if (!list.length || to <= from) return true;
    const { type, upColor, downColor, lineColor } = indicator.extendData;
    const x = (i: number) => xAxis.convertToPixel(i);
    const y = (v: number) => yAxis.convertToPixel(v);
    const space = chart.getBarSpace();
    const start = Math.max(0, from - 1);
    const end = Math.min(list.length, to + 1);
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    const tracePath = (step: boolean) => {
      ctx.beginPath();
      for (let i = start; i < end; i++) {
        const px = x(i);
        const py = y(list[i].close);
        if (i === start) ctx.moveTo(px, py);
        else if (step) {
          ctx.lineTo(px, y(list[i - 1].close));
          ctx.lineTo(px, py);
        } else ctx.lineTo(px, py);
      }
    };
    switch (type) {
      case "stepLine":
      case "lineMarkers": {
        ctx.strokeStyle = lineColor;
        tracePath(type === "stepLine");
        ctx.stroke();
        if (type === "lineMarkers") {
          ctx.fillStyle = lineColor;
          for (let i = start; i < end; i++) {
            ctx.beginPath();
            ctx.arc(x(i), y(list[i].close), Math.min(3, Math.max(1.5, space.bar / 4)), 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
      case "baseline": {
        let min = Infinity;
        let max = -Infinity;
        for (let i = from; i < Math.min(list.length, to); i++) {
          min = Math.min(min, list[i].close);
          max = Math.max(max, list[i].close);
        }
        const baseY = y((min + max) / 2);
        for (const [color, top, height] of [
          [upColor, 0, baseY],
          [downColor, baseY, bounding.height - baseY],
        ] as const) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, top, bounding.width, height);
          ctx.clip();
          tracePath(false);
          ctx.strokeStyle = color;
          ctx.stroke();
          ctx.lineTo(x(end - 1), baseY);
          ctx.lineTo(x(start), baseY);
          ctx.closePath();
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = color;
          ctx.fill();
          ctx.restore();
        }
        ctx.strokeStyle = "rgba(120,123,134,0.6)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        ctx.lineTo(bounding.width, baseY);
        ctx.stroke();
        break;
      }
      case "columns":
      case "highLow": {
        const w = Math.max(1, space.gapBar);
        for (let i = start; i < end; i++) {
          const k = list[i];
          const prev: KLineData | undefined = list[i - 1];
          const rising = type === "columns" ? k.close >= (prev?.close ?? k.open) : k.close >= k.open;
          ctx.fillStyle = type === "columns" ? (rising ? upColor : downColor) : lineColor;
          ctx.globalAlpha = type === "columns" ? 0.6 : 1;
          const top = type === "columns" ? y(k.close) : y(k.high);
          const bottom = type === "columns" ? bounding.height : y(k.low);
          ctx.fillRect(x(i) - w / 2, Math.min(top, bottom), w, Math.max(1, Math.abs(bottom - top)));
        }
        break;
      }
    }
    ctx.restore();
    return true;
  },
};

export interface CompareSeries {
  id: string;
  display: string;
  color: string;
  // close by bucketed timestamp
  closes: Map<number, number>;
}

export interface CompareExtend {
  series: CompareSeries[];
  bucket: (t: number) => number;
}

// Other symbols rebased to the main symbol's first common close, so both start at the same point
// and the percentage scale compares their moves.
const compareIndicator: IndicatorTemplate<Record<string, number | undefined>, number, CompareExtend> = {
  name: "CH_COMPARE",
  shortName: "",
  series: "price",
  calcParams: [],
  figures: [],
  regenerateFigures: null,
  shouldUpdate: () => ({ calc: true, draw: true }),
  calc: (list, indicator) => {
    const { series, bucket } = indicator.extendData;
    indicator.figures = series.map((s, i) => ({
      key: `c${i}`,
      title: `${s.display}: `,
      type: "line",
      styles: () => ({ color: s.color, size: 2 }),
    }));
    const bases = series.map((s) => {
      for (const k of list) {
        const other = s.closes.get(bucket(k.timestamp));
        if (other) return { main: k.close, other };
      }
      return null;
    });
    return list.map((k) => {
      const row: Record<string, number | undefined> = {};
      series.forEach((s, i) => {
        const base = bases[i];
        const other = s.closes.get(bucket(k.timestamp));
        if (base && other) row[`c${i}`] = (base.main * other) / base.other;
      });
      return row;
    });
  },
};

let registered = false;

export function registerChartSeries() {
  if (registered) return;
  registered = true;
  registerIndicator(seriesIndicator as unknown as IndicatorTemplate);
  registerIndicator(compareIndicator as unknown as IndicatorTemplate);
}
