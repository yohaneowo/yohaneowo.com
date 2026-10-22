"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useMemo } from "react";
import { useLocale } from "@/i18n/locale-provider";
import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { Medal, medalName } from "../../parts";
import { num, pct } from "../insights";
import {
  Caveat,
  HeroIcon,
  LineCompare,
  PerSide,
  SideDot,
  type SideKey,
  Sub,
  useLab,
  useNames,
  useSides,
  useTimeWindow,
} from "../lab-parts";
import {
  type CompareRow,
  comparability,
  disconnectSpans,
  draftCurve,
  draftGrades,
  draftReading,
  gameShape,
  heroRecord,
  inWindow,
  laneRole,
  me,
  parties,
  partySize,
  smurfEnemies,
} from "./history-calc";
import { shapeDetail, verdictText } from "./history-text";

// The game section: how alike A and B are, each player's experience and rank, all ten players, the
// game's shape, the draft's grades and its draft-only win chance, and pauses or disconnects.

const TONE = {
  good: "text-emerald-600 dark:text-emerald-400",
  bad: "text-red-600 dark:text-red-400",
} as const;
const pctFmt = (v: number) => `${Math.round(v * 100)}%`;

// One entry per match among the sides (the first side that played it).
function useMatches() {
  const sides = useSides();
  return sides.filter(([, s], i) => sides.findIndex(([, x]) => x.matchId === s.matchId) === i);
}

// ── How alike A and B are ────────────────────────────────────────────────────────────────────

function CompareValue({ k, s }: { k: CompareRow["key"]; s: LabSide }) {
  const { t } = useLab();
  const { t: dict } = useLocale();
  const h = t.x.history;
  const names = useNames();
  const unknown = <span className="text-muted-foreground">{h.unknown}</span>;
  switch (k) {
    case "match":
      return <>{s.matchId}</>;
    case "hero":
      return (
        <span className="inline-flex items-center gap-1">
          <HeroIcon id={s.heroId} size={16} />
          {names.heroes(s.heroId)}
        </span>
      );
    case "position":
      return s.position ? <>{t.header.position(s.position)}</> : unknown;
    case "patch":
      return s.patch ? <>{s.patch.name}</> : unknown;
    case "mode":
      return <>{dict.dotahub.modes[s.gameMode] ?? s.gameMode}</>;
    case "lobby":
      return <>{h.lobbies[s.lobbyType] ?? s.lobbyType}</>;
    case "side":
      return <>{s.radiant ? t.pick.radiant : t.pick.dire}</>;
    case "result":
      return <>{s.win ? t.header.win : t.header.loss}</>;
    case "rank":
      return s.rank ? <>{medalName(s.rank, dict.dotahub)}</> : unknown;
    case "duration":
      return <>{clock(s.duration)}</>;
    case "shape": {
      const g = gameShape(s);
      return g ? <>{h.shapeKinds[g.kind]}</> : unknown;
    }
    case "experience": {
      const r = heroRecord(s);
      return r ? <>{h.n(r.games)}</> : unknown;
    }
    case "party": {
      const n = partySize(s);
      return n == null ? unknown : <>{n > 1 ? h.partyOf(n) : h.solo}</>;
    }
    case "smurfs": {
      const n = smurfEnemies(s);
      return n == null ? unknown : <>{n ? h.flagged(n) : h.noFlags}</>;
    }
  }
}

function ComparabilityBlock() {
  const { t, a, b } = useLab();
  const h = t.x.history;
  const rows = useMemo(() => (b ? comparability(a, b) : []), [a, b]);
  if (!b) return null;
  const v = verdictText(a, b, t);
  return (
    <Sub title={h.compare}>
      <p
        className={cn(
          "text-sm",
          v.kind === "mode" || v.kind === "hero" || v.kind === "position"
            ? "font-medium text-red-700 dark:text-red-300"
            : v.kind === "caution" && "text-amber-800 dark:text-amber-200",
        )}
      >
        {v.text}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full max-w-2xl text-xs">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal" />
              <th className="py-1 font-normal">
                <SideDot side="a" className="mr-1" />
                {t.insight.a}
              </th>
              <th className="py-1 font-normal">
                <SideDot side="b" className="mr-1" />
                {t.insight.b}
              </th>
              <th className="py-1 font-normal" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b last:border-0">
                <td className="py-1 pr-3 text-muted-foreground">{h.compareRows[r.key]}</td>
                <td className="py-1 pr-3">
                  <CompareValue k={r.key} s={a} />
                </td>
                <td className="py-1 pr-3">
                  <CompareValue k={r.key} s={b} />
                </td>
                <td
                  className={cn(
                    "py-1",
                    r.level === 2 && "font-semibold text-red-600 dark:text-red-400",
                    r.level === 1 && "text-amber-700 dark:text-amber-300",
                    r.level === 0 && "text-muted-foreground",
                  )}
                >
                  {r.same == null ? "" : r.same ? h.same : h.differ}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Sub>
  );
}

