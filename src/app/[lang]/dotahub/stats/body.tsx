import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { getItemCosts, getItems, getPeers, getPlayer, isKeyItem } from "@/lib/dota/data";
import { getRankAverages, getStratzProfile } from "@/lib/dota/stratz";
import type { DeathsSource } from "../deaths/deaths-view";
import type { CompareProps } from "../economy/compare/compare-menu";
import { CompareView } from "../economy/compare/compare-view";
import {
  CROWD_COLORS,
  MAX_TARGETS,
  ME_COLOR,
  parseRankKey,
  PLAYER_COLORS,
  type Series,
} from "../economy/compare/series";
import { EconomyExplorer, type KeyItem } from "../economy/economy-explorer";
import { ImpCompareView } from "../imp/compare-view";
import { ImpExplorer } from "../imp/imp-explorer";
import { Notice } from "../parts";
import { bracketVolatility, loadBracket, loadDetailMatches, loadRank } from "./load";
import { getGoatScene } from "@/lib/dota/goat";
import { sourceOf } from "../source";

const BRACKET_HEROES = 8;
const PEER_SUGGESTIONS = 12;

// Name, avatar and rank tier: OpenDota's profile, STRATZ's when OpenDota is down.
async function profileOf(accountId: number) {
  const [player, scene] = await Promise.all([
    getPlayer(accountId).catch(() => null),
    getGoatScene().catch(() => null),
  ]);
  const profile = player?.data.profile;
  const fallback = profile?.personaname ? null : await getStratzProfile(accountId).catch(() => null);
  // A pro by the name they play under (Batyuk, not their Steam name).
  const pro = scene?.players.find((p) => p.accounts.some((a) => a.accountId === accountId));
  return {
    name: pro?.name || profile?.personaname || fallback?.name || String(accountId),
    avatar: profile?.avatarfull ?? fallback?.avatar ?? null,
    tier: player?.data.rank_tier ?? fallback?.tier ?? null,
  };
}

// Who ?vs= asks for: up to two of other accounts, 我的对局 ("bracket", only for a player linked
// here, whose matches' other players are stored) and a hero at a rank tier ("r5h31").
function parseVs(vs: string | undefined, accountId: number, bracketAvailable: boolean) {
  const out: string[] = [];
  for (const part of (vs ?? "").split(",")) {
    if (out.length >= MAX_TARGETS || out.includes(part)) continue;
    const id = Number(part);
    if (
      (part === "bracket" && bracketAvailable) ||
      parseRankKey(part) ||
      (Number.isSafeInteger(id) && id > 0 && id < 2 ** 32 && id !== accountId)
    )
      out.push(part);
  }
  return out;
}

