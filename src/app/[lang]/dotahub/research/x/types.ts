import type { ComponentType } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { LabAssets, LabSide } from "@/lib/dota/lab";
import type { Metric } from "../insights";

// The contract for 局内科研's analysis modules (one file per theme under x/): each adds blocks to
// sections, sentences to their one-line readings, lines for the top summary, rows for the 'biggest
// differences' table, and gold-valued lessons for 'what to fix'. lab-view.tsx gathers them all.

export type R = Dictionary["dotahub"]["research"];

export type Names = {
  items: (key: string) => string;
  abilities: (key: string) => string;
  heroes: (id: number) => string;
};

export type Ctx = { a: LabSide; b: LabSide | null; assets: LabAssets; t: R; names: Names };

export const SECTIONS = [
  "context",
  "refs",
  "timeline",
  "time",
  "laning",
  "farming",
  "items",
  "skills",
  "fights",
  "damage",
  "vision",
  "movement",
  "objectives",
  "decisions",
  "resources",
  "gold",
  "misc",
] as const;
export type SectionKey = (typeof SECTIONS)[number];

// Something to fix, valued in gold (or a gold equivalent) so the list can be ranked.
export type Lesson = { side: "a" | "b"; text: string; gold: number };

export type LabModule = {
  // Blocks shown at the end of a section, in this order (each reads useLab()).
  blocks: Partial<Record<SectionKey, ComponentType>>;
  // Sentences appended to a section's one-line reading.
  insights?: (ctx: Ctx) => Partial<Record<SectionKey, string[]>>;
  // Candidate lines for the top summary; the heaviest few are shown.
  summary?: (ctx: Ctx) => { text: string; w: number }[];
  // Rows for the 'biggest differences' table.
  metrics?: Metric[];
  lessons?: (ctx: Ctx) => Lesson[];
};
