"use client";

import { useMemo } from "react";
import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { num, pct } from "../insights";
import {
  Bars,
  Caveat,
  HeroIcon,
  PerSide,
  SIDE_COLOR,
  SideDot,
  type SideKey,
  SourceIcon,
  Sub,
  useLab,
  useNames,
  useTimeWindow,
} from "../lab-parts";
import {
  abilityMatrix,
  damageEfficiency,
  fightOutcomes,
  foreignDamage,
  healBreakdown,
  targetPriority,
} from "./fights-calc";

// The fights module's damage blocks: whom the damage went to, damage for the net worth and the
// team shares, each source on each enemy, heals both ways, and the damage that wasn't the hero's.

const RULE = "text-xs text-muted-foreground";
const inWindow = (t: number, w: [number, number]) => t >= w[0] && t <= w[1];

// Ability keys start with the hero's name, except where the two differ.
const PREFIX_ALIAS: Record<string, string> = { sand_king: "sandking" };

// ── Whom the damage went to ──────────────────────────────────────────────────────────────────

function TargetsBlock() {
  const { t } = useLab();
  const x = t.x.fights;
  return (
    <Sub title={x.targets} hint={x.targetsHint}>
      <p className={RULE}>{x.targetsRule}</p>
      <PerSide>{(k, s) => <TargetsSide s={s} />}</PerSide>
    </Sub>
  );
}

function TargetsSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.fights;
  const w = useTimeWindow(s);
  const tp = useMemo(() => targetPriority(s, fightOutcomes(s)), [s]);
  if (!tp.dealt && !tp.taken) return <p className={RULE}>–</p>;
  const fights = tp.fights.filter((f) => inWindow(f.o.start, w));
  return (
    <div className="flex flex-col gap-2">
      <table className="w-full max-w-sm text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal">{x.posCol.pos}</th>
            <th className="py-1 font-normal" />
            <th className="py-1 text-right font-normal">{x.posCol.dealt}</th>
            <th className="py-1 text-right font-normal">{x.posCol.taken}</th>
          </tr>
        </thead>
        <tbody>
          {tp.rows.map((r) => (
            <tr key={r.pos} className="border-b last:border-0">
              <td className="py-1 text-muted-foreground">{x.pos(r.pos)}</td>
              <td className="py-1">
                <HeroIcon id={r.hero} size={16} />
              </td>
              <td className="py-1 text-right tabular-nums">
                {num(r.dealt)}
                <span className="ml-1 text-muted-foreground">
                  {pct(tp.dealt ? r.dealt / tp.dealt : null)}
                </span>
              </td>
              <td className="py-1 text-right tabular-nums">
                {num(r.taken)}
                <span className="ml-1 text-muted-foreground">
                  {pct(tp.taken ? r.taken / tp.taken : null)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs">
        {x.coreLine(pct(tp.coreDealt), pct(tp.carryMid), pct(tp.coreTaken))}
        {tp.converted != null && ` ${x.convLine(pct(tp.converted))}`}
      </p>
      {tp.estimated && <Caveat kind="estimate">{x.estimatedPos}</Caveat>}
      {fights.length > 0 && (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 font-normal">{x.fightCol.fight}</th>
                <th className="py-1 text-right font-normal">{x.fightCol.core}</th>
                <th className="py-1 text-right font-normal">{x.fightCol.conv}</th>
                <th className="py-1 text-right font-normal">{x.fightCol.coreTaken}</th>
              </tr>
            </thead>
            <tbody>
              {fights.map((f) => (
                <tr key={f.o.i} className="border-b last:border-0">
                  <td className="py-1 tabular-nums">{clock(f.o.start)}</td>
                  <td className="py-1 text-right tabular-nums">{pct(f.coreDealt)}</td>
                  <td className="py-1 text-right tabular-nums">{pct(f.converted)}</td>
                  <td className="py-1 text-right tabular-nums">{pct(f.coreTaken)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Damage for the net worth, and shares of the team ────────────────────────────────────────

function EfficiencyBlock() {
  const { t, a, b } = useLab();
  const x = t.x.fights;
  const data = useMemo(() => {
    const list: [SideKey, LabSide][] = b
      ? [
          ["a", a],
          ["b", b],
        ]
      : [["a", a]];
    return list.map(([k, s]) => [k, damageEfficiency(s)] as const);
  }, [a, b]);
  return (
    <Sub title={x.efficiency} hint={x.efficiencyHint}>
      <p className={RULE}>{x.efficiencyRule}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal">{x.per1k}</th>
              {[...t.deep.phaseNames, x.whole].map((n) => (
                <th key={n} className="py-1 pr-3 text-right font-normal">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(([k, e]) => (
              <tr key={k} className="border-b last:border-0">
                <td className="py-1.5">
                  <SideDot side={k} />
                </td>
                {[...e.phases, e.whole].map((p, i) => (
                  <td
                    key={i}
                    className="py-1.5 pr-3 text-right tabular-nums"
                    title={p ? `${num(p.dpm)} / ${num(p.nw)}` : undefined}
                  >
                    {p ? num(p.per1k, 1) : "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PerSide>
        {(k) => {
          const e = data.find(([key]) => key === k)?.[1];
          const rows = (["heroDamage", "towerDamage", "gold", "netWorth"] as const).flatMap((key) => {
            const v = e?.shares[key];
            return v != null ? [{ key, value: v, label: x.shareNames[key] }] : [];
          });
          return rows.length ? (
            <Bars color={SIDE_COLOR[k]} max={1} format={(v) => pct(v, 1)} rows={rows} />
          ) : (
            <p className={RULE}>–</p>
          );
        }}
      </PerSide>
    </Sub>
  );
}

// ── Each source on each enemy ────────────────────────────────────────────────────────────────

function MatrixBlock() {
  const { t } = useLab();
  const x = t.x.fights;
  return (
    <Sub title={x.matrix} hint={x.matrixHint}>
      <PerSide>{(k, s) => <MatrixSide s={s} side={k} />}</PerSide>
    </Sub>
  );
}

function MatrixSide({ s, side }: { s: LabSide; side: SideKey }) {
  const { t } = useLab();
  const x = t.x.fights;
  const names = useNames();
  const m = useMemo(() => abilityMatrix(s), [s]);
  if (!m.rows.length) return <p className={RULE}>–</p>;
  const top = Math.max(1, ...m.rows.flatMap((r) => r.targets.map((c) => c.value)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal" />
            {m.cols.map((h) => (
              <th key={h} className="px-1 py-1 text-right font-normal">
                <HeroIcon id={h} size={16} />
              </th>
            ))}
            <th className="py-1 pl-2 text-right font-normal">{x.total}</th>
          </tr>
        </thead>
        <tbody>
          {m.rows.map((r) => (
            <tr key={r.key} className="border-b last:border-0">
              <td className="py-1 pr-2">
                <span className="flex max-w-40 items-center gap-1.5">
                  <SourceIcon k={r.key} size={16} />
                  <span className="truncate">{names.abilities(r.key)}</span>
                </span>
              </td>
              {m.cols.map((h) => {
                const v = r.targets.find((c) => c.hero === h)?.value ?? 0;
                return (
                  <td
                    key={h}
                    className="px-1 py-1 text-right tabular-nums"
                    style={
                      v
                        ? {
                            background: `color-mix(in srgb, ${SIDE_COLOR[side]} ${Math.round(8 + 42 * (v / top))}%, transparent)`,
                          }
                        : undefined
                    }
                  >
                    {v ? num(v) : ""}
                  </td>
                );
              })}
              <td className="py-1 pl-2 text-right tabular-nums">
                {num(r.total)}
                <span className="ml-1 text-muted-foreground">{pct(r.total / m.total)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Heals received and given ─────────────────────────────────────────────────────────────────

function HealsBlock() {
  const { t } = useLab();
  const x = t.x.fights;
  return (
    <Sub title={x.heals} hint={x.healsHint}>
      <p className={RULE}>{x.healsRule}</p>
      <PerSide>{(k, s) => <HealsSide s={s} side={k} />}</PerSide>
    </Sub>
  );
}

function HealsSide({ s, side }: { s: LabSide; side: SideKey }) {
  const { t, assets } = useLab();
  const x = t.x.fights;
  const names = useNames();
  const h = useMemo(() => healBreakdown(s, assets), [s, assets]);
  if (!s.parsed.stratz || !h.any)
    return (
      <p className={RULE}>
        {x.noHeals}
        {s.totals.healing > 0 && ` ${x.odHealing(num(s.totals.healing))}`}
      </p>
    );
  const source = (key: string) => (
    <>
      <SourceIcon k={key} size={16} />
      <span className="truncate">{names.abilities(key)}</span>
    </>
  );
  const received = [
    ...h.allies.map((a) => ({
      key: `ally-${a.hero}`,
      value: a.v,
      label: (
        <>
          <HeroIcon id={a.hero} size={16} />
          {a.top && <SourceIcon k={a.top} size={14} />}
          <span className="truncate">{names.heroes(a.hero)}</span>
        </>
      ),
    })),
    ...h.ownItems.map((i) => ({ key: `item-${i.key}`, value: i.v, note: x.ownItems, label: source(i.key) })),
    ...h.ownAbilities.map((i) => ({
      key: `ability-${i.key}`,
      value: i.v,
      note: x.ownAbilities,
      label: source(i.key),
    })),
    { key: "regen", value: h.regen, label: <span className="truncate">{x.regen}</span> },
  ].filter((r) => r.value > 0);
  const given = h.given.map((g) => ({
    key: String(g.hero),
    value: g.v,
    label: (
      <>
        <HeroIcon id={g.hero} size={16} />
        <span className="truncate">{names.heroes(g.hero)}</span>
      </>
    ),
  }));
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <p className="font-medium">{x.received}</p>
      <Bars color={SIDE_COLOR[side]} rows={received} />
      {h.stratzIn != null && <p className="text-muted-foreground">{x.stratzIn(num(h.stratzIn))}</p>}
      <p className="mt-1 font-medium">{x.given}</p>
      {given.length ? (
        <Bars color={SIDE_COLOR[side]} rows={given} />
      ) : (
        <p className="text-muted-foreground">{x.noGiven}</p>
      )}
      {!!h.stratzGiven && <p className="text-muted-foreground">{x.stratzGiven(num(h.stratzGiven))}</p>}
    </div>
  );
}

// ── Damage that wasn't the hero's own ────────────────────────────────────────────────────────

function ForeignBlock() {
  const { t } = useLab();
  const x = t.x.fights;
  return (
    <Sub title={x.foreign}>
      <PerSide>{(k, s) => <ForeignSide s={s} />}</PerSide>
      <p className={RULE}>{x.unitsNote}</p>
    </Sub>
  );
}

function ForeignSide({ s }: { s: LabSide }) {
  const { t, assets, heroes } = useLab();
  const x = t.x.fights;
  const names = useNames();
  const f = useMemo(() => {
    const prefix = (id: number) => {
      const key = heroes[id]?.key.replace(/^npc_dota_hero_/, "");
      return key ? `${PREFIX_ALIAS[key] ?? key}_` : null;
    };
    return foreignDamage(
      s,
      assets,
      prefix(s.heroId),
      s.enemies.map(prefix).filter((p): p is string => !!p),
    );
  }, [s, assets, heroes]);
  const icons = (list: { key: string; value: number }[]) => (
    <span className="ml-1 inline-flex flex-wrap items-center gap-x-2 align-middle">
      {list.map((r) => (
        <span
          key={r.key}
          className="inline-flex items-center gap-0.5 tabular-nums"
          title={names.abilities(r.key)}
        >
          <SourceIcon k={r.key} size={14} />
          {num(r.value)}
        </span>
      ))}
    </span>
  );
  const lines = [
    f.reflectedTotal > 0 && (
      <p key="reflected">
        {x.reflected(num(f.reflectedTotal), f.reflectedHits)}
        {f.via ? x.via[f.via] : ""}
        {icons(f.reflected)}
      </p>
    ),
    f.backTotal > 0 && (
      <p key="back">
        {x.back(num(f.backTotal))}
        {icons(f.back)}
      </p>
    ),
    f.units && (f.units.dealt > 0 || f.units.taken > 0) && (
      <p key="units">
        {x.units(
          num(f.units.dealt),
          pct(f.units.dealtShare, 1),
          num(f.units.taken),
          pct(f.units.takenShare, 1),
        )}
      </p>
    ),
  ].filter(Boolean);
  // Without STRATZ's hits only reflected spells (OpenDota) can be told apart.
  return (
    <div className="flex flex-col gap-1 text-xs">
      {lines.length ? lines : <p className="text-muted-foreground">{f.units ? x.noForeign : "–"}</p>}
    </div>
  );
}

export function DamageBlocks() {
  return (
    <>
      <TargetsBlock />
      <EfficiencyBlock />
      <MatrixBlock />
      <HealsBlock />
      <ForeignBlock />
    </>
  );
}
