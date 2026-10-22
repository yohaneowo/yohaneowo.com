"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { LabSide } from "@/lib/dota/lab";
import { clock, mapPoint } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { timeOf } from "../insights";
import {
  Caveat,
  type Cursor,
  HeroIcon,
  LabMap,
  type MapMark,
  SIDE_COLOR,
  type SideKey,
  Sub,
  useFlip,
  useLab,
  useSides,
} from "../lab-parts";
import { buildingName } from "../sections-late";
import { boardAt, moments } from "./vision-calc";

// The whole board at a moment: all ten heroes, the wards up, the buildings standing, and Roshan's,
// the Aegis's and the Tormentors' state, at a teamfight's start, a death, or the charts' cursor,
// with a slider around it. Enemies the studied player's team couldn't see (the fog estimate) fade.

const TEAM = { radiant: "#22c55e", dire: "#ef4444" };
const TEAM_FILL = { radiant: "rgba(34,197,94,0.55)", dire: "rgba(239,68,68,0.55)" };
// Roshan comes back 8 to 11 minutes after he falls.
const ROSHAN_MIN = 480;
const ROSHAN_MAX = 660;

// The last moment hovered on any chart, kept after the pointer leaves so the map can be read: one
// store per cursor, shared by every board.
type LastStore = { subscribe: (onChange: () => void) => () => void; get: () => number | null };
const lastStores = new WeakMap<Cursor, LastStore>();

function lastStore(cursor: Cursor): LastStore {
  const hit = lastStores.get(cursor);
  if (hit) return hit;
  let last = cursor.get();
  const listeners = new Set<() => void>();
  let stop: (() => void) | null = null;
  const store: LastStore = {
    subscribe: (onChange) => {
      listeners.add(onChange);
      stop ??= cursor.subscribe(() => {
        const v = cursor.get();
        if (v == null || v === last) return;
        last = v;
        listeners.forEach((l) => l());
      });
      return () => {
        listeners.delete(onChange);
        if (!listeners.size && stop) {
          stop();
          stop = null;
        }
      };
    },
    get: () => last,
  };
  lastStores.set(cursor, store);
  return store;
}

function useLastCursorTime(s: LabSide) {
  const { cursor, align } = useLab();
  const store = lastStore(cursor);
  const x = useSyncExternalStore(store.subscribe, store.get, () => null);
  return x == null ? null : timeOf(s, x, align);
}

// The grid sample nearest a moment.
function snap(ts: number[], t: number) {
  let best = ts[0];
  for (const x of ts) if (Math.abs(x - t) < Math.abs(best - t)) best = x;
  return best;
}

export function BoardBlock() {
  const { a, b, t } = useLab();
  const v = t.x.vision;
  const sides = useSides();
  if (!sides.some(([, s]) => s.match.grid.t.length)) return null;
  // One map when both are in the same match, with both marked.
  const same = !!b && b.matchId === a.matchId;
  return (
    <Sub title={v.board} hint={v.boardHint}>
      <div className={cn("grid gap-4", !same && b && "lg:grid-cols-2")}>
        {(same ? sides.slice(0, 1) : sides).map(([k, s]) => (
          <div key={k} className="flex min-w-0 flex-col gap-2">
            {!same && b && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold">
                <span className="inline-block size-2.5 rounded-full" style={{ background: SIDE_COLOR[k] }} />
                {k === "a" ? t.insight.a : t.insight.b}
              </span>
            )}
            <Board s={s} side={k} also={same ? b : null} />
          </div>
        ))}
      </div>
      <Caveat kind="hindsight">{v.boardHindsight}</Caveat>
      <Caveat kind="estimate">{v.boardFog}</Caveat>
    </Sub>
  );
}

