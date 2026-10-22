"use client";

import { useCallback } from "react";
import type { LabSide } from "@/lib/dota/lab";
import type { BaselineKey } from "@/lib/dota/lab-extra";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { firstBuys, minutesOf, num, xOf } from "./insights";
import {
  AbilityIcon,
  Bars,
  HeroIcon,
  ItemIcon,
  LineCompare,
  PerSide,
  SIDE_COLOR,
  SideDot,
  Sub,
  TimeStrip,
  useLab,
  useNames,
  useSides,
} from "./lab-parts";

// ── Timeline ─────────────────────────────────────────────────────────────────────────────────

const pctFmt = (v: number) => `${Math.round(v * 100)}%`;

// The rank average's curve for a stat (stable, so the charts don't redraw).
const bl = (key: BaselineKey) => (s: LabSide) => s.advanced.baseline?.minutes[key] ?? null;
const blNw = bl("networth");
const blXp = bl("xp");
const blLh = bl("cs");
const blDn = bl("dn");
const blLevel = bl("level");
const blHd = bl("heroDamage");
const blTd = bl("towerDamage");

export function TimelineBody() {
  const { t } = useLab();
  const tl = t.timeline;
  const nw = useCallback((s: LabSide) => s.minutes.netWorth, []);
  const xp = useCallback((s: LabSide) => s.minutes.xp, []);
  const lh = useCallback((s: LabSide) => s.minutes.lh, []);
  const dn = useCallback((s: LabSide) => s.minutes.dn, []);
  const level = useCallback((s: LabSide) => s.minutes.level, []);
  const hd = useCallback((s: LabSide) => (s.minutes.heroDamage.length ? s.minutes.heroDamage : null), []);
  const td = useCallback((s: LabSide) => (s.minutes.towerDamage.length ? s.minutes.towerDamage : null), []);
  const heal = useCallback(
    (s: LabSide) => (s.minutes.healing.some((v) => v > 0) ? s.minutes.healing : null),
    [],
  );
  const share = useCallback(
    (s: LabSide) =>
      s.minutes.netWorth.map((v, m) => (s.minutes.teamNetWorth[m] ? v / s.minutes.teamNetWorth[m] : 0)),
    [],
  );
  const hp = useCallback((s: LabSide) => (s.minutes.hpMin.length ? s.minutes.hpMin : null), []);
  const hpAvg = useCallback((s: LabSide) => (s.minutes.hpAvg.length ? s.minutes.hpAvg : null), []);
  const imp = useCallback((s: LabSide) => (s.minutes.imp.length ? s.minutes.imp : null), []);
  // STRATZ's "per minute" received damage is a running total.
  const taken = useCallback(
    (s: LabSide) => (s.minutes.damageTaken.length ? s.minutes.damageTaken : null),
    [],
  );
  const gold = useCallback((s: LabSide) => s.minutes.gold, []);
  return (
    <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
      <LineCompare title={tl.netWorth} series={nw} baseline={blNw} />
      <LineCompare title={tl.xp} series={xp} baseline={blXp} />
      <LineCompare title={tl.lh} series={lh} baseline={blLh} />
      <LineCompare title={tl.dn} series={dn} baseline={blDn} />
      <LineCompare title={tl.level} series={level} step integer baseline={blLevel} />
      <LineCompare title={tl.gold} series={gold} />
      <LineCompare title={tl.heroDamage} series={hd} baseline={blHd} />
      <LineCompare title={tl.towerDamage} series={td} baseline={blTd} />
      <LineCompare title={tl.nwShare} series={share} format={pctFmt} />
      <LineCompare title={tl.hp} series={hp} format={pctFmt} />
      <LineCompare title={tl.hpAvg} series={hpAvg} format={pctFmt} />
      <LineCompare title={tl.imp} series={imp} />
      <LineCompare title={tl.taken} series={taken} />
      <LineCompare title={tl.healing} series={heal} />
    </div>
  );
}

// ── Laning ───────────────────────────────────────────────────────────────────────────────────

const LANE_TONE: Record<string, string> = {
  top: "bg-sky-500/25",
  mid: "bg-amber-500/25",
  bot: "bg-emerald-500/25",
  jungle: "bg-lime-700/25",
  roam: "bg-violet-500/25",
};

