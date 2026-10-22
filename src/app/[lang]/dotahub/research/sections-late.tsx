"use client";

import { useCallback, useMemo, useState } from "react";
import type { LabFight, LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import {
  aliveAt,
  AREAS,
  areaOf,
  areaShares,
  GOLD_KINDS,
  goldShares,
  minutesOf,
  num,
  pct,
  xpShares,
} from "./insights";
import {
  Bars,
  HeroIcon,
  LabMap,
  LineCompare,
  type MapMark,
  PerSide,
  SIDE_COLOR,
  type SideKey,
  SourceIcon,
  Sub,
  useLab,
  useNames,
  useSides,
  useTimeWindow,
} from "./lab-parts";

const inWindow = (t: number, w: [number, number]) => t >= w[0] && t <= w[1];

// npc_dota_badguys_tower2_mid → 中路二塔, melee_rax_top → 上路近战兵营…
export function buildingName(key: string, t: ReturnType<typeof useLab>["t"]) {
  const k = key.replace(/^npc_dota_(good|bad)guys_/, "");
  const b = t.damage.building;
  const tower = /^tower(\d)(?:_(top|mid|bot))?$/.exec(k);
  if (tower) return b.tower(Number(tower[1]), tower[2] ? t.lanes[tower[2]] : "");
  const rax = /^(melee|range)_rax_(top|mid|bot)$/.exec(k);
  if (rax) return b.rax(rax[1] === "melee", t.lanes[rax[2]]);
  if (k.startsWith("fort")) return b.fort;
  if (k.includes("healers") || k.includes("shrine")) return b.shrine;
  if (k.includes("fillers")) return b.filler;
  return k;
}

// ── Fights ───────────────────────────────────────────────────────────────────────────────────

const KIND_TONE: Record<LabFight["kind"], string> = {
  kill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  death: "bg-red-500/15 text-red-700 dark:text-red-300",
  assist: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
};
const KIND_COLOR: Record<LabFight["kind"], string> = { kill: "#22c55e", death: "#ef4444", assist: "#86efac" };

function cumulative(s: LabSide, kinds: LabFight["kind"][]) {
  const out = Array.from({ length: s.minutes.netWorth.length }, () => 0);
  for (const f of s.fights.events)
    if (kinds.includes(f.kind)) for (let m = Math.max(0, Math.ceil(f.t / 60)); m < out.length; m++) out[m]++;
  return out;
}

// The share of the team's kills the player took part in, as it built up minute by minute.
function killParticipation(s: LabSide) {
  const enemy = new Set(s.enemies);
  const len = s.minutes.netWorth.length;
  if (!s.match.deaths.length) return null;
  const team = Array.from({ length: len }, () => 0);
  for (const d of s.match.deaths)
    if (enemy.has(d.hero)) for (let m = Math.max(0, Math.ceil(d.t / 60)); m < len; m++) team[m]++;
  const mine = cumulative(s, ["kill", "assist"]);
  return team.map((n, m) => (n ? Math.min(1, mine[m] / n) : 0));
}
const pctFmt = (v: number) => `${Math.round(v * 100)}%`;

function FightMap({ s, side }: { s: LabSide; side: SideKey }) {
  const w = useTimeWindow(s);
  const marks: MapMark[] = s.fights.events
    .filter((f) => f.x != null && f.y != null && inWindow(f.t, w))
    .map((f) => ({
      x: f.x!,
      y: f.y!,
      color: KIND_COLOR[f.kind],
      shape: f.kind === "assist" ? "ring" : "dot",
      size: f.kind === "assist" ? 1.3 : 1.7,
      title: `${clock(f.t)} ${f.kind}`,
    }));
  return <LabMap marks={marks} cursorOf={[{ side, s }]} />;
}

export function FightsBody() {
  const { t } = useLab();
  const f = t.fights;
  const ka = useCallback((s: LabSide) => cumulative(s, ["kill", "assist"]), []);
  const deaths = useCallback(
    (s: LabSide) => [{ name: f.death, values: cumulative(s, ["death"]) }],
    [f.death],
  );
  return (
    <>
      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
        <LineCompare title={f.cumulative} series={ka} extra={deaths} step integer />
        <LineCompare title={f.kpOverTime} series={killParticipation} format={pctFmt} />
      </div>
      <Sub title={f.map}>
        <PerSide>
          {(k, s) => (
            <div className="grid gap-3 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
              <FightMap s={s} side={k} />
              <dl className="grid grid-cols-2 content-start gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">{f.participation}</dt>
                <dd className="tabular-nums">{pct(s.fights.participation)}</dd>
                <dt className="text-muted-foreground">{t.header.kda}</dt>
                <dd className="tabular-nums">
                  {s.totals.kills} / {s.totals.deaths} / {s.totals.assists}
                </dd>
                <dt className="text-muted-foreground">{f.multi}</dt>
                <dd className="tabular-nums">
                  {Object.entries(s.fights.multiKills)
                    .map(([n, c]) => `${n}×${c}`)
                    .join(t.insight.sep) || "–"}
                </dd>
                <dt className="text-muted-foreground">{f.streaks}</dt>
                <dd className="tabular-nums">
                  {Object.entries(s.fights.streaks)
                    .map(([n, c]) => `${n}×${c}`)
                    .join(t.insight.sep) || "–"}
                </dd>
                <dt className="text-muted-foreground">{f.maxHit}</dt>
                <dd className="flex items-center gap-1 tabular-nums">
                  {s.fights.maxHit ? (
                    <>
                      {num(s.fights.maxHit.value)} <HeroIcon id={s.fights.maxHit.hero} size={14} />
                      {s.fights.maxHit.by && <SourceIcon k={s.fights.maxHit.by} size={14} />}
                      <span className="text-muted-foreground">{clock(s.fights.maxHit.t)}</span>
                    </>
                  ) : (
                    "–"
                  )}
                </dd>
                {s.firstBlood && (s.firstBlood.mine || s.firstBlood.victim) && (
                  <>
                    <dt className="text-muted-foreground">{t.misc.firstBlood}</dt>
                    <dd>
                      {s.firstBlood.mine ? t.misc.fbMine : t.misc.fbVictim} {clock(s.firstBlood.t)}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          )}
        </PerSide>
      </Sub>

      <Sub title={f.events}>
        <PerSide>{(k, s) => <FightTable s={s} />}</PerSide>
      </Sub>

      <Sub title={f.teamfights}>
        <PerSide>
          {(k, s) => (
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-1 font-normal">{f.fightTime}</th>
                    <th className="py-1 font-normal">{f.joined}</th>
                    <th className="py-1 text-right font-normal">{f.result}</th>
                    <th className="py-1 text-right font-normal">{f.dmg}</th>
                    <th className="py-1 text-right font-normal">{f.heal}</th>
                    <th className="py-1 text-right font-normal">{f.goldDelta}</th>
                    <th className="py-1 text-right font-normal">{f.xpDelta}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.fights.teamfights.map((x, i) => (
                    <tr
                      key={i}
                      className={cn("border-b last:border-0", !x.joined && "text-muted-foreground")}
                    >
                      <td className="py-1 tabular-nums">
                        {clock(x.start)}–{clock(x.end)}
                      </td>
                      <td className="py-1">
                        {x.joined ? f.yes : f.no}
                        {x.died && <span className="ml-1 text-red-600 dark:text-red-400">✝</span>}
                        {x.buyback && <span className="ml-1">BB</span>}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {x.teamDeaths} / {x.enemyDeaths}
                      </td>
                      <td className="py-1 text-right tabular-nums">{num(x.damage)}</td>
                      <td className="py-1 text-right tabular-nums">{num(x.healing)}</td>
                      <td className="py-1 text-right tabular-nums">{num(x.goldDelta)}</td>
                      <td className="py-1 text-right tabular-nums">{num(x.xpDelta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PerSide>
      </Sub>
    </>
  );
}

function FightTable({ s }: { s: LabSide }) {
  const { t } = useLab();
  const f = t.fights;
  const w = useTimeWindow(s);
  const rows = s.fights.events.filter((e) => inWindow(e.t, w));
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal">{f.time}</th>
            <th className="py-1 font-normal" />
            <th className="py-1 font-normal">{f.with}</th>
            <th className="py-1 font-normal">{f.where}</th>
            <th className="py-1 font-normal">{f.by}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => (
            <tr key={i} className="border-b align-top last:border-0">
              <td className="py-1 tabular-nums">{clock(e.t)}</td>
              <td className="py-1">
                <span className="flex items-center gap-1">
                  <span className={cn("rounded px-1", KIND_TONE[e.kind])}>{f[e.kind]}</span>
                  <HeroIcon id={e.hero} size={18} />
                </span>
              </td>
              <td className="py-1">
                <span className="flex flex-wrap gap-0.5">
                  {(e.kind === "death" ? e.enemies : e.allies).map((h) => (
                    <HeroIcon key={h} id={h} size={16} />
                  ))}
                </span>
              </td>
              <td className="py-1 text-muted-foreground">
                {e.x != null && e.y != null ? t.movement.zoneNames[areaOf(e.x, e.y, s.radiant)] : "–"}
              </td>
              <td className="py-1">
                <span className="flex flex-wrap items-center gap-1">
                  {e.by ? <SourceIcon k={e.by} size={16} /> : null}
                  {e.flags.map((x) => (
                    <span key={x} className="rounded bg-muted px-1">
                      {f.flags[x] ?? x}
                    </span>
                  ))}
                  {e.gold ? <span className="text-muted-foreground">{f.goldLost(e.gold)}</span> : null}
                  {e.timeDead ? <span className="text-muted-foreground">{f.dead(e.timeDead)}</span> : null}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Damage ───────────────────────────────────────────────────────────────────────────────────

export function DamageBody() {
  const { t } = useLab();
  const d = t.damage;
  const names = useNames();
  const perMinute = useCallback(
    (s: LabSide) => s.minutes.heroDamage.map((v, m) => (m ? v - s.minutes.heroDamage[m - 1] : v)),
    [],
  );
  const kindRows = (counts: Record<string, number>) =>
    Object.entries(counts)
      .filter(([, v]) => v > 0)
      .sort((x, y) => y[1] - x[1])
      .map(([k, v]) => ({ key: k, value: v, label: d.kinds[k] ?? k }));
  const sourceRows = (list: { key: string; value: number }[]) => {
    const total = list.reduce((a, b) => a + b.value, 0) || 1;
    return list.slice(0, 14).map((x) => ({
      key: x.key,
      value: x.value,
      note: pct(x.value / total),
      label: (
        <>
          <SourceIcon k={x.key} size={16} />
          <span className="truncate">{names.abilities(x.key)}</span>
        </>
      ),
    }));
  };
  const heroRows = (list: { hero: number; value: number }[]) =>
    list.map((x) => ({
      key: String(x.hero),
      value: x.value,
      label: (
        <>
          <HeroIcon id={x.hero} size={16} />
          <span className="truncate">{names.heroes(x.hero)}</span>
        </>
      ),
    }));
  return (
    <>
      <LineCompare title={d.perMinute} series={perMinute} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Sub title={d.dealtSource}>
          <PerSide>
            {(k, s) => <Bars color={SIDE_COLOR[k]} rows={sourceRows(s.damage.dealtBySource)} />}
          </PerSide>
        </Sub>
        <Sub title={d.takenSource}>
          <PerSide>
            {(k, s) => <Bars color={SIDE_COLOR[k]} rows={sourceRows(s.damage.receivedBySource)} />}
          </PerSide>
        </Sub>
        <Sub title={d.toHeroes}>
          <PerSide>{(k, s) => <Bars color={SIDE_COLOR[k]} rows={heroRows(s.damage.toHeroes)} />}</PerSide>
        </Sub>
        <Sub title={d.fromHeroes}>
          <PerSide>{(k, s) => <Bars color={SIDE_COLOR[k]} rows={heroRows(s.damage.fromHeroes)} />}</PerSide>
        </Sub>
        <Sub title={d.byKind}>
          <PerSide>{(k, s) => <Bars color={SIDE_COLOR[k]} rows={kindRows(s.damage.dealtByKind)} />}</PerSide>
        </Sub>
        <Sub title={d.takenKind}>
          <PerSide>{(k, s) => <Bars color={SIDE_COLOR[k]} rows={kindRows(s.damage.takenByKind)} />}</PerSide>
        </Sub>
        <Sub title={d.buildings}>
          <PerSide>
            {(k, s) => (
              <Bars
                color={SIDE_COLOR[k]}
                rows={s.damage.buildings.slice(0, 12).map((x) => ({
                  key: x.key,
                  value: x.value,
                  label: <span className="truncate">{buildingName(x.key, t)}</span>,
                }))}
              />
            )}
          </PerSide>
        </Sub>
        <Sub title={d.hits}>
          <PerSide>
            {(k, s) => (
              <Bars
                color={SIDE_COLOR[k]}
                rows={s.damage.hits.slice(0, 10).map((x) => ({
                  key: x.key,
                  value: x.value,
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
      </div>
    </>
  );
}

// ── Vision ───────────────────────────────────────────────────────────────────────────────────

const WARD_COLOR = { obs: "#facc15", sen: "#22d3ee", deward: "#ef4444" };

function VisionMap({ s, side }: { s: LabSide; side: SideKey }) {
  const w = useTimeWindow(s);
  const marks: MapMark[] = [
    ...s.vision.wards
      .filter((x) => x.t <= w[1] && (x.end ?? s.duration) >= w[0])
      .map((x) => ({
        x: x.x,
        y: x.y,
        color: WARD_COLOR[x.kind],
        shape: (x.kind === "obs" ? "dot" : "square") as MapMark["shape"],
        size: 1.5,
        title: `${clock(x.t)}`,
      })),
    ...s.vision.dewards
      .filter((x) => inWindow(x.t, w))
      .map((x) => ({
        x: x.x,
        y: x.y,
        color: WARD_COLOR.deward,
        shape: "cross" as const,
        size: 1.4,
        title: clock(x.t),
      })),
  ];
  return <LabMap marks={marks} cursorOf={[{ side, s }]} />;
}

export function VisionBody() {
  const { t } = useLab();
  const v = t.vision;
  return (
    <Sub title={v.map}>
      <PerSide>
        {(k, s) => (
          <div className="grid gap-3 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
            <VisionMap s={s} side={k} />
            <div className="flex min-w-0 flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {v.counts(
                  s.vision.wards.filter((w) => w.kind === "obs").length,
                  s.vision.wards.filter((w) => w.kind === "sen").length,
                  s.vision.dewards.length,
                )}
              </p>
              {s.vision.wards.length ? (
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background text-left text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-1 font-normal">{v.type}</th>
                        <th className="py-1 font-normal">{v.placed}</th>
                        <th className="py-1 font-normal">{v.lived}</th>
                        <th className="py-1 font-normal">{v.killedBy}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.vision.wards.map((w, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-0.5">
                            <span
                              className="mr-1 inline-block size-2 rounded-full"
                              style={{ background: WARD_COLOR[w.kind] }}
                            />
                            {w.kind === "obs" ? v.obs : v.sen}
                          </td>
                          <td className="py-0.5 tabular-nums">{clock(w.t)}</td>
                          <td className="py-0.5 tabular-nums">{w.end != null ? clock(w.end - w.t) : "–"}</td>
                          <td className="py-0.5">
                            {w.killedBy ? <HeroIcon id={w.killedBy} size={14} /> : v.expired}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{v.none}</p>
              )}
              {s.vision.dewards.length > 0 && (
                <p className="text-xs">
                  {v.dewards}
                  {t.insight.colon}
                  {s.vision.dewards
                    .map((d) => `${d.kind === "obs" ? v.obs : v.sen} ${clock(d.t)}`)
                    .join(t.insight.sep)}
                </p>
              )}
            </div>
          </div>
        )}
      </PerSide>
    </Sub>
  );
}

// ── Movement ─────────────────────────────────────────────────────────────────────────────────

const WINDOWS: [number, number][] = [
  [-90, 600],
  [600, 1200],
  [1200, 1800],
  [1800, 2400],
  [2400, 99999],
];

export function MovementBody() {
  const { t } = useLab();
  const m = t.movement;
  const [win, setWin] = useState<number | null>(null);
  const sides = useSides();
  if (!sides.some(([, s]) => s.path.t.length))
    return <p className="text-sm text-muted-foreground">{m.noPath}</p>;
  return (
    <>
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="mr-1 text-muted-foreground">{m.window}</span>
        {[null, ...WINDOWS.map((_, i) => i)].map((i) => (
          <button
            key={i ?? "all"}
            type="button"
            onClick={() => setWin(i)}
            aria-pressed={win === i}
            className={cn(
              "cursor-pointer rounded-md border px-2 py-0.5",
              win === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {i == null
              ? m.all
              : `${Math.max(0, WINDOWS[i][0] / 60)}–${WINDOWS[i][1] > 9000 ? "" : WINDOWS[i][1] / 60}′`}
          </button>
        ))}
        <span className="ml-2 text-muted-foreground">{t.controls.cursor}</span>
      </div>
      <PerSide>{(k, s) => <MovementSide s={s} side={k} win={win == null ? null : WINDOWS[win]} />}</PerSide>
      <Sub title={m.farmMap}>
        <PerSide>{(k, s) => <FarmMap s={s} side={k} />}</PerSide>
      </Sub>
    </>
  );
}

function MovementSide({ s, side, win }: { s: LabSide; side: SideKey; win: [number, number] | null }) {
  const { t } = useLab();
  const m = t.movement;
  const range = useTimeWindow(s);
  const from = Math.max(range[0], win?.[0] ?? -Infinity);
  const to = Math.min(range[1], win?.[1] ?? Infinity);
  const heat = useMemo(
    () =>
      s.path.t
        .map((tt, i) => ({ t: tt, x: s.path.x[i], y: s.path.y[i], alive: aliveAt(s, i) }))
        .filter((p) => p.alive && p.t >= from && p.t <= to),
    [s, from, to],
  );
  const shares = areaShares(s, from, to);
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <LabMap heat={heat} heatColor={SIDE_COLOR[side]} cursorOf={[{ side, s }]} />
      <Sub title={m.zones}>
        <Bars
          color={SIDE_COLOR[side]}
          max={1}
          format={(v) => pct(v)}
          rows={AREAS.map((a) => ({ key: a, value: shares.shares[a], label: m.zoneNames[a] }))}
        />
      </Sub>
    </div>
  );
}

const FARM_COLOR = ["#a3a3a3", "#22c55e", "#a855f7"];

function FarmMap({ s, side }: { s: LabSide; side: SideKey }) {
  const w = useTimeWindow(s);
  const marks: MapMark[] = s.resources.farm
    .filter((f) => inWindow(f.t, w))
    .map((f) => ({ x: f.x, y: f.y, color: FARM_COLOR[f.kind], size: 0.7 }));
  const counts = [0, 1, 2].map(
    (k) => s.resources.farm.filter((f) => f.kind === k && inWindow(f.t, w)).length,
  );
  const { t } = useLab();
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <LabMap marks={marks} cursorOf={[{ side, s }]} />
      <ul className="text-xs">
        <li>
          {t.resources.laneKills}: {counts[0]}
        </li>
        <li>
          {t.resources.neutralKills}: {counts[1]}
        </li>
        <li>
          {t.resources.ancientKills}: {counts[2]}
        </li>
      </ul>
    </div>
  );
}

// ── Resources ────────────────────────────────────────────────────────────────────────────────

export function ResourcesBody() {
  const { t } = useLab();
  const r = t.resources;
  const stacks = useCallback(
    (s: LabSide) => (s.minutes.campsStacked.length ? s.minutes.campsStacked : null),
    [],
  );
  const stacksAvg = useCallback((s: LabSide) => s.advanced.baseline?.minutes.campsStacked ?? null, []);
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        <Sub title={r.runes}>
          <PerSide>
            {(k, s) => {
              const byType = new Map<string, number>();
              for (const x of s.resources.runes) byType.set(x.rune, (byType.get(x.rune) ?? 0) + 1);
              return (
                <div className="flex flex-col gap-1.5 text-xs">
                  <p className="flex flex-wrap gap-2">
                    {[...byType.entries()].map(([rune, n]) => (
                      <span key={rune} className="rounded border px-1.5">
                        {r.runeNames[rune] ?? rune} ×{n}
                      </span>
                    ))}
                    {!byType.size && <span className="text-muted-foreground">{r.none}</span>}
                  </p>
                  <p className="text-muted-foreground">
                    {s.resources.runes
                      .map(
                        (x) =>
                          `${clock(x.t)} ${r.runeNames[x.rune] ?? x.rune}${x.action !== "PICKUP" ? `（${r.runeActions[x.action] ?? x.action}）` : ""}`,
                      )
                      .join(t.insight.sep)}
                  </p>
                </div>
              );
            }}
          </PerSide>
        </Sub>
        <Sub title={r.stacks}>
          <PerSide>
            {(k, s) => (
              <p className="text-xs">{r.stacked(s.resources.campsStacked, s.resources.creepsStacked)}</p>
            )}
          </PerSide>
          <LineCompare title={r.stacks} series={stacks} baseline={stacksAvg} height={160} step integer />
        </Sub>
        <Sub title={r.pulls} hint={r.pullsHint}>
          <PerSide>
            {(k, s) => {
              const pulled = s.resources.pulls.filter((p) => p.pulled);
              const farmed = s.resources.pulls.filter((p) => !p.pulled);
              return (
                <div className="flex flex-col gap-0.5 text-xs">
                  <p>
                    {r.pulledWaves(
                      pulled.length,
                      pulled.reduce((a, p) => a + p.n, 0),
                    )}
                    {pulled.length > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        {pulled.map((p) => clock(p.t)).join(t.insight.sep)}
                      </span>
                    )}
                  </p>
                  <p>
                    {r.farmedWaves(
                      farmed.length,
                      farmed.reduce((a, p) => a + p.n, 0),
                    )}
                    {farmed.length > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        {farmed.map((p) => clock(p.t)).join(t.insight.sep)}
                      </span>
                    )}
                  </p>
                </div>
              );
            }}
          </PerSide>
        </Sub>
        <Sub title={r.roshan}>
          <PerSide>
            {(k, s) => (
              <ul className="text-xs">
                {s.resources.roshan.length
                  ? s.resources.roshan.map((x, i) => (
                      <li key={i}>
                        <span className="tabular-nums">{clock(x.t)}</span> {r.roshanKinds[x.kind]}
                      </li>
                    ))
                  : r.none}
              </ul>
            )}
          </PerSide>
        </Sub>
        <Sub title={r.buybacks}>
          <PerSide>
            {(k, s) => (
              <p className="text-xs">
                {s.resources.buybacks.length
                  ? s.resources.buybacks
                      .map((b) => `${clock(b.t)}${b.cost ? `（${b.cost}）` : ""}`)
                      .join(t.insight.sep)
                  : r.noBuyback}
              </p>
            )}
          </PerSide>
        </Sub>
        <Sub title={r.counts}>
          <PerSide>
            {(k, s) => (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                {(
                  [
                    [r.laneKills, s.resources.laneKills],
                    [r.neutralKills, s.resources.neutralKills],
                    [r.ancientKills, s.resources.ancientKills],
                    [r.towers, s.resources.towersKilled],
                    [r.roshanKills, s.resources.roshanKills],
                    [r.couriers, s.resources.courierKills],
                  ] as [string, number][]
                ).map(([label, v]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="tabular-nums">
                      {v} <span className="text-muted-foreground">({num(v / minutesOf(s), 2)}/m)</span>
                    </dd>
                  </div>
                ))}
                {s.resources.buildingKills.length > 0 && (
                  <>
                    <dt className="text-muted-foreground">{r.buildingKills}</dt>
                    <dd>
                      {s.resources.buildingKills
                        .map((b) => `${clock(b.t)} ${buildingName(b.key, t)}`)
                        .join(t.insight.sep)}
                    </dd>
                  </>
                )}
              </dl>
            )}
          </PerSide>
        </Sub>
      </div>
    </>
  );
}

// ── Gold ─────────────────────────────────────────────────────────────────────────────────────

const GOLD_COLOR: Record<string, string> = {
  creeps: "#a3a3a3",
  neutrals: "#22c55e",
  heroes: "#ef4444",
  buildings: "#a16207",
  roshan: "#a855f7",
  runes: "#eab308",
  couriers: "#06b6d4",
  passive: "#64748b",
  other: "#d4d4d4",
};

export function GoldBody() {
  const { t } = useLab();
  const g = t.gold;
  const sides = useSides();
  return (
    <>
      <Sub title={g.title}>
        <div className="flex flex-col gap-2">
          {sides.map(([k, s]) => {
            const sh = goldShares(s);
            return (
              <div key={k} className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full" style={{ background: SIDE_COLOR[k] }} />
                <div className="flex h-6 min-w-0 flex-1 overflow-hidden rounded">
                  {GOLD_KINDS.filter((kind) => sh.shares[kind] > 0).map((kind) => (
                    <span
                      key={kind}
                      title={`${g.reasons[kind]} ${pct(sh.shares[kind], 1)}`}
                      className="flex items-center justify-center overflow-hidden border-r border-background text-[10px] whitespace-nowrap text-black"
                      style={{ width: `${sh.shares[kind] * 100}%`, background: GOLD_COLOR[kind] }}
                    >
                      {sh.shares[kind] > 0.07 ? `${g.reasons[kind]} ${pct(sh.shares[kind])}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <table className="mt-2 w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal" />
              {sides.map(([k]) => (
                <th key={k} className="py-1 text-right font-normal" colSpan={3}>
                  <span
                    className="mr-1 inline-block size-2 rounded-full"
                    style={{ background: SIDE_COLOR[k] }}
                  />
                  {k === "a" ? t.insight.a : t.insight.b}（{t.controls.total} · {g.share} · {g.perMin}）
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...GOLD_KINDS, "death" as const, "sells" as const].map((kind) => (
              <tr key={kind} className="border-b last:border-0">
                <td className="py-1">
                  <span
                    className="mr-1.5 inline-block size-2 rounded-sm"
                    style={{ background: GOLD_COLOR[kind] ?? (kind === "sells" ? "#0f766e" : "#7f1d1d") }}
                  />
                  {g.reasons[kind]}
                </td>
                {sides.map(([k, s]) => {
                  const sh = goldShares(s);
                  const v = kind === "death" ? -sh.lost : kind === "sells" ? sh.sells : sh.values[kind];
                  return [
                    <td key={`${k}v`} className="py-1 text-right tabular-nums">
                      {num(v)}
                    </td>,
                    <td key={`${k}s`} className="py-1 text-right text-muted-foreground tabular-nums">
                      {kind === "death" || kind === "sells" ? "" : pct(sh.shares[kind], 1)}
                    </td>,
                    <td key={`${k}m`} className="py-1 text-right text-muted-foreground tabular-nums">
                      {num(v / minutesOf(s))}
                    </td>,
                  ];
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Sub>
      <Sub title={g.xp}>
        <PerSide>
          {(k, s) => {
            const x = xpShares(s);
            return (
              <Bars
                color={SIDE_COLOR[k]}
                rows={(Object.entries(x.values) as [string, number][]).map(([kind, v]) => ({
                  key: kind,
                  value: v,
                  note: x.total ? pct(v / x.total) : "",
                  label: g.xpReasons[kind],
                }))}
              />
            );
          }}
        </PerSide>
      </Sub>
    </>
  );
}

// ── Actions and more ─────────────────────────────────────────────────────────────────────────

export function MiscBody() {
  const { t } = useLab();
  const m = t.misc;
  const fountain = useCallback((s: LabSide) => {
    if (!s.minutes.fountainTrips.length) return null;
    let sum = 0;
    return s.minutes.fountainTrips.map((v) => (sum += v));
  }, []);
  return (
    <>
      <PerSide>
        {(k, s) => (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs sm:grid-cols-4">
              <dt className="text-muted-foreground">{m.apm}</dt>
              <dd className="tabular-nums">{num(s.totals.apm)}</dd>
              <dt className="text-muted-foreground">{m.pings}</dt>
              <dd className="tabular-nums">{num(s.pings)}</dd>
              <dt className="text-muted-foreground">{m.dead}</dt>
              <dd className="tabular-nums">
                {s.totals.deadSeconds != null
                  ? `${clock(s.totals.deadSeconds)}（${pct(s.totals.deadSeconds / s.duration, 1)}）`
                  : "–"}
              </dd>
              <dt className="text-muted-foreground">{m.fountain}</dt>
              <dd className="tabular-nums">{num(s.minutes.fountainTrips.reduce((a, b) => a + b, 0))}</dd>
              <dt className="text-muted-foreground">{m.stuns}</dt>
              <dd className="tabular-nums">{num(s.totals.stuns, 1)}</dd>
              {s.totals.award && (
                <>
                  <dt className="text-muted-foreground">{m.award}</dt>
                  <dd>{m.awards[s.totals.award] ?? s.totals.award}</dd>
                </>
              )}
            </dl>
            {Object.keys(s.actions).length > 0 && (
              <Sub title={m.actions}>
                <Bars
                  color={SIDE_COLOR[k]}
                  rows={Object.entries(s.actions)
                    .filter(([, v]) => v > 0)
                    .sort((x, y) => y[1] - x[1])
                    .map(([key, v]) => ({
                      key,
                      value: v,
                      note: `${num(v / minutesOf(s))}/m`,
                      label: m.actionNames[key] ?? key,
                    }))}
                />
              </Sub>
            )}
            {Object.keys(s.benchmarks).length > 0 && (
              <Sub title={m.benchmarks}>
                <Bars
                  color={SIDE_COLOR[k]}
                  max={1}
                  format={(v) => pct(v)}
                  rows={Object.entries(s.benchmarks).map(([key, v]) => ({
                    key,
                    value: v,
                    label: m.benchNames[key] ?? key,
                  }))}
                />
              </Sub>
            )}
          </div>
        )}
      </PerSide>
      <LineCompare title={m.fountainTotal} series={fountain} height={150} step integer />
    </>
  );
}
