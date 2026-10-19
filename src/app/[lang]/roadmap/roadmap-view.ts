import type { RoadmapArea, RoadmapItem, RoadmapStatus } from "@/lib/roadmap";

// A roadmap item in one language, as the pages and their client parts use it.
export type ViewItem = {
  id: string;
  status: RoadmapStatus;
  area: RoadmapArea;
  title: string;
  summary: string;
  why: string | null;
  steps: { text: string; done: boolean }[];
  notes: string[];
  links: { label: string; href: string }[];
  reason: string | null;
  added: string;
  started: string | null;
  shipped: string | null;
};

export function viewItem(item: RoadmapItem, lang: "zh" | "en"): ViewItem {
  return {
    id: item.id,
    status: item.status,
    area: item.area,
    title: item.title[lang],
    summary: item.summary[lang],
    why: item.why?.[lang] ?? null,
    steps: (item.steps ?? []).map((s) => ({ text: s.text[lang], done: s.done })),
    notes: (item.notes ?? []).map((n) => n[lang]),
    links: (item.links ?? []).map((l) => ({ label: l.label[lang], href: l.href })),
    reason: item.reason?.[lang] ?? null,
    added: item.added,
    started: item.started ?? null,
    shipped: item.shipped ?? null,
  };
}

// Each area's color (lines, nodes, dots; text stays in the text colors).
export const AREA_COLOR: Record<RoadmapArea, string> = {
  moviehub: "#d4a72c",
  bot: "#6b7cff",
  admin: "#38a3c9",
  coinhub: "#e8793a",
  uidhub: "#d65fa0",
  site: "#2fb388",
};