// ── Experience on the hero ───────────────────────────────────────────────────────────────────

function ExperienceFor({ s }: { s: LabSide }) {
  const { t } = useLab();
  const { t: dict } = useLocale();
  const h = t.x.history;
  const rec = heroRecord(s);
  const p = me(s);
  const roles = Object.entries(s.refs.personal?.laneRoles ?? {})
    .filter(([, n]) => n > 0)
    .sort((x, y) => (x[0] === "0" ? 1 : y[0] === "0" ? -1 : y[1] - x[1]));
  const foes = s.match.players.filter((x) => x.radiant !== s.radiant && s.laneOpponents.includes(x.heroId));
  const mine = laneRole(s);
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
      <dt className="text-muted-foreground">{h.heroGamesLabel}</dt>
      <dd className="tabular-nums">
        {rec ? (
          <>
            {rec.wins != null
              ? h.heroGames(num(rec.games), rec.wins, rec.games ? pct(rec.wins / rec.games) : "–")
              : h.heroGamesOnly(num(rec.games))}
            <span className="ml-1 text-muted-foreground">
              {rec.wins != null ? h.heroGamesHint : h.heroGamesListed}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">{s.accountId ? h.personalNone : h.personalAnon}</span>
        )}
      </dd>
      <dt className="text-muted-foreground">{h.usualLane}</dt>
      <dd className="tabular-nums">
        {roles.length
          ? roles.map(([k, n], i) => (
              <span key={k} className={cn(k === mine && "font-medium")}>
                {i > 0 && t.insight.sep}
                {h.laneRoles[k] ?? k} {n}
                {k === mine && (
                  <span className="ml-0.5 text-[10px] text-muted-foreground">{h.thisGameTag}</span>
                )}
              </span>
            ))
          : "–"}
      </dd>
      <dt className="text-muted-foreground" title={h.plusHint}>
        {h.plusXp}
      </dt>
      <dd className="tabular-nums">{p?.heroXp != null ? num(p.heroXp) : "–"}</dd>
      <dt className="text-muted-foreground">{h.seasonRank}</dt>
      <dd className="flex items-center gap-1">
        {p?.seasonRank ? (
          <>
            <Medal tier={p.seasonRank} t={dict.dotahub} size={20} />
            {medalName(p.seasonRank, dict.dotahub)}
          </>
        ) : (
          "–"
        )}
      </dd>
      <dt className="text-muted-foreground">{h.smurf}</dt>
      <dd>
        {p?.smurf == null ? (
          "–"
        ) : p.smurf > 0 ? (
          <span className={TONE.bad}>{h.smurfYes(p.smurf)}</span>
        ) : (
          h.smurfNo
        )}
      </dd>
      {foes.length > 0 && (
        <>
          <dt className="text-muted-foreground" title={h.plusHint}>
            {h.laneFoesXp}
          </dt>
          <dd className="flex flex-wrap items-center gap-2 tabular-nums">
            {foes.map((f) => (
              <span key={f.slot} className="inline-flex items-center gap-1">
                <HeroIcon id={f.heroId} size={16} />
                {f.heroXp != null ? num(f.heroXp) : "–"}
              </span>
            ))}
          </dd>
        </>
      )}
    </dl>
  );
}

function ExperienceBlock() {
  const { t } = useLab();
  const h = t.x.history;
  return (
    <Sub title={h.experience}>
      <PerSide>{(k, s) => <ExperienceFor s={s} />}</PerSide>
    </Sub>
  );
}

