"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { type Metric, num, pct, xOf } from "../insights";
import {
  Bars,
  Caveat,
  HeroIcon,
  PerSide,
  SIDE_COLOR,
  SideDot,
  type SideKey,
  Sub,
  useLab,
  useNames,
  useSides,
  useTimeWindow,
} from "../lab-parts";
import * as C from "./decisions-calc";
import { muted, ObjectivesBlocks, Part } from "./decisions-objectives";
import { buildingLabel, objectiveLabel, swingFmt, tone } from "./decisions-text";
import type { Ctx, LabModule, Lesson } from "./types";

// Decisions and the map: key moments, conversions, objectives, defense, skirmishes, space.

const sidesOf = (a: LabSide, b: LabSide | null) =>
  (b
    ? [
        ["a", a],
        ["b", b],
      ]
    : [["a", a]]) as [SideKey, LabSide][];

const median = (list: number[]) => {
  if (!list.length) return null;
  const v = [...list].sort((p, q) => p - q);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

// ── Key moments ──────────────────────────────────────────────────────────────────────────────

function MomentRow({ s, m, kind }: { s: LabSide; m: C.Moment; kind: C.SwingKind }) {
  const { t } = useLab();
  const x = t.x.decisions;
  const what = [
    ...m.fights.map((i) => {
      const f = s.fights.teamfights[i];
      return x.fightLine(clock(f.start), f.teamDeaths, f.enemyDeaths);
    }),
    ...(m.fights.length || !(m.ours + m.theirs) ? [] : [x.deathsLine(m.ours, m.theirs)]),
    ...m.objectives.map((o) => {
      const good = o.type === "courier" ? o.radiant !== s.radiant : o.radiant === s.radiant;
      return `${good ? "▲" : "▼"} ${objectiveLabel(o, t)}`;
    }),
  ];
  const me = [
    m.dead > 0 ? x.deadFor(Math.round(m.dead)) : null,
    m.activity && m.activity !== "dead" ? t.deep.activities[m.activity] : null,
    m.area ? t.movement.zoneNames[m.area] : null,
    m.dist != null ? x.away(x.units(num(m.dist))) : null,
    m.kills + m.deaths + m.assists ? `${t.header.kda} ${m.kills}/${m.deaths}/${m.assists}` : null,
    m.dealt ? x.dealt(num(m.dealt)) : null,
  ].filter(Boolean);
  return (
    <tr className="border-b align-top last:border-0">
      <td className="py-1 pr-2 whitespace-nowrap tabular-nums">
        {clock(m.from)}–{clock(m.to)}
      </td>
      <td className={cn("py-1 pr-2 text-right font-semibold whitespace-nowrap tabular-nums", tone(m.swing))}>
        {swingFmt(kind, m.swing)}
      </td>
      <td className="py-1 pr-2">
        {what.length ? what.join(t.insight.sep) : <span className="text-muted-foreground">{x.nothing}</span>}
      </td>
      <td className="py-1 pr-2 text-muted-foreground">{me.join(" · ") || "–"}</td>
      <td className="py-1 pr-2">
        <Part v={m.present} />
      </td>
      <td className="py-1 whitespace-nowrap tabular-nums">▶ {clock(Math.round(m.watch))}</td>
    </tr>
  );
}

function MomentsSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.decisions;
  const [from, to] = useTimeWindow(s);
  const km = useMemo(() => C.keyMoments(s, from, to), [s, from, to]);
  if (!km) return <p className={muted}>{x.noSwing}</p>;
  const count = (list: C.Moment[]) =>
    [list.length, list.filter((m) => m.present).length, list.filter((m) => m.quiet).length] as const;
  const [dn, dk, dq] = count(km.drops);
  const [gn, gk, gq] = count(km.gains);
  return (
    <div className="flex flex-col gap-2">
      {km.kind === "nw" && <Caveat kind="source">{x.momentsNw}</Caveat>}
      {(dn > 0 || gn > 0) && (
        <p className="text-xs">
          {dn > 0 && x.dropsLine(dn, dk, dq)} {gn > 0 && x.gainsLine(gn, gk, gq)}
          {!s.path.t.length && <span className="text-muted-foreground"> {x.partNoPositions}</span>}
        </p>
      )}
      {km.list.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 font-normal">{x.colMinute}</th>
                <th className="py-1 text-right font-normal">{x.colSwing}</th>
                <th className="py-1 font-normal">{x.colWhat}</th>
                <th className="py-1 font-normal">{x.colMe}</th>
                <th className="py-1 font-normal whitespace-nowrap">{x.colPart}</th>
                <th className="py-1 font-normal whitespace-nowrap">{x.colWatch}</th>
              </tr>
            </thead>
            <tbody>
              {km.list.map((m) => (
                <MomentRow key={m.m} s={s} m={m} kind={km.kind} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={muted}>{x.none}</p>
      )}
    </div>
  );
}

// The replay of each match shown, and why only the game clock is given.
function WatchNote() {
  const { t } = useLab();
  const x = t.x.decisions;
  const sides = useSides();
  const links = sides.filter(
    ([, s], i) => s.match.replayUrl && sides.findIndex(([, o]) => o.matchId === s.matchId) === i,
  );
  return (
    <Caveat kind="source">
      <span>{x.watchNote}</span>
      {links.map(([k, s]) => (
        <a
          key={k}
          href={s.match.replayUrl!}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          {x.replay}
          {links.length > 1 ? ` · ${s.matchId}` : ""}
        </a>
      ))}
    </Caveat>
  );
}

function KeyMoments() {
  const { t } = useLab();
  const x = t.x.decisions;
  return (
    <Sub title={x.moments} hint={x.momentsHint}>
      <PerSide>{(k, s) => <MomentsSide s={s} />}</PerSide>
      <p className={muted}>{x.partHint}</p>
      <WatchNote />
    </Sub>
  );
}

// ── The swing while something happened ──────────────────────────────────────────────────────

function SwingTable({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.decisions;
  const sw = useMemo(() => C.swingWhile(s), [s]);
  if (!sw) return <p className={muted}>{x.noSwing}</p>;
  const nwNote = sw.kind === "nw" && <Caveat kind="source">{x.momentsNw}</Caveat>;
  const cell = (v: number, n: number) =>
    n ? (
      <>
        <span className={cn("tabular-nums", tone(v))}>{swingFmt(sw.kind, v)}</span>
        <span className="ml-1 text-[10px] text-muted-foreground">{x.minutes(n)}</span>
      </>
    ) : (
      <span className="text-muted-foreground">–</span>
    );
  return (
    <div className="flex flex-col gap-2">
      {nwNote}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal" />
              {sw.phases.map((p) => (
                <th key={p.key} className="py-1 font-normal">
                  {x.phaseNames[p.key]}
                </th>
              ))}
              <th className="py-1 font-normal">{x.total}</th>
            </tr>
          </thead>
          <tbody>
            {C.SWING_CATS.map((c) => {
              const r = sw.rows[c];
              return (
                <tr key={c} className="border-b last:border-0">
                  <td className="py-1 pr-2">{x.swingCats[c]}</td>
                  {r.sum.map((v, i) => (
                    <td key={i} className="py-1 pr-2 whitespace-nowrap">
                      {cell(v, r.n[i])}
                    </td>
                  ))}
                  <td className="py-1 whitespace-nowrap">
                    {cell(
                      r.sum.reduce((p, q) => p + q, 0),
                      r.n.reduce((p, q) => p + q, 0),
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SwingWhile() {
  const { t } = useLab();
  const x = t.x.decisions;
  return (
    <Sub title={x.swing} hint={x.swingHint}>
      <Caveat kind="estimate">{x.swingCaveat}</Caveat>
      <PerSide>{(k, s) => <SwingTable s={s} />}</PerSide>
    </Sub>
  );
}

// ── After a won fight or a kill ──────────────────────────────────────────────────────────────

function AfterSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.decisions;
  const [from, to] = useTimeWindow(s);
  const af = useMemo(() => C.afterFights(s, from, to), [s, from, to]);
  const timed = s.advanced.activity.length > 0;
  // Counted per kill: two kills before the same death both read 'died after'.
  const counts = new Map<string, number>();
  for (const p of af.picks) if (p.doing) counts.set(p.doing, (counts.get(p.doing) ?? 0) + 1);
  const parts = [...counts.entries()].map(([k, n]) => x.afterN(x.doing[k], n)).join(t.insight.sep);
  const lossDeaths = af.deaths.filter((d) => d.lost.length);
  return (
    <div className="flex flex-col gap-2 text-xs">
      <p>
        {af.won.length ? x.afterLine(af.won.length, af.converted, s.parsed.stratz ? af.hit : null) : x.noWon}
      </p>
      {af.won.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 font-normal">{x.colFight}</th>
                <th className="py-1 font-normal">{x.colDeaths}</th>
                <th className="py-1 font-normal">{x.colTook}</th>
                <th className="py-1 font-normal">{x.colTime}</th>
                <th className="py-1 text-right font-normal">{x.colHit}</th>
              </tr>
            </thead>
            <tbody>
              {af.won.map((w) => (
                <tr key={w.i} className="border-b align-top last:border-0">
                  <td className="py-1 pr-2 whitespace-nowrap tabular-nums">
                    {clock(w.start)}–{clock(w.end)}
                  </td>
                  <td className="py-1 pr-2 tabular-nums">
                    {w.ours} / {w.theirs}
                  </td>
                  <td className="py-1 pr-2">
                    {w.taken.length ? (
                      w.taken.map((o) => `${objectiveLabel(o, t)} ${clock(o.t)}`).join(t.insight.sep)
                    ) : (
                      <span className="text-red-600 dark:text-red-400">{x.none}</span>
                    )}
                  </td>
                  <td className="py-1 pr-2 tabular-nums">
                    {timed
                      ? `${w.time.farm} / ${w.time.fight} / ${w.time.move} / ${w.time.base} / ${w.time.dead}`
                      : "–"}
                  </td>
                  <td className="py-1 text-right tabular-nums">{s.parsed.stratz ? num(w.hit) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {af.picks.length > 0 && (
        <p>{x.picksLine(af.picks.length, af.picks.filter((p) => p.taken.length).length, parts || "–")}</p>
      )}
      {af.deaths.length > 0 && (
        <p>
          {x.deathLoss(lossDeaths.length, af.deaths.length)}
          {lossDeaths.length > 0 && (
            <span className="text-muted-foreground">
              {t.insight.colon}
              {lossDeaths
                .map(
                  (d) =>
                    `${clock(d.t)} → ${d.lost.map((o) => `${objectiveLabel(o, t)} ${clock(o.t)}`).join(t.insight.sep)}`,
                )
                .join(x.listSep)}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function AfterFights() {
  const { t } = useLab();
  const x = t.x.decisions;
  return (
    <Sub title={x.after} hint={x.afterHint}>
      <PerSide>{(k, s) => <AfterSide s={s} />}</PerSide>
    </Sub>
  );
}

// ── Phases set by the game's events ──────────────────────────────────────────────────────────

const SHARES = ["farm", "fight", "move", "dead"] as const;

function PhasesBlock() {
  const { t, a, b } = useLab();
  const x = t.x.decisions;
  const rows = useMemo(
    () => sidesOf(a, b).map(([k, s]) => ({ k, s, ph: C.phases(s), st: C.phaseStats(s) })),
    [a, b],
  );
  const keys = ["laning", "mid", "late"] as const;
  // The largest time-use gap of each phase (pairs), and phases where a side took 30%+ of the team's
  // deaths (3 or more).
  const sentences = keys.flatMap((key) => {
    const out: string[] = [];
    const pa = rows[0].st.find((p) => p.key === key);
    const pb = rows[1]?.st.find((p) => p.key === key);
    if (pa && pb) {
      const best = SHARES.map((k) => ({ k, va: pa[k], vb: pb[k] }))
        .filter(
          (d): d is { k: (typeof SHARES)[number]; va: number; vb: number } => d.va != null && d.vb != null,
        )
        .sort((p, q) => Math.abs(q.va - q.vb) - Math.abs(p.va - p.vb))[0];
      if (best && Math.abs(best.va - best.vb) >= 0.08)
        out.push(x.phaseDiff(x.phaseNames[key], x.shares[best.k], pct(best.va), pct(best.vb)));
    }
    for (const { k, st } of rows) {
      const p = st.find((q) => q.key === key);
      if (p && p.died >= 3 && p.deathShare != null && p.deathShare >= 0.3)
        out.push(
          x.phaseDeaths(
            x.phaseNames[key],
            rows.length > 1 ? (k === "a" ? t.insight.a : t.insight.b) : "",
            pct(p.deathShare),
            p.died,
            p.ourDeaths,
          ),
        );
    }
    return out;
  });
  return (
    <Sub title={x.phases} hint={x.phasesHint}>
      <ul className="flex flex-col gap-0.5 text-xs">
        {rows.map(({ k, ph }) => (
          <li key={k} className="flex flex-wrap items-center gap-x-2">
            {rows.length > 1 && <SideDot side={k} />}
            <span className="tabular-nums">
              {ph.list
                .map((p) =>
                  x.phaseSpan(x.phaseNames[p.key], clock(Math.round(p.from)), clock(Math.round(p.to))),
                )
                .join(" · ")}
            </span>
            <span className="text-muted-foreground">{x.paren(x.laneWhy[ph.laneWhy])}</span>
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal">{x.colPhase}</th>
              <th className="py-1 font-normal">{x.colSpan}</th>
              <th className="py-1 text-right font-normal">{x.colFarm}</th>
              <th className="py-1 text-right font-normal">{x.colFightShare}</th>
              <th className="py-1 text-right font-normal">{x.colMove}</th>
              <th className="py-1 text-right font-normal">{x.colDead}</th>
              <th className="py-1 pl-3 font-normal">{x.colPace}</th>
              <th className="py-1 text-right font-normal">{x.colDeathShare}</th>
              <th className="py-1 text-right font-normal">{x.colKp}</th>
            </tr>
          </thead>
          <tbody>
            {keys.flatMap((key) =>
              rows.map(({ k, st }, i) => {
                const p = st.find((q) => q.key === key);
                if (!p) return null;
                return (
                  <tr key={`${key}-${k}`} className={cn("border-b last:border-0", i > 0 && "border-dashed")}>
                    <td className="py-1 pr-2">
                      <span className="flex items-center gap-1.5">
                        {rows.length > 1 && <SideDot side={k} />}
                        {x.phaseNames[key]}
                      </span>
                    </td>
                    <td className="py-1 pr-2 whitespace-nowrap tabular-nums">
                      {clock(Math.round(p.from))}–{clock(Math.round(p.to))}
                    </td>
                    {SHARES.map((sh) => (
                      <td key={sh} className="py-1 text-right tabular-nums">
                        {pct(p[sh])}
                      </td>
                    ))}
                    <td className="py-1 pl-3 tabular-nums">
                      {num(p.killsPm, 2)} · {p.nwPm != null ? num(p.nwPm) : "–"}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {p.died}
                      {p.deathShare != null && (
                        <span className="ml-1 text-muted-foreground">{x.paren(pct(p.deathShare))}</span>
                      )}
                    </td>
                    <td className="py-1 text-right tabular-nums">{pct(p.kp)}</td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      {sentences.length > 0 && <p className="text-xs">{sentences.join(" ")}</p>}
      <p className={muted}>{x.paceHint}</p>
    </Sub>
  );
}

// ── Buybacks late in the game ────────────────────────────────────────────────────────────────

function BuybackSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.decisions;
  const [from, to] = useTimeWindow(s);
  const bb = useMemo(() => C.buybackLate(s, from, to), [s, from, to]);
  if (!bb) return <p className={muted}>{x.bbShort}</p>;
  const flagged = [
    ...bb.noGold.map((d) => ({ t: d.t, text: x.bbLackRow(clock(d.t), num(d.gold), num(d.cost)) })),
    ...bb.unused.map((d) => ({
      t: d.t,
      text: x.bbUnusedRow(
        clock(d.t),
        d.lost.map((o) => `${buildingLabel(o.key, t)} ${clock(o.t)}`).join(t.insight.sep),
      ),
    })),
  ].sort((p, q) => p.t - q.t);
  return (
    <div className="flex flex-col gap-1 text-xs">
      <p>
        {x.bbStart(clock(Math.round(bb.start)), bb.byTower)}
        {t.insight.colon}
        {bb.held != null && bb.alive > 0
          ? x.bbHeld(pct(bb.held / bb.alive), bb.buybacks)
          : x.bbCount(bb.buybacks)}{" "}
        {!bb.deaths.length
          ? x.bbNoDeaths
          : bb.known
            ? x.bbDeaths(bb.deaths.length, bb.noGold.length, bb.unused.length)
            : x.bbUnknown}
      </p>
      {flagged.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-muted-foreground tabular-nums">
          {flagged.map((f, i) => (
            <li key={i}>{f.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BuybackBlock() {
  const { t } = useLab();
  const x = t.x.decisions;
  return (
    <Sub title={x.buyback} hint={x.buybackHint}>
      <PerSide>{(k, s) => <BuybackSide s={s} />}</PerSide>
    </Sub>
  );
}

// ── After each respawn ───────────────────────────────────────────────────────────────────────

function RespawnSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.decisions;
  const [from, to] = useTimeWindow(s);
  const list = useMemo(() => C.respawns(s, from, to), [s, from, to]);
  if (!s.parsed.stratz) return <p className={muted}>{x.noTiming}</p>;
  if (!list.length) return <p className={muted}>{x.none}</p>;
  const mid = median(list.flatMap((r) => (r.lh != null ? [r.lh] : [])));
  return (
    <div className="flex flex-col gap-2 text-xs">
      <p>
        {x.respawnLine(
          list.length,
          list.filter((r) => r.tp != null && r.tp <= 15).length,
          mid != null ? x.sec(Math.round(mid)) : "–",
        )}
      </p>
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal">{x.colRespawn}</th>
              <th className="py-1 font-normal">{x.colTp}</th>
              <th className="py-1 font-normal">{x.colLh}</th>
              <th className="py-1 font-normal">{x.colEngage}</th>
              <th className="py-1 font-normal">{x.colWent}</th>
              <th className="py-1 font-normal">{x.colNote}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.death} className="border-b last:border-0">
                <td className="py-1 tabular-nums">{clock(Math.round(r.t))}</td>
                <td className="py-1 tabular-nums">{r.tp != null ? x.plus(Math.round(r.tp)) : x.walked}</td>
                <td className="py-1 tabular-nums">{r.lh != null ? x.plus(Math.round(r.lh)) : "–"}</td>
                <td className="py-1 tabular-nums">{r.fight != null ? x.plus(Math.round(r.fight)) : "–"}</td>
                <td className="py-1">{r.went ? x.went[r.went] : "–"}</td>
                <td className="py-1 text-muted-foreground">
                  {[r.buyback && x.bought, r.alone && x.alone, r.diedAgain && x.diedAgain]
                    .filter(Boolean)
                    .join(t.insight.sep)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RespawnBlock() {
  const { t } = useLab();
  const x = t.x.decisions;
  return (
    <Sub title={x.respawn} hint={x.respawnHint}>
      <PerSide>{(k, s) => <RespawnSide s={s} />}</PerSide>
    </Sub>
  );
}

// ── Every exchange ───────────────────────────────────────────────────────────────────────────

const RESULT_COLOR: Record<C.Encounter["result"], string> = {
  won: "#22c55e",
  lost: "#ef4444",
  traded: "#eab308",
  even: "#9ca3af",
};

function EncounterChart() {
  const { t, a, b, align, range } = useLab();
  const x = t.x.decisions;
  const option = useMemo<EChartsOption | null>(() => {
    const series = sidesOf(a, b).map(([k, s]) => ({
      name: k === "a" ? t.insight.a : t.insight.b,
      type: "scatter" as const,
      symbol: k === "a" ? "circle" : "rect",
      data: C.encounters(s).flatMap((e) => {
        const at = xOf(s, e.start, align);
        if (at == null) return [];
        return [
          {
            value: [at, e.dealt - e.taken],
            name: `${k === "a" ? t.insight.a : t.insight.b} ${clock(e.start)} · ${x.results[e.result]} · ${num(e.dealt)} / ${num(e.taken)}`,
            symbolSize: Math.max(5, Math.min(16, Math.sqrt(e.dealt + e.taken) / 5)),
            itemStyle: { color: RESULT_COLOR[e.result], opacity: 0.85 },
          },
        ];
      }),
    }));
    if (!series.some((p) => p.data.length)) return null;
    return {
      animation: false,
      grid: { left: 52, right: 12, top: 28, bottom: 24 },
      title: { text: x.netDamage, left: 0, top: 0, textStyle: { fontSize: 11, fontWeight: 500 } },
      tooltip: { trigger: "item", formatter: (p: unknown) => (p as { name: string }).name },
      xAxis: {
        type: "value",
        min: range[0],
        max: range[1],
        axisLabel: {
          fontSize: 10,
          formatter: (v: number) => (align.kind === "level" ? String(v) : String(Math.round(v))),
        },
        splitLine: { show: false },
      },
      yAxis: { type: "value", axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { opacity: 0.3 } } },
      series,
    };
  }, [a, b, align, range, t, x]);
  if (!option) return null;
  return (
    <div className="h-48 min-w-0">
      <EChart option={option} />
    </div>
  );
}

function EncounterSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.decisions;
  const [from, to] = useTimeWindow(s);
  const list = useMemo(() => C.encounters(s).filter((e) => e.start >= from && e.start <= to), [s, from, to]);
  const by = useMemo(() => C.encountersByPhase(s, list), [s, list]);
  if (!s.advanced.damage.length) return <p className={muted}>{x.noTiming}</p>;
  const small = list.filter((e) => !e.teamfight);
  const duels = list.filter((e) => e.duel);
  return (
    <div className="flex flex-col gap-2 text-xs">
      <p>
        {x.encountersLine(
          list.length,
          list.length ? pct(list.filter((e) => e.result === "won").length / list.length) : "–",
          small.length,
          small.filter((e) => e.result === "won").length,
        )}
        {duels.length > 0 &&
          ` ${x.duelsLine(
            duels.length,
            duels.filter((e) => e.result === "won").length,
            duels.filter((e) => e.result === "lost").length,
          )}`}
      </p>
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal">{x.colPhase}</th>
            <th className="py-1 text-right font-normal">{x.colN}</th>
            <th className="py-1 text-right font-normal">{x.colWon}</th>
            <th className="py-1 text-right font-normal">{x.colLost}</th>
            <th className="py-1 text-right font-normal">{x.colEven}</th>
            <th className="py-1 text-right font-normal">{x.colSmall}</th>
            <th className="py-1 text-right font-normal">{x.colFirst}</th>
          </tr>
        </thead>
        <tbody>
          {by.map((p) => (
            <tr key={p.key} className="border-b last:border-0">
              <td className="py-1">{x.phaseNames[p.key]}</td>
              <td className="py-1 text-right tabular-nums">{p.n}</td>
              <td className="py-1 text-right tabular-nums">{p.won}</td>
              <td className="py-1 text-right tabular-nums">{p.lost}</td>
              <td className="py-1 text-right tabular-nums">{p.even}</td>
              <td className="py-1 text-right tabular-nums">
                {p.small}
                <span className="ml-0.5 text-muted-foreground">{x.paren(String(p.smallWon))}</span>
              </td>
              <td className="py-1 text-right tabular-nums">{p.n ? pct(p.first / p.n) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EncountersBlock() {
  const { t } = useLab();
  const x = t.x.decisions;
  return (
    <Sub title={x.encounters} hint={x.encountersHint}>
      <Caveat kind="estimate">{x.encountersCaveat}</Caveat>
      <EncounterChart />
      <PerSide>{(k, s) => <EncounterSide s={s} />}</PerSide>
    </Sub>
  );
}

// ── Ally deaths ──────────────────────────────────────────────────────────────────────────────

const CLS_ORDER: C.AllyCls[] = ["helped", "late", "couldHelp", "tooFar", "dead"];

function AllySide({ k, s }: { k: SideKey; s: LabSide }) {
  const { t } = useLab();
  const x = t.x.decisions;
  const names = useNames();
  const [from, to] = useTimeWindow(s);
  const list = useMemo(() => C.allyDeaths(s, from, to), [s, from, to]);
  if (!list) return <p className={muted}>{x.noPositions}</p>;
  if (!list.length) return <p className={muted}>{x.none}</p>;
  return (
    <div className="flex flex-col gap-2 text-xs">
      <Bars
        color={SIDE_COLOR[k]}
        max={list.length}
        rows={CLS_ORDER.map((c) => ({
          key: c,
          label: x.cls[c],
          value: list.filter((d) => d.cls === c).length,
        }))}
      />
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal">{t.fights.time}</th>
              <th className="py-1 font-normal">{x.colAlly}</th>
              <th className="py-1 text-right font-normal">{x.colDist}</th>
              <th className="py-1 text-right font-normal">{x.colHitAlly}</th>
              <th className="py-1 pl-2 font-normal">{x.colCls}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-1 tabular-nums">{clock(d.t)}</td>
                <td className="py-1">
                  <span className="flex items-center gap-1" title={names.heroes(d.hero)}>
                    <HeroIcon id={d.hero} size={16} />
                    {d.killer != null && (
                      <>
                        <span className="text-muted-foreground">←</span>
                        <HeroIcon id={d.killer} size={14} />
                      </>
                    )}
                  </span>
                </td>
                <td className="py-1 text-right whitespace-nowrap tabular-nums">
                  {d.dist20 != null && d.dist != null ? `${num(d.dist20)} → ${num(d.dist)}` : "–"}
                </td>
                <td className="py-1 text-right tabular-nums">{d.dealt ? num(d.dealt) : "–"}</td>
                <td className="py-1 pl-2">
                  {x.cls[d.cls]}
                  {d.cls === "couldHelp" && d.near && (
                    <span className="ml-1 text-muted-foreground">{x.paren(x.nearNoHit)}</span>
                  )}
                  {d.tp && d.cls !== "dead" && <span className="ml-1 text-muted-foreground">{x.tp}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AllyBlock() {
  const { t } = useLab();
  const x = t.x.decisions;
  return (
    <Sub title={x.allies} hint={x.alliesHint}>
      <Caveat kind="hindsight">{x.alliesCaveat}</Caveat>
      <PerSide>{(k, s) => <AllySide k={k} s={s} />}</PerSide>
    </Sub>
  );
}

// ── Space ────────────────────────────────────────────────────────────────────────────────────

function SpaceSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.decisions;
  const names = useNames();
  const sp = useMemo(() => C.space(s), [s]);
  if (!sp) return <p className={muted}>{x.noPositions}</p>;
  const count = (kind: string) => sp.deaths.filter((d) => d.kind === kind).length;
  return (
    <div className="flex flex-col gap-2 text-xs">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal">{x.colPhase}</th>
            <th className="py-1 text-right font-normal">{x.colAvg}</th>
            <th className="py-1 text-right font-normal">{x.colShare}</th>
          </tr>
        </thead>
        <tbody>
          {sp.phases.map((p) => (
            <tr key={p.key} className="border-b">
              <td className="py-1">{x.phaseNames[p.key]}</td>
              <td className="py-1 text-right tabular-nums">{num(p.avg, 2)}</td>
              <td className="py-1 text-right tabular-nums">{pct(p.share, 1)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-1 font-medium">{x.total}</td>
            <td className="py-1" />
            <td className="py-1 text-right font-medium tabular-nums">{pct(sp.share, 1)}</td>
          </tr>
        </tbody>
      </table>
      {sp.carry && (
        <p>
          {x.carryLine(names.heroes(sp.carry.hero), sp.carry.minutes, num(sp.carry.gpm), num(sp.carry.other))}
        </p>
      )}
      {sp.deaths.length > 0 && (
        <p>{x.spaceDeaths(count("space"), count("feed"), count("other"), count("team"))}</p>
      )}
    </div>
  );
}

function SpaceBlock() {
  const { t } = useLab();
  const x = t.x.decisions;
  return (
    <Sub title={x.space} hint={x.spaceHint}>
      <Caveat kind="hindsight">{x.spaceCaveat}</Caveat>
      <PerSide>{(k, s) => <SpaceSide s={s} />}</PerSide>
    </Sub>
  );
}

// ── Risky moments ────────────────────────────────────────────────────────────────────────────

function RiskSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.decisions;
  const r = useMemo(() => C.risk(s), [s]);
  if (!r) return <p className={muted}>{x.noPositions}</p>;
  const n = r.episodes.length;
  return (
    <div className="flex flex-col gap-2 text-xs">
      <p>
        {n
          ? x.riskLine(
              n,
              r.episodes.filter((e) => e.died).length,
              r.episodes.filter((e) => !e.died).length,
              r.episodes.filter((e) => e.close).length,
            )
          : x.noRisk}
      </p>
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal">{x.colPhase}</th>
            <th className="py-1 text-right font-normal">{x.colRiskTime}</th>
            <th className="py-1 text-right font-normal">{x.colEpisodes}</th>
            <th className="py-1 text-right font-normal">{x.colDied}</th>
            <th className="py-1 text-right font-normal">{x.colEscaped}</th>
            <th className="py-1 text-right font-normal">{x.colClose}</th>
          </tr>
        </thead>
        <tbody>
          {r.phases.map((p) => (
            <tr key={p.key} className="border-b last:border-0">
              <td className="py-1">{x.phaseNames[p.key]}</td>
              <td className="py-1 text-right tabular-nums">
                {x.sec(p.seconds)}
                <span className="ml-1 text-muted-foreground">{x.paren(pct(p.share, 1))}</span>
              </td>
              <td className="py-1 text-right tabular-nums">{p.episodes}</td>
              <td className="py-1 text-right tabular-nums">{p.died}</td>
              <td className="py-1 text-right tabular-nums">{p.escaped}</td>
              <td className="py-1 text-right tabular-nums">{p.close}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskBlock() {
  const { t } = useLab();
  const x = t.x.decisions;
  return (
    <Sub title={x.risk} hint={x.riskHint}>
      <Caveat kind="hindsight">{x.riskCaveat}</Caveat>
      <PerSide>{(k, s) => <RiskSide s={s} />}</PerSide>
    </Sub>
  );
}

function DecisionsBlocks() {
  return (
    <>
      <KeyMoments />
      <SwingWhile />
      <AfterFights />
      <PhasesBlock />
      <BuybackBlock />
      <RespawnBlock />
      <EncountersBlock />
      <AllyBlock />
      <SpaceBlock />
      <RiskBlock />
    </>
  );
}

// ── Readings, summary, metrics, lessons ──────────────────────────────────────────────────────

type Ratio = { k: number; n: number } | null;
const rate = (r: Ratio) => (r && r.n ? r.k / r.n : null);

function dropsTaken(s: LabSide, until = Infinity): Ratio {
  const d = C.keyMoments(s, -Infinity, until)?.drops.filter((m) => m.present != null) ?? [];
  return d.length >= 2 ? { k: d.filter((m) => m.present).length, n: d.length } : null;
}

function converted(s: LabSide, until = Infinity): Ratio {
  const af = C.afterFights(s, -Infinity, until);
  return af.won.length >= 2 ? { k: af.converted, n: af.won.length } : null;
}

function deathLoss(s: LabSide, until = Infinity): Ratio {
  const d = C.afterFights(s, -Infinity, until).deaths;
  return d.length >= 2 ? { k: d.filter((x) => x.lost.length).length, n: d.length } : null;
}

function presence(s: LabSide, until = Infinity): Ratio {
  const rows = C.objectiveRows(s, -Infinity, until).filter(
    (r) => r.ours && r.o.type !== "courier" && r.present != null,
  );
  return rows.length >= 3 ? { k: rows.filter((r) => r.present).length, n: rows.length } : null;
}

// A minute or more of living time after the buyback start.
function bbHeld(s: LabSide, until = Infinity) {
  const bb = C.buybackLate(s, -Infinity, until);
  return bb?.held != null && bb.alive >= 6 ? bb.held / bb.alive : null;
}

function riskShare(s: LabSide, until = Infinity) {
  const r = C.risk(s, until);
  if (!r) return null;
  const alive = r.phases.reduce((p, q) => p + q.alive, 0);
  return alive >= 600 ? r.phases.reduce((p, q) => p + q.seconds, 0) / alive : null;
}

function encounterWin(s: LabSide, until = Infinity) {
  const list = C.encounters(s).filter((e) => e.start <= until);
  return list.length >= 3 ? list.filter((e) => e.result === "won").length / list.length : null;
}

function allyHelped(s: LabSide, until = Infinity) {
  const list = C.allyDeaths(s, -Infinity, until)?.filter((d) => d.cls !== "dead") ?? [];
  return list.length >= 3 ? list.filter((d) => d.cls === "helped").length / list.length : null;
}

function respawnLh(s: LabSide, until = Infinity) {
  if (!s.parsed.stratz) return null;
  const list = C.respawns(s, -Infinity, until).flatMap((r) => (r.lh != null ? [r.lh] : []));
  return list.length >= 2 ? median(list) : null;
}

const decisionMetrics: Metric[] = [
  {
    key: "objPresence",
    fmt: "pct",
    higher: true,
    get: (s) => rate(presence(s)),
    getUntil: (s, u) => rate(presence(s, u)),
    label: (t) => t.x.decisions.metrics.objPresence,
  },
  {
    key: "fightConvert",
    fmt: "pct",
    higher: true,
    get: (s) => rate(converted(s)),
    getUntil: (s, u) => rate(converted(s, u)),
    label: (t) => t.x.decisions.metrics.fightConvert,
  },
  {
    key: "deathLoss",
    fmt: "pct",
    higher: false,
    get: (s) => rate(deathLoss(s)),
    getUntil: (s, u) => rate(deathLoss(s, u)),
    label: (t) => t.x.decisions.metrics.deathLoss,
  },
  {
    key: "bbHeld",
    fmt: "pct",
    higher: true,
    get: (s) => bbHeld(s),
    getUntil: (s, u) => bbHeld(s, u),
    label: (t) => t.x.decisions.metrics.bbHeld,
  },
  {
    key: "riskShare",
    fmt: "pct",
    higher: false,
    get: (s) => riskShare(s),
    getUntil: (s, u) => riskShare(s, u),
    label: (t) => t.x.decisions.metrics.riskShare,
  },
  {
    key: "encounterWin",
    fmt: "pct",
    higher: true,
    get: (s) => encounterWin(s),
    getUntil: (s, u) => encounterWin(s, u),
    label: (t) => t.x.decisions.metrics.encounterWin,
  },
  {
    // A farming carry is often right to stay away.
    key: "allyHelped",
    fmt: "pct",
    higher: null,
    dir: (s) => (s.position && s.position > 1 ? true : null),
    get: (s) => allyHelped(s),
    getUntil: (s, u) => allyHelped(s, u),
    label: (t) => t.x.decisions.metrics.allyHelped,
  },
  {
    // Drawing enemies is the offlaner's and the roaming support's job.
    key: "spaceShare",
    fmt: "pct",
    higher: null,
    dir: (s) => (s.position === 3 || s.position === 4 ? true : null),
    get: (s) => C.space(s)?.share ?? null,
    getUntil: (s, u) => C.space(s, u)?.share ?? null,
    label: (t) => t.x.decisions.metrics.spaceShare,
  },
  {
    key: "respawnLh",
    fmt: "int",
    higher: null,
    dir: (s) => (s.position && s.position <= 3 ? false : null),
    get: (s) => respawnLh(s),
    getUntil: (s, u) => respawnLh(s, u),
    label: (t) => t.x.decisions.metrics.respawnLh,
  },
];

function insights(ctx: Ctx) {
  const { a, b, t } = ctx;
  const x = t.x.decisions;
  const r = (v: Ratio) => (v ? x.ratio(v.k, v.n) : "–");
  // What the drops are of: the win chance, or the net-worth lead where STRATZ has none.
  const [ka, kb] = [C.swingSeries(a)?.kind, b ? C.swingSeries(b)?.kind : undefined];
  const [wa, wb] = [x.swingName[ka ?? kb ?? "win"], x.swingName[kb ?? ka ?? "win"]];
  const decisions: string[] = [];
  const objectives: string[] = [];
  if (!b) {
    const d = dropsTaken(a);
    if (d) decisions.push(x.insightMoments(d.n, d.k, wa));
    const c = converted(a);
    if (c) decisions.push(x.insightConvert(c.n, c.k));
    const p = presence(a);
    if (p) objectives.push(x.insightPresent(p.n, p.k));
    const far = C.defense(a).lostFarming;
    if (far) objectives.push(x.insightFar(far));
  } else {
    const [da, db] = [dropsTaken(a), dropsTaken(b)];
    if (da || db) decisions.push(x.insightMomentsPair(r(da), r(db), wa, wb));
    const [ca, cb] = [converted(a), converted(b)];
    if (ca || cb) decisions.push(x.insightConvertPair(r(ca), r(cb)));
    const [pa, pb] = [presence(a), presence(b)];
    if (pa || pb) objectives.push(x.insightPresentPair(r(pa), r(pb)));
    const [fa, fb] = [C.defense(a).lostFarming, C.defense(b).lostFarming];
    if (fa || fb) objectives.push(x.insightFarPair(fa, fb));
  }
  // Without positions (no STRATZ parse) most of both sections is empty: say so.
  const none = !a.path.t.length && !b?.path.t.length ? [x.insightNone] : [];
  return {
    decisions: decisions.length ? decisions : none,
    objectives: objectives.length ? objectives : none,
  };
}

function summary(ctx: Ctx) {
  const { a, b, t } = ctx;
  const x = t.x.decisions;
  const out: { text: string; w: number }[] = [];
  for (const [k, s] of sidesOf(a, b)) {
    const who = k === "a" ? t.insight.a : t.insight.b;
    const d = dropsTaken(s);
    const what = x.swingName[C.swingSeries(s)?.kind ?? "win"];
    if (d && d.n >= 3 && d.k / d.n <= 1 / 3)
      out.push({ text: x.summaryDrops(who, d.n, d.k, what), w: 0.45 + (1 - d.k / d.n) * 0.2 });
    const dl = deathLoss(s);
    if (dl && dl.n >= 3 && dl.k / dl.n >= 0.5)
      out.push({ text: x.summaryDeathLoss(who, dl.k, dl.n), w: 0.3 + (dl.k / dl.n) * 0.4 });
    const bb = C.buybackLate(s);
    if (bb?.unused.length) out.push({ text: x.summaryUnused(who, bb.unused.length), w: 0.6 });
    else if (bb && bb.noGold.length >= 2)
      out.push({ text: x.summaryBuyback(who, bb.noGold.length), w: 0.35 });
  }
  if (b) {
    const [ca, cb] = [converted(a), converted(b)];
    const gap = ca && cb ? Math.abs(ca.k / ca.n - cb.k / cb.n) : 0;
    if (ca && cb && gap >= 0.25)
      out.push({ text: x.summaryConvert(x.ratio(ca.k, ca.n), x.ratio(cb.k, cb.n)), w: gap });
    const [pa, pb] = [presence(a), presence(b)];
    const pgap = pa && pb ? Math.abs(pa.k / pa.n - pb.k / pb.n) : 0;
    if (pa && pb && pgap >= 0.25)
      out.push({ text: x.summaryPresent(x.ratio(pa.k, pa.n), x.ratio(pb.k, pb.n)), w: pgap });
  }
  return out;
}

// Cores' farm missed between respawns and the first last hit (beyond the walk out).
function lessons(ctx: Ctx): Lesson[] {
  const out: Lesson[] = [];
  for (const [k, s] of sidesOf(ctx.a, ctx.b)) {
    if (!s.parsed.stratz || !s.position || s.position > 3) continue;
    const idle = C.respawnIdle(s);
    if (idle && idle.gold >= 300)
      out.push({ side: k, text: ctx.t.x.decisions.lessonRespawn(Math.round(idle.seconds)), gold: idle.gold });
  }
  return out;
}

export const decisionsModule: LabModule = {
  blocks: { decisions: DecisionsBlocks, objectives: ObjectivesBlocks },
  insights,
  summary,
  metrics: decisionMetrics,
  lessons,
};
