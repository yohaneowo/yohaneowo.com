"use client";

import { useMemo, useState } from "react";
import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { aliveAt, areaOf, type Metric, num, pct } from "../insights";
import {
  Bars,
  Caveat,
  HeroIcon,
  LabMap,
  type MapMark,
  PerSide,
  SIDE_COLOR,
  type SideKey,
  Sub,
  useLab,
  useNames,
  useSides,
  useTimeWindow,
} from "../lab-parts";
import type { Ctx, LabModule } from "./types";
import { CELL, sum } from "./util";
import { BoardBlock } from "./vision-board";
import {
  deathExposure,
  deathSight,
  duel,
  enemyCover,
  enemyObservers,
  EXPOSURE_ROWS,
  exposure,
  fogShares,
  wardHabits,
  wardValue,
} from "./vision-calc";
import { DuelBlock } from "./vision-duel";
import { OBSERVER_RADIUS, wardEnd } from "./vision-fog";

// Vision in depth: how long the player stood in enemy observers' vision (and farmed under their
// own), what the player's wards saw, what the team could see of the enemy (the fog estimate), the
// usual ward spots; in the movement section the whole board at a moment, and in the game's context
// the duel view when A and B are in the same match.

// An observer's radius on the map, in percent of its width (the map spans 128 cells).
const OBS_RING = (OBSERVER_RADIUS / CELL / 128) * 100;
const WARD_COLOR = { obs: "#facc15", sen: "#22d3ee" };
// Shares from fewer samples than this (5 minutes) say little.
const MIN_SAMPLES = 30;

// ── Time inside enemy observers' vision ──────────────────────────────────────────────────────

function ExposureBlock() {
  const { t } = useLab();
  const v = t.x.vision;
  const sides = useSides();
  if (!sides.some(([, s]) => s.advanced.activity.length)) return null;
  return (
    <Sub title={v.exposure} hint={v.exposureHint}>
      <PerSide>{(k, s) => <ExposureSide s={s} side={k} />}</PerSide>
      <Caveat kind="estimate">{v.exposureRule}</Caveat>
      <Caveat kind="hindsight">{v.exposureHindsight}</Caveat>
    </Sub>
  );
}

