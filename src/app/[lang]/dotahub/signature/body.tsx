import Link from "next/link";
import { connection } from "next/server";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getHeroes, getPlayer, type HeroInfo } from "@/lib/dota/data";
import { type Signature, signatures, type SignatureLabel } from "@/lib/dota/signature";
import { getGoatScene } from "@/lib/dota/goat";
import { getHeroLevels, getPracticeHistory, getRankedHistory, getStratzProfile } from "@/lib/dota/stratz";
import { cn } from "@/lib/utils";
import { HeroImage, Notice, PlusBadge } from "../parts";
import { LabelPillars } from "./label-pillars";
import { HeroLeaderboard } from "./leaderboard";

type T = Dictionary["dotahub"];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const points = (v: number) => (Math.round(v) > 0 ? `+${Math.round(v)}` : String(Math.round(v)));
const month = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 7);
const day = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);
// The start of the recent window (the report's 180 days).
const recentFrom = () => Date.now() / 1000 - 180 * 86400;

const BADGE: Record<SignatureLabel, string> = {
  current: "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  historic: "border-foreground/30 bg-muted text-foreground",
  potential: "border-sky-500/60 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  skilled: "border-border text-muted-foreground",
  frequent: "border-border text-muted-foreground",
};

// Why a hero made it, in words: each path's probability, the half-years, and how it's going lately.
function evidence(s: Signature, t: T["signature"]) {
  const parts: string[] = [];
  if (s.paths.includes("advantage")) {
    const best = Math.max(s.winProbability ?? 0, s.impProbability ?? 0);
    parts.push(
      t.advantageEvidence(
        Math.round(best * 100),
        (s.impProbability ?? 0) >= (s.winProbability ?? 0) ? t.byImp : t.byWinRate,
      ),
    );
  }
  if (s.paths.includes("mastery") && s.masteryProbability != null)
    parts.push(
      t.masteryEvidence(Math.round(s.masteryProbability * 100), s.windows.positive, s.windows.total),
    );
  if (!s.paths.length) parts.push(t.noEvidence);
  return parts.join(" · ");
}

