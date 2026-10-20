import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { getItemCosts, getItems, getPeers, getPlayer, isKeyItem } from "@/lib/dota/data";
import { getSteamOwner, steamIdOf } from "@/lib/steam-link";
import type { DeathsSource } from "../deaths/deaths-view";
import { CompareBar } from "../economy/compare/compare-bar";
import { CompareView } from "../economy/compare/compare-view";
import { BRACKET_COLOR, MAX_TARGETS, ME_COLOR, PLAYER_COLORS, type Series } from "../economy/compare/series";
import { EconomyExplorer, type KeyItem } from "../economy/economy-explorer";
import { ImpExplorer } from "../imp/imp-explorer";
import { Notice } from "../parts";
import { bracketVolatility, loadBracket, loadDetailMatches } from "./load";

const BRACKET_HEROES = 8;
const PEER_SUGGESTIONS = 8;

async function playerName(accountId: number) {
  const player = await getPlayer(accountId).catch(() => null);
  return player?.data.profile?.personaname ?? String(accountId);
}

// Who ?vs= asks for: up to two other accounts and / or the bracket (only for a player linked here,
// whose matches' other players are stored).
function parseVs(vs: string | undefined, accountId: number, bracketAvailable: boolean) {
  const out: string[] = [];
  for (const part of (vs ?? "").split(",")) {
    if (out.length >= MAX_TARGETS) break;
    if (part === "bracket" && bracketAvailable && !out.includes(part)) out.push(part);
    const id = Number(part);
    if (Number.isSafeInteger(id) && id > 0 && id < 2 ** 32 && id !== accountId && !out.includes(part))
      out.push(part);
  }
  return out;
}

// The 经济 or IMP page's content for a player: loads their matches with details and hands them to
// the page's explorer. A player linked here has every stored match (with "all"); anyone else the
// newest 100 from STRATZ. The economy page can compare (?vs=): other players and the bracket.
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
  const ranges = source.kind === "stored" ? [20, 50, 100, 0] : [20, 50, 100];
  const matchHref = localePath(lang, "/dotahub/matches");
  const note = !data.complete ? t.stats.history : source.kind === "stratz" ? t.player.stratzRecent : null;

  if (kind === "imp")
    return (
      <div className="flex flex-col gap-4">
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        <ImpExplorer
          matches={data.matches}
          sides={data.sides}
          heroes={data.heroes}
          ranges={ranges}
          matchHref={matchHref}
        />
      </div>
    );

  // The key items any shown match bought (the compared players' included), for the client.
  const items: Record<number, KeyItem> = {};
  const addItems = (matches: { details: { items: [number, number][] } }[]) => {
    for (const m of matches)
      for (const [, id] of m.details.items)
        if (!(id in items) && itemInfo?.[id] && isKeyItem(costs?.[id]))
          items[id] = { name: itemInfo[id][lang], img: itemInfo[id].img };
  };
  addItems(data.matches);

  const bracketAvailable = source.kind === "stored";
  const wanted = parseVs(vs, accountId, bracketAvailable);
  const path = localePath(lang, own ? "/dotahub/economy" : `/dotahub/players/${accountId}/economy`);

  const [meLabel, peers, targets] = await Promise.all([
    own ? Promise.resolve(t.compare.you) : playerName(accountId),
    getPeers(accountId)
      .then((list) =>
        list
          .filter((p) => p.with_games >= 3)
          .sort((a, b) => b.with_games - a.with_games)
          .slice(0, PEER_SUGGESTIONS)
          .map((p) => ({ id: p.account_id, name: p.personaname || String(p.account_id) })),
      )
      .catch(() => []),
    Promise.all(
      wanted.map(async (key, i): Promise<Series | null> => {
        if (key === "bracket") {
          const bracket =
            source.kind === "stored" ? await loadBracket(source.userId).catch(() => null) : null;
          return bracket
            ? {
                key,
                kind: "bracket",
                label: t.compare.bracket,
                color: BRACKET_COLOR,
                matches: bracket.matches,
                sides: {},
              }
            : null;
        }
        const id = Number(key);
        const owner = await getSteamOwner(steamIdOf(id));
        const [other, label] = await Promise.all([
          loadDetailMatches(owner ? { kind: "stored", userId: owner } : { kind: "stratz" }, id).catch(
            () => null,
          ),
          playerName(id),
        ]);
        return other
          ? {
              key,
              kind: "player",
              label,
              color: PLAYER_COLORS[wanted.slice(0, i).filter((k) => k !== "bracket").length],
              matches: other.matches,
              sides: other.sides,
            }
          : null;
      }),
    ),
  ]);
  const others = targets.filter((x): x is Series => x != null);
  for (const x of others) addItems(x.matches);

  const bar = (
    <CompareBar
      path={path}
      ownerId={accountId}
      targets={others.map((x) => ({ key: x.key, label: x.label, color: x.color }))}
      peers={peers}
      bracketAvailable={bracketAvailable}
    />
  );

  if (!others.length)
    return (
      <div className="flex flex-col gap-4">
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        {bar}
        {wanted.length > 0 && <p className="text-xs text-muted-foreground">{t.compare.couldNotLoad}</p>}
        <EconomyExplorer
          matches={data.matches}
          sides={data.sides}
          heroes={data.heroes}
          items={items}
          ranges={ranges}
          matchHref={matchHref}
        />
      </div>
    );

  const series: Series[] = [
    { key: "me", kind: "me", label: meLabel, color: ME_COLOR, matches: data.matches, sides: data.sides },
    ...others,
  ];
  // The forest chart's background: the bracket's sampled players of the page player's main heroes.
  let bracketCv: Record<number, number[]> = {};
  if (others.some((x) => x.kind === "bracket") && source.kind === "stored") {
    const bracket = await loadBracket(source.userId).catch(() => null);
    if (bracket) {
      const counts = new Map<number, number>();
      for (const m of data.matches) counts.set(m.heroId, (counts.get(m.heroId) ?? 0) + 1);
      const main = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, BRACKET_HEROES)
        .map(([id]) => id);
      const exclude = [accountId, ...others.filter((x) => x.kind === "player").map((x) => Number(x.key))];
      bracketCv = await bracketVolatility(main, bracket.accounts, exclude);
    }
  }
  return (
    <div className="flex flex-col gap-4">
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {bar}
      <CompareView series={series} heroes={data.heroes} items={items} ranges={ranges} bracketCv={bracketCv} />
    </div>
  );
}
