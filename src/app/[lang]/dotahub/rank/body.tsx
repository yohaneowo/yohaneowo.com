import type { Dictionary } from "@/i18n/dictionaries";
import { getHeroes, getPlayer, getRankDistribution, getRankedIndex, type RankedEntry } from "@/lib/dota/data";
import { ALL_BRACKETS, DEFAULT_MATCHUP_WEEKS } from "@/lib/dota/matchup-range";
import { bracketOf, getHeroMatchups, getStratzProfile } from "@/lib/dota/stratz";
import type { DeathsSource } from "../deaths/deaths-view";
import { Medal, medalName, Notice } from "../parts";
import { BracketWinRateChart, DistributionChart, RankTrendChart } from "./charts";
import { aroundOwn, byMedal, loadMatchups, rankPoints, topHeroes } from "./load";
import { HeroMatchups, type InitialMatchups } from "./matchups";
import { WorstOpponents } from "./worst-opponents";

type T = Dictionary["dotahub"];

const MIN_TREND_POINTS = 10;

// The 段位 page: the rank among everyone, the matches' average rank over time and by bracket, and
// the bracket's hero matchups beside the player's own.
export async function RankBody({ t, accountId, source }: { t: T; accountId: number; source: DeathsSource }) {
  const r = t.rankPage;
  const [player, index, distribution, heroes, matchups] = await Promise.all([
    getPlayer(accountId).catch(() => null),
    getRankedIndex(accountId).catch(() => ({}) as Record<number, RankedEntry>),
    getRankDistribution().catch(() => null),
    getHeroes(),
    loadMatchups(source, accountId).catch(() => null),
  ]);
  let tier = player?.data.rank_tier ?? null;
  if (tier == null) tier = (await getStratzProfile(accountId).catch(() => null))?.tier ?? null;
  const leaderboard = player?.data.leaderboard_rank ?? null;
  const ownMedal = tier ? Math.floor(tier / 10) : null;

  const points = rankPoints(index);
  const medals = byMedal(points);
  const around = aroundOwn(points, tier);
  // Where the player sits among everyone ranked: the share below their tier.
  const below =
    distribution && tier
      ? distribution.rows
          .filter((row) => row.tier < tier)
          .reduce((max, row) => Math.max(max, row.cumulative), 0) / distribution.total
      : null;

  const top = matchups ? topHeroes(matchups) : [];
  // The first hero's matchups at the player's own bracket (every bracket for the unranked) come
  // with the page; the rest load as they're picked.
  const ownBracket = bracketOf(tier);
  const initial: InitialMatchups | null = top[0]
    ? {
        hero: top[0],
        bracket: ownBracket ?? ALL_BRACKETS,
        weeks: DEFAULT_MATCHUP_WEEKS,
        rows: await getHeroMatchups(top[0], ownBracket ?? ALL_BRACKETS, DEFAULT_MATCHUP_WEEKS).catch(
          () => null,
        ),
      }
    : null;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center gap-4 rounded-xl border p-4">
        <Medal tier={tier} t={t} size={72} />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{r.current}</span>
          <span className="text-xl font-semibold">{tier ? medalName(tier, t) : r.unranked}</span>
          {leaderboard ? (
            <span className="text-sm text-muted-foreground">{r.leaderboard(leaderboard)}</span>
          ) : null}
          {below != null && (
            <span className="text-sm text-muted-foreground">{r.percentile(Math.round(below * 100))}</span>
          )}
        </div>
      </section>

      {distribution && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{r.distribution}</h2>
          <DistributionChart rows={distribution.rows} total={distribution.total} tier={tier} />
          <p className="text-xs text-muted-foreground">{r.distributionHint}</p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{r.trend}</h2>
        {points.length >= MIN_TREND_POINTS ? (
          <>
            <RankTrendChart points={points} />
            <p className="text-xs text-muted-foreground">{r.trendHint}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{r.trendTooFew}</p>
        )}
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{r.byBracket}</h2>
          {medals.length ? (
            <>
              <BracketWinRateChart rows={medals} own={ownMedal} />
              {around && (
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  {(["above", "same", "below"] as const).map((key) => {
                    const rec = around[key];
                    return (
                      <div key={key} className="rounded-lg border p-2">
                        <dt className="text-xs text-muted-foreground">{r[key]}</dt>
                        <dd className="text-lg font-semibold tabular-nums">
                          {rec.g ? `${Math.round((100 * rec.w) / rec.g)}%` : "–"}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {r.games(rec.g)}
                          </span>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
              <p className="text-xs text-muted-foreground">{r.byBracketHint}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{r.noBracketData}</p>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{r.overall}</h2>
          {matchups ? (
            <WorstOpponents heroes={heroes} overall={matchups.overall} />
          ) : (
            <p className="text-sm text-muted-foreground">{r.noHeroes}</p>
          )}
          <p className="text-xs text-muted-foreground">{r.overallHint}</p>
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{r.matchups}</h2>
        {matchups ? (
          <HeroMatchups
            heroes={heroes}
            ownBracket={ownBracket}
            top={top.map((hero) => ({ hero, games: matchups.heroGames[hero] ?? 0 }))}
            initial={initial}
            mine={matchups}
            accountId={matchups.source === "opendota" ? accountId : null}
          />
        ) : (
          <Notice>{r.noHeroes}</Notice>
        )}
      </section>
    </div>
  );
}
