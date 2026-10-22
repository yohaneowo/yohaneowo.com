"use client";

import { type ReactNode, useMemo, useState } from "react";
import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { PHASES } from "../advanced";
import { num, pct } from "../insights";
import {
  Bars,
  Caveat,
  ItemIcon,
  LabMap,
  type MapMark,
  PerSide,
  SIDE_COLOR,
  type SideKey,
  SourceIcon,
  Sub,
  TimeStrip,
  useLab,
  useNames,
  useTimeWindow,
} from "../lab-parts";
import {
  AFTER_LANE,
  affordDelays,
  CAMP_SIZES,
  campKills,
  campVisits,
  creepKills,
  farmPlaces,
  farmSpan,
  GAME_STATES,
  hasActivity,
  hasGoldLog,
  isCore,
  LARGE_CLEAR,
  lastHitMethods,
  lastHits,
  misfiledFrogs,
  type MethodRow,
  type Places,
  rhythm,
  routeStats,
  STATE_MIN,
  stateRates,
  type StateRates,
  stateShares,
  teamStacks,
  vsAverage,
} from "./farming-calc";
import { droughtSentence, gapSentence } from "./farming-text";
import { sum } from "./util";

// The farming section's blocks: farm time against farm speed, jungle routes, the farming rhythm, how
// and where the last hits were made, how long the gold for each key item waited, and the rates in the
// same game state.

const ANCIENT_COLOR = "#a855f7";
const inWindow = (t: number, [from, to]: [number, number]) => t >= from && t <= to;
const stratzOf = (s: LabSide) => hasActivity(s) && hasGoldLog(s);

