"use client";

import type { LabSide } from "@/lib/dota/lab";
import type { Metric } from "../insights";
import { ownPercentile } from "./history-calc";
import { ContextBlocks } from "./history-context";
import { RefsBlocks } from "./history-refs";
import { contextInsight, historySummary, refsInsight } from "./history-text";
import type { LabModule } from "./types";

// The player's own history, pro games, experience and the hero's context.

// This game's place among the player's own games on the hero (a percentile, so it is its own
// reference): the difference table can say whose game was the more unusual one for them.
const own = (key: "gpm" | "xpm" | "lhpm") => (s: LabSide) => ownPercentile(s, key)?.pct ?? null;
const itself = (_s: LabSide, v: number) => v;

const metrics: Metric[] = [
  {
    key: "historyOwnGpm",
    fmt: "pct",
    higher: true,
    get: own("gpm"),
    // A support's farm isn't the measure of their game (as for GPM itself).
    dir: (s) => (s.position != null && s.position >= 4 ? null : true),
    pct: itself,
    label: (t) => t.x.history.metricOwnGpm,
  },
  {
    key: "historyOwnXpm",
    fmt: "pct",
    higher: true,
    get: own("xpm"),
    pct: itself,
    label: (t) => t.x.history.metricOwnXpm,
  },
  {
    key: "historyOwnLhpm",
    fmt: "pct",
    higher: true,
    get: own("lhpm"),
    // Last hits are a core's measure.
    dir: (s) => (s.position == null ? null : s.position <= 3 ? true : null),
    pct: itself,
    label: (t) => t.x.history.metricOwnLhpm,
  },
];

export const historyModule: LabModule = {
  blocks: { refs: RefsBlocks, context: ContextBlocks },
  insights: (ctx) => ({ refs: refsInsight(ctx), context: contextInsight(ctx) }),
  summary: historySummary,
  metrics,
};
