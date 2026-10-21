import { connection } from "next/server";
import { getDictionary } from "@/i18n/server";
import { getHeroes, getRecentMatches } from "@/lib/dota/data";
import {
  getHeroMatchesOf,
  getHeroProMatches,
  getLabSide,
  type LabAssets,
  labParam,
  type LabResult,
  type LabSuggestion,
} from "@/lib/dota/lab";
import { RequestParse } from "../buttons";
import { Notice } from "../parts";
import { LabView } from "./lab-view";
import { type Chosen, LabPicker } from "./picker";

export type ResearchParams = Promise<{ a?: string | string[]; b?: string | string[] }>;

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
    pa ? getLabSide(pa.matchId, pa.slot).catch(() => null) : null,
    pb ? getLabSide(pb.matchId, pb.slot).catch(() => null) : null,
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
            })),
          )
          .catch(() => [])
      : [],
    accountId && heroA ? getHeroMatchesOf(accountId, heroA) : [],
    heroA ? getHeroProMatches(heroA) : [],
  ]);

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
  };
  return (
    <div className="flex flex-col gap-4">
      <LabPicker
        a={chosen(pa, ra)}
        b={chosen(pb, rb)}
        recent={recent}
        mine={mine.filter((m) => !(pa && m.matchId === pa.matchId))}
        pros={pros}
        heroes={heroes}
        signedIn={signedIn}
      />
      {notices}
      {a && <LabView a={a.side} b={b?.side ?? null} assets={assets} heroes={heroes} />}
    </div>
  );
}
