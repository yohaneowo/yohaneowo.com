"use client";

import { Component, type ReactNode, useCallback, useMemo } from "react";
import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { num, pct } from "../insights";
import {
  AbilityIcon,
  Caveat,
  HeroIcon,
  LineCompare,
  PerSide,
  SIDE_COLOR,
  type SideKey,
  SourceIcon,
  Sub,
  useLab,
  useNames,
  useSides,
  useTimeWindow,
} from "../lab-parts";
import {
  conversion,
  type FightUse,
  fightCasts,
  HERO_METRICS,
  type HeroMetric,
  type HeroValue,
  kindsOf,
  manaCurves,
  manaStats,
  maxOrder,
  stackBuffs,
  talentTiers,
  targetShares,
  topAbilities,
} from "./skills-calc";
import type { R } from "./types";

// The skills section's blocks: how to read the use rates, talents and the build against the rank,
// what the big spells led to, who they went to in each teamfight, mana, hero-specific metrics and
// stacking buffs.

// A block that throws on data it didn't expect is left out rather than breaking the section.
export class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export const Muted = ({ children }: { children: ReactNode }) => (
  <p className="text-xs text-muted-foreground">{children}</p>
);

const mmss = (v: number) => clock(Math.round(v));
const valueText = (v: number, fmt: "pct" | "dec") => (fmt === "pct" ? pct(v) : num(v, 2));

// ── How to read the use rates ────────────────────────────────────────────────────────────────