// The position the player plays the hero most (where a rank starts its position filter), if any.
function mainPosition(matches: { heroId: number; details: { pos: number | null } }[], heroId: number) {
  const counts = new Map<number, number>();
  for (const m of matches)
    if (m.heroId === heroId && m.details.pos) counts.set(m.details.pos, (counts.get(m.details.pos) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// The 经济 or IMP page's content for a player: loads their matches with details and hands them to
// the page's explorer. A player linked here has every stored match (with "all"); anyone else the
// newest 100 from STRATZ. Both pages can compare (?vs=): other players, 我的对局 and a hero's
// players at a rank tier (the IMP page without STRATZ's rank averages: they have no IMP).
export async function StatsBody({
  kind,
  source,
  accountId,
  vs,
  own = false,
}: {
  kind: "imp" | "economy";
  source: DeathsSource;
  accountId: number;
  vs?: string;
  own?: boolean;
}) {
  const lang = await getLocale();
  const dict = await getDictionary();
  const t = dict.dotahub;
  const [data, itemInfo, costs] = await Promise.all([
    loadDetailMatches(source, accountId).catch(() => null),
    kind === "economy" ? getItems().catch(() => null) : null,
    kind === "economy" ? getItemCosts().catch(() => null) : null,
  ]);
  if (!data) return <Notice>{t.stats.unavailable}</Notice>;
  const ranges = source.kind === "stratz" ? [20, 50, 100] : [20, 50, 100, 0];
  const matchHref = localePath(lang, "/dotahub/matches");
  // A guest or a STRATZ-only player says where the matches come from in the 读取全部 banner above
  // (how far the reading has got, or the newest 100), so not again here.
  const note = !data.complete && source.kind === "stored" ? t.stats.history : null;

  // The key items any shown match bought (the compared players' included), for the client.
  const items: Record<number, KeyItem> = {};
  const addItem = (id: number) => {
    if (!(id in items) && itemInfo?.[id] && isKeyItem(costs?.[id]))
      items[id] = { name: itemInfo[id][lang], img: itemInfo[id].img };
  };
  const addItems = (matches: { details: { items: [number, number][] } }[]) => {
    for (const m of matches) for (const [, id] of m.details.items) addItem(id);
  };
  addItems(data.matches);

  const bracketAvailable = source.kind === "stored";
  const wanted = parseVs(vs, accountId, bracketAvailable);
  const path = localePath(lang, own ? `/dotahub/${kind}` : `/dotahub/players/${accountId}/${kind}`);
  const heroName = (id: number) => data.heroes[id]?.[lang] ?? String(id);
  const playerKeys = wanted.filter((k) => k !== "bracket" && !parseRankKey(k));
  const crowdKeys = wanted.filter((k) => k === "bracket" || parseRankKey(k));

  const [meProfile, peers, targets] = await Promise.all([
    profileOf(accountId),
    getPeers(accountId)
      .then((list) =>
        list
          .filter((p) => p.with_games >= 3)
          .sort((a, b) => b.with_games - a.with_games)
          .slice(0, PEER_SUGGESTIONS)
          .map((p) => ({
            id: p.account_id,
            name: p.personaname || String(p.account_id),
            avatar: p.avatarfull,
            games: p.with_games,
          })),
      )
      .catch(() => []),
    Promise.all(
      wanted.map(async (key): Promise<Series | null> => {
        const crowdColor = CROWD_COLORS[crowdKeys.indexOf(key)];
        if (key === "bracket") {
          const bracket =
            source.kind === "stored" ? await loadBracket(source.userId).catch(() => null) : null;
          return bracket
            ? {
                key,
                kind: "bracket",
                label: t.compare.mine,
                color: crowdColor,
                matches: bracket.matches,
                sides: {},
              }
            : null;
        }
        const rank = parseRankKey(key);
        if (rank) {
          const [sample, averageSet] = await Promise.all([
            loadRank(rank.heroId, rank.tier).catch(() => null),
            kind === "economy" ? getRankAverages(rank.heroId, rank.tier).catch(() => null) : null,
          ]);
          if (!sample && !averageSet) return null;
          return {
            key,
            kind: "rank",
            label: t.compare.rankLabel(t.medals[rank.tier], heroName(rank.heroId), null),
            color: crowdColor,
            matches: sample?.matches ?? [],
            sides: {},
            tier: rank.tier * 10,
            heroId: rank.heroId,
            averageSet,
            position: mainPosition(data.matches, rank.heroId),
            progress: sample?.progress,
            cv: sample?.cv,
          };
        }
        const id = Number(key);
        const { source: otherSource } = await sourceOf(id);
        const [other, profile] = await Promise.all([
          loadDetailMatches(otherSource, id).catch(() => null),
          profileOf(id),
        ]);
        return other
          ? {
              key,
              kind: "player",
              label: profile.name,
              color: PLAYER_COLORS[playerKeys.indexOf(key)],
              matches: other.matches,
              sides: other.sides,
              avatar: profile.avatar,
              history: {
                stored: otherSource.kind !== "stratz",
                complete: other.complete,
                count: other.matches.length,
                accountId: id,
              },
            }
          : null;
      }),
    ),
  ]);
  const others = targets.filter((x): x is Series => x != null);
  for (const x of others) {
    addItems(x.matches);
    for (const set of Object.values(x.averageSet ?? {}))
      for (const id of Object.keys(set?.items ?? {})) addItem(Number(id));
  }

  // The heroes played most, for picking a rank's hero (the first is the default).
  const heroCounts = new Map<number, number>();
  for (const m of data.matches) heroCounts.set(m.heroId, (heroCounts.get(m.heroId) ?? 0) + 1);
  const heroGames = [...heroCounts.entries()].sort((a, b) => b[1] - a[1]);
  const mainHeroes = heroGames.map(([id]) => id);

  const compare: CompareProps = {
    path,
    ownerId: accountId,
    me: { label: own ? t.compare.you : meProfile.name, avatar: meProfile.avatar, tier: meProfile.tier },
    targets: others.map((x) => ({
      key: x.key,
      kind: x.kind,
      label: x.label,
      color: x.color,
      avatar: x.avatar ?? null,
      tier: x.kind === "bracket" ? meProfile.tier : (x.tier ?? null),
      heroId: x.heroId ?? null,
    })),
    peers,
    bracketAvailable,
    myTier: meProfile.tier,
  };

  if (!others.length)
    return (
      <div className="flex flex-col gap-4">
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        {wanted.length > 0 && <p className="text-xs text-muted-foreground">{t.compare.couldNotLoad}</p>}
        {kind === "imp" ? (
          <ImpExplorer
            matches={data.matches}
            sides={data.sides}
            heroes={data.heroes}
            ranges={ranges}
            matchHref={matchHref}
            compare={compare}
          />
        ) : (
          <EconomyExplorer
            matches={data.matches}
            sides={data.sides}
            heroes={data.heroes}
            items={items}
            ranges={ranges}
            matchHref={matchHref}
            compare={compare}
          />
        )}
      </div>
    );

  const series: Series[] = [
    {
      key: "me",
      kind: "me",
      label: own ? t.compare.you : meProfile.name,
      color: ME_COLOR,
      matches: data.matches,
      sides: data.sides,
      avatar: meProfile.avatar,
    },
    ...others,
  ];
  if (kind === "imp")
    return (
      <div className="flex flex-col gap-4">
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        <ImpCompareView series={series} heroes={data.heroes} ranges={ranges} compare={compare} />
      </div>
    );
  // The forest chart's background: other players' volatility per hero. 我的对局: sampled players of
  // the page player's main heroes; a rank: its sampled players of its hero.
  let crowdCv: Record<number, number[]> = {};
  if (others.some((x) => x.kind === "bracket") && source.kind === "stored") {
    const bracket = await loadBracket(source.userId).catch(() => null);
    if (bracket) {
      const exclude = [accountId, ...others.filter((x) => x.kind === "player").map((x) => Number(x.key))];
      crowdCv = await bracketVolatility(mainHeroes.slice(0, BRACKET_HEROES), bracket.accounts, exclude);
    }
  }
  for (const x of others)
    if (x.kind === "rank" && x.heroId && x.cv?.length) crowdCv = { ...crowdCv, [x.heroId]: x.cv };
  const crowd = others.find((x) => x.kind === "rank") ?? others.find((x) => x.kind === "bracket");
  return (
    <div className="flex flex-col gap-4">
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <CompareView
        series={series}
        heroes={data.heroes}
        items={items}
        ranges={ranges}
        crowdCv={crowdCv}
        crowdLabel={crowd?.label ?? ""}
        compare={compare}
      />
    </div>
  );
}
