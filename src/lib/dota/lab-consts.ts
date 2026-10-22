import "server-only";
import { cacheLife } from "next/cache";
import { getJson } from "./data";
import { stratzQuery } from "./stratz";

// The game's constants the lab reads beyond names and pictures (OpenDota's constants): item
// cooldowns, components and charges; each ability's cooldown and mana cost by level, damage type
// and targeting; which talents sit in which tier; permanent buff names; command names; patch names;
// chat wheel phrases; the unit names behind STRATZ's npc ids.
// All of it changes only with patches, so it's kept for days, reduced to what the lab uses.

const OPENDOTA = "https://api.opendota.com/api";

export type ItemMeta = {
  cost: number;
  cd: number | null;
  components: string[];
  consumable: boolean;
  // Has an active use (a cooldown and no 'passive only' label).
  active: boolean;
  // A neutral item's tier (1–5), else null.
  tier: number | null;
};

export type AbilityMeta = {
  cd: number[];
  mc: number[];
  // Deals damage (has a damage type), so its use rate can be read as a nuke's.
  damaging: boolean;
  // Targets enemies, allies or both ('Enemy', 'Friendly'…), as OpenDota writes it.
  targetTeam: string | null;
  passive: boolean;
};

export type LabConsts = {
  items: Record<string, ItemMeta>;
  abilities: Record<string, AbilityMeta>;
  // Hero unit name (npc_dota_hero_antimage) → its abilities in slot order and talents with their
  // tier (1 = level 10 … 4 = level 25).
  heroes: Record<string, { abilities: string[]; talents: { key: string; tier: number }[] }>;
  permanentBuffs: Record<string, string>;
  orders: Record<string, string>;
  patches: Record<string, { name: string; date: string }>;
  // Chat wheel id → its phrase (English; the game's own text).
  chatWheel: Record<string, string>;
  // STRATZ npc id → unit name (npc_dota_neutral_froglet…).
  npcs: Record<string, string>;
};

const numbers = (v: unknown): number[] =>
  (Array.isArray(v) ? v : v == null ? [] : String(v).split(/\s+/))
    .map(Number)
    .filter((n) => Number.isFinite(n));

export async function getLabConsts(): Promise<LabConsts> {
  "use cache";
  cacheLife("days");
  type RawItem = {
    id: number;
    cost: number | null;
    cd?: number | false | null;
    components?: string[] | null;
    qual?: string;
    abilities?: { type: string }[];
    tier?: number | null;
  };
  type RawAbility = {
    cd?: string | string[] | number;
    mc?: string | string[] | number;
    dmg_type?: string;
    target_team?: string | string[];
    behavior?: string | string[];
  };
  const empty = <T>() => ({}) as T;
  type RawWheel = { name?: string; label?: string; message?: string };
  const [items, abilities, heroAbilities, buffs, orders, patches, wheel, npcs] = await Promise.all([
    getJson<Record<string, RawItem>>(`${OPENDOTA}/constants/items`).catch(() =>
      empty<Record<string, RawItem>>(),
    ),
    getJson<Record<string, RawAbility>>(`${OPENDOTA}/constants/abilities`).catch(() =>
      empty<Record<string, RawAbility>>(),
    ),
    getJson<Record<string, { abilities: string[]; talents: { name: string; level: number }[] }>>(
      `${OPENDOTA}/constants/hero_abilities`,
    ).catch(() =>
      empty<Record<string, { abilities: string[]; talents: { name: string; level: number }[] }>>(),
    ),
    getJson<Record<string, string>>(`${OPENDOTA}/constants/permanent_buffs`).catch(() =>
      empty<Record<string, string>>(),
    ),
    getJson<Record<string, string>>(`${OPENDOTA}/constants/order_types`).catch(() =>
      empty<Record<string, string>>(),
    ),
    getJson<{ id: number; name: string; date: string }[]>(`${OPENDOTA}/constants/patch`).catch(
      () => [] as { id: number; name: string; date: string }[],
    ),
    getJson<Record<string, RawWheel>>(`${OPENDOTA}/constants/chat_wheel`).catch(() =>
      empty<Record<string, RawWheel>>(),
    ),
    stratzQuery<{ constants: { npcs: { id: number; name: string | null }[] | null } | null }>(
      "{ constants { npcs { id name } } }",
      20_000,
    ).catch(() => null),
  ]);
  // Some phrases only carry a localisation key ('dota_chatwheel_message_MissingHero'): the name,
  // split into words, stands in.
  const phrase = (w: RawWheel) =>
    [w.message, w.label].find((x) => x && !x.startsWith("dota_")) ??
    (w.name ?? "").replace(/([a-z])([A-Z])/g, "$1 $2");
  return {
    items: Object.fromEntries(
      Object.entries(items).map(([key, it]) => [
        key,
        {
          cost: it.cost ?? 0,
          cd: typeof it.cd === "number" && it.cd > 0 ? it.cd : null,
          components: it.components ?? [],
          consumable: it.qual === "consumable",
          active:
            (it.abilities ?? []).some((a) => a.type === "active") || (typeof it.cd === "number" && it.cd > 0),
          tier: typeof it.tier === "number" ? it.tier : null,
        },
      ]),
    ),
    abilities: Object.fromEntries(
      Object.entries(abilities).map(([key, ab]) => {
        const behavior = Array.isArray(ab.behavior) ? ab.behavior : ab.behavior ? [ab.behavior] : [];
        return [
          key,
          {
            cd: numbers(ab.cd).filter((n) => n > 0),
            mc: numbers(ab.mc),
            damaging: !!ab.dmg_type,
            targetTeam: Array.isArray(ab.target_team) ? ab.target_team.join(",") : (ab.target_team ?? null),
            passive: behavior.includes("Passive"),
          },
        ];
      }),
    ),
    heroes: Object.fromEntries(
      Object.entries(heroAbilities).map(([hero, h]) => [
        hero,
        {
          abilities: (h.abilities ?? []).filter((a) => a !== "generic_hidden"),
          talents: (h.talents ?? []).map((x) => ({ key: x.name, tier: x.level })),
        },
      ]),
    ),
    permanentBuffs: buffs,
    orders,
    patches: Object.fromEntries(patches.map((p) => [String(p.id), { name: p.name, date: p.date }])),
    npcs: Object.fromEntries(
      (npcs?.constants?.npcs ?? []).filter((n) => n.name).map((n) => [String(n.id), n.name!]),
    ),
    chatWheel: Object.fromEntries(
      Object.entries(wheel)
        .map(([id, w]) => [id, phrase(w)] as const)
        .filter(([, text]) => text),
    ),
  };
}
