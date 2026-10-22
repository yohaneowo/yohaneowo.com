import { connection } from "next/server";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary } from "@/i18n/server";
import { getHeroes, getRecentMatches } from "@/lib/dota/data";
import {
  getHeroMatchesOf,
  getHeroProMatches,
  getLabSide,
  type LabAssets,
  labParam,
  type LabResult,
  type LabSide,
  type LabSuggestion,
} from "@/lib/dota/lab";
import { RequestParse } from "../buttons";
import { Notice } from "../parts";
import { LabView } from "./lab-view";
import { type Chosen, LabPicker } from "./picker";

export type ResearchParams = Promise<{
  a?: string | string[];
  b?: string | string[];
  pa?: string | string[];
  pb?: string | string[];
}>;

// A position override (1–5) from the query, or null.
const positionParam = (v: string | string[] | undefined) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

// The games most worth setting beside A: the same hero, the other result (what went differently),
// a similar length and the same game mode; the player's own games before pros'.
function suggestB(
  a: LabSide,
  own: LabSuggestion[],
  pros: LabSuggestion[],
  why: Dictionary["dotahub"]["research"]["pick"]["why"],
): LabSuggestion[] {
  const score = (c: LabSuggestion, mine: boolean) => {
    let s = mine ? 1 : 0;
    if (c.duration) s += 2 * (1 - Math.min(1, Math.abs(c.duration - a.duration) / a.duration));
    if (c.win != null && c.win !== a.win) s += 1.5;
    if (c.gameMode != null && c.gameMode === a.gameMode) s += 0.5;
    return s;
  };
  const label = (c: LabSuggestion, mine: boolean) =>
    [
      mine ? why.own : (c.label ?? why.pro),
      c.win != null && c.win !== a.win ? (c.win ? why.won : why.lost) : null,
      c.duration ? why.length(Math.round(c.duration / 60)) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  return [...own.map((c) => ({ c, mine: true })), ...pros.map((c) => ({ c, mine: false }))]
    .filter(({ c }) => c.matchId !== a.matchId && c.heroId === a.heroId)
    .map(({ c, mine }) => ({ c: { ...c, label: label(c, mine) }, s: score(c, mine) }))
    .sort((x, y) => y.s - x.s)
    .slice(0, 6)
    .map((x) => x.c);
}

// Development only: with LAB_FIXTURES set to a folder of saved results (side_m_<match>_s_<slot>.json,
// what getLabSide returned), the page reads those instead of asking OpenDota and STRATZ, so it can
// be checked again and again without spending their quotas.
async function labSide(matchId: number, slot: number, position: number | null): Promise<LabResult> {
  const dir = process.env.NODE_ENV === "development" ? process.env.LAB_FIXTURES : undefined;
  if (dir) {
    const { readFile } = await import("node:fs/promises");
    const saved = await readFile(`${dir}/side_m_${matchId}_s_${slot}.json`, "utf8").catch(() => null);
    if (saved) return JSON.parse(saved) as LabResult;
  }
  return getLabSide(matchId, slot, position);
}

function chosen(param: { matchId: number; slot: number } | null, result: LabResult): Chosen {
  if (!param) return null;
  if (result?.state === "ok") return { ...param, heroId: result.side.heroId, name: result.side.name };
  if (result?.state === "unparsed") return { ...param, heroId: result.heroId, name: result.name };
  return { ...param, heroId: null, name: null };
}

// The lab for the chosen matches (?a=<match>-<slot>&b=…), with the picker and suggestions from
// accountId's matches (the viewer's own, or the player whose page this is).
export async function ResearchBody({
  searchParams,
  accountId,
  signedIn,
}: {
  searchParams: ResearchParams;
  accountId: number | null;
  signedIn: boolean;
}) {
  await connection();
  const [dict, sp] = await Promise.all([getDictionary(), searchParams]);
  const t = dict.dotahub.research;
  const pa = labParam(sp.a);
  const pb = labParam(sp.b);
  const [ra, rb, heroes] = await Promise.all([
    pa ? labSide(pa.matchId, pa.slot, positionParam(sp.pa)).catch(() => null) : null,
    pb ? labSide(pb.matchId, pb.slot, positionParam(sp.pb)).catch(() => null) : null,
    getHeroes(),
  ]);
  const heroA = ra?.state === "ok" ? ra.side.heroId : ra?.state === "unparsed" ? ra.heroId : null;
  const [recent, mine, pros] = await Promise.all([
    accountId
      ? getRecentMatches(accountId)
          .then((r) =>
            r.data.map((m): LabSuggestion => ({
              matchId: m.match_id,
              slot: m.player_slot,
              accountId,
              heroId: m.hero_id,
              start: m.start_time,
              win: m.player_slot < 128 === m.radiant_win,
              label: null,
              duration: m.duration,
              gameMode: m.game_mode,
            })),
          )
          .catch(() => [])
      : [],
    accountId && heroA ? getHeroMatchesOf(accountId, heroA) : [],
    heroA ? getHeroProMatches(heroA) : [],
  ]);
  // A's own player's games on the hero (when it isn't the viewer), for the suggested B.
  const sideA = ra?.state === "ok" ? ra.side : null;
  const ofA =
    sideA?.accountId && sideA.accountId !== accountId
      ? await getHeroMatchesOf(sideA.accountId, sideA.heroId).catch(() => [])
      : mine;
  const best = sideA ? suggestB(sideA, ofA, pros, t.pick.why) : [];

  const notices = (
    [
      ["A", pa, ra],
      ["B", pb, rb],
    ] as const
  ).map(([label, param, result]) => {
    if (!param || result?.state === "ok") return null;
    if (result?.state === "unparsed")
      return (
        <Notice key={label}>
          <p className="font-medium text-foreground">{t.unparsed.title(label)}</p>
          <p className="mt-1">{t.unparsed.body}</p>
          <div className="mt-2">
            <RequestParse matchId={param.matchId} />
          </div>
        </Notice>
      );
    if (result?.state === "noPlayer") return <Notice key={label}>{t.unparsed.noPlayer}</Notice>;
    return <Notice key={label}>{t.pick.notFound}</Notice>;
  });

  const a = ra?.state === "ok" ? ra : null;
  const b = rb?.state === "ok" ? rb : null;
  // Both sides' names and pictures together.
  const assets: LabAssets = {
    items: { ...a?.assets.items, ...b?.assets.items },
    abilities: { ...a?.assets.abilities, ...b?.assets.abilities },
    itemMeta: { ...a?.assets.itemMeta, ...b?.assets.itemMeta },
    abilityMeta: { ...a?.assets.abilityMeta, ...b?.assets.abilityMeta },
    talentTier: { ...a?.assets.talentTier, ...b?.assets.talentTier },
    heroAbilities: { ...a?.assets.heroAbilities, ...b?.assets.heroAbilities },
  };
  return (
    <div className="flex flex-col gap-4">
      <LabPicker
        a={chosen(pa, ra)}
        b={chosen(pb, rb)}
        recent={recent}
        mine={mine.filter((m) => !(pa && m.matchId === pa.matchId))}
        pros={pros}
        best={best}
        heroes={heroes}
        signedIn={signedIn}
      />
      {notices}
      {a && <LabView a={a.side} b={b?.side ?? null} assets={assets} heroes={heroes} />}
    </div>
  );
}
