"use client";

import { useCallback } from "react";
import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { num, pct, signed } from "../insights";
import {
  Caveat,
  HeroIcon,
  LineCompare,
  PerSide,
  SIDE_COLOR,
  Sub,
  useLab,
  useNames,
  useSides,
} from "../lab-parts";
import {
  COUNTER,
  creepShare,
  EARLY,
  equilibrium,
  laneExpect,
  laneGaps,
  MIN_GAMES,
  RULES_PATCH,
  RUNE_KINDS,
  rotations,
  runeControl,
  threat,
  WAVE_STATES,
  type GapRow,
  type WaveState,
} from "./laning-calc";

// The laning module's blocks: the lane the rank's records expected and what happened, the lane gaps
// at 10 minutes, where the waves met, how the lane's creeps were shared, rotations, runes (laning
// section) and the matchup threats (context section).

const pctAxis = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : "–");
// Points of win rate, one decimal.
export const points = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
const tone = (v: number) =>
  v > 0 ? "text-emerald-600 dark:text-emerald-400" : v < 0 ? "text-red-600 dark:text-red-400" : undefined;
const muted = (text: string) => <p className="text-xs text-muted-foreground">{text}</p>;

// One note per distinct source line (both sides often share it).
function useSourceNote(line: (s: LabSide) => string | null) {
  const sides = useSides();
  return [...new Set(sides.map(([, s]) => line(s)).filter((x): x is string => !!x))].join(" · ");
}

// ── The expected lane ────────────────────────────────────────────────────────────────────────

