"use client";

import { type ReactNode, useMemo } from "react";
import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { num, pct, signed } from "../insights";
import {
  AbilityIcon,
  Caveat,
  HeroIcon,
  ItemIcon,
  PerSide,
  SideDot,
  type SideKey,
  SourceIcon,
  Sub,
  useLab,
  useNames,
  useTimeWindow,
} from "../lab-parts";
import { DamageBlocks } from "./fights-damage";
import {
  BIG_SHARE,
  cohesion,
  deathCost,
  deathRecaps,
  type DefensiveUse,
  fightOutcomes,
  fightPrep,
  fightRecord,
  type FightResult,
  GRACE,
  isBurst,
  type ItemReady,
  killValue,
  missedFights,
  type UltReady,
  unusedAtDeath,
  wandLeft,
} from "./fights-calc";
import { FIGHTS_METRICS, fightsInsights, fightsLessons, fightsSummary } from "./fights-read";
import type { LabModule } from "./types";

// Fights in depth: results and shares, readiness, deaths, uptime, targets, efficiency, heals.

const RESULT_TONE: Record<FightResult, string> = {
  won: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  lost: "bg-red-500/15 text-red-700 dark:text-red-300",
  traded: "bg-muted text-muted-foreground",
};
// Damage types: right-click, physical spell, magical, pure (apart from the sides' orange and blue).
const TYPE_COLOR = ["#a3a3a3", "#a16207", "#8b5cf6", "#eab308"];
const RULE = "text-xs text-muted-foreground";
const BAD = "text-red-600 dark:text-red-400";

const inWindow = (t: number, w: [number, number]) => t >= w[0] && t <= w[1];
// Marked only for BKB, the one meant to go on before the hits land (Manta and Satanic after is normal).
const lateBkb = (d: DefensiveUse) => d.key === "black_king_bar" && d.kind !== "proactive";
// Signed after rounding, so a tiny gap reads 0.0 rather than −0.0.
const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");
const signedLevel = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return `${sign(r)}${Math.abs(r).toFixed(1)}`;
};
const signedPct = (v: number) => {
  const r = Math.round(v * 100);
  return `${sign(r)}${Math.abs(r)}%`;
};

function ResultTag({ r }: { r: FightResult }) {
  const { t } = useLab();
  return <span className={cn("rounded px-1", RESULT_TONE[r])}>{t.x.fights.results[r]}</span>;
}

// ── Each fight's result and the player's part ────────────────────────────────────────────────

function OutcomeBlock() {
  const { t } = useLab();
  const x = t.x.fights;
  return (
    <Sub title={x.outcome} hint={x.outcomeHint}>
      <p className={RULE}>{x.outcomeRule}</p>
      <PerSide>{(k, s) => <OutcomeSide s={s} />}</PerSide>
    </Sub>
  );
}

function OutcomeSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.fights;
  const w = useTimeWindow(s);
  const rows = fightOutcomes(s).filter((o) => inWindow(o.start, w));
  if (!rows.length) return <p className={RULE}>{x.none}</p>;
  const rec = fightRecord(rows);
  // Healing shares only for players who heal others (else it's their own regeneration).
  const heal = s.totals.healing > 0;
  return (
    <div className="flex flex-col gap-2">
      <table className="w-full max-w-lg text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal" />
            <th className="py-1 text-right font-normal">{x.recordCols.n}</th>
            <th className="py-1 text-right font-normal">{x.recordCols.wlt}</th>
            <th className="py-1 text-right font-normal">{x.recordCols.gold}</th>
            <th className="py-1 text-right font-normal">{x.recordCols.xp}</th>
          </tr>
        </thead>
        <tbody>
          {(["joined", "absent", "dead"] as const).map((p) => {
            const g = rec[p];
            if (!g.n) return null;
            return (
              <tr key={p} className="border-b last:border-0">
                <td className="py-1">{x.recordRows[p]}</td>
                <td className="py-1 text-right tabular-nums">{g.n}</td>
                <td className="py-1 text-right tabular-nums">
                  {g.won} / {g.lost} / {g.traded}
                </td>
                <td className={cn("py-1 text-right tabular-nums", g.gold != null && g.gold < 0 && BAD)}>
                  {g.gold != null ? signed(g.gold) : "–"}
                </td>
                <td className="py-1 text-right tabular-nums">{g.xp != null ? signed(g.xp) : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rec.big > 0 && <p className="text-xs">{x.big(rec.big, rec.bigWon, rec.bigLost)}</p>}
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal">{x.col.time}</th>
              <th className="py-1 font-normal">{x.col.result}</th>
              <th className="py-1 text-right font-normal">{x.col.swing}</th>
              <th className="py-1 text-right font-normal">{x.col.edge}</th>
              <th className="py-1 text-right font-normal">{x.col.level}</th>
              <th className="py-1 text-right font-normal">{x.col.dmgShare}</th>
              {heal && <th className="py-1 text-right font-normal">{x.col.healShare}</th>}
              <th className="py-1 pl-2 font-normal">{x.col.presence}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr
                key={o.i}
                className={cn("border-b last:border-0", o.presence !== "joined" && "text-muted-foreground")}
              >
                <td className="py-1 tabular-nums">{clock(o.start)}</td>
                <td className="py-1">
                  <ResultTag r={o.result} />{" "}
                  <span className="tabular-nums">
                    {o.teamDeaths}:{o.enemyDeaths}
                  </span>
                </td>
                <td className="py-1 text-right tabular-nums">
                  {o.gold != null ? signed(o.gold) : "–"} / {o.xp != null ? signed(o.xp) : "–"}
                </td>
                <td
                  className={cn(
                    "py-1 text-right tabular-nums",
                    o.levelEdge != null && o.levelEdge <= -1 && BAD,
                    o.levelEdge != null && o.levelEdge >= 1 && "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {o.levelEdge != null ? signedLevel(o.levelEdge) : "–"}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {o.level ?? "–"}
                  {o.gained ? <span className="text-muted-foreground"> (+{o.gained})</span> : null}
                </td>
                <td
                  className={cn(
                    "py-1 text-right tabular-nums",
                    o.dmgShare != null && o.dmgShare >= BIG_SHARE && "font-semibold",
                  )}
                >
                  {o.presence === "joined" ? pct(o.dmgShare) : "–"}
                </td>
                {heal && (
                  <td className="py-1 text-right tabular-nums">
                    {o.presence === "joined" ? pct(o.healShare) : "–"}
                  </td>
                )}
                <td className="py-1 pl-2">
                  {x.presence[o.presence]}
                  {o.died && <span className={cn("ml-1", BAD)}>✝</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {heal && <Caveat kind="source">{x.healNote}</Caveat>}
    </div>
  );
}

// ── Fights missed while alive ────────────────────────────────────────────────────────────────

function MissedBlock() {
  const { t, a, b } = useLab();
  const x = t.x.fights;
  const wa = useTimeWindow(a);
  const wb = useTimeWindow(b ?? a);
  // The caveat only under fights shown in the time range.
  const any = (
    [
      [a, wa],
      [b, wb],
    ] as const
  ).some(([s, w]) => s && fightOutcomes(s).some((o) => o.presence === "absent" && inWindow(o.start, w)));
  return (
    <Sub title={x.missed} hint={x.missedHint}>
      <p className={RULE}>{x.missedRule}</p>
      <PerSide>{(k, s) => <MissedSide s={s} />}</PerSide>
      {any && <Caveat kind="hindsight">{x.hindsight}</Caveat>}
    </Sub>
  );
}

function MissedSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.fights;
  const w = useTimeWindow(s);
  const all = useMemo(() => missedFights(s, fightOutcomes(s)), [s]);
  const rows = all.filter((m) => inWindow(m.o.start, w));
  if (!rows.length) return <p className={RULE}>{x.noMissed}</p>;
  return (
    <div className="max-h-64 overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal">{x.col.time}</th>
            <th className="py-1 font-normal">{x.missedCol.activity}</th>
            <th className="py-1 text-right font-normal">{x.missedCol.dist}</th>
            <th className="py-1 text-right font-normal">{x.missedCol.meanwhile}</th>
            <th className="py-1 pl-2 font-normal">{x.missedCol.team}</th>
            <th className="py-1 text-right font-normal">{x.missedCol.swing}</th>
            <th className="py-1 text-right font-normal">{x.missedCol.win}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.o.i} className="border-b last:border-0">
              <td className="py-1 tabular-nums">{clock(m.o.start)}</td>
              <td className="py-1">{m.activity ? (t.deep.activities[m.activity] ?? m.activity) : "–"}</td>
              <td className="py-1 text-right tabular-nums">
                {m.dist != null ? num(m.dist) : "–"}
                <span className="text-muted-foreground"> / {m.closest != null ? num(m.closest) : "–"}</span>
              </td>
              <td className="py-1 text-right tabular-nums">
                {signed(m.gold)} / {signed(m.xp)}
              </td>
              <td className="py-1 pl-2">
                <ResultTag r={m.o.result} />{" "}
                <span className="tabular-nums">
                  {m.o.teamDeaths}:{m.o.enemyDeaths}
                </span>
              </td>
              <td className="py-1 text-right tabular-nums">
                {m.o.gold != null ? signed(m.o.gold) : "–"} / {m.o.xp != null ? signed(m.o.xp) : "–"}
              </td>
              <td className={cn("py-1 text-right tabular-nums", m.win != null && m.win <= -0.05 && BAD)}>
                {m.win != null ? signedPct(m.win) : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Readiness and execution ──────────────────────────────────────────────────────────────────

function PrepBlock() {
  const { t, a, b } = useLab();
  const x = t.x.fights;
  return (
    <Sub title={x.prep} hint={x.prepHint}>
      <p className={RULE}>{x.prepRule}</p>
      <PerSide>{(k, s) => <PrepSide s={s} />}</PerSide>
      {(a.parsed.stratz || b?.parsed.stratz) && <Caveat kind="estimate">{x.prepEstimate}</Caveat>}
    </Sub>
  );
}

function UltCell({ u }: { u: UltReady | null }) {
  const { t } = useLab();
  const x = t.x.fights;
  if (!u) return <span className="text-muted-foreground">–</span>;
  return (
    <span className="flex items-center gap-1">
      <AbilityIcon k={u.key} size={14} />
      <span
        className={cn(
          u.state === "cooldown" && u.left > GRACE && cn("font-semibold", BAD),
          u.state === "none" && "text-muted-foreground",
        )}
      >
        {u.state === "cooldown" ? x.left(u.left) : x.ult[u.state]}
      </span>
    </span>
  );
}

// An item at a moment: dimmed with the seconds left while on cooldown, marked in the backpack.
function ItemState({ i }: { i: ItemReady }) {
  const { t } = useLab();
  const names = useNames();
  const x = t.x.fights;
  const dim = i.state === "cooldown" || i.state === "backpack";
  return (
    <span className="relative inline-flex">
      <ItemIcon
        k={i.key}
        size={14}
        className={cn(dim && "opacity-40 grayscale")}
        title={`${names.items(i.key)} · ${i.state === "cooldown" ? x.left(i.left) : x.itemState[i.state]}`}
      />
      {dim && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-foreground">
          {i.state === "cooldown" ? i.left : x.bag}
        </span>
      )}
    </span>
  );
}

function PrepSide({ s }: { s: LabSide }) {
  const { t, assets } = useLab();
  const x = t.x.fights;
  const w = useTimeWindow(s);
  const all = useMemo(() => fightPrep(s, assets, fightOutcomes(s)), [s, assets]);
  if (!s.parsed.stratz || (!s.advanced.inventory.length && !s.advanced.damage.length))
    return <p className={RULE}>{x.noStratz}</p>;
  const rows = all.filter((p) => inWindow(p.o.start, w));
  if (!rows.length) return <p className={RULE}>{x.none}</p>;
  const notReady = rows.filter((p) => p.notReady);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs">
        {notReady.length
          ? x.notReady(
              notReady.length,
              notReady.filter((p) => p.o.result === "won").length,
              notReady.filter((p) => p.o.result === "lost").length,
            )
          : x.allReady}
      </p>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal">{x.col.time}</th>
              <th className="py-1 font-normal">{x.prepCol.ult}</th>
              <th className="py-1 font-normal">{x.prepCol.items}</th>
              <th className="py-1 font-normal">{x.prepCol.timing}</th>
              <th className="py-1 text-right font-normal">{x.prepCol.uptime}</th>
              <th className="py-1 text-right font-normal">{x.prepCol.active}</th>
              <th className="py-1 pl-2 font-normal">{x.prepCol.result}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.o.i}
                className={cn("border-b align-top last:border-0", p.notReady && "bg-red-500/5")}
              >
                <td className="py-1 tabular-nums">{clock(p.o.start)}</td>
                <td className="py-1">
                  <UltCell u={p.ult} />
                </td>
                <td className="py-1">
                  <span className="flex max-w-40 flex-wrap gap-0.5">
                    {p.items.length ? p.items.map((i) => <ItemState key={i.key} i={i} />) : "–"}
                  </span>
                </td>
                <td className="py-1">
                  <span className="flex flex-col gap-0.5">
                    {p.defensive.map((d) => (
                      <span
                        key={d.key}
                        className="flex items-center gap-1"
                        title={d.afterHit != null ? x.afterHit(d.afterHit) : undefined}
                      >
                        <ItemIcon k={d.key} size={12} />
                        <span className={cn(lateBkb(d) && BAD)}>{x.kinds[d.kind]}</span>
                        {d.at != null && <span className="text-muted-foreground">{x.fromStart(d.at)}</span>}
                      </span>
                    ))}
                    {!p.defensive.length && "–"}
                  </span>
                </td>
                <td className="py-1 text-right tabular-nums">
                  {pct(p.uptime)}
                  {p.uptime != null && p.targets > 0 && (
                    <span className="ml-1 text-muted-foreground">({x.hitCount(p.targets)})</span>
                  )}
                </td>
                <td className="py-1 text-right tabular-nums">{pct(p.active)}</td>
                <td className="py-1 pl-2">
                  <ResultTag r={p.o.result} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Deaths taken apart ───────────────────────────────────────────────────────────────────────

function TypeBar({ types, total }: { types: number[]; total: number }) {
  const { t } = useLab();
  if (!total) return null;
  return (
    <span className="flex h-1.5 w-20 overflow-hidden rounded bg-muted/50">
      {types.map((v, i) =>
        v > 0 ? (
          <span
            key={i}
            title={`${t.x.fights.types[i]} ${num(v)}`}
            style={{ width: `${(v / total) * 100}%`, background: TYPE_COLOR[i] }}
          />
        ) : null,
      )}
    </span>
  );
}

function TypeLegend() {
  const { t } = useLab();
  return (
    <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {t.x.fights.types.map((name, i) => (
        <span key={name} className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm" style={{ background: TYPE_COLOR[i] }} />
          {name}
        </span>
      ))}
    </p>
  );
}

function RecapBlock() {
  const { t, a, b } = useLab();
  const x = t.x.fights;
  return (
    <Sub title={x.recap} hint={x.recapHint}>
      <p className={RULE}>{x.recapRule}</p>
      <PerSide>{(k, s) => <RecapSide s={s} />}</PerSide>
      {(a.parsed.stratz || b?.parsed.stratz) && (
        <>
          <TypeLegend />
          <Caveat kind="estimate">{x.recapEstimate}</Caveat>
        </>
      )}
    </Sub>
  );
}

function RecapSide({ s }: { s: LabSide }) {
  const { t, assets } = useLab();
  const x = t.x.fights;
  const names = useNames();
  const w = useTimeWindow(s);
  const all = useMemo(() => deathRecaps(s, assets), [s, assets]);
  if (!s.parsed.stratz || !s.advanced.damage.length) return <p className={RULE}>{x.noStratz}</p>;
  const rows = all.filter((d) => inWindow(d.t, w));
  if (!rows.length) return <p className={RULE}>{x.noDeaths}</p>;
  const wand = rows.filter((d) => {
    const c = wandLeft(d);
    return !!c?.max && c.n >= c.max / 2;
  }).length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs">
        {x.recapLine(
          rows.length,
          rows.filter(isBurst).length,
          rows.filter((d) => unusedAtDeath(d).length > 0).length,
          wand,
        )}
      </p>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal">{x.col.time}</th>
              <th className="py-1 font-normal">{x.recapCol.taken}</th>
              <th className="py-1 text-right font-normal">{x.recapCol.last3}</th>
              <th className="py-1 pl-2 font-normal">{x.recapCol.from}</th>
              <th className="py-1 font-normal">{x.recapCol.killers}</th>
              <th className="py-1 font-normal">{x.recapCol.unused}</th>
              <th className="py-1 font-normal">{x.recapCol.charges}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.t} className="border-b align-top last:border-0">
                <td className="py-1 tabular-nums">{clock(d.t)}</td>
                <td className="py-1">
                  <span className="flex flex-col gap-0.5">
                    <span className="tabular-nums">{num(d.total)}</span>
                    <TypeBar types={d.types} total={d.total} />
                  </span>
                </td>
                <td className={cn("py-1 text-right tabular-nums", isBurst(d) && cn("font-semibold", BAD))}>
                  {d.total ? pct(d.last3 / d.total) : "–"}
                </td>
                <td className="py-1 pl-2">
                  <span className="flex max-w-56 flex-wrap items-center gap-x-2 gap-y-0.5">
                    {d.heroes.slice(0, 2).map((h) => (
                      <span key={h.hero} className="flex items-center gap-0.5 tabular-nums">
                        <HeroIcon id={h.hero} size={14} />
                        {num(h.v)}
                      </span>
                    ))}
                    {d.sources
                      .filter((src) => src.key !== "null")
                      .slice(0, 2)
                      .map((src) => (
                        <span
                          key={src.key}
                          className="flex items-center gap-0.5 text-muted-foreground tabular-nums"
                          title={names.abilities(src.key)}
                        >
                          <SourceIcon k={src.key} size={14} />
                          {num(src.v)}
                        </span>
                      ))}
                  </span>
                </td>
                <td className="py-1">
                  <span className="flex flex-wrap gap-0.5">
                    {d.killers.map((h) => (
                      <HeroIcon
                        key={h}
                        id={h}
                        size={14}
                        className={h === d.killer ? "rounded-sm ring-1 ring-red-500" : undefined}
                      />
                    ))}
                  </span>
                </td>
                <td className="py-1">
                  <span className="flex flex-wrap gap-0.5">
                    {unusedAtDeath(d).map((i) => (
                      <ItemIcon key={i.key} k={i.key} size={14} />
                    ))}
                  </span>
                </td>
                <td className="py-1">
                  <span className="flex flex-wrap gap-1">
                    {d.charges.map((c, i) => (
                      <span key={`${c.key}-${i}`} className="flex items-center gap-0.5 tabular-nums">
                        <ItemIcon k={c.key} size={12} />
                        <span className={cn(c.max != null && c.n >= c.max && cn("font-semibold", BAD))}>
                          {c.max ? `${c.n}/${c.max}` : c.n}
                        </span>
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── What deaths and kills were worth ─────────────────────────────────────────────────────────

function CostBlock() {
  const { t } = useLab();
  const x = t.x.fights;
  return (
    <Sub title={x.cost} hint={x.costHint}>
      <p className={RULE}>{x.costRule}</p>
      <PerSide>{(k, s) => <CostSide s={s} />}</PerSide>
    </Sub>
  );
}

function CostSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.fights;
  const c = useMemo(() => deathCost(s), [s]);
  const kills = useMemo(() => killValue(s), [s]);
  // XP fed side by side only when both are known (none fed without deaths).
  const xpOk = c.baseline?.xpFed != null && (c.xpFed != null || !c.n);
  const row = (label: string, value: ReactNode) => (
    <div key={label} className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
      {row(
        x.costRows.cost,
        !c.n
          ? x.noDeaths
          : c.missed != null
            ? x.costValue(num(c.cost), num(c.lost), num(c.missed))
            : x.costNoMissed(num(c.lost)),
      )}
      {c.n > 0 &&
        row(c.full ? x.costRows.rate : x.costRows.rateLostOnly, `${num(c.perMin)} / ${pct(c.share, 1)}`)}
      {c.n > 0 &&
        c.fed != null &&
        row(x.costRows.fed, x.fedValue(num(c.fed), c.xpFed != null ? num(c.xpFed) : null))}
      {c.baseline &&
        row(
          x.costRows.avg(c.baseline.minute, num(c.baseline.n)),
          x.avgValue(
            x.lostFed(num(c.baseline.lost), num(c.baseline.fed), xpOk ? num(c.baseline.xpFed) : null),
            x.lostFed(num(c.lost ?? 0), num(c.fed ?? 0), xpOk ? num(c.xpFed ?? 0) : null),
          ),
        )}
      {row(
        x.costRows.kills,
        kills.n
          ? x.killsValue(kills.n, num(kills.gold), kills.xp != null ? num(kills.xp) : null, kills.xpN)
          : x.noKills,
      )}
      {kills.top.length > 0 &&
        row(
          x.costRows.richest,
          <span className="flex flex-wrap gap-x-3 gap-y-0.5">
            {kills.top.map((k) => (
              <span key={`${k.t}-${k.hero}`} className="flex items-center gap-1">
                {clock(k.t)}
                <HeroIcon id={k.hero} size={14} />+{num(k.gold)}
                {k.xp != null && <span className="text-muted-foreground">/ +{num(k.xp)}</span>}
              </span>
            ))}
          </span>,
        )}
    </dl>
  );
}

// ── Zone changes and grouping ────────────────────────────────────────────────────────────────

function CohesionBlock() {
  const { t, a, b } = useLab();
  const x = t.x.fights;
  const data = useMemo(() => {
    const list: [SideKey, LabSide][] = b
      ? [
          ["a", a],
          ["b", b],
        ]
      : [["a", a]];
    return list.map(([k, s]) => [k, cohesion(s)] as const);
  }, [a, b]);
  return (
    <Sub title={x.cohesion} hint={x.cohesionHint}>
      <p className={RULE}>{x.cohesionRule}</p>
      {data.some(([, c]) => c) ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 font-normal" />
                {[...t.deep.phaseNames, x.whole].map((n) => (
                  <th key={n} className="py-1 pr-3 font-normal">
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(([k, c]) => (
                <tr key={k} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">
                    <SideDot side={k} />
                  </td>
                  {c ? (
                    [...c.phases, c.whole].map((p, i) => (
                      <td key={i} className="py-1.5 pr-3 tabular-nums">
                        {p.zonesPerMin != null || p.centroid != null
                          ? x.zonesCell(num(p.zonesPerMin, 1), num(p.centroid))
                          : "–"}
                      </td>
                    ))
                  ) : (
                    <td colSpan={t.deep.phaseNames.length + 1} className="py-1.5 text-muted-foreground">
                      {x.noGrid}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={RULE}>{x.noGrid}</p>
      )}
    </Sub>
  );
}

function FightsBlocks() {
  return (
    <>
      <OutcomeBlock />
      <MissedBlock />
      <PrepBlock />
      <RecapBlock />
      <CostBlock />
      <CohesionBlock />
    </>
  );
}

export const fightsModule: LabModule = {
  blocks: { fights: FightsBlocks, damage: DamageBlocks },
  insights: fightsInsights,
  summary: fightsSummary,
  metrics: FIGHTS_METRICS,
  lessons: fightsLessons,
};