function ReadingSide({ s }: { s: LabSide }) {
  const { t, assets } = useLab();
  const x = t.x.skills.reading;
  const names = useNames();
  const list = useMemo(() => kindsOf(s, assets), [s, assets]);
  if (!list.length) return <Muted>{t.skills.noTiming}</Muted>;
  return (
    <ul className="flex flex-col gap-1.5 text-xs">
      {(["nuke", "utility", "ult"] as const).map((kind) => {
        const rows = list.filter((r) => r.kind === kind);
        if (!rows.length) return null;
        return (
          <li key={kind} className="flex flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{x.kinds[kind]}</span>
              {rows.map((r) => (
                <span key={r.key} className="flex items-center gap-1">
                  <AbilityIcon k={r.key} size={16} />
                  <span className="max-w-32 truncate">{names.abilities(r.key)}</span>
                  {kind !== "ult" && (
                    <span
                      className={cn(
                        "tabular-nums",
                        r.low ? "font-semibold text-amber-700 dark:text-amber-300" : "text-muted-foreground",
                      )}
                    >
                      {pct(r.ratio)}
                    </span>
                  )}
                </span>
              ))}
            </span>
            <span className="text-muted-foreground">{x.expect[kind]}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ReadingBlock() {
  const { t } = useLab();
  const x = t.x.skills.reading;
  const sides = useSides();
  if (!sides.some(([, s]) => s.skills.learned.length)) return null;
  return (
    <Sub title={x.title} hint={x.hint}>
      <PerSide>{(k, s) => <ReadingSide s={s} />}</PerSide>
    </Sub>
  );
}

// ── Talents ──────────────────────────────────────────────────────────────────────────────────

// The rank the references come from: bracket, position and games.
export const rankRef = (s: LabSide, t: R) => {
  const bl = s.advanced.baseline;
  return bl
    ? t.x.skills.talents.ref(
        t.deep.brackets[bl.bracket] ?? bl.bracket,
        bl.position ? t.deep.position(bl.position) : "",
        bl.matches.toLocaleString(),
      )
    : "";
};

function TalentTable({ side, s }: { side: SideKey; s: LabSide }) {
  const { t, assets, a, b } = useLab();
  const x = t.x.skills.talents;
  const names = useNames();
  const allKeys = !b || a.heroId === b.heroId;
  const tiers = useMemo(() => talentTiers(s, assets, allKeys), [s, assets, allKeys]);
  if (!tiers.length) return <Muted>{t.resources.none}</Muted>;
  const known = s.skills.learned.length > 0;
  return (
    <div className="flex flex-col gap-1">
      {!known && <Muted>{x.none}</Muted>}
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 pr-2 font-normal">{x.level}</th>
            <th className="py-1 font-normal">{x.talent}</th>
            <th className="py-1 text-right font-normal">{x.share}</th>
            <th className="py-1 text-right font-normal">{x.win}</th>
            {known && <th className="py-1 pl-3 font-normal">{x.taken}</th>}
          </tr>
        </thead>
        <tbody>
          {tiers.flatMap((tier) =>
            tier.options.map((o, i) => {
              const picked = tier.pick?.key === o.key;
              const later = tier.later?.key === o.key ? tier.later : null;
              return (
                <tr key={o.key} className={cn(i === tier.options.length - 1 && "border-b last:border-0")}>
                  {i === 0 && (
                    <td
                      rowSpan={tier.options.length}
                      className="py-1 pr-2 align-top text-muted-foreground tabular-nums"
                    >
                      {tier.level}
                    </td>
                  )}
                  <td className={cn("py-1", picked && "font-semibold")}>
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn("inline-block size-2 shrink-0 rounded-full", !picked && "invisible")}
                        style={{ background: SIDE_COLOR[side] }}
                      />
                      <span className="max-w-56 truncate" title={names.abilities(o.key)}>
                        {names.abilities(o.key)}
                      </span>
                    </span>
                  </td>
                  <td className="py-1 text-right tabular-nums">{pct(o.share)}</td>
                  <td className="py-1 text-right tabular-nums">{o.n ? pct((o.w ?? 0) / o.n) : "–"}</td>
                  {known && (
                    <td className="py-1 pl-3 whitespace-nowrap tabular-nums">
                      {picked && tier.pick ? (
                        <>
                          {x.at(clock(tier.pick.t), tier.pick.level)}
                          {o.time != null && (
                            <span className="ml-1 text-muted-foreground">{x.avg(clock(o.time))}</span>
                          )}
                        </>
                      ) : later ? (
                        <span className="text-muted-foreground">{x.later(clock(later.t))}</span>
                      ) : i === 0 && !tier.pick ? (
                        <span className="text-muted-foreground">
                          {tier.reached != null ? x.notTaken(clock(tier.reached)) : x.notReached}
                        </span>
                      ) : null}
                    </td>
                  )}
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TalentBlock() {
  const { t } = useLab();
  const x = t.x.skills.talents;
  const sides = useSides();
  if (!sides.some(([, s]) => s.advanced.baseline?.talents.length || s.skills.learned.some((l) => l.talent)))
    return null;
  const refs = [...new Set(sides.map(([, s]) => rankRef(s, t)).filter(Boolean))];
  return (
    <Sub title={x.title} hint={x.hint}>
      <PerSide>{(k, s) => <TalentTable side={k} s={s} />}</PerSide>
      {refs.length > 0 && <Caveat kind="source">{x.note(refs.join(" · "))}</Caveat>}
    </Sub>
  );
}

// ── Skill build against the rank ─────────────────────────────────────────────────────────────

function BuildTable({ s }: { s: LabSide }) {
  const { t, assets } = useLab();
  const x = t.x.skills.build;
  const names = useNames();
  const rows = useMemo(() => maxOrder(s, assets), [s, assets]);
  if (!rows.length) return <Muted>{x.none}</Muted>;
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-muted-foreground">
        <tr className="border-b">
          <th className="py-1 font-normal">{x.ability}</th>
          <th className="py-1 text-right font-normal">{x.maxed}</th>
          <th className="py-1 text-right font-normal">{x.share}</th>
          <th className="py-1 text-right font-normal">{x.win}</th>
          <th className="py-1 pl-3 text-right font-normal">{x.common}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const full = r.key === s.skills.ult ? 3 : 4;
          return (
            <tr key={r.key} className="border-b last:border-0">
              <td className="py-1">
                <span className="flex items-center gap-1.5">
                  <AbilityIcon k={r.key} size={16} />
                  <span className="max-w-36 truncate">{names.abilities(r.key)}</span>
                </span>
              </td>
              <td className="py-1 text-right tabular-nums">
                {r.maxAt ?? (
                  <span className="text-muted-foreground">
                    {r.points.length > full
                      ? x.points(r.points[0], r.points.length)
                      : x.notMaxed(r.points[0], r.points.length)}
                  </span>
                )}
              </td>
              <td
                className={cn(
                  "py-1 text-right tabular-nums",
                  r.ref && r.ref.share < 0.1 && "font-semibold text-amber-700 dark:text-amber-300",
                )}
              >
                {r.ref ? (
                  <>
                    {pct(r.ref.share, r.ref.share < 0.1 ? 1 : 0)}
                    <span className="ml-1 font-normal text-muted-foreground">{x.rank(r.ref.rank)}</span>
                  </>
                ) : (
                  "–"
                )}
              </td>
              <td className="py-1 text-right tabular-nums">{r.ref ? pct(r.ref.win) : "–"}</td>
              <td className="py-1 pl-3 text-right text-muted-foreground tabular-nums">
                {r.common ? x.atLevel(r.common.level, pct(r.common.share)) : "–"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function BuildBlock() {
  const { t } = useLab();
  const x = t.x.skills.build;
  const sides = useSides();
  if (!sides.some(([, s]) => s.skills.learned.length)) return null;
  return (
    <Sub title={x.title} hint={x.hint}>
      <PerSide>{(k, s) => <BuildTable s={s} />}</PerSide>
      <Caveat kind="source">{x.note}</Caveat>
    </Sub>
  );
}

// ── What the big spells led to ───────────────────────────────────────────────────────────────

function ConversionTable({ s }: { s: LabSide }) {
  const { t, assets } = useLab();
  const x = t.x.skills.conv;
  const names = useNames();
  const [from, to] = useTimeWindow(s);
  const rows = useMemo(() => conversion(s, assets, from, to), [s, assets, from, to]);
  if (!s.skills.useTimes.length) return <Muted>{x.none}</Muted>;
  if (!rows.length) return <Muted>{x.noCasts}</Muted>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal">{x.spell}</th>
            <th className="py-1 text-right font-normal">{x.casts}</th>
            <th className="py-1 text-right font-normal">{x.converted}</th>
            <th className="py-1 text-right font-normal">{x.nobody}</th>
            <th className="py-1 text-right font-normal">{x.perCast}</th>
            <th className="py-1 text-right font-normal">{x.cores}</th>
            <th className="py-1 text-right font-normal">{x.died}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b last:border-0">
              <td className="py-1">
                <span className="flex items-center gap-1.5" title={names.abilities(r.key)}>
                  <AbilityIcon k={r.key} size={16} />
                  <span className="max-w-28 truncate">{names.abilities(r.key)}</span>
                  {r.ult && <span className="shrink-0 text-muted-foreground">{x.ult}</span>}
                </span>
              </td>
              <td className="py-1 text-right tabular-nums">{r.casts}</td>
              <td className="py-1 text-right whitespace-nowrap tabular-nums">
                {r.converted}
                <span className="ml-1 text-muted-foreground">{pct(r.converted / r.casts)}</span>
              </td>
              <td className="py-1 text-right tabular-nums">{r.nobody ?? "–"}</td>
              <td className="py-1 text-right tabular-nums">
                {r.nobody == null && !r.hits ? "–" : num(r.hits / r.casts, 2)}
              </td>
              <td className="py-1 text-right tabular-nums">{r.known ? pct(r.cores / r.known) : "–"}</td>
              <td className="py-1 text-right tabular-nums">{r.hits ? pct(r.died / r.hits) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ConversionBlock() {
  const { t } = useLab();
  const x = t.x.skills.conv;
  const sides = useSides();
  if (!sides.some(([, s]) => s.skills.useTimes.length)) return null;
  return (
    <Sub title={x.title} hint={x.hint}>
      <PerSide>{(k, s) => <ConversionTable s={s} />}</PerSide>
      <Caveat kind="estimate">{x.note}</Caveat>
    </Sub>
  );
}

// ── Who they went to in each teamfight ───────────────────────────────────────────────────────

// Uses grouped by what and on whom, with the count.
function Uses({ list }: { list: FightUse[] }) {
  const groups = new Map<string, { key: string; hero: number; n: number }>();
  for (const u of list) {
    const id = `${u.key}|${u.hero}`;
    const g = groups.get(id);
    if (g) g.n++;
    else groups.set(id, { key: u.key, hero: u.hero, n: 1 });
  }
  if (!groups.size) return <span className="text-muted-foreground">–</span>;
  return (
    <span className="flex max-w-64 flex-wrap gap-x-2 gap-y-0.5">
      {[...groups.entries()].map(([id, g]) => (
        <span key={id} className="flex items-center gap-0.5">
          <SourceIcon k={g.key} size={14} />
          <span className="text-muted-foreground">›</span>
          <HeroIcon id={g.hero} size={14} />
          {g.n > 1 && <span className="text-[9px] tabular-nums">×{g.n}</span>}
        </span>
      ))}
    </span>
  );
}

function FightTargets({ s }: { s: LabSide }) {
  const { t, assets } = useLab();
  const x = t.x.skills.fightTargets;
  const [from, to] = useTimeWindow(s);
  const fights = useMemo(() => fightCasts(s, assets, from, to), [s, assets, from, to]);
  if (!s.parsed.stratz) return <Muted>{x.noStratz}</Muted>;
  const shown = fights.filter((f) => f.enemy.length || f.ally.length);
  if (!shown.length) return <Muted>{x.none}</Muted>;
  const sh = targetShares(s, fights);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs">
        {[sh.known > 0 && x.enemyShare(sh.cores, sh.known), sh.ally > 0 && x.allyShare(sh.ally, sh.allyCores)]
          .filter(Boolean)
          .join(t.x.skills.map.join)}
      </p>
      <div className="max-h-[22rem] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal">{x.time}</th>
              <th className="py-1 font-normal">{x.result}</th>
              <th className="py-1 font-normal">{x.enemy}</th>
              <th className="py-1 font-normal">{x.ally}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr
                key={f.idx}
                className={cn("border-b align-top last:border-0", !f.joined && "text-muted-foreground")}
              >
                <td className="py-1 tabular-nums">{clock(f.start)}</td>
                <td className="py-1 tabular-nums">
                  {f.teamDeaths} / {f.enemyDeaths}
                </td>
                <td className="py-1">
                  <Uses list={f.enemy} />
                </td>
                <td className="py-1">
                  <Uses list={f.ally} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FightTargetsBlock() {
  const { t } = useLab();
  const x = t.x.skills.fightTargets;
  const sides = useSides();
  if (!sides.some(([, s]) => s.fights.teamfights.length)) return null;
  return (
    <Sub title={x.title} hint={x.hint}>
      <PerSide>{(k, s) => <FightTargets s={s} />}</PerSide>
      {sides.some(([, s]) => s.parsed.stratz) && <Caveat kind="source">{x.note}</Caveat>}
    </Sub>
  );
}

// ── Mana ─────────────────────────────────────────────────────────────────────────────────────

const manaAvg = (s: LabSide) => manaCurves(s)?.avg ?? null;
const pctFmt = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : "–");

function ManaStatsView({ s }: { s: LabSide }) {
  const { t, assets } = useLab();
  const x = t.x.skills.mana;
  const m = useMemo(() => manaStats(s, assets), [s, assets]);
  if (!m) return <Muted>{x.none}</Muted>;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
      <dt className="text-muted-foreground">
        {x.lowest} / {x.avg}
      </dt>
      <dd className="tabular-nums">
        {pct(m.lowest)} / {pct(m.avg)}
      </dd>
      <dt className="text-muted-foreground">{x.low}</dt>
      <dd className="tabular-nums">
        {mmss(m.lowSeconds)}
        <span className="ml-1 text-muted-foreground">{x.lowOf(pct(m.lowShare, 1))}</span>
      </dd>
      <dt className="text-muted-foreground">{x.dips}</dt>
      <dd className="tabular-nums">{m.dips}</dd>
      <dt className="text-muted-foreground">{x.lane}</dt>
      <dd className="tabular-nums">{m.lane ? `${pct(m.lane.avg)} / ${pct(m.lane.lowest)}` : "–"}</dd>
      <dt className="text-muted-foreground">{x.fights}</dt>
      <dd className="tabular-nums">
        {m.fights.n ? (
          <>
            {pct(m.fights.avg)}
            <span className="ml-1 text-muted-foreground">{x.fightsLow(m.fights.low, m.fights.n)}</span>
          </>
        ) : (
          "–"
        )}
      </dd>
      <dt className="text-muted-foreground">{x.held}</dt>
      <dd className="tabular-nums">{m.held != null ? x.heldValue(num(m.held)) : "–"}</dd>
    </dl>
  );
}

export function ManaBlock() {
  const { t } = useLab();
  const x = t.x.skills.mana;
  const sides = useSides();
  const lowest = useCallback(
    (s: LabSide) => {
      const c = manaCurves(s);
      return c ? [{ name: x.lowestLine, values: c.min }] : [];
    },
    [x.lowestLine],
  );
  if (!sides.some(([, s]) => s.advanced.mana.min.length)) return null;
  return (
    <Sub title={x.title}>
      <LineCompare title={x.chart} series={manaAvg} extra={lowest} format={pctFmt} height={180} />
      <PerSide>{(k, s) => <ManaStatsView s={s} />}</PerSide>
      <Caveat kind="estimate">{x.heldNote}</Caveat>
    </Sub>
  );
}

// ── Hero-specific metrics ────────────────────────────────────────────────────────────────────

// What a hero value is made of, in words (236 casts, 18 hits in 13 casts…).
function Note({ v }: { v: HeroValue }) {
  const x = useLab().t.x.skills.hero.units;
  const text =
    v.unit === "count"
      ? x.count(v.n)
      : v.unit === "hits"
        ? x.hits(v.n, v.of ?? 0)
        : v.unit === "perFight"
          ? x.perFight(v.n, v.of ?? 0)
          : `${v.n}/${v.of ?? 0}`;
  return <span className="ml-1 text-muted-foreground">{text}</span>;
}

function MetricValue({ m, s }: { m: HeroMetric; s: LabSide }) {
  const v = m.get(s);
  if (!v) return <>–</>;
  return (
    <>
      {valueText(v.v, m.fmt)}
      <Note v={v} />
    </>
  );
}

function TopAbilities({ s }: { s: LabSide }) {
  const { t, assets } = useLab();
  const x = t.x.skills.hero;
  const names = useNames();
  const rows = useMemo(() => topAbilities(s, assets), [s, assets]);
  if (!rows.length) return <Muted>{t.resources.none}</Muted>;
  // Heroes reached only where it's known (STRATZ, or OpenDota's hits for single-target spells).
  const hits = rows.some((r) => r.heroes);
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-muted-foreground">
        <tr className="border-b">
          <th className="py-1 font-normal">{x.generic}</th>
          <th className="py-1 text-right font-normal">{x.perMin}</th>
          {hits && <th className="py-1 text-right font-normal">{x.heroes}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b last:border-0">
            <td className="py-1">
              <span className="flex items-center gap-1.5">
                <AbilityIcon k={r.key} size={16} />
                <span className="max-w-40 truncate">{names.abilities(r.key)}</span>
              </span>
            </td>
            <td className="py-1 text-right tabular-nums">{num(r.perMin, 2)}</td>
            {hits && (
              <td className="py-1 text-right tabular-nums">
                {r.heroes ? (
                  <>
                    {num(r.heroes.v, 2)}
                    <Note v={r.heroes} />
                  </>
                ) : (
                  "–"
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HeroList({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.skills.hero;
  const list = (HERO_METRICS[s.heroId] ?? []).filter((m) => m.get(s));
  if (!list.length) return <TopAbilities s={s} />;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
      {list.map((m) => (
        <div key={m.key} className="contents">
          <dt className="text-muted-foreground">{x.names[m.key] ?? m.key}</dt>
          <dd className="tabular-nums">
            <MetricValue m={m} s={s} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function HeroBlock() {
  const { t, a, b } = useLab();
  const x = t.x.skills.hero;
  const sides = useSides();
  const curated = HERO_METRICS[a.heroId];
  const same = !b || a.heroId === b.heroId;
  const rows = same && curated ? curated.filter((m) => sides.some(([, s]) => m.get(s))) : [];
  return (
    <Sub title={x.title} hint={x.hint}>
      {rows.length ? (
        <table className="w-full max-w-2xl text-xs">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal">{x.metric}</th>
              {sides.map(([k]) => (
                <th key={k} className="py-1 text-right font-normal">
                  <span
                    className="mr-1 inline-block size-2 rounded-full"
                    style={{ background: SIDE_COLOR[k] }}
                  />
                  {k === "a" ? t.insight.a : t.insight.b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.key} className="border-b last:border-0">
                <td className="py-1 text-muted-foreground">{x.names[m.key] ?? m.key}</td>
                {sides.map(([k, s]) => (
                  <td key={k} className="py-1 text-right tabular-nums">
                    <MetricValue m={m} s={s} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <PerSide>{(k, s) => <HeroList s={s} />}</PerSide>
      )}
      <Caveat kind="source">{x.note}</Caveat>
    </Sub>
  );
}

// ── Stacking buffs ───────────────────────────────────────────────────────────────────────────

export function BuffsBlock() {
  const { t } = useLab();
  const x = t.x.skills.buffs;
  const sides = useSides();
  const names = useNames();
  const keys = [...new Set(sides.flatMap(([, s]) => stackBuffs(s).map((b) => b.key)))];
  if (!keys.length) return null;
  return (
    <Sub title={x.title}>
      <table className="w-full max-w-xl text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal">{x.buff}</th>
            {sides.map(([k]) => (
              <th key={k} className="py-1 text-right font-normal">
                <span
                  className="mr-1 inline-block size-2 rounded-full"
                  style={{ background: SIDE_COLOR[k] }}
                />
                {k === "a" ? t.insight.a : t.insight.b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key} className="border-b last:border-0">
              <td className="py-1">
                <span className="flex items-center gap-1.5">
                  <SourceIcon k={key} size={16} />
                  <span className="truncate">{names.abilities(key)}</span>
                </span>
              </td>
              {sides.map(([k, s]) => (
                <td key={k} className="py-1 text-right tabular-nums">
                  {s.buffs.find((b) => b.key === key)?.stacks ?? "–"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Caveat kind="source">{x.note}</Caveat>
    </Sub>
  );
}