function ExpectBlock() {
  const { t } = useLab();
  const x = t.x.laning;
  const d = t.deep;
  const source = useSourceNote((s) => {
    const bl = s.advanced.baseline;
    return bl && laneExpect(s)?.records.length
      ? x.expectSource(
          d.brackets[bl.bracket] ?? bl.bracket,
          bl.position ? d.position(bl.position) : "",
          bl.week != null,
        )
      : null;
  });
  return (
    <Sub title={x.expect} hint={x.expectHint}>
      <PerSide>
        {(k, s) => {
          const e = laneExpect(s);
          if (!e?.records.length) return muted(x.noExpect);
          return (
            <div className="flex flex-col gap-2 text-xs">
              <table className="w-full">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-1 font-normal">{x.hero}</th>
                    <th className="py-1 font-normal">{x.role}</th>
                    <th className="py-1 text-right font-normal">{x.lanes}</th>
                    <th className="py-1 text-right font-normal">{x.win}</th>
                    <th className="py-1 text-right font-normal">{x.draw}</th>
                    <th className="py-1 text-right font-normal">{x.loss}</th>
                  </tr>
                </thead>
                <tbody>
                  {e.records.map((r) => (
                    <tr
                      key={`${r.with}-${r.hero}`}
                      className={cn("border-b last:border-0", !r.used && "text-muted-foreground")}
                    >
                      <td className="py-1">
                        <HeroIcon id={r.hero} size={18} />
                      </td>
                      <td className="py-1">
                        {r.with ? x.with : x.vs}
                        {!r.used && <span className="ml-1">· {x.thin}</span>}
                      </td>
                      <td className="py-1 text-right tabular-nums">{num(r.n)}</td>
                      <td
                        className="py-1 text-right tabular-nums"
                        title={`${d.laneResults.stompWin} ${pct(r.stompWin / r.n)}`}
                      >
                        {pct((r.win + r.stompWin) / r.n)}
                      </td>
                      <td className="py-1 text-right tabular-nums">{pct(r.draw / r.n)}</td>
                      <td
                        className="py-1 text-right tabular-nums"
                        title={`${d.laneResults.stompLoss} ${pct(r.stompLoss / r.n)}`}
                      >
                        {pct((r.loss + r.stompLoss) / r.n)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="flex flex-col gap-0.5">
                <span>
                  {e.expected
                    ? x.expectLine(x.odds[e.expected], pct(e.win), pct(e.draw), pct(e.loss), num(e.n))
                    : x.tooThin}
                </span>
                <span className={cn("font-medium", e.verdict != null && tone(e.verdict))}>
                  {e.actual
                    ? e.verdict != null
                      ? x.actualLine(d.laneResults[e.actual], x.verdicts[String(e.verdict)])
                      : `${d.outcome}${t.insight.colon}${d.laneResults[e.actual]}`
                    : x.noActual}
                </span>
              </p>
            </div>
          );
        }}
      </PerSide>
      {source && <Caveat kind="source">{source}</Caveat>}
    </Sub>
  );
}

// ── Lane gaps ────────────────────────────────────────────────────────────────────────────────

function Heroes({ list }: { list: GapRow[] }) {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {list.map((r) => (
        <HeroIcon key={r.hero} id={r.hero} size={16} />
      ))}
    </span>
  );
}

function GapsBlock() {
  const { t } = useLab();
  const x = t.x.laning;
  return (
    <Sub title={x.gaps} hint={x.gapsHint}>
      <PerSide>
        {(k, s) => {
          const g = laneGaps(s);
          if (!g?.total) return muted(x.noGaps);
          const nw = (list: GapRow[]) => list.reduce((a, r) => a + r.nw, 0);
          const rows = [
            {
              key: "lane",
              label: x.wholeLane(g.ours.length, g.theirs.length),
              ours: <Heroes list={g.ours} />,
              theirs: <Heroes list={g.theirs} />,
              a: nw(g.ours),
              b: nw(g.theirs),
              gapNw: g.total.nw,
              gapXp: g.total.xp,
            },
            ...(
              [
                ["role", g.role, x.counterpart],
                ["same", g.same, x.samePosition],
              ] as const
            ).flatMap(([key, r, label]) =>
              r
                ? [
                    {
                      key,
                      label: (
                        <>
                          {label(r.position ?? 0)}
                          {!r.inLane && <span className="ml-1 text-muted-foreground">· {x.notInLane}</span>}
                        </>
                      ),
                      ours: <Heroes list={[g.me]} />,
                      theirs: <Heroes list={[r]} />,
                      a: g.me.nw,
                      b: r.nw,
                      gapNw: r.gapNw,
                      gapXp: r.gapXp,
                    },
                  ]
                : [],
            ),
          ];
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-1 font-normal">{x.atMinute(g.minute)}</th>
                    <th className="py-1 text-right font-normal">{x.ours}</th>
                    <th className="py-1 text-right font-normal">{x.theirs}</th>
                    <th className="py-1 text-right font-normal">{x.nwGap}</th>
                    <th className="py-1 text-right font-normal">{x.xpGap}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-b last:border-0">
                      <td className="py-1">{r.label}</td>
                      <td className="py-1 text-right whitespace-nowrap tabular-nums">
                        {r.ours} {num(r.a)}
                      </td>
                      <td className="py-1 text-right whitespace-nowrap tabular-nums">
                        {r.theirs} {num(r.b)}
                      </td>
                      <td className={cn("py-1 text-right font-medium tabular-nums", tone(r.gapNw))}>
                        {signed(r.gapNw)}
                      </td>
                      <td className={cn("py-1 text-right tabular-nums", tone(r.gapXp))}>{signed(r.gapXp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!g.positions && <p className="mt-1 text-xs text-muted-foreground">{x.noPositions}</p>}
            </div>
          );
        }}
      </PerSide>
    </Sub>
  );
}

// The match's patch when the assumed spawn rules (7.41) may not hold.
function usePatchNote() {
  const { t } = useLab();
  return useSourceNote((s) => {
    const patch = s.match.patch?.name;
    return patch && patch !== RULES_PATCH ? t.x.laning.otherPatch(patch) : null;
  });
}

// ── Where the waves met ──────────────────────────────────────────────────────────────────────

const STATE_TONE: Record<WaveState, string> = {
  intoOwn: "bg-red-500/25",
  nearOwn: "bg-emerald-500/25",
  middle: "bg-sky-500/20",
  nearEnemy: "bg-amber-500/25",
  intoEnemy: "bg-violet-500/25",
};
const waveSeries = (s: LabSide) => equilibrium(s)?.waveSeries ?? null;

function WaveBlock() {
  const { t, align } = useLab();
  const x = t.x.laning;
  const any = useSides().some(([, s]) => !!equilibrium(s));
  const hero = useCallback(
    (s: LabSide) => {
      const q = equilibrium(s);
      return q ? [{ name: x.heroPlace, values: q.heroSeries }] : [];
    },
    [x.heroPlace],
  );
  return (
    <div className="flex flex-col gap-2">
      <LineCompare
        title={x.wave}
        series={waveSeries}
        extra={hero}
        format={pctAxis}
        height={200}
        xMax={align.kind === "time" ? 12 : undefined}
      />
      <PerSide>
        {(k, s) => {
          const q = equilibrium(s);
          if (!q) return muted(x.noWave);
          return (
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex gap-0.5">
                {q.minutes.map((m) => (
                  <span
                    key={m.m}
                    title={[
                      clock(m.m * 60),
                      m.state ? x.waveStates[m.state] : "–",
                      `${m.n} ${t.timeline.lh}`,
                      m.ahead ? x.ahead : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    className={cn(
                      "flex h-8 min-w-0 flex-1 flex-col items-center justify-center rounded text-[10px]",
                      m.state ? STATE_TONE[m.state] : "bg-muted/40",
                    )}
                  >
                    <span className="text-muted-foreground tabular-nums">{m.m}</span>
                    <span className="truncate tabular-nums">
                      {m.wave != null ? pctAxis(m.wave) : "–"}
                      {m.ahead && "↑"}
                    </span>
                  </span>
                ))}
              </div>
              <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                {WAVE_STATES.map((st) => (
                  <span key={st} className="flex items-center gap-1">
                    <span className={cn("inline-block size-2 rounded-sm", STATE_TONE[st])} />
                    {x.waveStates[st]} {q.counts[st]}
                  </span>
                ))}
                <span>
                  ↑ {x.ahead} {q.ahead}
                </span>
              </p>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
                <dt className="text-muted-foreground">{x.waveMedian}</dt>
                <dd className="tabular-nums">
                  {q.wave != null
                    ? x.fromTower(pct(q.wave), num(Math.round((q.wave * q.length * 128) / 10) * 10))
                    : x.fewHits}
                </dd>
                <dt className="text-muted-foreground">{x.heroMean}</dt>
                <dd className="tabular-nums">{q.hero != null ? pct(q.hero) : "–"}</dd>
              </dl>
            </div>
          );
        }}
      </PerSide>
      {any && <Caveat kind="estimate">{x.waveNote}</Caveat>}
    </div>
  );
}

// ── The lane's creeps ────────────────────────────────────────────────────────────────────────

type Part = { key: string; label: string; value: number; color: string; opacity?: number; hint?: string };

function ShareBar({ parts, total }: { parts: Part[]; total: number }) {
  const top = Math.max(
    1,
    total,
    parts.reduce((a, p) => a + p.value, 0),
  );
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-3.5 overflow-hidden rounded bg-muted/50">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <span
              key={p.key}
              title={`${p.label} ${p.value}`}
              className="border-r border-background last:border-0"
              style={{ width: `${(p.value / top) * 100}%`, background: p.color, opacity: p.opacity }}
            />
          ))}
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
        {parts.map((p) => (
          <span key={p.key} className="flex items-center gap-1" title={p.hint}>
            <span
              className="inline-block size-2 rounded-sm"
              style={{ background: p.color, opacity: p.opacity }}
            />
            {p.label}
            <span className="text-foreground tabular-nums">{p.value}</span>
            <span className="tabular-nums">· {pct(p.value / top)}</span>
          </span>
        ))}
      </p>
    </div>
  );
}

const youShare = (s: LabSide) => creepShare(s)?.youSeries ?? null;

function CreepsBlock() {
  const { t, align } = useLab();
  const x = t.x.laning;
  const patch = usePatchNote();
  const lane = useCallback(
    (s: LabSide) => {
      const c = creepShare(s);
      return c?.allies.length ? [{ name: x.laneTeam, values: c.laneSeries }] : [];
    },
    [x.laneTeam],
  );
  return (
    <Sub title={x.creeps}>
      <LineCompare
        title={x.creepChart}
        series={youShare}
        extra={lane}
        format={pctAxis}
        height={180}
        xMax={align.kind === "time" ? 10 : undefined}
      />
      <PerSide>
        {(k, s) => {
          const c = creepShare(s);
          if (!c) return muted(x.noCreeps);
          const v = c.total;
          const rest = { key: "rest", label: x.rest, color: "#a3a3a3", hint: x.restHint };
          return (
            <div className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">{x.enemyCreeps(v.reached)}</span>
                <ShareBar
                  total={v.reached}
                  parts={[
                    { key: "you", label: x.you, value: v.you, color: SIDE_COLOR[k] },
                    ...(c.allies.length
                      ? [{ key: "ally", label: x.allies, value: v.ally, color: SIDE_COLOR[k], opacity: 0.45 }]
                      : []),
                    { key: "denied", label: x.deniedByThem, value: v.denied, color: "#ef4444" },
                    { ...rest, value: Math.max(0, v.rest) },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">{x.ownCreeps(v.reached)}</span>
                <ShareBar
                  total={v.reached}
                  parts={[
                    { key: "theirs", label: x.theirLh, value: v.theirs, color: "#ef4444" },
                    { key: "denies", label: x.ourDenies, value: v.ourDenies, color: SIDE_COLOR[k] },
                    { ...rest, value: Math.max(0, v.ourRest) },
                  ]}
                />
              </div>
              <p className="text-muted-foreground">
                {c.lhLane != null ? x.lhNote(c.lhAll, c.lhLane, c.until / 60) : x.lhNoPlaces}
              </p>
            </div>
          );
        }}
      </PerSide>
      <Caveat kind="estimate">
        {x.creepNote}
        {patch && ` ${patch}`}
      </Caveat>
    </Sub>
  );
}

// ── Rotations ────────────────────────────────────────────────────────────────────────────────

function RotationsBlock() {
  const { t } = useLab();
  const x = t.x.laning;
  const any = useSides().some(([, s]) => !!rotations(s));
  return (
    <Sub title={x.rotations} hint={x.rotationsHint}>
      <PerSide>
        {(k, s) => {
          const r = rotations(s);
          if (!r) return muted(x.noPath);
          const paid = r.mine.filter((v) => v.outcome !== "nothing").length;
          const died = r.mine.filter((v) => v.died).length;
          const gold = r.mine.reduce((a, v) => a + (v.gold ?? 0), 0);
          const xp = r.mine.reduce((a, v) => a + (v.xp ?? 0), 0);
          const killGold = r.mine.reduce((a, v) => a + v.killGold, 0);
          const tens = Math.min(EARLY, s.duration) / 600;
          return (
            <div className="flex flex-col gap-3 text-xs">
              {!r.home && <p className="text-muted-foreground">{x.noHome}</p>}
              {r.mine.length ? (
                <div className="flex flex-col gap-1">
                  <p>
                    {x.rotationLine(r.mine.length, num(r.mine.length / Math.max(0.1, tens), 1), paid, died)}
                    {r.rate && r.home
                      ? ` ${x.givenLine(num(gold), num(xp), killGold ? num(killGold) : null)}`
                      : ""}
                  </p>
                  <table className="w-full">
                    <thead className="text-left text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-1 font-normal">{x.time}</th>
                        <th className="py-1 font-normal">{x.where}</th>
                        <th className="py-1 font-normal">{x.how}</th>
                        <th className="py-1 font-normal">{x.result}</th>
                        <th className="py-1 text-right font-normal">{x.killGold}</th>
                        <th className="py-1 text-right font-normal">{x.away}</th>
                        <th className="py-1 text-right font-normal">{x.givenUp}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.mine.map((v, i) => (
                        <tr key={i} className="border-b align-top last:border-0">
                          <td className="py-1 tabular-nums">{clock(v.start)}</td>
                          <td className="py-1">{t.lanes[v.lane]}</td>
                          <td className="py-1">{v.tp ? x.tp : x.walk}</td>
                          <td className="py-1">
                            <span className="flex flex-wrap items-center gap-1">
                              <span
                                className={cn(
                                  "rounded px-1",
                                  v.outcome === "nothing"
                                    ? "bg-muted"
                                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                                )}
                              >
                                {x.outcomes[v.outcome]}
                              </span>
                              {[...v.kills, ...v.assists].map((h, j) => (
                                <HeroIcon key={j} id={h} size={16} />
                              ))}
                              {v.died && <span className="text-red-600 dark:text-red-400">✝ {x.died}</span>}
                            </span>
                          </td>
                          <td className="py-1 text-right tabular-nums">
                            {v.killGold ? `+${num(v.killGold)}` : "–"}
                          </td>
                          <td className="py-1 text-right tabular-nums">
                            {v.away != null ? clock(Math.round(v.away)) : "–"}
                          </td>
                          <td className="py-1 text-right tabular-nums">
                            {v.gold != null ? `${num(v.gold)} / ${num(v.xp)}` : "–"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground">{x.noRotation}</p>
              )}
              {r.home && (
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{x.enemyIn}</span>
                  {r.enemies.length ? (
                    <table className="w-full">
                      <thead className="text-left text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-1 font-normal">{x.time}</th>
                          <th className="py-1 font-normal">{x.who}</th>
                          <th className="py-1 font-normal">{x.youThere}</th>
                          <th className="py-1 font-normal">{x.then}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.enemies.map((e, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1 tabular-nums">{clock(e.t)}</td>
                            <td className="py-1">
                              <span className="flex flex-wrap items-center gap-0.5">
                                {e.heroes.map((h) => (
                                  <HeroIcon key={h} id={h} size={16} />
                                ))}
                                {e.tp && <span className="ml-1 rounded bg-muted px-1">{x.jump}</span>}
                              </span>
                            </td>
                            <td className="py-1">{e.youThere ? x.here : x.notHere}</td>
                            <td className="py-1">
                              <span className="flex flex-wrap items-center gap-0.5">
                                {e.ourDeaths.length
                                  ? e.ourDeaths.map((h, j) => (
                                      <HeroIcon
                                        key={j}
                                        id={h}
                                        size={16}
                                        className={cn(h === s.heroId && "ring-2 ring-red-500")}
                                      />
                                    ))
                                  : "–"}
                                <span className="mx-1 text-muted-foreground">/</span>
                                {e.theirDeaths.length
                                  ? e.theirDeaths.map((h, j) => <HeroIcon key={j} id={h} size={16} />)
                                  : "–"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-muted-foreground">{x.noEnemyIn}</p>
                  )}
                </div>
              )}
            </div>
          );
        }}
      </PerSide>
      {any && (
        <>
          <Caveat kind="estimate">{x.rotationNote}</Caveat>
          <Caveat kind="source">{x.positionsNote}</Caveat>
        </>
      )}
    </Sub>
  );
}

// ── Runes ────────────────────────────────────────────────────────────────────────────────────

function RunesBlock() {
  const { t } = useLab();
  const x = t.x.laning;
  const patch = usePatchNote();
  return (
    <Sub title={x.runes} hint={x.runesHint}>
      <PerSide>
        {(k, s) => {
          const rc = runeControl(s);
          if (!rc) return muted(x.noRunes);
          const all = RUNE_KINDS.map((kind) => rc.kinds[kind]);
          const add = (f: (v: (typeof all)[number]) => number) => all.reduce((a, v) => a + f(v), 0);
          const rows = [
            ...RUNE_KINDS.map((kind) => ({ key: kind, label: x.runeKinds[kind], ...rc.kinds[kind] })),
            {
              key: "total",
              label: x.total,
              ours: add((v) => v.ours),
              theirs: add((v) => v.theirs),
              mine: add((v) => v.mine),
              oursOnTime: add((v) => v.oursOnTime),
              theirsOnTime: add((v) => v.theirsOnTime),
            },
          ];
          return (
            <div className="flex flex-col gap-2 text-xs">
              <table className="w-full">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-1 font-normal">{x.kind}</th>
                    <th className="py-1 text-right font-normal">{x.ours}</th>
                    <th className="py-1 text-right font-normal">{x.theirs}</th>
                    <th className="py-1 text-right font-normal">{x.share}</th>
                    <th className="py-1 text-right font-normal">{x.mine}</th>
                    <th className="py-1 text-right font-normal">{x.onTime}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.key}
                      className={cn("border-b last:border-0", r.key === "total" && "font-medium")}
                    >
                      <td className="py-1">{r.label}</td>
                      <td className="py-1 text-right tabular-nums">{r.ours}</td>
                      <td className="py-1 text-right tabular-nums">{r.theirs}</td>
                      <td className="py-1 text-right tabular-nums">
                        {r.ours + r.theirs ? pct(r.ours / (r.ours + r.theirs)) : "–"}
                      </td>
                      <td className="py-1 text-right tabular-nums">{r.mine}</td>
                      <td className="py-1 text-right tabular-nums">
                        {r.oursOnTime} / {r.theirsOnTime}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rc.power.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{x.afterPower}</span>
                  <ul className="flex flex-col gap-0.5">
                    {rc.power.map((p, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-1.5">
                        <span className="w-10 tabular-nums">{clock(p.t)}</span>
                        <span className={cn("w-8", !p.ours && "text-muted-foreground")}>
                          {p.ours ? x.ours : x.theirs}
                        </span>
                        <HeroIcon id={p.hero} size={16} />
                        <span className="text-muted-foreground">
                          {t.resources.runeNames[p.rune] ?? p.rune}
                        </span>
                        {p.kills.length ? (
                          <span className="flex items-center gap-0.5">
                            →
                            {p.kills.map((h, j) => (
                              <HeroIcon key={j} id={h} size={16} />
                            ))}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{x.noKill}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        }}
      </PerSide>
      <Caveat kind="estimate">
        {x.runeNote}
        {patch && ` ${patch}`}
      </Caveat>
    </Sub>
  );
}

export function LaningBlocks() {
  return (
    <>
      <ExpectBlock />
      <GapsBlock />
      <WaveBlock />
      <CreepsBlock />
      <RotationsBlock />
      <RunesBlock />
    </>
  );
}

// ── Matchup threats (the game's context) ─────────────────────────────────────────────────────

export function ThreatBlock() {
  const { t } = useLab();
  const x = t.x.laning;
  const names = useNames();
  const source = useSourceNote((s) => {
    const bl = s.advanced.baseline;
    return bl && threat(s)
      ? x.threatSource(t.deep.brackets[bl.bracket] ?? bl.bracket, bl.week != null)
      : null;
  });
  return (
    <Sub title={x.threat} hint={x.threatHint}>
      <PerSide>
        {(k, s) => {
          const th = threat(s);
          if (!th) return muted(x.noThreat);
          const list = (f: (synergy: number) => boolean) =>
            th.rows
              .filter((r) => r.n >= MIN_GAMES && r.synergy != null && f(r.synergy))
              .map((r) => names.heroes(r.hero))
              .join(t.insight.sep);
          return (
            <div className="flex flex-col gap-2 text-xs">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-1 font-normal">{x.hero}</th>
                      <th className="py-1 text-right font-normal">{x.games}</th>
                      <th className="py-1 text-right font-normal">{x.winRate}</th>
                      <th className="py-1 text-right font-normal">{x.advantage}</th>
                      <th className="py-1 text-right font-normal">{x.takenShare}</th>
                      <th className="py-1 text-right font-normal">{x.killedYou}</th>
                      <th className="py-1 text-right font-normal">{x.dealtShare}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {th.rows.map((r) => (
                      <tr
                        key={r.hero}
                        className={cn("border-b last:border-0", r.n < MIN_GAMES && "text-muted-foreground")}
                      >
                        <td className="py-1">
                          <span className="flex items-center gap-1">
                            <HeroIcon id={r.hero} size={18} />
                            {r.lane && <span className="rounded bg-muted px-1 text-[10px]">{x.laneTag}</span>}
                          </span>
                        </td>
                        <td className="py-1 text-right tabular-nums">{num(r.n)}</td>
                        <td className="py-1 text-right tabular-nums">{pct(r.winRate, 1)}</td>
                        <td
                          className={cn(
                            "py-1 text-right font-medium tabular-nums",
                            r.synergy != null && Math.abs(r.synergy) >= COUNTER && tone(r.synergy),
                          )}
                        >
                          {r.synergy != null ? points(r.synergy) : "–"}
                        </td>
                        <td className="py-1 text-right tabular-nums">{pct(r.takenShare)}</td>
                        <td className="py-1 text-right tabular-nums">{r.kills}</td>
                        <td className="py-1 text-right tabular-nums">{pct(r.dealtShare)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {th.avg != null && <p>{x.draftLine(points(th.avg), th.used)}</p>}
              {th.countersTaken != null && (
                <p>
                  {x.countersLine(
                    list((v) => v <= -COUNTER),
                    pct(th.countersTaken),
                  )}
                </p>
              )}
              {th.counteredDealt != null && (
                <p>
                  {x.counteredLine(
                    list((v) => v >= COUNTER),
                    pct(th.counteredDealt),
                  )}
                </p>
              )}
            </div>
          );
        }}
      </PerSide>
      {source && <Caveat kind="source">{source}</Caveat>}
    </Sub>
  );
}
