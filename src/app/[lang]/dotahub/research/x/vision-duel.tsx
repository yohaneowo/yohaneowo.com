"use client";

import { useCallback, useMemo } from "react";
import type { LabSide } from "@/lib/dota/lab";
import type { Activity } from "@/lib/dota/lab-extra";
import { clock } from "@/lib/dota/map";
import { AREAS, num, pct } from "../insights";
import { Bars, Caveat, ItemIcon, LineCompare, SIDE_COLOR, SideDot, Sub, useLab } from "../lab-parts";
import { duel } from "./vision-calc";

// When A and B are in the same match: the two players' direct dealings — damage and kills between
// them, the net-worth gap and the race to key items, whose jungle each farmed, and what each did
// while the other farmed.

const ACTS: Activity[] = ["farmLane", "farmJungle", "fight", "move", "base", "dead"];

export function DuelBlock() {
  const { a, b, t } = useLab();
  const v = t.x.vision;
  const d = useMemo(() => (b ? duel(a, b) : null), [a, b]);
  const dmg = useCallback(
    (s: LabSide) => (!d?.damage ? null : s === a ? d.damage.curves.a : s === b ? d.damage.curves.b : null),
    [a, b, d],
  );
  const gap = useCallback((s: LabSide) => (d && s === a ? d.nwGap : null), [a, d]);
  if (!b || !d) return null;
  const who = (k: "a" | "b") => (k === "a" ? t.insight.a : t.insight.b);
  const times = (list: { t: number; killer: boolean }[], killer: boolean) =>
    list
      .filter((x) => x.killer === killer)
      .map((x) => clock(x.t))
      .join(t.insight.sep) || v.none;
  const rows = Math.min(8, Math.max(d.items.a.length, d.items.b.length));
  return (
    <Sub title={d.opponents ? v.duel : v.mates}>
      {d.opponents && (
        <div className="flex flex-col gap-1 text-xs">
          {d.damage && (
            <p>
              {v.damageLine(
                num(d.damage.aToB),
                num(d.damage.aToBUnits),
                num(d.damage.bToA),
                num(d.damage.bToAUnits),
                num(d.damage.aToB10),
                num(d.damage.bToA10),
              )}
            </p>
          )}
          <p className="flex items-center gap-1.5">
            <SideDot side="a" />
            {v.killsLine(who("a"), who("b"), times(d.aKills, true), times(d.aKills, false))}
          </p>
          <p className="flex items-center gap-1.5">
            <SideDot side="b" />
            {v.killsLine(who("b"), who("a"), times(d.bKills, true), times(d.bKills, false))}
          </p>
        </div>
      )}
      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
        {d.damage && <LineCompare title={v.dmgChart} series={dmg} height={180} />}
        <LineCompare title={v.nwGap} series={gap} height={180} />
      </div>
      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
        <Sub title={v.itemRace}>
          {rows ? (
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-1 font-normal">{v.order}</th>
                  <th className="py-1 font-normal">
                    <SideDot side="a" className="mr-1" />
                    {who("a")}
                  </th>
                  <th className="py-1 font-normal">
                    <SideDot side="b" className="mr-1" />
                    {who("b")}
                  </th>
                  {d.opponents && <th className="py-1 text-right font-normal">{v.first}</th>}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rows }, (_, i) => {
                  const x = d.items.a[i];
                  const y = d.items.b[i];
                  const lead = x && y ? y.t - x.t : null;
                  return (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="py-1">
                        {x ? (
                          <span className="flex items-center gap-1 tabular-nums">
                            <ItemIcon k={x.key} size={16} />
                            {clock(x.t)}
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="py-1">
                        {y ? (
                          <span className="flex items-center gap-1 tabular-nums">
                            <ItemIcon k={y.key} size={16} />
                            {clock(y.t)}
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      {d.opponents && (
                        <td className="py-1 text-right tabular-nums">
                          {lead == null || lead === 0 ? (
                            "–"
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <SideDot side={lead > 0 ? "a" : "b"} />
                              {clock(Math.abs(lead))}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground">{v.none}</p>
          )}
        </Sub>
        {(d.jungle.a || d.jungle.b) && (
          <Sub title={v.jungleTitle} hint={v.jungleHint}>
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-1 font-normal" />
                  <th className="py-1 text-right font-normal">
                    {d.opponents ? v.jungleOf(who("a")) : v.ownJungle}
                  </th>
                  <th className="py-1 text-right font-normal">
                    {d.opponents ? v.jungleOf(who("b")) : v.enemyJungle}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(["a", "b"] as const).map((k) => {
                  const j = d.jungle[k];
                  // For opponents the columns are A's and B's jungles: B's own is the second.
                  const cols = !j
                    ? [null, null]
                    : d.opponents && k === "b"
                      ? [j.enemy, j.own]
                      : [j.own, j.enemy];
                  return (
                    <tr key={k} className="border-b last:border-0">
                      <td className="py-1">
                        <SideDot side={k} className="mr-1" />
                        {who(k)}
                      </td>
                      {cols.map((c, i) => (
                        <td key={i} className="py-1 text-right tabular-nums">
                          {c ? v.creeps(c.n, num(c.gold)) : v.none}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Sub>
        )}
      </div>
      {d.whileFarmed && (
        <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
          {(["a", "b"] as const).map((k) => {
            const w = d.whileFarmed![k];
            const other = k === "a" ? "b" : "a";
            return (
              <Sub key={k} title={v.whileFarmed(who(k), who(other))}>
                {w.n ? (
                  <>
                    <Bars
                      color={SIDE_COLOR[k]}
                      max={1}
                      format={(x) => pct(x)}
                      rows={ACTS.filter((x) => w.counts[x]).map((x) => ({
                        key: x,
                        value: (w.counts[x] ?? 0) / w.n,
                        label: t.deep.activities[x],
                      }))}
                    />
                    {w.alive > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {v.whereLine(
                          AREAS.filter((x) => w.areas[x])
                            .sort((x, y) => (w.areas[y] ?? 0) - (w.areas[x] ?? 0))
                            .slice(0, 3)
                            .map((x) => `${t.movement.zoneNames[x]} ${pct((w.areas[x] ?? 0) / w.alive)}`)
                            .join(t.insight.sep),
                        )}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">{v.nearOther(who(other), pct(w.near))}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">{v.none}</p>
                )}
              </Sub>
            );
          })}
        </div>
      )}
      {d.whileFarmed && <Caveat kind="estimate">{t.deep.timeHint}</Caveat>}
    </Sub>
  );
}