function ExposureSide({ s, side }: { s: LabSide; side: SideKey }) {
  const { t } = useLab();
  const v = t.x.vision;
  const [from, to] = useTimeWindow(s);
  const ex = useMemo(() => exposure(s, from, to), [s, from, to]);
  const deaths = useMemo(() => deathExposure(s).filter((d) => d.t >= from && d.t <= to), [s, from, to]);
  const map = useMemo(() => {
    const cov = enemyCover(s);
    const live = s.path.t.flatMap((tt, i) =>
      tt < Math.max(0, from) || tt > to || !aliveAt(s, i) ? [] : [i],
    );
    const marks: MapMark[] = [
      ...enemyObservers(s, from, to).map((w) => ({
        x: w.x,
        y: w.y,
        shape: "ring" as const,
        color: "#ef4444",
        size: OBS_RING,
        title: `${clock(w.t)}–${clock(Math.min(wardEnd(w), s.duration))}`,
      })),
      ...live
        .filter((i) => cov[i])
        .map((i) => ({
          x: s.path.x[i],
          y: s.path.y[i],
          color: "#ef4444",
          size: 0.8,
          title: clock(s.path.t[i]),
        })),
    ];
    return { marks, heat: live.map((i) => ({ x: s.path.x[i], y: s.path.y[i] })) };
  }, [s, from, to]);
  if (!ex) return <p className="text-xs text-muted-foreground">{t.movement.noPath}</p>;
  const exposed = deaths.filter((d) => d.exposed).length;
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-1">
        <LabMap marks={map.marks} heat={map.heat} heatColor={SIDE_COLOR[side]} of={s} />
        <p className="text-[11px] text-muted-foreground">{v.exposureMap}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-3 text-xs">
        <table className="w-full">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal" />
              <th className="py-1 text-right font-normal">{v.minutes}</th>
              <th className="py-1 text-right font-normal">{v.inEnemy}</th>
              <th className="py-1 text-right font-normal">{v.inOwn}</th>
            </tr>
          </thead>
          <tbody>
            {EXPOSURE_ROWS.map((r) => (
              <tr key={r} className="border-b last:border-0">
                <td className="py-1 text-muted-foreground">{v.rows[r]}</td>
                <td className="py-1 text-right tabular-nums">{num(ex.rows[r].n / 6, 1)}</td>
                <td className="py-1 text-right tabular-nums">{pct(ex.share(r, "enemy"))}</td>
                <td className="py-1 text-right tabular-nums">{pct(ex.share(r, "own"))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-col gap-1">
          <p className="font-medium">{v.beforeDeath}</p>
          {deaths.length ? (
            <>
              <table className="w-full">
                <tbody>
                  {deaths.map((d) => (
                    <tr key={d.t} className="border-b last:border-0">
                      <td className="py-0.5 tabular-nums">{clock(d.t)}</td>
                      <td className="py-0.5 text-muted-foreground">{d.kind ? t.deep.kinds[d.kind] : "–"}</td>
                      <td
                        className={cn(
                          "py-0.5 text-right tabular-nums",
                          d.exposed && "font-semibold text-red-600 dark:text-red-400",
                        )}
                      >
                        {v.secs(d.secs)} / {v.secs(d.n * 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-muted-foreground">
                {v.exposedDeaths(exposed, deaths.length, pct(ex.share("alive", "enemy")))}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">{v.noDeaths}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── What the player's wards saw ──────────────────────────────────────────────────────────────

function WardValueBlock() {
  const { t } = useLab();
  const v = t.x.vision;
  const sides = useSides();
  if (!sides.some(([, s]) => s.match.wards.some((w) => w.slot === s.slot))) return null;
  return (
    <Sub title={v.value} hint={v.valueHint}>
      <PerSide>{(k, s) => <WardValueSide s={s} />}</PerSide>
      <Caveat kind="estimate">{v.valueRule}</Caveat>
    </Sub>
  );
}

function WardValueSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const v = t.x.vision;
  const [from, to] = useTimeWindow(s);
  const all = wardValue(s);
  const obs = all.obs.filter((o) => o.ward.t <= to && o.end >= from);
  const sen = all.sen.filter((o) => o.ward.t <= to && o.end >= from);
  if (!obs.length && !sen.length) return <p className="text-xs text-muted-foreground">{v.noWards}</p>;
  const seen = obs.flatMap((o) => (o.heroSeconds != null ? [o.heroSeconds] : []));
  return (
    <div className="flex flex-col gap-2 text-xs">
      {seen.length > 0 && (
        <p>
          {v.valueLine(
            obs.length,
            num(sum(seen) / 60, 1),
            num(sum(seen) / seen.length),
            sum(obs.map((o) => o.kills ?? 0)),
          )}
        </p>
      )}
      {obs.length > 0 && (
        <div className="max-h-64 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-background text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 font-normal">{v.placed}</th>
                <th className="py-1 font-normal">{v.area}</th>
                <th className="py-1 text-right font-normal">{v.lived}</th>
                <th className="py-1 text-right font-normal">{v.seen}</th>
                <th className="py-1 text-right font-normal">{v.kills}</th>
              </tr>
            </thead>
            <tbody>
              {obs.map((o, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-0.5 tabular-nums">{clock(o.ward.t)}</td>
                  <td className="py-0.5 text-muted-foreground">
                    {t.movement.zoneNames[areaOf(o.ward.x, o.ward.y, s.radiant)]}
                  </td>
                  <td className="py-0.5 text-right tabular-nums">{clock(Math.round(o.end - o.ward.t))}</td>
                  <td className="py-0.5 text-right tabular-nums">
                    {o.heroSeconds == null ? "–" : v.secs(o.heroSeconds)}
                  </td>
                  <td className="py-0.5 text-right tabular-nums">{o.kills ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sen.length > 0 && (
        <p className="text-muted-foreground">
          {v.sentryLine(sen.length, sum(sen.map((x) => x.cleared)), sum(sen.map((x) => x.observers)))}
        </p>
      )}
    </div>
  );
}

// ── What the team could see ──────────────────────────────────────────────────────────────────

function FogBlock() {
  const { t } = useLab();
  const v = t.x.vision;
  const sides = useSides();
  if (!sides.some(([, s]) => s.match.grid.t.length)) return null;
  return (
    <Sub title={v.fog} hint={v.fogHint}>
      <PerSide>{(k, s) => <FogSide s={s} side={k} />}</PerSide>
      <Caveat kind="estimate">{v.fogRule}</Caveat>
    </Sub>
  );
}

function FogSide({ s, side }: { s: LabSide; side: SideKey }) {
  const { t } = useLab();
  const v = t.x.vision;
  const names = useNames();
  const [from, to] = useTimeWindow(s);
  const fog = useMemo(() => fogShares(s, from, to), [s, from, to]);
  const deaths = useMemo(() => deathSight(s).filter((d) => d.t >= from && d.t <= to), [s, from, to]);
  if (!fog) return <p className="text-xs text-muted-foreground">{t.movement.noPath}</p>;
  const rows = [...fog.team.bySlot.entries()].map(([slot, r]) => {
    const hero = s.match.players.find((p) => p.slot === slot)?.heroId ?? 0;
    return {
      key: String(slot),
      value: r.n ? r.seen / r.n : 0,
      note: `${num(r.n / 6)}′`,
      label: (
        <>
          <HeroIcon id={hero} size={16} />
          <span className="truncate">{names.heroes(hero)}</span>
        </>
      ),
    };
  });
  return (
    <div className="flex flex-col gap-2 text-xs">
      <p>
        {v.fogLine(pct(fog.team.share), pct(fog.day), pct(fog.night))} {v.seenByEnemy(pct(fog.seenByEnemy))}
      </p>
      <p className="font-medium">{v.perHero}</p>
      <Bars color={SIDE_COLOR[side]} max={1} format={(x) => pct(x)} rows={rows} />
      <p className="font-medium">{v.deathSight}</p>
      {deaths.length ? (
        <table className="w-full">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal">{t.fights.time}</th>
              <th className="py-1 font-normal">{t.deep.kind}</th>
              <th className="py-1 font-normal">{v.near}</th>
              <th className="py-1 text-right font-normal">{v.before10}</th>
            </tr>
          </thead>
          <tbody>
            {deaths.map((d) => (
              <tr key={d.t} className="border-b last:border-0">
                <td className="py-1 whitespace-nowrap tabular-nums">
                  {clock(d.t)} <span className="text-muted-foreground">{d.night ? v.night : v.day}</span>
                </td>
                <td className="py-1 text-muted-foreground">{d.kind ? t.deep.kinds[d.kind] : "–"}</td>
                <td className="py-1">
                  <span className="flex flex-wrap gap-0.5">
                    {d.near.length
                      ? d.near.map((e) => (
                          <span
                            key={e.slot}
                            className={cn(!e.seen && "opacity-40")}
                            title={`${names.heroes(e.hero)}${e.seen ? "" : ` · ${v.inFog}`}`}
                          >
                            <HeroIcon id={e.hero} size={16} className={e.seen ? undefined : "grayscale"} />
                          </span>
                        ))
                      : v.nobody}
                  </span>
                </td>
                <td className="py-1 text-right tabular-nums">
                  {d.near.length ? `${d.near.filter((e) => e.before).length} / ${d.near.length}` : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted-foreground">{v.noDeaths}</p>
      )}
      {deaths.some((d) => d.near.length) && (
        <p className="text-muted-foreground">
          {v.fromFog(
            deaths.filter((d) => d.near.length && !d.near.some((e) => e.before)).length,
            deaths.filter((d) => d.near.length).length,
          )}
        </p>
      )}
    </div>
  );
}

// ── Usual ward spots ─────────────────────────────────────────────────────────────────────────

function HabitsBlock() {
  const { t } = useLab();
  const v = t.x.vision;
  const sides = useSides();
  const [kind, setKind] = useState<"obs" | "sen">("obs");
  // For supports with a ward map of some size, or anyone who placed 3 or more observers this game:
  // for cores who barely ward, the usual spots say little.
  const shown = sides.some(([, s]) => {
    const h = wardHabits(s);
    if (!h) return false;
    const support = s.position != null && s.position >= 4;
    return (support && h.obsTotal + h.senTotal >= 5) || h.spots.length >= 3;
  });
  if (!shown) return null;
  return (
    <Sub title={v.habits} hint={v.habitsHint}>
      <div className="flex gap-1 text-xs">
        {(["obs", "sen"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={cn(
              "cursor-pointer rounded-md border px-2 py-0.5",
              kind === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v[k]}
          </button>
        ))}
      </div>
      <PerSide>{(k, s) => <HabitsSide s={s} kind={kind} />}</PerSide>
    </Sub>
  );
}

function HabitsSide({ s, kind }: { s: LabSide; kind: "obs" | "sen" }) {
  const { t } = useLab();
  const v = t.x.vision;
  const h = wardHabits(s);
  const heat = useMemo(
    () => (h ? h[kind].flatMap((c) => Array.from({ length: c.n }, () => ({ x: c.x, y: c.y }))) : []),
    [h, kind],
  );
  if (!h) return <p className="text-xs text-muted-foreground">{v.noHabits}</p>;
  const usual = new Set(h.spots.filter((x) => x.usual).map((x) => x.t));
  const marks: MapMark[] = s.vision.wards.map((w) => ({
    x: w.x,
    y: w.y,
    shape: w.kind === "obs" ? "dot" : "square",
    color: WARD_COLOR[w.kind],
    size: w.kind === "obs" && usual.has(w.t) ? 1.6 : 1.1,
    title: `${w.kind === "obs" ? v.obs : v.sen} ${clock(w.t)}`,
  }));
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
      <LabMap heat={heat} heatColor="#a855f7" marks={marks} of={s} />
      <div className="flex flex-col gap-1 text-xs">
        {h.spots.length > 0 && <p>{v.usualLine(h.usual, h.spots.length)}</p>}
        <p className="text-muted-foreground">{v.usualRule}</p>
        <p className="text-muted-foreground">{v.habitsFrom(h.obsTotal, h.senTotal)}</p>
      </div>
    </div>
  );
}

// ── The vision section's blocks, in order ────────────────────────────────────────────────────

function VisionBlocks() {
  return (
    <>
      <ExposureBlock />
      <WardValueBlock />
      <FogBlock />
      <HabitsBlock />
    </>
  );
}

// ── Readings ─────────────────────────────────────────────────────────────────────────────────

const sidesOf = (ctx: Ctx) => (ctx.b ? [ctx.a, ctx.b] : [ctx.a]);
const whoOf = (ctx: Ctx, i: number) => (ctx.b ? (i ? ctx.t.insight.b : ctx.t.insight.a) : "");

// Exposure shares, when there's enough alive time to read them.
function shares(s: LabSide) {
  const ex = exposure(s);
  if (!ex || ex.rows.alive.n < MIN_SAMPLES) return null;
  return { alive: ex.share("alive", "enemy") ?? 0, farm: ex.farmN >= MIN_SAMPLES ? ex.farmEnemy : null };
}

const farmPct = (v: number | null) => (v == null ? null : pct(v));

const exposedDeaths = (s: LabSide) => {
  const d = deathExposure(s);
  return { k: d.filter((x) => x.exposed).length, n: d.length };
};

function insights(ctx: Ctx) {
  const v = ctx.t.x.vision;
  const vision: string[] = [];
  const parts = sidesOf(ctx)
    .map((s, i) => {
      const sh = shares(s);
      return sh ? v.exposurePart(whoOf(ctx, i), pct(sh.alive), farmPct(sh.farm)) : "";
    })
    .filter(Boolean);
  if (parts.length) vision.push(v.insightExposure(parts.join(v.partSep)));
  // The side with the most deaths that followed time in enemy vision.
  const worst = sidesOf(ctx)
    .map((s, i) => ({ i, ...exposedDeaths(s) }))
    .filter((x) => x.k > 0 && x.n >= 2)
    .sort((x, y) => y.k - x.k)[0];
  if (worst) vision.push(v.insightDeaths(whoOf(ctx, worst.i), worst.k, worst.n));
  const context: string[] = [];
  const d = ctx.b ? duel(ctx.a, ctx.b) : null;
  if (d?.opponents && d.damage)
    context.push(
      v.insightDuel(
        num(d.damage.aToB),
        num(d.damage.bToA),
        d.aKills.filter((x) => x.killer).length,
        d.bKills.filter((x) => x.killer).length,
      ),
    );
  return { vision, context };
}

function summary(ctx: Ctx) {
  const { a, b } = ctx;
  const v = ctx.t.x.vision;
  const out: { text: string; w: number }[] = [];
  const sa = shares(a);
  if (b) {
    const sb = shares(b);
    const gap = sa && sb ? sa.alive - sb.alive : 0;
    if (sa && sb && Math.abs(gap) >= 0.08)
      out.push({
        text: v.summaryExposure(
          gap > 0 ? ctx.t.insight.a : ctx.t.insight.b,
          pct(sa.alive),
          pct(sb.alive),
          farmPct(sa.farm),
          farmPct(sb.farm),
        ),
        w: Math.min(1, Math.abs(gap) * 4),
      });
    // The team's sight is the team's doing: weighed lower.
    const fa = fogShares(a)?.team.share;
    const fb = fogShares(b)?.team.share;
    if (fa != null && fb != null && a.matchId !== b.matchId && Math.abs(fa - fb) >= 0.1)
      out.push({
        text: v.summarySight(fa > fb ? ctx.t.insight.a : ctx.t.insight.b, pct(fa), pct(fb)),
        w: Math.min(0.5, Math.abs(fa - fb) * 2),
      });
    const wa = wardValue(a);
    const wb = wardValue(b);
    if (wa.obs.length >= 3 && wb.obs.length >= 3 && wa.perObserver != null && wb.perObserver != null) {
      const hi = Math.max(wa.perObserver, wb.perObserver);
      const lo = Math.min(wa.perObserver, wb.perObserver);
      if (hi >= 30 && hi >= lo * 1.5)
        out.push({
          text: v.summaryWards(
            wa.perObserver > wb.perObserver ? ctx.t.insight.a : ctx.t.insight.b,
            num(wa.perObserver),
            num(wb.perObserver),
          ),
          w: Math.min(0.6, (hi / Math.max(1, lo) - 1) * 0.3),
        });
    }
    const d = duel(a, b);
    if (d?.opponents && d.damage) {
      const ka = d.aKills.filter((x) => x.killer).length;
      const kb = d.bKills.filter((x) => x.killer).length;
      const share = d.damage.aToB / Math.max(1, d.damage.aToB + d.damage.bToA);
      out.push({
        text: v.insightDuel(num(d.damage.aToB), num(d.damage.bToA), ka, kb),
        w: Math.min(0.9, 0.5 + Math.abs(share - 0.5) + Math.abs(ka - kb) * 0.1),
      });
    }
  } else {
    if (sa && (sa.alive >= 0.15 || (sa.farm ?? 0) >= 0.15))
      out.push({
        text: v.summaryExposureSingle(pct(sa.alive), farmPct(sa.farm)),
        w: Math.min(0.6, Math.max(sa.alive, sa.farm ?? 0) * 2),
      });
    const w = wardValue(a);
    if (w.obs.length >= 3 && w.totalSeconds != null && w.kills != null)
      out.push({ text: v.summaryWardsSingle(w.obs.length, num(w.totalSeconds / 60, 1), w.kills), w: 0.3 });
  }
  sidesOf(ctx).forEach((s, i) => {
    const e = exposedDeaths(s);
    if (e.k >= 2) out.push({ text: v.summaryDeaths(whoOf(ctx, i), e.k), w: Math.min(0.7, 0.2 + e.k * 0.1) });
  });
  return out;
}

// Rows for the differences table: exposure over the same window when the games differ in length.
const exposureShare = (s: LabSide, until = Infinity) => {
  const ex = exposure(s, -Infinity, until);
  return ex && ex.rows.alive.n >= MIN_SAMPLES ? ex.share("alive", "enemy") : null;
};
const farmShare = (s: LabSide, k: "farmEnemy" | "farmOwn", until = Infinity) => {
  const ex = exposure(s, -Infinity, until);
  return ex && ex.farmN >= MIN_SAMPLES ? ex[k] : null;
};

const METRICS: Metric[] = [
  {
    key: "enemyWardTime",
    fmt: "pct",
    higher: false,
    get: (s) => exposureShare(s),
    getUntil: (s, until) => exposureShare(s, until),
    // Cores should farm out of sight; supports and offlaners walk into it on purpose.
    dir: (s) => (s.position != null && s.position <= 2 ? false : null),
    label: (t) => t.x.vision.metrics.enemyWardTime,
  },
  {
    key: "farmEnemyWards",
    fmt: "pct",
    higher: false,
    get: (s) => farmShare(s, "farmEnemy"),
    getUntil: (s, until) => farmShare(s, "farmEnemy", until),
    label: (t) => t.x.vision.metrics.farmEnemyWards,
  },
  {
    key: "farmOwnWards",
    fmt: "pct",
    higher: true,
    get: (s) => farmShare(s, "farmOwn"),
    getUntil: (s, until) => farmShare(s, "farmOwn", until),
    label: (t) => t.x.vision.metrics.farmOwnWards,
  },
  {
    key: "teamSight",
    fmt: "pct",
    higher: true,
    get: (s) => fogShares(s)?.team.share ?? null,
    getUntil: (s, until) => fogShares(s, -Infinity, until)?.team.share ?? null,
    label: (t) => t.x.vision.metrics.teamSight,
  },
  {
    key: "wardSeen",
    fmt: "int",
    higher: true,
    get: (s) => {
      const w = wardValue(s);
      return w.obs.length >= 3 ? w.perObserver : null;
    },
    label: (t) => t.x.vision.metrics.wardSeen,
  },
];

export const visionModule: LabModule = {
  blocks: { vision: VisionBlocks, movement: BoardBlock, context: DuelBlock },
  insights,
  summary,
  metrics: METRICS,
};