// ── All ten players ──────────────────────────────────────────────────────────────────────────

const PARTY_TONE = [
  "bg-sky-500/20 text-sky-800 dark:text-sky-200",
  "bg-violet-500/20 text-violet-800 dark:text-violet-200",
  "bg-lime-500/20 text-lime-800 dark:text-lime-200",
  "bg-pink-500/20 text-pink-800 dark:text-pink-200",
];

// Columns STRATZ can leave empty for all ten (pro lobbies have no parties; an unparsed match has no
// hero XP or IMP): left out of the table and named once above it.
const OPTIONAL = {
  seasonRank: "colRank",
  smurf: "colSmurf",
  heroXp: "colXp",
  party: "colParty",
  imp: "colImp",
} as const;
type Optional = keyof typeof OPTIONAL;
const emptyCols = (s: LabSide) =>
  (Object.keys(OPTIONAL) as Optional[]).filter((k) => s.match.players.every((p) => p[k] == null));
// Smurf flags known but nobody flagged: the column would be blank, so a sentence says it instead.
const noSmurfs = (s: LabSide) =>
  s.match.players.some((p) => p.smurf != null) && !s.match.players.some((p) => (p.smurf ?? 0) > 0);

function PlayersTable({ s, studied }: { s: LabSide; studied: [SideKey, LabSide][] }) {
  const { t } = useLab();
  const { t: dict, href } = useLocale();
  const h = t.x.history;
  const names = useNames();
  const party = useMemo(() => parties(s), [s]);
  const empty = useMemo(
    () => new Set<Optional>([...emptyCols(s), ...(noSmurfs(s) ? (["smurf"] as const) : [])]),
    [s],
  );
  const show = (k: Optional) => !empty.has(k);
  const bySlot = new Map(studied.map(([k, x]) => [x.slot, k] as const));
  // Whose lane opponent each enemy hero was.
  const laneOf = (heroId: number, radiant: boolean) =>
    studied.filter(([, x]) => x.radiant !== radiant && x.laneOpponents.includes(heroId)).map(([k]) => k);
  const order = (radiant: boolean) =>
    s.match.players
      .filter((p) => p.radiant === radiant)
      .sort((x, y) => (x.position ?? 9) - (y.position ?? 9) || x.slot - y.slot);
  const teams = [
    { key: "ours", list: order(s.radiant) },
    { key: "theirs", list: order(!s.radiant) },
  ] as const;
  const span = 3 + (Object.keys(OPTIONAL) as Optional[]).filter(show).length;
  return (
    <div className="overflow-x-auto">
      <table className="w-full max-w-3xl text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal" />
            <th className="py-1 font-normal">{h.colPlayer}</th>
            {show("seasonRank") && <th className="px-2 py-1 font-normal">{h.colRank}</th>}
            {show("smurf") && <th className="px-2 py-1 font-normal">{h.colSmurf}</th>}
            {show("heroXp") && (
              <th className="px-2 py-1 text-right font-normal" title={h.plusHint}>
                {h.colXp}
              </th>
            )}
            {show("party") && <th className="px-2 py-1 font-normal">{h.colParty}</th>}
            {show("imp") && <th className="px-2 py-1 text-right font-normal">{h.colImp}</th>}
            <th className="py-1 pl-2 text-right font-normal">{h.colKda}</th>
          </tr>
        </thead>
        {teams.map((team) => (
          <tbody key={team.key}>
            <tr>
              <td colSpan={span} className="pt-2 pb-0.5 text-[10px] text-muted-foreground">
                {t.deep[team.key]}
              </td>
            </tr>
            {team.list.map((p) => {
              const side = bySlot.get(p.slot);
              const lane = laneOf(p.heroId, p.radiant);
              const group = party.get(p.slot);
              return (
                <tr key={p.slot} className={cn("border-b last:border-0", side && "bg-muted/40")}>
                  <td className="py-1 pr-2">
                    <span className="flex items-center gap-1">
                      <HeroIcon id={p.heroId} size={18} />
                      <span className="w-3 text-[10px] text-muted-foreground tabular-nums">
                        {p.position ?? ""}
                      </span>
                    </span>
                  </td>
                  <td className="py-1 pr-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {side && <SideDot side={side} />}
                      {p.accountId ? (
                        <Link
                          href={href(`/dotahub/players/${p.accountId}`)}
                          className="max-w-40 truncate hover:underline"
                          title={names.heroes(p.heroId)}
                        >
                          {p.name ?? p.accountId}
                        </Link>
                      ) : (
                        <span className="max-w-40 truncate text-muted-foreground">
                          {p.name ?? h.anonymous}
                        </span>
                      )}
                      {lane.map((k) => (
                        <span
                          key={k}
                          className="inline-flex shrink-0 items-center gap-0.5 rounded border px-1 text-[10px] text-muted-foreground"
                          title={h.laneOf(k === "a" ? t.insight.a : t.insight.b)}
                        >
                          <SideDot side={k} className="size-1.5" />
                          {h.laneTag}
                        </span>
                      ))}
                    </span>
                  </td>
                  {show("seasonRank") && (
                    <td className="px-2 py-1">
                      {p.seasonRank ? (
                        <span
                          className="inline-flex items-center gap-1"
                          title={medalName(p.seasonRank, dict.dotahub)}
                        >
                          <Medal tier={p.seasonRank} t={dict.dotahub} size={20} />
                        </span>
                      ) : (
                        "–"
                      )}
                    </td>
                  )}
                  {show("smurf") && (
                    <td className="px-2 py-1">
                      {p.smurf == null ? (
                        "–"
                      ) : p.smurf > 0 ? (
                        <span className={TONE.bad}>{h.suspect}</span>
                      ) : (
                        ""
                      )}
                    </td>
                  )}
                  {show("heroXp") && (
                    <td className="px-2 py-1 text-right tabular-nums">
                      {p.heroXp != null ? num(p.heroXp) : "–"}
                    </td>
                  )}
                  {show("party") && (
                    <td className="px-2 py-1">
                      {group != null && (
                        <span
                          className={cn(
                            "rounded px-1 text-[10px]",
                            PARTY_TONE[(group - 1) % PARTY_TONE.length],
                          )}
                        >
                          {h.party(group)}
                        </span>
                      )}
                    </td>
                  )}
                  {show("imp") && (
                    <td
                      className={cn(
                        "px-2 py-1 text-right tabular-nums",
                        p.imp != null && p.imp >= 10 && TONE.good,
                        p.imp != null && p.imp <= -10 && TONE.bad,
                      )}
                    >
                      {p.imp ?? "–"}
                    </td>
                  )}
                  <td className="py-1 pl-2 text-right tabular-nums">
                    {p.kills}/{p.deaths}/{p.assists}
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function MissingNote({ s }: { s: LabSide }) {
  const { t } = useLab();
  const h = t.x.history;
  const empty = emptyCols(s);
  const lines = [
    empty.length ? h.missing(empty.map((k) => h[OPTIONAL[k]]).join(t.insight.sep), s.parsed.stratz) : "",
    noSmurfs(s) ? h.noSmurfs : "",
  ].filter(Boolean);
  if (!lines.length) return null;
  return <p className="text-xs text-muted-foreground">{lines.join(" ")}</p>;
}

function PlayersBlock() {
  const { t } = useLab();
  const h = t.x.history;
  const sides = useSides();
  const matches = useMatches();
  return (
    <Sub title={h.players} hint={h.playersHint}>
      <div className="flex flex-col gap-4">
        {matches.map(([k, s]) => (
          <div key={s.matchId} className="flex flex-col gap-1">
            {matches.length > 1 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <SideDot side={k} />
                {s.matchId}
              </span>
            )}
            <MissingNote s={s} />
            <PlayersTable s={s} studied={sides.filter(([, x]) => x.matchId === s.matchId)} />
          </div>
        ))}
      </div>
    </Sub>
  );
}

// ── The game's shape ─────────────────────────────────────────────────────────────────────────

function ShapeFor({ s }: { s: LabSide }) {
  const { t } = useLab();
  const h = t.x.history;
  const g = useMemo(() => gameShape(s), [s]);
  if (!g) return <p className="text-xs text-muted-foreground">–</p>;
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <span
        className={cn(
          "font-semibold",
          (g.kind === "stomp" || g.kind === "comeback") && TONE.good,
          (g.kind === "stomped" || g.kind === "throw") && TONE.bad,
        )}
      >
        {h.shapeKinds[g.kind]}
      </span>
      <span className="tabular-nums">{shapeDetail(g, t)}</span>
      {(g.ahead != null || g.final != null) && (
        <span className="text-muted-foreground tabular-nums">
          {[
            g.ahead != null ? h.ahead(pct(g.ahead)) : "",
            g.final != null
              ? h.final(`${g.final > 0 ? "+" : g.final < 0 ? "−" : ""}${num(Math.abs(g.final))}`)
              : "",
          ]
            .filter(Boolean)
            .join(t.insight.sep)}
        </span>
      )}
      <span className="text-muted-foreground">{h.shapeSource[g.source]}</span>
    </div>
  );
}

function ShapeBlock() {
  const { t } = useLab();
  const h = t.x.history;
  return (
    <Sub title={h.shape}>
      <PerSide>{(k, s) => <ShapeFor s={s} />}</PerSide>
      <Caveat kind="estimate">{h.shapeRule}</Caveat>
    </Sub>
  );
}

// ── The draft ────────────────────────────────────────────────────────────────────────────────

function GradesFor({ s }: { s: LabSide }) {
  const { t } = useLab();
  const h = t.x.history;
  const names = useNames();
  const g = useMemo(() => draftGrades(s), [s]);
  if (!g) return <p className="text-xs text-muted-foreground">{h.draftNone}</p>;
  const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v)}`;
  return (
    <div className="flex flex-col gap-1 text-xs">
      {(["ours", "theirs"] as const).map((team) => (
        <div key={team} className="flex flex-wrap items-center gap-1">
          <span className="w-10 text-muted-foreground">{t.deep[team]}</span>
          {g.rows
            .filter((r) => r.ours === (team === "ours"))
            .map((r) => (
              <span
                key={r.hero}
                className={cn(
                  "flex items-center gap-1 rounded border px-1 tabular-nums",
                  !r.delta && "opacity-60",
                )}
                title={`${names.heroes(r.hero)} · ${r.base}% → ${r.adjusted}%`}
              >
                <HeroIcon id={r.hero} size={16} />
                {r.base}→{r.adjusted}
                <span className={cn(r.delta > 0 && TONE.good, r.delta < 0 && TONE.bad)}>
                  {signed(r.delta)}
                </span>
              </span>
            ))}
        </div>
      ))}
      <p className="text-muted-foreground tabular-nums">
        {h.draftTotal(signed(g.ours), signed(g.theirs))}
        {g.unchanged >= Math.ceil(g.rows.length / 2) &&
          g.common != null &&
          ` ${h.draftFlat(g.unchanged, g.rows.length, g.common)}`}
      </p>
    </div>
  );
}

function DraftBlock() {
  const { t, a, b } = useLab();
  const h = t.x.history;
  const sides = useSides();
  const matches = useMatches();
  const live = useCallback(
    (s: LabSide) =>
      s.advanced.context.winProb.length ? [{ name: h.live, values: s.advanced.context.winProb }] : [],
    [h.live],
  );
  // Two sides on one team of one match share both curves: drawn and read once.
  const twin = !!b && a.matchId === b.matchId && a.radiant === b.radiant;
  const series = useCallback(
    (s: LabSide) => (twin && b && s.matchId === b.matchId && s.slot === b.slot ? null : draftCurve(s)),
    [twin, b],
  );
  const curves = sides.filter(([k, s]) => s.match.predictedWin.length && !(twin && k === "b"));
  const who = (k: SideKey) =>
    twin ? `${t.insight.a}${t.insight.sep}${t.insight.b}` : k === "a" ? t.insight.a : t.insight.b;
  return (
    <Sub title={h.draft} hint={h.draftHint}>
      <div className="flex flex-col gap-3">
        {matches.map(([k, s]) => (
          <div key={s.matchId} className="flex flex-col gap-1">
            {matches.length > 1 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <SideDot side={k} />
                {s.matchId}
              </span>
            )}
            <GradesFor s={s} />
          </div>
        ))}
      </div>
      {curves.length > 0 && (
        <>
          <LineCompare title={h.draftCurve} series={series} extra={live} format={pctFmt} height={190} />
          <ul className="flex flex-col gap-0.5 text-xs">
            {curves.map(([k, s]) => {
              const r = draftReading(draftCurve(s)!);
              return (
                <li key={k} className="flex items-center gap-1.5">
                  <SideDot side={k} />
                  {h.draftReading(
                    who(k),
                    pct(r.start),
                    r.even != null && r.even > 0 ? clock(r.even * 60) : null,
                    pct(r.end),
                  )}
                </li>
              );
            })}
          </ul>
          <Caveat kind="source">{h.draftUndocumented}</Caveat>
        </>
      )}
    </Sub>
  );
}

// ── Pauses, disconnects, leavers ─────────────────────────────────────────────────────────────

function Badge({ hot, children, title }: { hot: boolean; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 tabular-nums",
        hot ? "border-amber-500/60 bg-amber-500/15 font-medium" : "text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function QualityFor({ s, studied }: { s: LabSide; studied: [SideKey, LabSide][] }) {
  const { t } = useLab();
  const h = t.x.history;
  const [from, to] = useTimeWindow(s);
  const sideOf = (slot: number) => studied.find(([, x]) => x.slot === slot)?.[0] ?? null;
  const drops = useMemo(() => disconnectSpans(s), [s]);
  const heroOf = (slot: number) => s.match.players.find((p) => p.slot === slot)?.heroId ?? null;
  const when = (at: number) => (at < 0 ? h.pregame : inWindow(at, from, to) ? h.inRange : undefined);
  if (!s.match.pauses.length && !drops.length && !s.match.leavers.length)
    return <p className="text-xs text-muted-foreground">{h.qualityNone}</p>;
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex flex-wrap gap-1.5">
        {s.match.pauses.map((p, i) => (
          <Badge key={`p${i}`} hot={inWindow(p.t, from, to)} title={when(p.t)}>
            {h.pause(clock(Math.round(p.t)), Math.round(p.d))}
            {p.t < 0 && <span className="text-[10px]">{h.pregame}</span>}
          </Badge>
        ))}
        {drops.map((d, i) => (
          <Badge key={`d${i}`} hot={inWindow(d.t, from, to) && d.event !== "reconnect"} title={when(d.t)}>
            <HeroIcon id={heroOf(d.slot)} size={14} />
            {sideOf(d.slot) && <SideDot side={sideOf(d.slot)!} />}
            {h.events[d.event] ?? d.event} {clock(Math.round(d.t))}
            {d.event === "disconnect" && (
              <span className="text-[10px]">
                {d.back != null ? h.back(clock(Math.round(d.back))) : h.noBack}
              </span>
            )}
            {d.t < 0 && <span className="text-[10px]">{h.pregame}</span>}
          </Badge>
        ))}
        {s.match.leavers.map((slot) => (
          <Badge key={`l${slot}`} hot>
            <HeroIcon id={heroOf(slot)} size={14} />
            {sideOf(slot) && <SideDot side={sideOf(slot)!} />}
            {h.leaver}
          </Badge>
        ))}
      </div>
      {s.match.pauses.length > 0 && <p className="text-muted-foreground">{h.pauseNote}</p>}
    </div>
  );
}

function QualityBlock() {
  const { t } = useLab();
  const h = t.x.history;
  const sides = useSides();
  const matches = useMatches();
  return (
    <Sub title={h.quality}>
      <div className="flex flex-col gap-2">
        {matches.map(([k, s]) => (
          <div key={s.matchId} className="flex flex-col gap-1">
            {matches.length > 1 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <SideDot side={k} />
                {s.matchId}
              </span>
            )}
            <QualityFor s={s} studied={sides.filter(([, x]) => x.matchId === s.matchId)} />
          </div>
        ))}
      </div>
    </Sub>
  );
}

export function ContextBlocks() {
  return (
    <>
      <ComparabilityBlock />
      <ExperienceBlock />
      <PlayersBlock />
      <ShapeBlock />
      <DraftBlock />
      <QualityBlock />
    </>
  );
}
