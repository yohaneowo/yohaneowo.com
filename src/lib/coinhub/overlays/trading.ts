import type { FigureTemplate, OverlayFigure, OverlayTemplate } from "klinecharts";
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

// A price the account holds at (the average cost, a position's break-even or liquidation), drawn
// like Binance's cost line: a line in its own colour, width and style, with a bordered label at the
// left — the title as a filled tag over the price — and the price on the axis. Not draggable.
export type HoldingLineOptions = {
  title: string;
  color: string;
  width: number;
  style: "solid" | "dashed" | "dotted";
};

const DASHES: Record<HoldingLineOptions["style"], number[]> = { solid: [], dashed: [6, 4], dotted: [2, 3] };
const LABEL_FONT =
  "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
let measurer: CanvasRenderingContext2D | null = null;

function textWidth(text: string) {
  measurer ??= document.createElement("canvas").getContext("2d");
  if (!measurer) return text.length * 7;
  measurer.font = LABEL_FONT;
  return measurer.measureText(text).width;
}

const holdingLine: OverlayTemplate = tool(
  "holdingLine",
  1,
  ({ coordinates, bounding, overlay, chart }) => {
    const o = ext(overlay, { title: "", color: "#0ecb81", width: 1, style: "dashed" } as HoldingLineOptions);
    const y = coordinates[0].y;
    const price = fmtPrice(chart, overlay.points[0]?.value ?? 0);
    const rowHeight = 17;
    const left = 8;
    const width = Math.ceil(Math.max(textWidth(o.title), textWidth(price))) + 12;
    const top = y - rowHeight;
    return [
      line(
        [
          { x: 0, y },
          { x: bounding.width, y },
        ],
        {
          color: o.color,
          size: o.width,
          style: o.style === "solid" ? "solid" : "dashed",
          dashedValue: DASHES[o.style],
        },
      ),
      // The group's border and tinted background, the title's filled tag inside it.
      {
        type: "rect",
        attrs: { x: left, y: top, width, height: rowHeight * 2 },
        styles: {
          style: "stroke_fill",
          color: alpha(o.color, 0.12),
          borderColor: o.color,
          borderSize: 1,
          borderRadius: 4,
        },
        ignoreEvent: true,
      },
      {
        type: "rect",
        attrs: { x: left, y: top, width, height: rowHeight },
        styles: { style: "fill", color: o.color, borderRadius: [4, 4, 0, 0] },
        ignoreEvent: true,
      },
      label(left + width / 2, top + rowHeight / 2, o.title, {
        color: "#fff",
        size: 11,
        align: "center",
        baseline: "middle",
        ignoreEvent: true,
      }),
      label(left + width / 2, y + rowHeight / 2, price, {
        color: o.color,
        size: 11,
        bold: true,
        align: "center",
        baseline: "middle",
        ignoreEvent: true,
      }),
    ];
  },
  {
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createYAxisFigures: ({ chart, coordinates, overlay }) => {
      const o = ext(overlay, { title: "", color: "#0ecb81" } as HoldingLineOptions);
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
  },
);

// One level of a grid bot (Pionex), drawn like Pionex's own chart: a thin line across the pane with
// a small tag at the left saying the price and whether a buy or a sell waits there. Dozens of them
// at once, so no axis label and no border box. Not draggable.
export type GridLineOptions = { text: string; color: string };

const gridLine: OverlayTemplate = tool(
  "gridLine",
  1,
  ({ coordinates, bounding, overlay }) => {
    const o = ext(overlay, { text: "", color: "#0ecb81" } as GridLineOptions);
    const y = coordinates[0].y;
    return [
      line(
        [
          { x: 0, y },
          { x: bounding.width, y },
        ],
        { color: alpha(o.color, 0.55), size: 1, style: "solid" },
      ),
      label(8, y, o.text, {
        color: o.color,
        background: alpha(o.color, 0.12),
        borderColor: alpha(o.color, 0.6),
        baseline: "middle",
        padding: 2,
        size: 10,
        ignoreEvent: true,
      }),
    ];
  },
  { needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false },
);

// A real fill (or the fills of one candle) from the user's exchange account, drawn like Binance's
// own marks: a rounded square with a small point towards the candle and a thin line up to its
// wick — "B" under the low for a buy, "S" over the high for a sell (the point is that low or
// high). Futures fills are hollow. Not draggable; a click opens the fills list.
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
    const color = buy ? "#0ecb81" : "#f6465d";
    const size = 20;
    const lead = 7;
    const tip = 5;
    // d: +1 draws downwards (under a low), −1 upwards (over a high).
    const d = buy ? 1 : -1;
    const tipY = y + d * lead;
    const boxStart = tipY + d * tip;
    const boxTop = buy ? boxStart : boxStart - size;
    const fill = o.hollow
      ? { style: "stroke_fill", color: alpha(color, 0.18), borderColor: color, borderSize: 1.5 }
      : { style: "fill", color };
    const figures: OverlayFigure[] = [
      line(
        [
          { x, y },
          { x, y: tipY },
        ],
        { color, size: 1 },
      ),
      {
        type: "polygon",
        attrs: {
          coordinates: [
            { x, y: tipY },
            { x: x - 3.5, y: boxStart + d * 2 },
            { x: x + 3.5, y: boxStart + d * 2 },
          ],
        },
        styles: fill,
      },
      {
        type: "rect",
        attrs: { x: x - size / 2, y: boxTop, width: size, height: size },
        styles: { ...fill, borderRadius: 6 },
      },
      label(x, boxTop + size / 2, o.text, {
        color: o.hollow ? color : "#fff",
        size: 11,
        bold: true,
        align: "center",
        baseline: "middle",
        ignoreEvent: true,
      }),
    ];
    return figures;
  },
  { needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false },
);