function Card({
  s,
  heroes,
  t,
  dict,
  lang,
  positions,
  level,
}: {
  s: Signature;
  heroes: Record<number, HeroInfo>;
  t: T["signature"];
  dict: T;
  lang: Locale;
  positions: string[];
  // The player's Dota Plus level on the hero, if any.
  level: number | undefined;
}) {
  return (
    <div className="relative flex flex-col gap-3 rounded-xl border p-3">
      {level ? (
        <div className="absolute -top-4 -right-3">
          <PlusBadge level={level} t={dict} size={76} fontSize={19} />
        </div>
      ) : null}
      <div className={cn("flex items-start gap-3", level && "pr-16")}>
        <span data-sig-hero className="shrink-0">
          <HeroImage hero={heroes[s.hero]} lang={lang} className="h-12 w-20 rounded" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{heroes[s.hero]?.[lang] ?? s.hero}</span>
            <span className="text-xs text-muted-foreground">
              {s.pos ? positions[s.pos - 1] : t.unknownPosition}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", BADGE[s.label])}>
              {t.labels[s.label]}
            </span>
            {s.paths.map((p) => (
              <span key={p} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                {t.paths[p]}
              </span>
            ))}
            {s.trend && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-[11px]",
                  s.trend === "up"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {s.trend === "up" ? (
                  <ArrowUpRightIcon className="size-3" aria-hidden />
                ) : (
                  <ArrowDownRightIcon className="size-3" aria-hidden />
                )}
                {t.trend[s.trend]}
              </span>
            )}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[11px] text-muted-foreground">{t.matches}</dt>
          <dd className="font-semibold tabular-nums">{s.matches}</dd>
          <dd className="text-[11px] text-muted-foreground">{t.recentMatches(s.recent.matches)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">{t.winRate}</dt>
          <dd className="font-semibold tabular-nums">{pct(s.winRate)}</dd>
          <dd className="text-[11px] text-muted-foreground">
            {s.baselineWinRate != null ? t.versus(pct(s.baselineWinRate)) : "–"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">{t.imp}</dt>
          <dd className="font-semibold tabular-nums">{s.imp ? points(s.imp.mean) : "–"}</dd>
          <dd className="text-[11px] text-muted-foreground">
            {s.baselineImp != null ? t.versus(points(s.baselineImp)) : "–"}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">{evidence(s, t)}</p>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{t.span(month(s.first), month(s.last))}</span>
        <Link
          href={`?hero=${s.hero}#leaderboard`}
          scroll={false}
          className="hover:text-foreground hover:underline"
        >
          {t.toLeaderboard}
        </Link>
      </div>
    </div>
  );
}

// The 绝活 page for a player: their signature heroes (with the evidence), the heroes they play a
// lot without it (高熟练), and any hero's leaderboard at a rank.
export async function SignatureBody({
  t,
  lang,
  accountId,
  own,
  hero,
}: {
  t: T;
  lang: Locale;
  accountId: number;
  own: boolean;
  hero: number | null;
}) {
  // The report counts "recent" from now, so this renders per request.
  await connection();
  let history, heroes, levels: Record<number, number>;
  try {
    [history, heroes, levels] = await Promise.all([
      getRankedHistory(accountId),
      getHeroes(),
      getHeroLevels(accountId).catch(() => ({})),
    ]);
  } catch {
    return <Notice>{t.unavailable}</Notice>;
  }
  const [practice, scene] = await Promise.all([
    getPracticeHistory(accountId).catch(() => []),
    getGoatScene().catch(() => null),
  ]);
  const report = signatures(history);
  const since = recentFrom();
  // No ranked match in the recent window at all: everything is historic, so say why (and, for a pro,
  // where they play instead).
  const lastRanked = history.length ? Math.max(...history.map((m) => m.start)) : null;
  const pro = scene?.players.find((p) => p.accounts.some((a) => a.accountId === accountId));
  const proTeam = pro?.teamId ? scene?.teams.find((x) => x.id === pro.teamId) : undefined;
  // Practice lobby captains mode per hero: matches, wins, mean IMP (where STRATZ has it), recent.
  const practiceRows = [...new Set(practice.map((m) => m.hero))]
    .map((id) => {
      const ms = practice.filter((m) => m.hero === id);
      const imps = ms.filter((m) => m.imp != null).map((m) => m.imp!);
      return {
        hero: id,
        matches: ms.length,
        wins: ms.filter((m) => m.won).length,
        imp: imps.length ? imps.reduce((a, b) => a + b, 0) / imps.length : null,
        recent: ms.filter((m) => m.start >= since).length,
      };
    })
    .sort((a, b) => b.matches - a.matches);
  const found = report.signatures.filter((s) => ["current", "historic", "potential"].includes(s.label));
  const skilled = report.signatures.filter((s) => s.label === "skilled" || s.label === "frequent");
  const s = t.signature;
  const positions = t.stats.positions;

  // The player's rank (for the leaderboard's default) and their recent matches per hero.
  const player = await getPlayer(accountId).catch(() => null);
  const tier = player?.data.rank_tier ?? (await getStratzProfile(accountId).catch(() => null))?.tier ?? null;
  const byHero = new Map<number, number[]>();
  const counts = new Map<number, number>();
  for (const m of history) {
    counts.set(m.hero, (counts.get(m.hero) ?? 0) + 1);
    if (m.imp != null && (byHero.get(m.hero)?.length ?? 0) < 25)
      byHero.set(m.hero, [...(byHero.get(m.hero) ?? []), m.imp]);
  }
  const recentImp = Object.fromEntries(
    [...byHero.entries()].map(([id, imps]) => [
      id,
      { matches: imps.length, imp: imps.reduce((a, b) => a + b, 0) / imps.length },
    ]),
  );
  const firstHero = hero ?? found[0]?.hero ?? [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1;

  return (
    <div className="flex flex-col gap-8">
      {lastRanked && lastRanked < since && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
          <p>{s.noRecentRanked(day(lastRanked))}</p>
          {pro && (
            <p className="mt-1 text-muted-foreground">
              {s.proElsewhere(pro.name, proTeam?.name ?? null)}{" "}
              <Link
                href={localePath(
                  lang,
                  proTeam ? `/dotahub/goat/teams/${proTeam.id}` : "/dotahub/goat/players",
                )}
                className="text-foreground underline underline-offset-2"
              >
                {s.toGoat}
              </Link>
            </p>
          )}
        </div>
      )}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-medium">{s.found}</h2>
          <p className="text-xs text-muted-foreground">{s.foundHint}</p>
        </div>
        {found.length ? (
          <LabelPillars
            groups={(["historic", "current", "potential"] as const).map((label) => ({
              key: label,
              name: s.labels[label],
              art: [...new Set(found.filter((x) => x.label === label).map((x) => x.hero))]
                .filter((id) => heroes[id])
                .slice(0, 4)
                .map((id) => ({
                  id,
                  name: heroes[id][lang],
                  // Cached hero lists from before the render field fall back to the small picture.
                  render: heroes[id].render ?? heroes[id].img,
                  attr: heroes[id].attr,
                })),
              cast: found
                .filter((x) => x.label === label)
                .map((x) => ({
                  name: heroes[x.hero]?.[lang] ?? String(x.hero),
                  render: heroes[x.hero]?.render ?? heroes[x.hero]?.img ?? "",
                })),
              cards: found
                .filter((x) => x.label === label)
                .map((x) => (
                  <Card
                    key={`${x.hero}-${x.pos}`}
                    s={x}
                    heroes={heroes}
                    t={s}
                    dict={t}
                    lang={lang}
                    positions={positions}
                    level={levels[x.hero]}
                  />
                )),
            }))}
          />
        ) : (
          <p className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">{s.none}</p>
        )}
      </section>

      {practice.length >= 20 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-medium">{s.practiceTitle}</h2>
            <p className="text-xs text-muted-foreground">
              {s.practiceHint(practice.length, day(Math.min(...practice.map((m) => m.start))))}
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2 font-normal">{s.hero}</th>
                  <th className="px-3 py-2 text-right font-normal">{s.matches}</th>
                  <th className="px-3 py-2 text-right font-normal">{s.practiceRecent}</th>
                  <th className="px-3 py-2 text-right font-normal">{s.winRate}</th>
                  <th className="px-3 py-2 text-right font-normal">{s.imp}</th>
                </tr>
              </thead>
              <tbody>
                {practiceRows.slice(0, 12).map((r) => (
                  <tr key={r.hero} className="border-b last:border-0">
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-2">
                        <HeroImage hero={heroes[r.hero]} lang={lang} className="h-6 w-10 rounded-sm" />
                        {heroes[r.hero]?.[lang] ?? r.hero}
                        {found.some((x) => x.hero === r.hero) && (
                          <span className="rounded-full border border-amber-500/50 px-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                            {s.alsoRanked}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.matches}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">{r.recent}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{pct(r.wins / r.matches)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.imp == null ? "–" : points(r.imp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {skilled.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-medium">{s.skilledTitle}</h2>
            <p className="text-xs text-muted-foreground">{s.skilledHint}</p>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <tbody>
                {skilled.map((x) => (
                  <tr key={`${x.hero}-${x.pos}`} className="border-b last:border-0">
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-2">
                        <HeroImage hero={heroes[x.hero]} lang={lang} className="h-6 w-10 rounded-sm" />
                        {heroes[x.hero]?.[lang] ?? x.hero}
                        {levels[x.hero] ? <PlusBadge level={levels[x.hero]} t={t} size={16} /> : null}
                        <span className="text-xs text-muted-foreground">
                          {x.pos ? positions[x.pos - 1] : s.unknownPosition}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{s.labels[x.label]}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{x.matches}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{pct(x.winRate)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {x.imp ? points(x.imp.mean) : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section id="leaderboard" className="flex scroll-mt-28 flex-col gap-3">
        <div>
          <h2 className="font-medium">{s.leaderboard}</h2>
          <p className="text-xs text-muted-foreground">{s.leaderboardHint}</p>
        </div>
        <HeroLeaderboard
          key={firstHero}
          heroes={heroes}
          hero={firstHero}
          tier={tier}
          counts={[...counts.entries()]}
          accountId={accountId}
          recentImp={recentImp}
          levels={levels}
          comparePath={localePath(lang, own ? "/dotahub/economy" : `/dotahub/players/${accountId}/economy`)}
          own={own}
        />
      </section>

      <p className="text-xs text-muted-foreground">
        {s.coverage(
          report.coverage.matches,
          report.coverage.since ? month(report.coverage.since) : "–",
          pct(report.coverage.withImp / Math.max(1, report.coverage.matches)),
        )}{" "}
        {s.method}
      </p>
    </div>
  );
}
