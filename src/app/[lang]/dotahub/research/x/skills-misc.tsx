"use client";

import { useCallback, useMemo } from "react";
import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { type Align, firstBuys, minutesOf, num, timeOf } from "../insights";
import {
  Caveat,
  ItemIcon,
  LineCompare,
  PerSide,
  SIDE_COLOR,
  SideDot,
  type SideKey,
  Sub,
  TimeStrip,
  useLab,
  useSides,
  useTimeWindow,
} from "../lab-parts";
import { Muted } from "./skills-blocks";
import {
  chatOf,
  countOf,
  MAIN_GROUPS,
  type MapFeatures,
  mapFeatures,
  ORDER_GROUPS,
  orderCount,
  WALK_SPEED,
} from "./skills-calc";

// The misc section's blocks: attack damage and regeneration over time, the map's features, more of
// OpenDota's command counts, and the player's chat.

// ── Attack damage and regeneration ───────────────────────────────────────────────────────────

const attackOf = (s: LabSide) => {
  const b = s.advanced.battle;
  return b.damage.length ? b.damage.map((v, m) => v + (b.bonus[m] ?? 0)) : null;
};
const hpRegenOf = (s: LabSide) => (s.advanced.battle.hpRegen.length ? s.advanced.battle.hpRegen : null);
const mpRegenOf = (s: LabSide) => (s.advanced.battle.mpRegen.length ? s.advanced.battle.mpRegen : null);
const oneDecimal = (v: number) => num(v, 1);
const ITEM_MARK = "#a855f7";

export function BattleBlock() {
  const { t, assets } = useLab();
  const x = t.x.skills.battle;
  const sides = useSides();
  const marks = useCallback(
    (s: LabSide) => [...firstBuys(s, assets).values()].map((at) => ({ t: at, color: ITEM_MARK })),
    [assets],
  );
  if (!sides.some(([, s]) => s.advanced.battle.damage.length)) return null;
  return (
    <Sub title={x.title} hint={x.hint}>
      <div className="grid gap-x-6 gap-y-3 lg:grid-cols-3">
        <LineCompare title={x.attack} series={attackOf} marks={marks} height={170} />
        <LineCompare title={x.hpRegen} series={hpRegenOf} format={oneDecimal} height={170} />
        <LineCompare title={x.mpRegen} series={mpRegenOf} format={oneDecimal} height={170} />
      </div>
      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {sides.map(([k, s]) => (
          <p key={k} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <SideDot side={k} />
            <span className="inline-block size-2 rounded-full" style={{ background: ITEM_MARK }} />
            <span>
              {x.marks}
              {t.insight.colon}
            </span>
            {[...firstBuys(s, assets).entries()].map(([key, at]) => (
              <span key={key} className="flex items-center gap-1">
                <ItemIcon k={key} size={14} />
                <span className="tabular-nums">{clock(at)}</span>
              </span>
            ))}
          </p>
        ))}
      </div>
    </Sub>
  );
}

// ── Map features ─────────────────────────────────────────────────────────────────────────────

// The seconds a side's shared time range covers (as useTimeWindow, for both sides at once).
const windowOf = (s: LabSide, align: Align, range: [number, number]): [number, number] => [
  timeOf(s, range[0], align) ?? -Infinity,
  timeOf(s, range[1], align) ?? Infinity,
];

function MapStrip({ side, s, f }: { side: SideKey; s: LabSide; f: MapFeatures }) {
  const { t } = useLab();
  const x = t.x.skills.map;
  const rows = [
    { key: "watchers", label: x.watchers, times: Array.isArray(f.watchers) ? f.watchers : [] },
    { key: "gates", label: x.gates, times: (f.trips ?? []).map((p) => p.t) },
    { key: "lotuses", label: x.lotuses, times: Array.isArray(f.lotuses) ? f.lotuses : [] },
    { key: "wisdom", label: x.wisdom, times: f.wisdom },
    { key: "tormentorOurs", label: x.tormentorOurs, times: f.tormentor.ours },
    { key: "tormentorTheirs", label: x.tormentorTheirs, times: f.tormentor.theirs },
  ].filter((r) => r.times.length);
  return rows.length ? <TimeStrip side={side} s={s} rows={rows} /> : null;
}