// A compact table: a label column, then one column per head.
function Grid({
  heads,
  rows,
  first,
}: {
  heads: ReactNode[];
  rows: {
    key: string;
    label: ReactNode;
    cells: ReactNode[];
    titles?: (string | undefined)[];
    shade?: boolean;
  }[];
  first?: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs tabular-nums">
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 pr-2 text-left font-normal">{first}</th>
            {heads.map((h, i) => (
              <th key={i} className="py-1 pl-2 text-right font-normal whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={cn("border-b last:border-0", r.shade && "bg-muted/50")}>
              <td className="py-1 pr-2 text-muted-foreground">{r.label}</td>
              {r.cells.map((c, i) => (
                <td key={i} className="py-1 pl-2 text-right whitespace-nowrap" title={r.titles?.[i]}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Muted = ({ children }: { children: ReactNode }) => (
  <p className="text-xs text-muted-foreground">{children}</p>
);

// ── Notes on the data ────────────────────────────────────────────────────────────────────────

function DataNotes() {
  const { a, b, t } = useLab();
  const x = t.x.farming;
  const lines = (b ? [a, b] : [a]).flatMap((s) => {
    const who = b ? `${s === a ? t.insight.a : t.insight.b}${t.insight.colon}` : "";
    const frogs = misfiledFrogs(s);
    return [
      ...(stratzOf(s) ? [] : [`${who}${x.noStratz}`]),
      ...(frogs ? [`${who}${x.misfiled(frogs)}`] : []),
    ];
  });
  if (!lines.length) return null;
  return (
    <div className="flex flex-col gap-1">
      {lines.map((l) => (
        <Caveat key={l} kind="source">
          {l}
        </Caveat>
      ))}
    </div>
  );
}

// ── Farm time and farm speed ─────────────────────────────────────────────────────────────────

function SpeedBlock() {
  const { a, b, t } = useLab();
  const f = t.x.farming.speed;
  return (
    <Sub title={f.title} hint={f.hint}>
      <PerSide>{(k, s) => <SpeedSide s={s} />}</PerSide>
      {b && isCore(a) === isCore(b) && <GapLine a={a} b={b} />}
      <Caveat kind="source">{f.avgNote}</Caveat>
    </Sub>
  );
}

// Per phase and over the selected range: time alive and farming, farm speed (all, lane, jungle), last
// hits while farming, the creep gold from fights, the gold from kills and objectives, and the rank
// average's last hits and net worth over the same minutes.
function SpeedSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.farming;
  const f = x.speed;
  const [from, to] = useTimeWindow(s);
  const whole = from <= 0 && to >= s.duration;
  const cols = useMemo(
    () =>
      [...PHASES, [from, to] as [number, number]].map(([a, b]) => ({
        span: farmSpan(s, a, b),
        avg: vsAverage(s, a, b),
      })),
    [s, from, to],
  );
  const stratz = stratzOf(s);
  const gamesTitle = (n: number | null) => (n != null ? f.games(n.toLocaleString()) : undefined);
  const spanRow = (key: string, label: string, v: (c: (typeof cols)[number]) => string) => ({
    key,
    label,
    cells: cols.map((c) => (c.span ? v(c) : "–")),
  });
  const rows = [
    ...(stratz
      ? [
          spanRow("alive", f.alive, (c) => pct(c.span!.alive)),
          spanRow("farm", f.farm, (c) => pct(c.span!.farm)),
          spanRow("speed", f.speed, (c) => num(c.span!.speed)),
          spanRow(
            "laneJungle",
            f.laneJungle,
            (c) => `${num(c.span!.laneSpeed)} / ${num(c.span!.jungleSpeed)}`,
          ),
          spanRow("lhRate", f.lhRate, (c) => num(c.span!.lhRate, 1)),
          spanRow("otherShare", f.otherShare, (c) => pct(c.span!.otherShare)),
          spanRow("farmPm", f.farmPm, (c) => num(c.span!.farmPm)),
          spanRow("kills", f.kills, (c) => num(c.span!.kills)),
          spanRow("objectives", f.objectives, (c) => num(c.span!.objectives)),
          spanRow("gpm", f.gpm, (c) => num(c.span!.gpm)),
        ]
      : []),
    {
      key: "lhAvg",
      label: f.lhAvg,
      cells: cols.map((c) => (c.avg ? `${num(c.avg.lh, 1)} / ${num(c.avg.avgLh, 1)}` : "–")),
      titles: cols.map((c) => gamesTitle(c.avg?.n ?? null)),
    },
    {
      key: "nwAvg",
      label: f.nwAvg,
      cells: cols.map((c) => (c.avg ? `${num(c.avg.nw)} / ${num(c.avg.avgNw)}` : "–")),
      titles: cols.map((c) => gamesTitle(c.avg?.n ?? null)),
    },
  ];
  const dry = droughtSentence(s, t);
  return (
    <div className="flex flex-col gap-1.5">
      <Grid heads={[...t.deep.phaseNames, whole ? x.all : x.window]} rows={rows} />
      {dry && <p className="text-xs">{dry}</p>}
    </div>
  );
}

// Which side farms more while farming, over the same minutes of the game when the x axis is time (each
// side's own selected range otherwise).
function GapLine({ a, b }: { a: LabSide; b: LabSide }) {
  const { t, align } = useLab();
  const [a0, a1] = useTimeWindow(a);
  const [b0, b1] = useTimeWindow(b);
  const time = align.kind === "time";
  const text = useMemo(() => {
    if (!time) return gapSentence(farmSpan(a, a0, a1), farmSpan(b, b0, b1), t, null);
    const from = Math.max(0, a0, b0);
    const to = Math.min(a1, b1, a.duration, b.duration);
    return gapSentence(
      farmSpan(a, from, to),
      farmSpan(b, from, to),
      t,
      `${clock(Math.round(from))}–${clock(Math.round(to))}`,
    );
  }, [a, b, a0, a1, b0, b1, t, time]);
  return text ? <p className="text-xs">{text}</p> : null;
}

// ── Jungle routes ────────────────────────────────────────────────────────────────────────────

const SLICE = 300;

function RoutesBlock() {
  const { a, b, t } = useLab();
  const f = t.x.farming.routes;
  const [pick, setPick] = useState<number | null>(null);
  // Five-minute slices with camps cleared on either side; the busiest by default.
  const slices = useMemo(() => {
    const list = b ? [a, b] : [a];
    const end = Math.max(...list.map((s) => s.duration));
    const out: { i: number; n: number }[] = [];
    for (let i = 0; i * SLICE < end; i++) {
      const n = sum(
        list.map((s) => campVisits(s).filter((v) => v.t > i * SLICE && v.t <= (i + 1) * SLICE).length),
      );
      if (n) out.push({ i, n });
    }
    return out;
  }, [a, b]);
  if (!slices.length) return null;
  const busiest = slices.reduce((p, q) => (q.n > p.n ? q : p)).i;
  const slice = pick != null && slices.some((x) => x.i === pick) ? pick : busiest;
  return (
    <Sub title={f.title} hint={f.hint}>
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="mr-1 text-muted-foreground">{f.window}</span>
        {slices.map(({ i }) => (
          <button
            key={i}
            type="button"
            onClick={() => setPick(i)}
            aria-pressed={slice === i}
            className={cn(
              "cursor-pointer rounded-md border px-2 py-0.5 tabular-nums",
              slice === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {`${i * 5}–${i * 5 + 5}′`}
          </button>
        ))}
      </div>
      <PerSide>{(k, s) => <RouteSide s={s} side={k} slice={slice} />}</PerSide>
      <Caveat kind="estimate">{f.stackNote}</Caveat>
    </Sub>
  );
}

function RouteSide({ s, side, slice }: { s: LabSide; side: SideKey; slice: number }) {
  const { t } = useLab();
  const x = t.x.farming;
  const f = x.routes;
  const [from, to] = useTimeWindow(s);
  const st = useMemo(() => routeStats(s, from, to), [s, from, to]);
  const all = useMemo(() => routeStats(s, -Infinity, Infinity), [s]);
  const shown = useMemo(
    () => campVisits(s).filter((v) => v.t > slice * SLICE && v.t <= (slice + 1) * SLICE),
    [s, slice],
  );
  if (!st || !all) return <Muted>{x.noData}</Muted>;
  // Numbered in order; bigger for more creeps, a ring around the clears of 7 or more.
  const marks: MapMark[] = shown.flatMap((v, i) => {
    const r = 1.5 + Math.min(1.5, v.n * 0.18);
    const color = v.ancient ? ANCIENT_COLOR : SIDE_COLOR[side];
    const dot: MapMark = {
      x: v.x,
      y: v.y,
      color,
      size: r,
      label: String(i + 1),
      title: f.visit(i + 1, clock(v.t), v.n),
    };
    return v.n >= LARGE_CLEAR
      ? [{ x: v.x, y: v.y, color, shape: "ring" as const, size: r + 0.9 }, dot]
      : [dot];
  });
  const secs = (v: number | null) => (v == null ? "–" : x.seconds(Math.round(v)));
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-1">
        <LabMap marks={marks} of={s} />
        <p className="text-[11px] text-muted-foreground">
          {f.slice(slice * 5, slice * 5 + 5, shown.length)} · {shown.length ? f.map : f.noVisits}
        </p>
      </div>
      <div className="flex flex-col gap-2 text-xs">
        <dl className="grid grid-cols-[auto_auto] justify-start gap-x-4 gap-y-0.5 tabular-nums">
          <dt className="text-muted-foreground">{f.visits}</dt>
          <dd>{st.visits}</dd>
          <dt className="text-muted-foreground">{f.ancient}</dt>
          <dd>{st.ancient}</dd>
          <dt className="text-muted-foreground">{f.perVisit}</dt>
          <dd>{num(st.perVisit, 1)}</dd>
          <dt className="text-muted-foreground">{f.perMin}</dt>
          <dd>{num(st.perMin, 1)}</dd>
          <dt className="text-muted-foreground">{f.walk}</dt>
          <dd>{secs(st.walk)}</dd>
          <dt className="text-muted-foreground">{f.cycle}</dt>
          <dd>{secs(st.cycle)}</dd>
          <dt className="text-muted-foreground">{f.large}</dt>
          <dd>{st.large.length}</dd>
          <dt className="text-muted-foreground">{f.stacks}</dt>
          <dd>
            {all.large.length} / {teamStacks(s)}
          </dd>
        </dl>
        {st.large.length > 0 && (
          <p className="text-muted-foreground">
            {f.large}
            {t.insight.colon}
            {st.large.map((v) => `${clock(v.t)} ×${v.n}`).join(t.insight.sep)}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Rhythm ───────────────────────────────────────────────────────────────────────────────────

function RhythmBlock() {
  const { a, b, t } = useLab();
  const f = t.x.farming.rhythm;
  if (!rhythm(a) && !(b && rhythm(b))) return null;
  return (
    <Sub title={f.title} hint={f.hint}>
      <PerSide>{(k, s) => <RhythmSide s={s} side={k} />}</PerSide>
      <Caveat kind="estimate">{f.rule}</Caveat>
    </Sub>
  );
}

function RhythmSide({ s, side }: { s: LabSide; side: SideKey }) {
  const { t } = useLab();
  const x = t.x.farming;
  const f = x.rhythm;
  const [from, to] = useTimeWindow(s);
  const r = useMemo(() => {
    const rh = rhythm(s);
    if (!rh) return null;
    const w: [number, number] = [from, to];
    const idle = rh.idle.filter((g) => inWindow(g.t, w));
    return {
      switches: rh.switches.filter((v) => inWindow(v, w)),
      gaps: rh.gaps.filter((g) => inWindow(g.t, w)),
      idle,
      lh: lastHits(s).filter((h) => h.t >= AFTER_LANE && inWindow(h.t, w)).length,
      longest: idle.reduce<(typeof idle)[number] | null>((m, g) => (!m || g.d > m.d ? g : m), null),
    };
  }, [s, from, to]);
  if (!r) return <Muted>{x.noData}</Muted>;
  return (
    <div className="flex flex-col gap-1.5">
      <TimeStrip
        side={side}
        s={s}
        rows={[
          { key: "switches", label: f.switches, times: r.switches },
          { key: "gaps", label: f.gaps, times: r.gaps.map((g) => g.t) },
          { key: "idle", label: f.idle, times: r.idle.map((g) => g.t) },
        ]}
      />
      <p className="text-xs">
        {f.line(
          r.switches.length,
          r.lh ? num((r.switches.length / r.lh) * 100, 1) : "–",
          r.gaps.length,
          r.idle.length,
          r.longest ? f.longest(x.seconds(r.longest.d), clock(r.longest.t)) : "",
        )}
      </p>
    </div>
  );
}

// ── How the last hits were made ──────────────────────────────────────────────────────────────

function MethodBlock() {
  const { a, b, t } = useLab();
  const f = t.x.farming.method;
  if (!lastHits(a).length && !(b && lastHits(b).length)) return null;
  return (
    <Sub title={f.title} hint={f.hint}>
      <PerSide>{(k, s) => <MethodSide s={s} />}</PerSide>
    </Sub>
  );
}

function MethodSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const names = useNames();
  const x = t.x.farming;
  const f = x.method;
  const rows = lastHitMethods(s);
  if (!rows.length) return <Muted>{x.noData}</Muted>;
  const total = sum(rows.map((r) => r.total));
  const label = (r: MethodRow): ReactNode => {
    if (r.key === "rightClick")
      return (
        <span className="flex items-center gap-1.5">
          <SourceIcon k="null" size={16} />
          {f.rightClick}
        </span>
      );
    if (r.key === "units") return f.units;
    if (!r.by) return r.src === 1 ? f.item : f.ability;
    return (
      <span className="flex items-center gap-1.5">
        {r.src === 1 ? <ItemIcon k={r.by} size={16} /> : <SourceIcon k={r.by} size={16} />}
        {r.src === 1 ? names.items(r.by) : names.abilities(r.by)}
      </span>
    );
  };
  return (
    <Grid
      first={f.source}
      heads={[...t.deep.phaseNames, f.total, f.share, f.gold]}
      rows={rows.map((r) => ({
        key: r.key,
        label: label(r),
        cells: [...r.n.map((n) => (n ? n : "·")), r.total, pct(r.total / total), num(r.gold)],
      }))}
    />
  );
}

// ── Where the farm came from ─────────────────────────────────────────────────────────────────

const PLACE_ROWS = [
  "ownJungle",
  "enemyJungle",
  "ancients",
  "ownBase",
  "ownHalf",
  "enemyHalf",
  "enemyBase",
  "enemyTowers",
] as const satisfies (keyof Places)[];

function PlacesBlock() {
  const { a, b, t } = useLab();
  const f = t.x.farming.places;
  return (
    <Sub title={f.title}>
      <PerSide>{(k, s) => <PlacesSide s={s} side={k} />}</PerSide>
      {(lastHits(a).length > 0 || (b && lastHits(b).length > 0)) && <Caveat kind="estimate">{f.rule}</Caveat>}
    </Sub>
  );
}

function PlacesSide({ s, side }: { s: LabSide; side: SideKey }) {
  const { t } = useLab();
  const f = t.x.farming.places;
  const camps = campKills(s);
  const creeps = creepKills(s);
  const places = farmPlaces(s);
  const share = (p: Places, v: number | null) => (p.n && v != null ? pct(v / p.n) : "–");
  const cols = [...places.phases, places.all];
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground">{f.camps}</span>
        <Bars
          color={SIDE_COLOR[side]}
          rows={CAMP_SIZES.filter((k) => k !== "other" || camps.other > 0).map((k) => ({
            key: k,
            label: f.campNames[k],
            value: camps[k],
          }))}
        />
      </div>
      <p>
        {f.creeps(creeps.melee, creeps.ranged, creeps.siege, creeps.flagbearer)}
        {creeps.upgraded + creeps.mega > 0 ? f.upgraded(creeps.upgraded, creeps.mega) : ""}
        {f.denied(creeps.denied)}
      </p>
      {places.all.n > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">{f.where}</span>
          <Grid
            heads={[...t.deep.phaseNames, t.x.farming.all]}
            rows={[
              { key: "n", label: f.n, cells: cols.map((p) => p.n) },
              // One share per row; the bases only when some last hit was there.
              ...PLACE_ROWS.filter((k) => cols.some((p) => (p[k] ?? 0) > 0) || !k.endsWith("Base")).map(
                (k) => ({
                  key: k,
                  label: f.rows[k],
                  cells: cols.map((p) => share(p, p[k])),
                }),
              ),
            ]}
          />
        </div>
      )}
    </div>
  );
}

// ── Key items: affordable to paid ────────────────────────────────────────────────────────────

function AffordBlock() {
  const { a, b, t } = useLab();
  const f = t.x.farming.afford;
  if (!a.advanced.unspent.length && !b?.advanced.unspent.length) return null;
  return (
    <Sub title={f.title} hint={f.hint}>
      <PerSide>{(k, s) => <AffordSide s={s} />}</PerSide>
      <Caveat kind="estimate">{f.rule}</Caveat>
    </Sub>
  );
}

function AffordSide({ s }: { s: LabSide }) {
  const { t, assets } = useLab();
  const names = useNames();
  const x = t.x.farming;
  const f = x.afford;
  const w = useTimeWindow(s);
  if (!s.advanced.unspent.length) return <Muted>{x.noData}</Muted>;
  const list = affordDelays(s, assets).filter((a) => inWindow(a.t, w));
  if (!list.length) return <Muted>{f.none}</Muted>;
  const secs = (v: number | null) => (v == null ? "–" : v ? x.seconds(v) : "0");
  return (
    <Grid
      heads={[f.bought, f.from, f.held, f.heldBuyback, f.wait, f.where]}
      rows={list.map((a) => ({
        key: a.key,
        label: (
          <span className="flex items-center gap-1.5 text-foreground">
            <ItemIcon k={a.key} size={16} />
            {names.items(a.key)}
          </span>
        ),
        cells: [
          clock(a.t),
          a.from != null ? clock(a.from) : "–",
          secs(a.held),
          secs(a.heldBuyback),
          secs(a.wait),
          f.place[a.place ?? "field"],
        ],
      }))}
    />
  );
}

// ── The same game state ──────────────────────────────────────────────────────────────────────

const STATE_COLS: { key: keyof StateRates; fmt: (v: number) => string }[] = [
  { key: "farm", fmt: (v) => num(v) },
  { key: "lh", fmt: (v) => num(v, 1) },
  { key: "hd", fmt: (v) => num(v) },
  { key: "td", fmt: (v) => num(v) },
  { key: "deaths", fmt: (v) => num(v, 1) },
  { key: "farmPct", fmt: (v) => pct(v) },
  { key: "fightPct", fmt: (v) => pct(v) },
];

function StateBlock() {
  const { a, b, t } = useLab();
  const f = t.x.farming.state;
  const sides = useMemo(() => (b ? [a, b] : [a]).filter((s) => s.advanced.context.nwLead.length), [a, b]);
  // Each state over the whole game, then by phase; a side's values only where it spent STATE_MIN
  // minutes or more.
  const rows = useMemo(
    () =>
      GAME_STATES.flatMap((state) =>
        [null, 0, 1, 2, 3].map((phase) => ({
          state,
          phase,
          rates: sides.map((s) => stateRates(s, state, phase)),
        })),
      ).filter((r) => r.rates.some((x) => x.minutes >= STATE_MIN)),
    [sides],
  );
  if (!sides.length)
    return (
      <Sub title={f.title}>
        <Muted>{f.noLead}</Muted>
      </Sub>
    );
  const pair = sides.length > 1;
  const both = (r: (typeof rows)[number]) => pair && r.rates.every((x) => x.minutes >= STATE_MIN);
  const anyMatch = rows.some((r) => r.phase != null && both(r));
  const cell = (rates: StateRates[], k: keyof StateRates, fmt: (v: number) => string) =>
    rates
      .map((x) => {
        const v = x[k];
        return x.minutes >= STATE_MIN && v != null ? fmt(v) : "–";
      })
      .join(" / ");
  return (
    <Sub title={f.title} hint={f.hint}>
      <div className="flex flex-col gap-0.5 text-xs">
        {sides.map((s) => {
          const sh = stateShares(s);
          return (
            <p key={s === a ? "a" : "b"} className="flex flex-wrap items-center gap-2">
              {b && (
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: SIDE_COLOR[s === a ? "a" : "b"] }}
                />
              )}
              <span className="text-muted-foreground">{f.share}</span>
              {GAME_STATES.map((k) => `${f.states[k]} ${pct(sh[k])}`).join(t.insight.sep)}
            </p>
          );
        })}
      </div>
      <Grid
        first={pair ? `${f.row}${f.pair}` : f.row}
        heads={[f.minutes, f.farm, f.lh, f.hd, f.td, f.deaths, f.farmPct, f.fightPct]}
        rows={rows.map((r) => ({
          key: `${r.state}-${r.phase}`,
          label: `${f.states[r.state]} · ${r.phase == null ? t.x.farming.all : t.deep.phaseNames[r.phase]}`,
          shade: both(r),
          cells: [
            r.rates.map((x) => x.minutes).join(" / "),
            ...STATE_COLS.map((c) => cell(r.rates, c.key, c.fmt)),
          ],
        }))}
      />
      <Muted>
        {f.ratesHint}
        {pair && (anyMatch ? f.matchHint : f.noMatch)}
      </Muted>
    </Sub>
  );
}

// ── The section ──────────────────────────────────────────────────────────────────────────────

export function FarmingBlocks() {
  return (
    <>
      <DataNotes />
      <SpeedBlock />
      <StateBlock />
      <RoutesBlock />
      <RhythmBlock />
      <MethodBlock />
      <PlacesBlock />
      <AffordBlock />
    </>
  );
}
