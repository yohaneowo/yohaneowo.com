"use client";

import { useCallback, useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import type { LabSide } from "@/lib/dota/lab";
import type { Activity } from "@/lib/dota/lab-extra";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import {
  ACTIVITIES,
  activityShares,
  banking,
  hitsPerCast,
  itemEffects,
  itemFightUse,
  laneTrades,
  movement,
  PHASES,
  skillEfficiency,
  visionQuality,
} from "./advanced";
import { num, pct, xOf } from "./insights";
import {
  AbilityIcon,
  Bars,
  GROUP,
  HeroIcon,
  ItemIcon,
  LabMap,
  LineCompare,
  PerSide,
  SIDE_COLOR,
  type SideKey,
  SourceIcon,
  Sub,
  useLab,
  useNames,
  useSides,
} from "./lab-parts";

const ACTIVITY_COLOR: Record<Activity, string> = {
  farmLane: "#a3a3a3",
  farmJungle: "#22c55e",
  fight: "#ef4444",
  move: "#60a5fa",
  base: "#a16207",
  dead: "#3f3f46",
};

const signedPct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v * 100))}%`;

// ── The game ─────────────────────────────────────────────────────────────────────────────────

const killDeathMarks = (s: LabSide) =>
  s.fights.events
    .filter((f) => f.kind !== "assist")
    .map((f) => ({ t: f.t, color: f.kind === "kill" ? "#22c55e" : "#ef4444" }));

export function ContextBody() {
  const { t } = useLab();
  const d = t.deep;
  const sides = useSides();
  const names = useNames();
  const win = useCallback(
    (s: LabSide) => (s.advanced.context.winProb.length ? s.advanced.context.winProb : null),
    [],
  );
  const nw = useCallback(
    (s: LabSide) => (s.advanced.context.nwLead.length ? s.advanced.context.nwLead : null),
    [],
  );
  const xp = useCallback(
    (s: LabSide) => (s.advanced.context.xpLead.length ? s.advanced.context.xpLead : null),
    [],
  );
  const pctFmt = useCallback((v: number) => `${Math.round(v * 100)}%`, []);
  const marks = useCallback((s: LabSide) => killDeathMarks(s), []);
  // One draft per match.
  const matches = sides.filter(([, s], i) => sides.findIndex(([, x]) => x.matchId === s.matchId) === i);
  return (
    <>
      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
        <LineCompare title={d.winProb} series={win} format={pctFmt} marks={marks} />
        <LineCompare title={d.nwLead} series={nw} marks={marks} />
        <LineCompare title={d.xpLead} series={xp} />
        <Sub title={d.laneOutcomes}>
          <PerSide>
            {(k, s) => (
              <ul className="flex flex-col gap-1 text-xs">
                {s.advanced.context.lanes.map((l) => (
                  <li key={l.lane} className={cn("flex gap-2", l.lane === s.lane && "font-semibold")}>
                    <span className="w-12 text-muted-foreground">{t.lanes[l.lane]}</span>
                    <span>{d.laneResults[l.outcome]}</span>
                  </li>
                ))}
                {!s.advanced.context.lanes.length && <li className="text-muted-foreground">–</li>}
              </ul>
            )}
          </PerSide>
        </Sub>
      </div>
      <Sub title={d.draft}>
        <div className="flex flex-col gap-3">
          {matches.map(([k, s]) => (
            <div key={k} className="flex flex-col gap-1">
              {matches.length > 1 && <span className="text-xs text-muted-foreground">{s.matchId}</span>}
              {(["ours", "theirs"] as const).map((team) => (
                <div key={team} className="flex flex-wrap items-center gap-1 text-xs">
                  <span className="w-10 text-muted-foreground">{d[team]}</span>
                  {s.advanced.context.draft
                    .filter((x) => x.ours === (team === "ours"))
                    .sort((a, b) => a.order - b.order)
                    .map((x) => (
                      <span
                        key={`${x.order}-${x.hero}`}
                        className={cn(
                          "flex items-center gap-0.5 rounded border px-1",
                          !x.pick && "opacity-50",
                        )}
                        title={`${x.order + 1} · ${x.pick ? d.pick : d.ban} · ${names.heroes(x.hero)}`}
                      >
                        <span className="text-[10px] text-muted-foreground tabular-nums">{x.order + 1}</span>
                        <HeroIcon id={x.hero} size={18} className={x.pick ? undefined : "grayscale"} />
                      </span>
                    ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Sub>
      <BaselineNote />
    </>
  );
}

export function BaselineNote() {
  const { t } = useLab();
  const d = t.deep;
  const sides = useSides();
  const notes = [
    ...new Set(
      sides
        .map(([, s]) => s.advanced.baseline)
        .filter((b) => b != null)
        .map((b) =>
          d.baselineNote(
            d.brackets[b!.bracket] ?? b!.bracket,
            b!.position ? d.position(b!.position) : "",
            b!.matches.toLocaleString(),
          ),
        ),
    ),
  ];
  return notes.length ? <p className="text-xs text-muted-foreground">{notes.join(" · ")}</p> : null;
}

// ── Time use ─────────────────────────────────────────────────────────────────────────────────

function ActivityBar({ shares, compact = false }: { shares: Record<Activity, number>; compact?: boolean }) {
  const { t } = useLab();
  return (
    <div className="flex h-6 min-w-0 flex-1 overflow-hidden rounded">
      {ACTIVITIES.filter((a) => shares[a] > 0).map((a) => (
        <span
          key={a}
          title={`${t.deep.activities[a]} ${pct(shares[a], 1)}`}
          className="flex items-center justify-center overflow-hidden border-r border-background text-[10px] whitespace-nowrap text-black"
          style={{ width: `${shares[a] * 100}%`, background: ACTIVITY_COLOR[a] }}
        >
          {!compact && shares[a] > 0.08 ? `${t.deep.activities[a]} ${pct(shares[a])}` : ""}
        </span>
      ))}
    </div>
  );
}

function ActivityBand({ s }: { s: LabSide }) {
  const { align, range, t } = useLab();
  const span = range[1] - range[0] || 1;
  return (
    <div className="relative h-5 overflow-hidden rounded bg-muted/40">
      {s.advanced.activity.map((a, i) => {
        const x0 = xOf(s, s.path.t[i] - 10, align);
        const x1 = xOf(s, s.path.t[i], align);
        if (x0 == null || x1 == null || x1 < range[0] || x0 > range[1]) return null;
        return (
          <span
            key={i}
            title={`${clock(s.path.t[i])} ${t.deep.activities[a]}`}
            className="absolute inset-y-0"
            style={{
              left: `${((Math.max(x0, range[0]) - range[0]) / span) * 100}%`,
              width: `${((Math.min(x1, range[1]) - Math.max(x0, range[0])) / span) * 100}%`,
              background: ACTIVITY_COLOR[a],
            }}
          />
        );
      })}
    </div>
  );
}

export function TimeBody() {
  const { t } = useLab();
  const d = t.deep;
  const sides = useSides();
  if (!sides.some(([, s]) => s.advanced.activity.length))
    return <p className="text-sm text-muted-foreground">{d.noTime}</p>;
  return (
    <>
      <p className="text-xs text-muted-foreground">{d.timeHint}</p>
      <Sub title={d.shares}>
        <div className="flex flex-col gap-2">
          {sides.map(([k, s]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-full" style={{ background: SIDE_COLOR[k] }} />
              <ActivityBar shares={activityShares(s).shares} />
            </div>
          ))}
          <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {ACTIVITIES.map((a) => (
              <span key={a} className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-sm" style={{ background: ACTIVITY_COLOR[a] }} />
                {d.activities[a]}
              </span>
            ))}
          </p>
        </div>
      </Sub>
      <Sub title={d.band}>
        <div className="flex flex-col gap-1.5">
          {sides.map(([k, s]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-full" style={{ background: SIDE_COLOR[k] }} />
              <div className="min-w-0 flex-1">
                <ActivityBand s={s} />
              </div>
            </div>
          ))}
        </div>
      </Sub>
      <Sub title={d.phases}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 font-normal" />
                {d.phaseNames.map((n) => (
                  <th key={n} className="py-1 font-normal">
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sides.map(([k, s]) => (
                <tr key={k} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ background: SIDE_COLOR[k] }}
                    />
                  </td>
                  {PHASES.map(([a, b], i) => {
                    const sh = activityShares(s, a, b);
                    return (
                      <td key={i} className="py-1.5 pr-3">
                        {sh.n ? (
                          <div className="flex w-40">
                            <ActivityBar shares={sh.shares} compact />
                          </div>
                        ) : (
                          "–"
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sub>
    </>
  );
}

// ── Laning trades ────────────────────────────────────────────────────────────────────────────

export function LaneTradesBlock() {
  const { t } = useLab();
  const d = t.deep;
  return (
    <Sub title={d.trades}>
      <PerSide>
        {(k, s) => {
          if (!s.advanced.damage.length)
            return <p className="text-xs text-muted-foreground">{t.skills.noTiming}</p>;
          const tr = laneTrades(s);
          return (
            <div className="flex flex-col gap-2 text-xs">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <dt className="text-muted-foreground">{d.dealt}</dt>
                <dd className="tabular-nums">{num(tr.out)}</dd>
                <dt className="text-muted-foreground">{d.taken}</dt>
                <dd className="tabular-nums">{num(tr.in)}</dd>
                <dt className="text-muted-foreground">{d.lowHp}</dt>
                <dd className="tabular-nums">{tr.lowHp != null ? pct(tr.lowHp) : "–"}</dd>
                <dt className="text-muted-foreground">{d.outcome}</dt>
                <dd>
                  {s.advanced.context.laneOutcome ? d.laneResults[s.advanced.context.laneOutcome] : "–"}
                </dd>
              </dl>
              {tr.perOpponent.length > 0 && (
                <ul className="flex flex-col gap-0.5">
                  <li className="text-muted-foreground">
                    {d.vsOpp} · {d.dealt} / {d.taken}
                  </li>
                  {tr.perOpponent.map((o) => (
                    <li key={o.hero} className="flex items-center gap-2 tabular-nums">
                      <HeroIcon id={o.hero} size={16} />
                      {num(o.out)} / {num(o.in)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }}
      </PerSide>
    </Sub>
  );
}

// ── Items ────────────────────────────────────────────────────────────────────────────────────

export function ItemEffectsBlock() {
  const { t, assets } = useLab();
  const d = t.deep;
  const names = useNames();
  return (
    <>
      <Sub title={d.effects}>
        <PerSide>
          {(k, s) => {
            const fx = itemEffects(s, assets);
            if (!fx.length) return <p className="text-xs text-muted-foreground">{t.resources.none}</p>;
            const cell = (pair: readonly [number | null, number | null], digits = 0) => (
              <span className="tabular-nums">
                {num(pair[0], digits)} → {num(pair[1], digits)}
                {pair[0] && pair[1] != null ? (
                  <span
                    className={cn(
                      "ml-1",
                      pair[1] >= pair[0]
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {signedPct(pair[1] / pair[0] - 1)}
                  </span>
                ) : null}
              </span>
            );
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-1 font-normal">{t.items.item}</th>
                      <th className="py-1 font-normal">{t.skills.time}</th>
                      <th className="py-1 font-normal">{d.avgTime}</th>
                      <th className="py-1 font-normal">{d.gpm}</th>
                      <th className="py-1 font-normal">{d.lhpm}</th>
                      <th className="py-1 font-normal">{d.dpm}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fx.map((e) => (
                      <tr key={e.key} className="border-b last:border-0">
                        <td className="py-1">
                          <span className="flex items-center gap-1.5" title={names.items(e.key)}>
                            <ItemIcon k={e.key} size={18} />
                          </span>
                        </td>
                        <td className="py-1 tabular-nums">{clock(e.t)}</td>
                        <td className="py-1 tabular-nums">
                          {e.baseline != null ? (
                            <>
                              {clock(e.baseline)}
                              <span
                                className={cn(
                                  "ml-1",
                                  e.t <= e.baseline
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-red-600 dark:text-red-400",
                                )}
                              >
                                {e.t <= e.baseline ? "−" : "+"}
                                {clock(Math.abs(e.t - e.baseline))}
                              </span>
                            </>
                          ) : (
                            "–"
                          )}
                        </td>
                        <td className="py-1">{cell(e.gold)}</td>
                        <td className="py-1">{cell(e.lh, 1)}</td>
                        <td className="py-1">{cell(e.dmg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }}
        </PerSide>
      </Sub>
      <Sub title={d.fightUse}>
        <PerSide>
          {(k, s) => {
            const list = itemFightUse(s, assets);
            return list.length ? (
              <Bars
                color={SIDE_COLOR[k]}
                max={1}
                format={(v) => pct(v)}
                rows={list.map((x) => ({
                  key: x.key,
                  value: x.used / x.fights,
                  note: d.usedIn(x.used, x.fights),
                  label: (
                    <>
                      <ItemIcon k={x.key} size={16} />
                      <span className="truncate">{names.items(x.key)}</span>
                    </>
                  ),
                }))}
              />
            ) : (
              <p className="text-xs text-muted-foreground">{t.resources.none}</p>
            );
          }}
        </PerSide>
      </Sub>
    </>
  );
}

// ── Skills ───────────────────────────────────────────────────────────────────────────────────

export function SkillEfficiencyBlock() {
  const { t } = useLab();
  const d = t.deep;
  const names = useNames();
  return (
    <>
      <Sub title={d.efficiency} hint={d.effHint}>
        <PerSide>
          {(k, s) => {
            const list = skillEfficiency(s);
            return list.length ? (
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-1 font-normal" />
                    <th className="py-1 text-right font-normal">{d.casts}</th>
                    <th className="py-1 text-right font-normal">{d.possible}</th>
                    <th className="py-1 text-right font-normal">{d.ratio}</th>
                    <th className="py-1 text-right font-normal">{d.ultFights}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.key} className="border-b last:border-0">
                      <td className="py-1">
                        <span className="flex items-center gap-1.5">
                          <AbilityIcon k={e.key} size={16} />
                          <span className="truncate">{names.abilities(e.key)}</span>
                        </span>
                      </td>
                      <td className="py-1 text-right tabular-nums">{e.casts}</td>
                      <td className="py-1 text-right tabular-nums">{e.possible}</td>
                      <td className="py-1 text-right tabular-nums">{pct(e.ratio)}</td>
                      <td className="py-1 text-right tabular-nums">
                        {e.fights ? `${e.fights[0]} / ${e.fights[1]}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-muted-foreground">{t.skills.noTiming}</p>
            );
          }}
        </PerSide>
      </Sub>
      <Sub title={d.hitsPerCast}>
        <PerSide>
          {(k, s) => (
            <Bars
              color={SIDE_COLOR[k]}
              format={(v) => num(v, 2)}
              rows={hitsPerCast(s).map((x) => ({
                key: x.key,
                value: x.per,
                note: `${x.hits}/${x.casts}`,
                label: (
                  <>
                    <SourceIcon k={x.key} size={16} />
                    <span className="truncate">{names.abilities(x.key)}</span>
                  </>
                ),
              }))}
            />
          )}
        </PerSide>
      </Sub>
    </>
  );
}