export function LaningBody() {
  const { t, align } = useLab();
  const sides = useSides();
  const l = t.laning;
  const names = useNames();
  const nwEarly = useCallback((s: LabSide) => s.minutes.netWorth.slice(0, 13), []);
  const opponents = useCallback(
    (s: LabSide) => s.laning.opponents10.map((o) => ({ name: names.heroes(o.hero), values: o.curve })),
    [names],
  );
  const rows: { key: string; label: string; get: (s: LabSide) => string }[] = [
    { key: "lh", label: t.timeline.lh, get: (s) => num(s.laning.at10?.lh) },
    { key: "dn", label: t.timeline.dn, get: (s) => num(s.laning.at10?.dn) },
    { key: "nw", label: t.timeline.netWorth, get: (s) => num(s.laning.at10?.netWorth) },
    { key: "gold", label: t.timeline.gold, get: (s) => num(s.laning.at10?.gold) },
    { key: "xp", label: t.timeline.xp, get: (s) => num(s.laning.at10?.xp) },
    { key: "level", label: t.timeline.level, get: (s) => num(s.laning.at10?.level) },
    {
      key: "kd",
      label: l.killsDeaths,
      get: (s) => `${s.laning.killsBefore10} / ${s.laning.deathsBefore10}`,
    },
    {
      key: "eff",
      label: l.efficiency,
      get: (s) => (s.laning.efficiency != null ? `${s.laning.efficiency}%` : "–"),
    },
  ];
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Sub title={l.at10}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 font-normal">{l.metric}</th>
                {sides.map(([k]) => (
                  <th key={k} className="py-1.5 text-right font-normal">
                    <SideDot side={k} className="mr-1" />
                    {k === "a" ? t.insight.a : t.insight.b}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="py-1.5 text-muted-foreground">{r.label}</td>
                  {sides.map(([k, s]) => (
                    <td key={k} className="py-1.5 text-right tabular-nums">
                      {r.get(s)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Sub>
        <Sub title={l.vsLane}>
          <PerSide>
            {(k, s) =>
              s.laning.opponents10.length ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {s.laning.opponents10.map((o) => (
                    <li key={o.hero} className="flex items-center gap-2">
                      <HeroIcon id={o.hero} size={22} />
                      <span className="flex-1 text-xs text-muted-foreground tabular-nums">
                        {o.lh} / {o.dn} · {num(o.netWorth)} · XP {num(o.xp)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">{l.noOpponents}</p>
              )
            }
          </PerSide>
        </Sub>
      </div>
      <LineCompare
        title={l.nwChart}
        series={nwEarly}
        extra={opponents}
        height={220}
        xMax={align.kind === "time" ? 12 : undefined}
      />
      <Sub title={l.lanePerMinute}>
        <PerSide>
          {(k, s) => (
            <div className="flex flex-col gap-2">
              <div className="flex gap-0.5">
                {s.laning.lanes.map((lane, m) => (
                  <span
                    key={m}
                    title={`${m}:00 ${lane ? t.lanes[lane] : "–"}`}
                    className={cn(
                      "flex h-8 min-w-0 flex-1 flex-col items-center justify-center rounded text-[10px]",
                      lane ? LANE_TONE[lane] : "bg-muted/40",
                    )}
                  >
                    <span className="text-muted-foreground tabular-nums">{m}</span>
                    <span className="truncate">{lane ? t.lanes[lane] : "–"}</span>
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {l.swaps}
                {t.insight.colon}
                {s.laning.swaps.length
                  ? s.laning.swaps
                      .map((w) =>
                        l.swap(clock(w.t), t.lanes[w.from ?? ""] ?? "–", t.lanes[w.to ?? ""] ?? "–"),
                      )
                      .join(t.insight.sep)
                  : l.noSwap}
              </p>
              <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {t.header.allies}
                {t.insight.colon}
                {s.laneAllies.length ? s.laneAllies.map((h) => <HeroIcon key={h} id={h} size={18} />) : "–"}
                <span className="ml-3">
                  {t.header.opponents}
                  {t.insight.colon}
                </span>
                {s.laneOpponents.length
                  ? s.laneOpponents.map((h) => <HeroIcon key={h} id={h} size={18} />)
                  : "–"}
              </p>
            </div>
          )}
        </PerSide>
      </Sub>
    </>
  );
}

// ── Items ────────────────────────────────────────────────────────────────────────────────────

// Icons placed along the x range by purchase time, in as many rows as needed not to overlap.
function PurchaseTrack({ s, side, consumables }: { s: LabSide; side: "a" | "b"; consumables: boolean }) {
  const { align, range, assets } = useLab();
  const span = range[1] - range[0] || 1;
  const rows: number[] = [];
  const placed = s.items.purchases
    .filter((p) => (assets.items[p.key]?.consumable ?? false) === consumables && !p.key.startsWith("recipe_"))
    .map((p) => ({ ...p, x: xOf(s, p.t, align) }))
    .filter((p): p is typeof p & { x: number } => p.x != null && p.x >= range[0] && p.x <= range[1])
    .map((p) => {
      const f = (p.x - range[0]) / span;
      let row = rows.findIndex((end) => end < f);
      if (row < 0) {
        row = rows.length;
        rows.push(0);
      }
      rows[row] = f + (consumables ? 0.028 : 0.042);
      return { ...p, f, row };
    });
  const size = consumables ? 18 : 24;
  return (
    <div
      className="relative rounded bg-muted/40"
      style={{ height: Math.max(1, rows.length) * (size + 4) + 4 }}
    >
      {placed.map((p, i) => (
        <span
          key={i}
          className="absolute"
          style={{ left: `calc(${p.f * 100}% - ${size * 0.68}px)`, top: 2 + p.row * (size + 4) }}
        >
          <ItemIcon
            k={p.key}
            size={size}
            title={`${assets.items[p.key]?.zh ?? p.key} · ${clock(p.t)}`}
            className="ring-1"
          />
          <span className="sr-only">{clock(p.t)}</span>
          <span
            className="pointer-events-none absolute -bottom-0.5 left-0 h-0.5 w-full"
            style={{ background: SIDE_COLOR[side] }}
          />
        </span>
      ))}
    </div>
  );
}

const CONSUMABLE_ORDER = [
  "tango",
  "flask",
  "clarity",
  "faerie_fire",
  "enchanted_mango",
  "tpscroll",
  "smoke_of_deceit",
  "dust",
  "ward_observer",
  "ward_sentry",
  "ward_dispenser",
  "bottle",
  "blood_grenade",
  "famango",
  "great_famango",
  "greater_famango",
  "magic_stick",
  "magic_wand",
];

export function ItemsBody() {
  const { t, assets } = useLab();
  const it = t.items;
  const sides = useSides();
  const names = useNames();
  const firsts = sides.map(([k, s]) => [k, firstBuys(s, assets)] as const);
  const keys = [...new Set(firsts.flatMap(([, m]) => [...m.keys()]))].sort(
    (x, y) =>
      Math.min(...firsts.map(([, m]) => m.get(x) ?? Infinity)) -
      Math.min(...firsts.map(([, m]) => m.get(y) ?? Infinity)),
  );
  return (
    <>
      <Sub title={it.timeline}>
        <PerSide>
          {(k, s) => (
            <div className="flex flex-col gap-1.5">
              <PurchaseTrack s={s} side={k} consumables={false} />
              <PurchaseTrack s={s} side={k} consumables />
            </div>
          )}
        </PerSide>
      </Sub>

      <div className="grid gap-4 lg:grid-cols-2">
        <Sub title={it.keyItems}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 font-normal">{it.item}</th>
                {sides.map(([k]) => (
                  <th key={k} className="py-1.5 text-right font-normal">
                    <SideDot side={k} className="mr-1" />
                    {k === "a" ? t.insight.a : t.insight.b}
                  </th>
                ))}
                {sides.length > 1 && <th className="py-1.5 text-right font-normal">{it.diff}</th>}
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => {
                const ta = firsts[0][1].get(key);
                const tb = firsts[1]?.[1].get(key);
                return (
                  <tr key={key} className="border-b last:border-0">
                    <td className="py-1">
                      <span className="flex items-center gap-2">
                        <ItemIcon k={key} size={20} />
                        <span className="truncate text-xs">{names.items(key)}</span>
                      </span>
                    </td>
                    {firsts.map(([k, m]) => (
                      <td key={k} className="py-1 text-right tabular-nums">
                        {m.has(key) ? clock(m.get(key)!) : "–"}
                      </td>
                    ))}
                    {sides.length > 1 && (
                      <td
                        className={cn(
                          "py-1 text-right text-xs tabular-nums",
                          ta != null && tb != null && Math.abs(ta - tb) >= 120 && "font-semibold",
                        )}
                      >
                        {ta != null && tb != null
                          ? `${ta < tb ? t.insight.a : t.insight.b} −${clock(Math.abs(ta - tb))}`
                          : "–"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Sub>

        <Sub title={it.consumables}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 font-normal">{it.item}</th>
                {sides.map(([k]) => (
                  <th key={k} className="py-1.5 text-right font-normal">
                    <SideDot side={k} className="mr-1" />
                    {it.bought} / {it.used}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CONSUMABLE_ORDER.filter((key) =>
                sides.some(
                  ([, s]) =>
                    s.items.purchases.some((p) => p.key === key) || s.items.uses.some((u) => u.key === key),
                ),
              ).map((key) => (
                <tr key={key} className="border-b last:border-0">
                  <td className="py-1">
                    <span className="flex items-center gap-2">
                      <ItemIcon k={key} size={18} />
                      <span className="truncate text-xs">{names.items(key)}</span>
                    </span>
                  </td>
                  {sides.map(([k, s]) => (
                    <td key={k} className="py-1 text-right tabular-nums">
                      {s.items.purchases.filter((p) => p.key === key).length} /{" "}
                      {s.items.uses.find((u) => u.key === key)?.count ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Sub>
      </div>

      <Sub title={it.neutral}>
        <PerSide>
          {(k, s) =>
            s.items.neutralHistory.length ? (
              <ul className="flex flex-wrap gap-2 text-xs">
                {s.items.neutralHistory.map((n, i) => (
                  <li key={i} className="flex items-center gap-1.5 rounded border px-1.5 py-1">
                    <ItemIcon k={n.key} size={20} />
                    <span className="tabular-nums">{clock(n.t)}</span>
                    {n.enhancement && (
                      <span className="text-muted-foreground">{names.items(n.enhancement)}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{t.resources.none}</p>
            )
          }
        </PerSide>
      </Sub>

      <Sub title={it.uses} hint={it.timing}>
        <PerSide>
          {(k, s) =>
            s.items.useTimes.length ? (
              <TimeStrip
                side={k}
                s={s}
                rows={s.items.useTimes.slice(0, 18).map((u) => ({
                  key: u.key,
                  times: u.times,
                  label: (
                    <>
                      <ItemIcon k={u.key} size={16} />
                      <span className="truncate">{names.items(u.key)}</span>
                    </>
                  ),
                }))}
              />
            ) : (
              <Bars
                color={SIDE_COLOR[k]}
                rows={s.items.uses.slice(0, 18).map((u) => ({
                  key: u.key,
                  value: u.count,
                  note: `${num(u.count / minutesOf(s), 1)}/m`,
                  label: (
                    <>
                      <ItemIcon k={u.key} size={16} />
                      <span className="truncate">{names.items(u.key)}</span>
                    </>
                  ),
                }))}
              />
            )
          }
        </PerSide>
      </Sub>

      <Sub title={t.header.final}>
        <PerSide>
          {(k, s) => (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {s.items.final.map((key, i) => (
                <ItemIcon key={i} k={key} size={28} />
              ))}
              {s.items.backpack.length > 0 && (
                <span className="ml-2 text-muted-foreground">{it.backpack}</span>
              )}
              {s.items.backpack.map((key, i) => (
                <ItemIcon key={`b${i}`} k={key} size={20} className="opacity-70" />
              ))}
              {s.items.neutral && <ItemIcon k={s.items.neutral} size={24} className="ml-2 rounded-full" />}
              <span className="ml-2 text-muted-foreground">
                {[
                  s.items.buffs.scepter && it.scepter,
                  s.items.buffs.shard && it.shard,
                  s.items.buffs.moonshard && it.moonshard,
                ]
                  .filter(Boolean)
                  .join(t.insight.sep)}
              </span>
            </div>
          )}
        </PerSide>
      </Sub>
    </>
  );
}

// ── Skills ───────────────────────────────────────────────────────────────────────────────────

// The skill build as a grid: a row per ability (the talents in one row), a column per hero level
// at which either side took a point; each cell is the ability's point number. Comparing the same
// hero, a level where the other side took something else is marked.
function SkillGrid({ s, other, levels }: { s: LabSide; other: LabSide | null; levels: number[] }) {
  const { assets, t } = useLab();
  const names = useNames();
  const learned = s.skills.learned;
  const order = assets.heroAbilities[String(s.heroId)] ?? [];
  const keys = [
    ...new Set([
      ...order.filter((k) => learned.some((l) => l.key === k && !l.talent)),
      ...learned.filter((l) => !l.talent).map((l) => l.key),
    ]),
  ];
  const cells = new Map<string, { n: string; key: string; t: number }>();
  const counts = new Map<string, number>();
  for (const l of learned) {
    if (l.talent) {
      cells.set(`talent|${l.level}`, { n: "T", key: l.key, t: l.t });
      continue;
    }
    const n = (counts.get(l.key) ?? 0) + 1;
    counts.set(l.key, n);
    cells.set(`${l.key}|${l.level}`, { n: String(n), key: l.key, t: l.t });
  }
  const theirs = new Map(other?.skills.learned.map((l) => [l.level, l.talent ? "talent" : l.key]) ?? []);
  const rows = [...keys, ...(learned.some((l) => l.talent) ? ["talent"] : [])];
  return (
    <div className="overflow-x-auto">
      <table className="text-[11px]">
        <thead className="text-muted-foreground">
          <tr>
            <th className="sticky left-0 bg-background pr-2 text-left font-normal">{t.skills.levelCol}</th>
            {levels.map((lv) => (
              <th key={lv} className="w-5 text-center font-normal tabular-nums">
                {lv}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row} className="border-t">
              <td className="sticky left-0 bg-background py-0.5 pr-2">
                <span className="flex items-center gap-1">
                  {row === "talent" ? (
                    <span className="text-muted-foreground">{t.skills.talent}</span>
                  ) : (
                    <>
                      <AbilityIcon k={row} size={16} />
                      <span className="max-w-28 truncate">{names.abilities(row)}</span>
                    </>
                  )}
                </span>
              </td>
              {levels.map((lv) => {
                const c = cells.get(`${row}|${lv}`);
                const differ = !!c && !!other && theirs.has(lv) && theirs.get(lv) !== row;
                return (
                  <td
                    key={lv}
                    title={c ? `${names.abilities(c.key)} · Lv ${lv} · ${clock(c.t)}` : undefined}
                    className={cn(
                      "text-center tabular-nums",
                      c && "bg-muted font-semibold",
                      differ && "bg-amber-500/30",
                    )}
                  >
                    {c?.n ?? ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkillsBody() {
  const { t } = useLab();
  const sk = t.skills;
  const sides = useSides();
  const names = useNames();
  const sameHero = sides.length > 1 && sides[0][1].heroId === sides[1][1].heroId;
  const levels = [...new Set(sides.flatMap(([, s]) => s.skills.learned.map((l) => l.level)))].sort(
    (a, b) => a - b,
  );
  return (
    <>
      <Sub title={sk.order} hint={sameHero ? sk.orderHint : undefined}>
        {levels.length ? (
          <PerSide>
            {(k, s) => (
              <SkillGrid
                s={s}
                levels={levels}
                other={sameHero ? (sides.find(([key]) => key !== k)?.[1] ?? null) : null}
              />
            )}
          </PerSide>
        ) : (
          <p className="text-xs text-muted-foreground">{sk.noTiming}</p>
        )}
      </Sub>

      <Sub title={sk.uses} hint={sk.timing}>
        <PerSide>
          {(k, s) =>
            s.skills.useTimes.length ? (
              <TimeStrip
                side={k}
                s={s}
                rows={s.skills.useTimes.slice(0, 14).map((u) => ({
                  key: u.key,
                  times: u.times,
                  label: (
                    <>
                      <AbilityIcon k={u.key} size={16} />
                      <span className="truncate">{names.abilities(u.key)}</span>
                    </>
                  ),
                }))}
              />
            ) : (
              <Bars
                color={SIDE_COLOR[k]}
                rows={s.skills.uses.map((u) => ({
                  key: u.key,
                  value: u.count,
                  note: `${num(u.count / minutesOf(s), 1)}/m`,
                  label: (
                    <>
                      <AbilityIcon k={u.key} size={16} />
                      <span className="truncate">{names.abilities(u.key)}</span>
                    </>
                  ),
                }))}
              />
            )
          }
        </PerSide>
      </Sub>

      <Sub title={sk.targets}>
        <PerSide>
          {(k, s) =>
            s.skills.targets.length ? (
              <ul className="flex flex-col gap-1.5 text-xs">
                {s.skills.targets.map((x) => (
                  <li key={x.key} className="flex flex-wrap items-center gap-1.5">
                    <AbilityIcon k={x.key} size={18} />
                    <span className="w-32 truncate">{names.abilities(x.key)}</span>
                    {x.heroes.map((h) => (
                      <span key={h.hero} className="flex items-center gap-0.5 tabular-nums">
                        <HeroIcon id={h.hero} size={16} />
                        {h.count}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{t.resources.none}</p>
            )
          }
        </PerSide>
      </Sub>
    </>
  );
}
