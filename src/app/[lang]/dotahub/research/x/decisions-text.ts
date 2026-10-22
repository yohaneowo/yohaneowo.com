import type { LabObjective } from "@/lib/dota/lab-match";
import { buildingName } from "../sections-late";
import type { R } from "./types";

// Labels and number formats for the decisions module.

// npc_dota_badguys_tower2_mid (or tower2_mid) → 中路二塔, melee_rax_top → 上路近战兵营…
export const buildingLabel = (key: string | null | undefined, t: R) => (key ? buildingName(key, t) : "–");

export function objectiveLabel(o: LabObjective, t: R) {
  return o.type === "building" ? buildingLabel(o.key, t) : (t.x.decisions.objectives[o.type] ?? o.type);
}

// Who got it, from a side's view (a courier's side is the one that lost it).
export function objectiveWho(o: LabObjective, radiant: boolean, t: R) {
  const x = t.x.decisions;
  if (o.type === "courier") return o.radiant === radiant ? x.courierTheirs : x.courierOurs;
  return o.radiant === radiant ? x.ours : x.theirs;
}

export const signedPct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v * 100))}%`;
export const signedNum = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v)).toLocaleString()}`;
export const swingFmt = (kind: "win" | "nw", v: number) => (kind === "win" ? signedPct(v) : signedNum(v));
export const tone = (v: number) =>
  v > 0 ? "text-emerald-600 dark:text-emerald-400" : v < 0 ? "text-red-600 dark:text-red-400" : "";