function Board({ s, side, also }: { s: LabSide; side: SideKey; also: LabSide | null }) {
  const { t } = useLab();
  const v = t.x.vision;
  const list = useMemo(() => {
    const own = moments(s).map((m) => ({ ...m, who: side }));
    const more = also
      ? moments(also)
          .filter((m) => m.kind === "death")
          .map((m) => ({ ...m, who: "b" as SideKey }))
      : [];
    return [...own, ...more].sort((x, y) => x.t - y.t);
  }, [s, side, also]);
  const [pick, setPick] = useState(list.length ? "0" : "cursor");
  const [offset, setOffset] = useState(0);
  const hovered = useLastCursorTime(s);
  const base = pick === "cursor" ? hovered : (list[Number(pick)]?.t ?? null);
  const grid = s.match.grid.t;
  const at = base == null || !grid.length ? null : snap(grid, base + offset);
  const board = useMemo(() => (at == null ? null : boardAt(s, at)), [s, at]);
  const flip = useFlip(s);
  if (!grid.length) return <p className="text-xs text-muted-foreground">{v.noGrid}</p>;
  const team = (radiant: boolean) => (radiant ? "radiant" : "dire");
  const teamName = (radiant: boolean | null) =>
    radiant == null ? "–" : radiant ? t.pick.radiant : t.pick.dire;
  const marks: MapMark[] = board
    ? [
        ...board.buildings.map((x) => ({
          x: x.x,
          y: x.y,
          shape: "square" as const,
          color: TEAM_FILL[team(x.radiant)],
          size: x.type === "fort" ? 1.6 : x.type === "tower" ? 1.1 : 0.8,
          title: x.name ? buildingName(x.name, t) : x.type,
        })),
        ...board.wards.map((w) => ({
          x: w.x,
          y: w.y,
          shape: (w.kind === "obs" ? "dot" : "ring") as MapMark["shape"],
          color: TEAM[team(w.radiant)],
          size: 0.9,
          title: `${w.kind === "obs" ? v.obs : v.sen} ${clock(w.t)}`,
        })),
      ]
    : [];
  // The players studied: ringed in their side's colour.
  const ring = (slot: number) =>
    slot === s.slot ? SIDE_COLOR[side] : also && slot === also.slot ? SIDE_COLOR.b : null;
  const roshan = board?.roshan;
  const since = roshan && at != null ? at - roshan.t : null;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1 text-muted-foreground">
          {v.moment}
          <select
            value={pick}
            onChange={(e) => {
              setPick(e.target.value);
              setOffset(0);
            }}
            className="max-w-48 rounded border bg-background px-1 py-0.5 text-foreground"
          >
            <option value="cursor">{v.cursor}</option>
            {list.map((m, i) => (
              <option key={i} value={String(i)}>
                {m.kind === "fight"
                  ? v.fightAt(clock(m.t))
                  : v.deathAt(m.who === "a" ? t.insight.a : t.insight.b, clock(m.t))}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-muted-foreground">
          <input
            type="range"
            min={-30}
            max={30}
            step={10}
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value))}
            className="w-28 accent-foreground"
            aria-label={v.boardHint}
          />
          <span className="w-14 tabular-nums">
            {offset > 0 ? "+" : offset < 0 ? "−" : "±"}
            {v.secs(Math.abs(offset))}
          </span>
        </label>
        {at != null && board && (
          <span className="font-medium tabular-nums">{v.at(clock(at), board.night)}</span>
        )}
      </div>
      {at == null || !board ? (
        <p className="text-xs text-muted-foreground">{v.noCursor}</p>
      ) : (
        <>
          <div className="relative w-full max-w-sm">
            <LabMap marks={marks} of={s} />
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
              {board.heroes.map((h) => {
                if (!h.at || h.dead) return null;
                const p = flip ? mapPoint(256 - h.at.x, 256 - h.at.y) : mapPoint(h.at.x, h.at.y);
                const own = ring(h.slot);
                return (
                  <span
                    key={h.slot}
                    className={cn(
                      "absolute flex -translate-x-1/2 -translate-y-1/2 rounded-sm",
                      h.seen === false && "opacity-40",
                    )}
                    style={{
                      left: `${p.left * 100}%`,
                      top: `${p.top * 100}%`,
                      outline: `2px ${h.seen === false ? "dashed" : "solid"} ${own ?? TEAM[team(h.radiant)]}`,
                      zIndex: own ? 2 : 1,
                    }}
                  >
                    <HeroIcon id={h.hero} size={own ? 22 : 18} />
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1 text-xs">
            {[true, false].map((radiant) => (
              <div key={String(radiant)} className="flex flex-wrap items-center gap-1">
                <span className="flex w-12 shrink-0 items-center gap-1">
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ background: TEAM[team(radiant)] }}
                  />
                  {teamName(radiant)}
                </span>
                {board.heroes
                  .filter((h) => h.radiant === radiant)
                  .map((h) => (
                    <span
                      key={h.slot}
                      className={cn("flex items-center", (h.dead || h.seen === false) && "opacity-50")}
                      title={h.dead ? v.dead : h.seen === false ? v.inFog : undefined}
                    >
                      <HeroIcon id={h.hero} size={18} className={h.dead ? "grayscale" : undefined} />
                      {h.dead && <span className="text-[10px] text-red-600 dark:text-red-400">✝</span>}
                    </span>
                  ))}
              </div>
            ))}
            <p className="text-muted-foreground">
              {!roshan || since == null || since >= ROSHAN_MAX
                ? v.roshanAlive
                : since < ROSHAN_MIN
                  ? v.roshanDead(
                      teamName(roshan.radiant),
                      clock(roshan.t),
                      clock(roshan.t + ROSHAN_MIN),
                      clock(roshan.t + ROSHAN_MAX),
                    )
                  : v.roshanMaybe(teamName(roshan.radiant), clock(roshan.t), clock(roshan.t + ROSHAN_MAX))}
              {board.aegis && (
                <span className="ml-2 inline-flex items-center gap-1 align-middle">
                  <HeroIcon
                    id={s.match.players.find((p) => p.slot === board.aegis!.slot)?.heroId ?? null}
                    size={14}
                  />
                  {v.aegis(clock(board.aegis.until))}
                </span>
              )}
            </p>
            {board.tormentors.length > 0 && (
              <p className="text-muted-foreground">
                {v.tormentors(
                  board.tormentors.map((x) => `${clock(x.t)} ${teamName(x.radiant)}`).join(t.insight.sep),
                )}
              </p>
            )}
            <p className="text-muted-foreground">{v.boardLegend}</p>
          </div>
        </>
      )}
    </div>
  );
}