export function MapBlock() {
  const { t, a, b, align, range } = useLab();
  const x = t.x.skills.map;
  const feats = useMemo(
    () =>
      (b ? [a, b] : [a]).map((s) => {
        const [from, to] = windowOf(s, align, range);
        return mapFeatures(s, from, to);
      }),
    [a, b, align, range],
  );
  const sides = useSides();
  const walk = (f: MapFeatures) => (f.trips ?? []).reduce((sum, p) => sum + p.dist / WALK_SPEED, 0);
  const rows: {
    key: string;
    label: string;
    cells: (f: MapFeatures) => string;
    show: (f: MapFeatures) => boolean;
  }[] = [
    {
      key: "watchers",
      label: x.watchers,
      cells: (f) => `${countOf(f.watchers)}${typeof f.watchers === "number" ? ` ${x.noTimes}` : ""}`,
      show: (f) => countOf(f.watchers) > 0,
    },
    {
      key: "gates",
      label: x.gates,
      cells: (f) => (f.trips ? x.gatesValue(f.trips.length, f.gateUses) : String(f.gateUses)),
      show: (f) => f.gateUses > 0,
    },
    {
      key: "walk",
      label: x.walk,
      cells: (f) =>
        f.trips?.length
          ? x.walkValue(clock(Math.round(walk(f) / f.trips.length)), clock(Math.round(walk(f))))
          : "–",
      show: (f) => !!f.trips?.length,
    },
    {
      key: "lotuses",
      label: x.lotuses,
      cells: (f) =>
        [
          `${countOf(f.lotuses)}${typeof f.lotuses === "number" ? ` ${x.noTimes}` : ""}`,
          f.lotusGiven > 0 && x.lotusGiven(f.lotusGiven),
          f.lotusFrom > 0 && x.lotusFrom(f.lotusFrom),
          f.plucks > 0 && `${x.plucks} ${f.plucks}`,
        ]
          .filter(Boolean)
          .join(" · "),
      show: (f) => countOf(f.lotuses) > 0 || f.lotusFrom > 0 || f.plucks > 0,
    },
    {
      key: "outposts",
      label: x.outposts,
      cells: (f) => `${f.outposts} ${x.noTimes}`,
      show: (f) => f.outposts > 0,
    },
    {
      key: "wisdom",
      label: x.wisdom,
      cells: (f) => `${f.wisdom.length}${f.wisdomXp ? ` · ${x.wisdomXp(f.wisdomXp.toLocaleString())}` : ""}`,
      show: (f) => f.wisdom.length > 0,
    },
    {
      key: "tormentor",
      label: x.tormentor,
      cells: (f) =>
        `${f.tormentor.ours.length} / ${f.tormentor.theirs.length}${f.tormentor.mine ? ` · ${x.tormentorMine(f.tormentor.mine)}` : ""}`,
      show: (f) => f.tormentor.ours.length + f.tormentor.theirs.length > 0,
    },
  ];
  const shown = rows.filter((r) => feats.some(r.show));
  return (
    <Sub title={x.title} hint={x.hint}>
      {shown.length ? (
        <>
          <table className="w-full max-w-2xl text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 font-normal">{x.feature}</th>
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
              {shown.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="py-1 text-muted-foreground">{r.label}</td>
                  {feats.map((f, i) => (
                    <td key={i} className="py-1 text-right tabular-nums">
                      {r.cells(f)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <PerSide>{(k, s) => <MapStrip side={k} s={s} f={feats[k === "a" ? 0 : 1]} />}</PerSide>
          {feats.some((f) => f.trips?.length) && <Caveat kind="estimate">{x.walkNote(WALK_SPEED)}</Caveat>}
          {feats.some((f) => f.wisdomXp) && <Caveat kind="source">{x.xpNote}</Caveat>}
        </>
      ) : (
        <Muted>{x.none}</Muted>
      )}
    </Sub>
  );
}

// ── Commands ─────────────────────────────────────────────────────────────────────────────────

export function OrdersBlock() {
  const { t } = useLab();
  const x = t.x.skills.orders;
  const sides = useSides();
  if (!sides.some(([, s]) => s.orders.length)) return null;
  // The main kinds only where STRATZ's breakdown above is missing.
  const main = sides.some(([, s]) => !Object.keys(s.actions).length);
  const groups = [...ORDER_GROUPS, ...(main ? MAIN_GROUPS : [])].filter(([, keys]) =>
    sides.some(([, s]) => orderCount(s, keys) > 0),
  );
  if (!groups.length) return null;
  return (
    <Sub title={x.title} hint={x.hint}>
      <table className="w-full max-w-2xl text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal">{x.command}</th>
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
          {groups.map(([key, keys]) => (
            <tr key={key} className="border-b last:border-0">
              <td className="py-1 text-muted-foreground">{x.names[key] ?? key}</td>
              {sides.map(([k, s]) => {
                const n = orderCount(s, keys);
                return (
                  <td key={k} className="py-1 text-right tabular-nums">
                    {s.orders.length ? x.value(num(n), num(n / minutesOf(s), 2)) : "–"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Caveat kind="source">{x.note}</Caveat>
    </Sub>
  );
}

// ── Chat ─────────────────────────────────────────────────────────────────────────────────────

function ChatSide({ side, s }: { side: SideKey; s: LabSide }) {
  const { t } = useLab();
  const x = t.x.skills.chat;
  const [from, to] = useTimeWindow(s);
  const c = useMemo(() => chatOf(s, from, to), [s, from, to]);
  // The same line repeated within a second once, with the count.
  const lines = useMemo(() => {
    const out: { t: number; wheel: boolean; text: string; n: number }[] = [];
    for (const l of c.own) {
      const prev = out[out.length - 1];
      if (prev && prev.text === l.text && prev.wheel === l.wheel && l.t - prev.t <= 1) prev.n++;
      else out.push({ t: l.t, wheel: l.wheel, text: l.text, n: 1 });
    }
    return out;
  }, [c]);
  if (!lines.length && !c.missing.length && !c.wellPlayed.length) return <Muted>{x.none}</Muted>;
  const rows = [
    { key: "own", label: x.own, times: c.own.filter((l) => !l.wheel).map((l) => l.t) },
    { key: "wheel", label: x.ownWheel, times: c.own.filter((l) => l.wheel).map((l) => l.t) },
    { key: "missing", label: x.missing, times: c.missing },
    { key: "wellPlayed", label: x.wellPlayed, times: c.wellPlayed },
  ].filter((r) => r.times.length);
  return (
    <div className="flex flex-col gap-2">
      {lines.length > 0 && (
        <ul className="flex max-h-40 flex-col gap-0.5 overflow-auto text-xs">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-12 shrink-0 text-muted-foreground tabular-nums">{clock(l.t)}</span>
              {l.wheel && (
                <span className="h-fit shrink-0 rounded border px-1 text-[10px] text-muted-foreground">
                  {x.wheel}
                </span>
              )}
              <span className="min-w-0 break-words">
                {l.text}
                {l.n > 1 && <span className="ml-1 text-muted-foreground tabular-nums">×{l.n}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && <TimeStrip side={side} s={s} rows={rows} />}
    </div>
  );
}

export function ChatBlock() {
  const { t } = useLab();
  const x = t.x.skills.chat;
  const sides = useSides();
  if (!sides.some(([, s]) => s.match.chat.length)) return null;
  return (
    <Sub title={x.title} hint={x.hint}>
      <PerSide>{(k, s) => <ChatSide side={k} s={s} />}</PerSide>
    </Sub>
  );
}