// ── Fights and deaths ────────────────────────────────────────────────────────────────────────

export function FightBreakdownBlock() {
  const { t } = useLab();
  const d = t.deep;
  return (
    <Sub title={d.breakdown}>
      <PerSide>
        {(k, s) => (
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-1 font-normal">{t.fights.fightTime}</th>
                  <th className="py-1 font-normal">{d.distEnemy}</th>
                  <th className="py-1 font-normal">{d.near}</th>
                  <th className="py-1 font-normal">{d.first}</th>
                  <th className="py-1 font-normal">{d.burst}</th>
                  <th className="py-1 font-normal">{d.dealtTaken}</th>
                  <th className="py-1 font-normal">{d.used}</th>
                  <th className="py-1 font-normal">{t.fights.result}</th>
                </tr>
              </thead>
              <tbody>
                {s.fights.teamfights.map((f, i) => {
                  const x = s.advanced.fightDetails[i];
                  return (
                    <tr
                      key={i}
                      className={cn("border-b align-top last:border-0", !f.joined && "text-muted-foreground")}
                    >
                      <td className="py-1 tabular-nums">
                        {clock(f.start)}
                        {f.died && <span className="ml-1 text-red-600 dark:text-red-400">✝</span>}
                      </td>
                      <td className="py-1 tabular-nums">
                        {x?.distEnemy != null ? d.units(x.distEnemy) : "–"}
                      </td>
                      <td className="py-1 tabular-nums">{x ? `${x.alliesNear} / ${x.enemiesNear}` : "–"}</td>
                      <td className="py-1 tabular-nums">
                        {x?.firstDealt != null ? d.seconds(x.firstDealt) : "–"} /{" "}
                        {x?.firstTaken != null ? d.seconds(x.firstTaken) : "–"}
                      </td>
                      <td className="py-1 tabular-nums">{x ? num(x.burst) : "–"}</td>
                      <td className="py-1 tabular-nums">{x ? `${num(x.dealt)} / ${num(x.taken)}` : "–"}</td>
                      <td className="py-1">
                        <span className="flex max-w-56 flex-wrap gap-0.5">
                          {x?.abilities.map((a) => (
                            <span key={a.key} className="flex items-center" title={`${a.key} ×${a.count}`}>
                              <SourceIcon k={a.key} size={14} />
                              {a.count > 1 && <span className="text-[9px]">{a.count}</span>}
                            </span>
                          ))}
                          {x?.items
                            .filter((a) => a.key !== "power_treads")
                            .map((a) => (
                              <ItemIcon key={a.key} k={a.key} size={12} title={`${a.key} ×${a.count}`} />
                            ))}
                        </span>
                      </td>
                      <td className="py-1 tabular-nums">
                        {f.teamDeaths} / {f.enemyDeaths}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PerSide>
    </Sub>
  );
}

export function DeathAnalysisBlock() {
  const { t } = useLab();
  const d = t.deep;
  return (
    <Sub title={d.deaths}>
      <PerSide>
        {(k, s) => (
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 font-normal">{t.fights.time}</th>
                <th className="py-1 font-normal">{d.kind}</th>
                <th className="py-1 font-normal">{d.near}</th>
                <th className="py-1 font-normal">{d.buyback}</th>
                <th className="py-1 font-normal">{d.swing}</th>
                <th className="py-1 text-right font-normal">{t.header.netWorth}</th>
              </tr>
            </thead>
            <tbody>
              {s.advanced.deathDetails.map((x, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1 tabular-nums">{clock(x.t)}</td>
                  <td className="py-1">{d.kinds[x.kind]}</td>
                  <td className="py-1 tabular-nums">
                    {x.alliesNear ?? "–"} / {x.enemiesNear ?? "–"}
                  </td>
                  <td className="py-1">{x.buyback == null ? "–" : x.buyback ? d.yes : d.no}</td>
                  <td
                    className={cn(
                      "py-1 tabular-nums",
                      x.swing != null && x.swing < -0.05 && "font-semibold text-red-600 dark:text-red-400",
                    )}
                  >
                    {x.swing != null ? signedPct(x.swing) : "–"}
                  </td>
                  <td className="py-1 text-right tabular-nums">{num(x.netWorth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PerSide>
    </Sub>
  );
}

// ── Damage ───────────────────────────────────────────────────────────────────────────────────

export function DamageDeepBlock() {
  const { t } = useLab();
  const d = t.deep;
  const heal = useCallback((s: LabSide) => (s.advanced.healIn.length ? s.advanced.healIn : null), []);
  return (
    <>
      <div className="flex flex-col gap-5">
        <Sub title={d.types}>
          <PerSide>
            {(k, s) => {
              const r = s.advanced.report;
              if (!r) return <p className="text-xs text-muted-foreground">–</p>;
              const rows = (
                [
                  ["physical", "physicalDamage"],
                  ["magical", "magicalDamage"],
                  ["pure", "pureDamage"],
                ] as const
              ).map(([label, key]) => ({
                key: label,
                value: r.dealt[key] ?? 0,
                note: `/ ${num(r.received[key] ?? 0)}`,
                label: d[label],
              }));
              return <Bars color={SIDE_COLOR[k]} rows={rows} />;
            }}
          </PerSide>
        </Sub>
        <Sub title={d.disables}>
          <PerSide>
            {(k, s) => {
              const r = s.advanced.report;
              if (!r) return <p className="text-xs text-muted-foreground">–</p>;
              // STRATZ keeps durations in hundredths of a second.
              const row = (label: string, c: string, dur: string) => (
                <tr key={label} className="border-b last:border-0">
                  <td className="py-1 text-muted-foreground">{label}</td>
                  <td className="py-1 text-right tabular-nums">
                    {r.dealt[c] ?? 0} {d.times} · {num((r.dealt[dur] ?? 0) / 100, 1)}
                    {d.secs}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {r.received[c] ?? 0} {d.times} · {num((r.received[dur] ?? 0) / 100, 1)}
                    {d.secs}
                  </td>
                </tr>
              );
              return (
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-1 font-normal" />
                      <th className="py-1 text-right font-normal">{d.dealt}</th>
                      <th className="py-1 text-right font-normal">{d.taken}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row(d.stun, "stunCount", "stunDuration")}
                    {row(d.disable, "disableCount", "disableDuration")}
                    {row(d.slow, "slowCount", "slowDuration")}
                    <tr>
                      <td className="py-1 text-muted-foreground">
                        {d.selfHeal} / {d.allyHeal}
                      </td>
                      <td className="py-1 text-right tabular-nums" colSpan={2}>
                        {num(r.dealt.selfHeal)} / {num(r.dealt.allyHeal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              );
            }}
          </PerSide>
        </Sub>
      </div>
      <LineCompare title={d.healIn} series={heal} />
    </>
  );
}

// ── Vision ───────────────────────────────────────────────────────────────────────────────────

export function VisionQualityBlock() {
  const { t } = useLab();
  const d = t.deep;
  return (
    <Sub title={d.quality}>
      <PerSide>
        {(k, s) => {
          const q = visionQuality(s);
          if (!q.count) return <p className="text-xs text-muted-foreground">{t.vision.none}</p>;
          return (
            <div className="flex flex-col gap-2 text-xs">
              <Bars
                color={SIDE_COLOR[k]}
                rows={(Object.entries(q.roles) as [string, number][]).map(([role, n]) => ({
                  key: role,
                  value: n,
                  label: d.roles[role],
                }))}
              />
              <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <dt className="text-muted-foreground">{d.beforeObjective}</dt>
                <dd className="tabular-nums">
                  {q.beforeObjective} / {q.count}
                </dd>
                <dt className="text-muted-foreground">{d.avgLife}</dt>
                <dd className="tabular-nums">
                  {q.avgObs != null ? clock(Math.round(q.avgObs)) : "–"} /{" "}
                  {q.avgSen != null ? clock(Math.round(q.avgSen)) : "–"}
                </dd>
                <dt className="text-muted-foreground">{d.dewardedShare}</dt>
                <dd className="tabular-nums">{pct(q.dewardedShare)}</dd>
              </dl>
            </div>
          );
        }}
      </PerSide>
    </Sub>
  );
}

// ── Movement ─────────────────────────────────────────────────────────────────────────────────

export function MovementDeepBlock() {
  const { t } = useLab();
  const d = t.deep;
  return (
    <>
      <div className="flex flex-col gap-5">
        <Sub title={d.distance}>
          <PerSide>
            {(k, s) => {
              const m = movement(s);
              return (
                <Bars
                  color={SIDE_COLOR[k]}
                  rows={m.dist.map((v, i) => {
                    const [a, b] = PHASES[i];
                    const mins = Math.max(1, (Math.min(b, s.duration) - Math.max(0, a)) / 60);
                    return { key: String(i), value: v, note: `${num(v / mins)}/m`, label: d.phaseNames[i] };
                  })}
                />
              );
            }}
          </PerSide>
        </Sub>
        <Sub title={d.group}>
          <PerSide>
            {(k, s) => {
              const m = movement(s);
              return (
                <Bars
                  color={SIDE_COLOR[k]}
                  max={1}
                  format={(v) => pct(v)}
                  rows={[
                    { key: "alone", value: m.group.alone, label: d.alone },
                    { key: "one", value: m.group.one, label: d.one },
                    { key: "two", value: m.group.two, label: d.two },
                  ]}
                />
              );
            }}
          </PerSide>
        </Sub>
      </div>
      <Sub title={`${d.tps} · ${d.smokes}`}>
        <PerSide>
          {(k, s) => {
            const m = movement(s);
            const marks = m.tps.flatMap((tp) =>
              tp.to ? [{ x: tp.to.x, y: tp.to.y, color: "#22d3ee", size: 1.4, title: clock(tp.t) }] : [],
            );
            return (
              <div className="grid gap-3 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
                <LabMap marks={marks} cursorOf={[{ side: k as SideKey, s }]} />
                <div className="flex flex-col gap-1 text-xs">
                  <p className="text-muted-foreground">
                    {m.tps.length ? m.tps.map((tp) => clock(tp.t)).join(t.insight.sep) : t.resources.none}
                  </p>
                  <p>
                    {d.smokes}
                    {t.insight.colon}
                    {m.smokes.length ? m.smokes.map(clock).join(t.insight.sep) : t.resources.none}
                  </p>
                </div>
              </div>
            );
          }}
        </PerSide>
      </Sub>
    </>
  );
}

// ── Gold over time ───────────────────────────────────────────────────────────────────────────

const SOURCE_COLOR: Record<string, string> = {
  creeps: "#a3a3a3",
  neutrals: "#22c55e",
  heroes: "#ef4444",
  buildings: "#a16207",
  roshan: "#a855f7",
  runes: "#eab308",
  couriers: "#06b6d4",
  wards: "#f472b6",
  other: "#d4d4d4",
};

function GoldStack({ s }: { s: LabSide }) {
  const { t, align, range } = useLab();
  const option = useMemo<EChartsOption>(() => {
    const kinds = Object.keys(s.advanced.goldByMinute).filter((k) =>
      s.advanced.goldByMinute[k as keyof typeof s.advanced.goldByMinute].some((v) => v > 0),
    );
    return {
      animation: false,
      grid: { left: 44, right: 8, top: 24, bottom: 24 },
      tooltip: { trigger: "axis" },
      legend: { top: 0, textStyle: { fontSize: 10 }, itemWidth: 10, itemHeight: 8 },
      xAxis: {
        type: "value",
        min: range[0],
        max: range[1],
        axisLabel: { fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: { type: "value", axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { opacity: 0.3 } } },
      series: kinds.map((k) => ({
        name: t.deep.sources[k] ?? k,
        type: "bar",
        stack: "gold",
        barCategoryGap: "10%",
        itemStyle: { color: SOURCE_COLOR[k] },
        data: s.advanced.goldByMinute[k as keyof typeof s.advanced.goldByMinute]
          .map((v, m) => [xOf(s, m * 60 + 30, align), v] as [number | null, number])
          .filter((p): p is [number, number] => p[0] != null),
      })),
    };
  }, [s, t, align, range]);
  return (
    <div className="h-56 min-w-0">
      <EChart option={option} group={GROUP} />
    </div>
  );
}

export function GoldDeepBlock() {
  const { t } = useLab();
  const d = t.deep;
  const unspent = useCallback((s: LabSide) => banking(s)?.perMinute ?? null, []);
  return (
    <>
      <Sub title={d.overTime}>
        <PerSide>
          {(k, s) =>
            s.advanced.goldByMinute.creeps.some((v) => v > 0) ? (
              <GoldStack s={s} />
            ) : (
              <p className="text-xs text-muted-foreground">{t.skills.noTiming}</p>
            )
          }
        </PerSide>
      </Sub>
      <LineCompare title={d.unspent} series={unspent} />
      <Sub title={d.bank}>
        <PerSide>
          {(k, s) => {
            const bk = banking(s);
            return (
              <p className="text-xs tabular-nums">
                {bk ? `${num(bk.avg)} / ${num(bk.max)} / ${pct(bk.over1500)}` : "–"}
              </p>
            );
          }}
        </PerSide>
      </Sub>
    </>
  );
}

// ── Attributes ───────────────────────────────────────────────────────────────────────────────

export function AttributesBlock() {
  const { t } = useLab();
  const d = t.deep;
  const str = useCallback(
    (s: LabSide) => (s.advanced.attributes.str.length ? s.advanced.attributes.str : null),
    [],
  );
  const agi = useCallback(
    (s: LabSide) => (s.advanced.attributes.agi.length ? s.advanced.attributes.agi : null),
    [],
  );
  const int = useCallback(
    (s: LabSide) => (s.advanced.attributes.int.length ? s.advanced.attributes.int : null),
    [],
  );
  return (
    <Sub title={d.attributes}>
      <div className="grid gap-x-6 gap-y-3 lg:grid-cols-3">
        <LineCompare title={d.str} series={str} height={170} />
        <LineCompare title={d.agi} series={agi} height={170} />
        <LineCompare title={d.int} series={int} height={170} />
      </div>
    </Sub>
  );
}