// The X posts on the chart (lib/coinhub/x-posts.ts), like TradingView's events: stacks of small
// round badges at the bottom of the pane, one per post (up to MAX_POST_BADGES a stack, then "+n"):
// the author's avatar ringed in the colour of the post's view (green bullish, red bearish, grey
// neutral or none), or their two letters on that colour until the avatar has loaded; the selected
// post has a second ring. One overlay holds every candle that has posts (a point each, `groups`
// beside them); candles closer than a badge are stacked together on every redraw, so zooming out
// merges them instead of piling badges up. A badge's figure key names its post and its stack
// (`posts:<id>|<id,id,…>`); the "+n" names only the stack.
export type PostBadge = { id: string; tag: string; color: string; selected: boolean; avatar: string | null };
export type PostMarksOptions = { groups: PostBadge[][] };

const MAX_POST_BADGES = 3;
const BADGE_R = 9;
const BADGE_GAP = 2;

export const POST_KEY = "posts:";

// Avatars as images the canvas can draw, loaded once per URL; whoever draws them is told when one
// arrives (the chart redraws its marks).
const avatars = new Map<string, HTMLImageElement | "failed">();
const avatarListeners = new Set<() => void>();

export function onAvatarLoaded(listener: () => void) {
  avatarListeners.add(listener);
  return () => {
    avatarListeners.delete(listener);
  };
}

function avatarImage(src: string): HTMLImageElement | null {
  const cached = avatars.get(src);
  if (cached === "failed") return null;
  if (cached) return cached.complete && cached.naturalWidth ? cached : null;
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.onload = () => avatarListeners.forEach((l) => l());
  img.onerror = () => avatars.set(src, "failed");
  img.src = src;
  avatars.set(src, img);
  return null;
}

type AvatarAttrs = {
  x: number;
  y: number;
  r: number;
  src: string | null;
  tag: string;
  color: string;
  selected: boolean;
};

// The badge itself, registered as a figure so it can draw an image clipped to a circle.
export const POST_AVATAR_FIGURE: FigureTemplate<AvatarAttrs> = {
  name: "postAvatar",
  checkEventOn: (c, a) => (c.x - a.x) ** 2 + (c.y - a.y) ** 2 <= (a.r + 2) ** 2,
  draw: (ctx, a) => {
    const img = a.src ? avatarImage(a.src) : null;
    ctx.save();
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
    if (img) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, a.x - a.r, a.y - a.r, a.r * 2, a.r * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = a.color;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.round(a.r * 0.9)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(a.tag, a.x, a.y + 0.5);
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = a.color;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
    ctx.stroke();
    if (a.selected) {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },
};

const postMarks: OverlayTemplate = tool(
  "postMarks",
  1,
  ({ coordinates, bounding, overlay }) => {
    const o = ext(overlay, { groups: [] } as PostMarksOptions);
    const r = BADGE_R;
    const step = 2 * r + BADGE_GAP;
    const bottom = bounding.height - 5;
    // Each candle's posts (newest first) at its x, left to right; a stack takes the candles that
    // start within one badge of its first.
    const placed = coordinates
      .map((c, i) => ({ x: c.x, items: o.groups[i] ?? [] }))
      .filter((g) => g.items.length && g.x > -r && g.x < bounding.width + r)
      .sort((a, b) => a.x - b.x);
    const stacks: Array<{ first: number; xs: number[]; items: PostBadge[] }> = [];
    for (const g of placed) {
      const last = stacks[stacks.length - 1];
      if (last && g.x - last.first < step) {
        last.xs.push(g.x);
        // Later candles' posts are newer: they go to the bottom of the stack.
        last.items = [...g.items, ...last.items];
      } else stacks.push({ first: g.x, xs: [g.x], items: [...g.items] });
    }
    const figures: OverlayFigure[] = [];
    for (const stack of stacks) {
      const x = stack.xs.reduce((a, b) => a + b, 0) / stack.xs.length;
      const ids = stack.items.map((i) => i.id).join(",");
      stack.items.slice(0, MAX_POST_BADGES).forEach((item, i) => {
        figures.push({
          key: `${POST_KEY}${item.id}|${ids}`,
          type: "postAvatar",
          attrs: {
            x,
            y: bottom - r - i * step,
            r,
            src: item.avatar,
            tag: item.tag,
            color: item.color,
            selected: item.selected,
          } satisfies AvatarAttrs,
        });
      });
      const shown = Math.min(stack.items.length, MAX_POST_BADGES);
      const extra = stack.items.length - shown;
      if (extra > 0)
        figures.push({
          ...label(x, bottom - shown * step - 1, `+${extra}`, {
            color: "#787b86",
            size: 10,
            bold: true,
            align: "center",
            baseline: "bottom",
            ignoreEvent: false,
          }),
          key: `${POST_KEY}|${ids}`,
        });
    }
    return figures;
  },
  { needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false },
);

// A price level from the selected X post: a dashed line across the pane, faint before the post's
// candle and full after it, tagged at the left with the account, the kind of level and the price
// (at the left so it shows however far back the post is).
export type PostLevelOptions = { text: string; color: string };

const postLevel: OverlayTemplate = tool(
  "postLevel",
  1,
  ({ coordinates, bounding, overlay }) => {
    const o = ext(overlay, { text: "", color: "#787b86" } as PostLevelOptions);
    const { x, y } = coordinates[0];
    const from = Math.min(Math.max(0, x), bounding.width);
    const figures: OverlayFigure[] = [];
    if (from > 0)
      figures.push(
        line(
          [
            { x: 0, y },
            { x: from, y },
          ],
          { color: alpha(o.color, 0.35), size: 1, style: "dashed", dashedValue: [2, 4] },
        ),
      );
    figures.push(
      line(
        [
          { x: from, y },
          { x: bounding.width, y },
        ],
        { color: o.color, size: 1, style: "dashed", dashedValue: [5, 3] },
      ),
      label(8, y - 2, o.text, {
        color: o.color,
        background: alpha(o.color, 0.12),
        borderColor: alpha(o.color, 0.6),
        baseline: "bottom",
        padding: 2,
        size: 10,
      }),
    );
    return figures;
  },
  { needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false },
);

export const TRADING_OVERLAYS: OverlayTemplate[] = [
  priceTagLine("alertLine"),
  priceTagLine("orderLine"),
  holdingLine,
  gridLine,
  fillMark,
  postMarks,
  postLevel,
];
