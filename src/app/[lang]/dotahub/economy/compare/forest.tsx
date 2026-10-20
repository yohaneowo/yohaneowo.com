"use client";

import { useLocale } from "@/i18n/locale-provider";
import type { DetailMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import type { FilteredSeries } from "./series";

// The forest chart: is one player's GPM steadier from match to match than another's, and can the
// numbers tell? Volatility is the coefficient of variation of the per-match GPM; its standard error
// is approximated as cv·√((1 + 2cv²) / 2n), and two players differ when the 95% interval of the
// difference stays on one side of 0. With the bracket, each player is placed among a sample of
// the bracket's players of that hero instead.

export const MIN_GAMES = 3;
export const LOW_GAMES = 5;
const Z = 1.96;

function cvOf(values: number[]) {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (!mean) return null;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1));
  return sd / mean;
}
const stdErr = (cv: number, n: number) => cv * Math.sqrt((1 + 2 * cv * cv) / (2 * n));
const signed = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v)}`;

type Person = { key: string; label: string; color: string; byHero: Map<number, number[]> };

function gpmByHero(matches: DetailMatch[]) {
  const map = new Map<number, number[]>();
  for (const m of matches) map.set(m.heroId, [...(map.get(m.heroId) ?? []), m.details.gpm]);
  return map;
}

// Where a value falls among others: the share of them it's lower than (steadier than).
const steadierThan = (cv: number, others: number[]) => others.filter((o) => o > cv).length / others.length;

export function Forest({
  series,
  heroes,
  bracketCv,
}: {
  series: FilteredSeries[];
  heroes: Record<number, HeroInfo>;
  // Per hero, the volatility of sampled bracket players (empty without the bracket).
  bracketCv: Record<number, number[]>;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.compare;
  const name = (id: number) => heroes[id]?.[lang] ?? String(id);
  // Heroes are compared side by side, so the hero filter doesn't apply here.
  const people: Person[] = series
    .filter((s) => s.kind !== "bracket")
    .map((s) => ({ key: s.key, label: short(s.label), color: s.color, byHero: gpmByHero(s.lists.anyHero) }));
  const withBracket = series.some((s) => s.kind === "bracket");
  const [me, ...rest] = people;
  if (!me) return null;

  // Heroes the page player and at least one other side played.
  const heroIds = [...me.byHero.keys()].filter(
    (h) => rest.some((p) => p.byHero.has(h)) || (withBracket && (bracketCv[h]?.length ?? 0) > 0),
  );
  const rows = heroIds
    .map((hero) => {
      const games = people.map((p) => p.byHero.get(hero) ?? []);
      return { hero, games, total: games.reduce((a, g) => a + g.length, 0) };
    })
    .sort((a, b) => b.total - a.total);
  const usable = rows.filter((r) => r.games[0].length >= MIN_GAMES);
  const skipped = rows.filter((r) => r.games[0].length < MIN_GAMES);
  if (!usable.length) return <p className="text-sm text-muted-foreground">{t.forestEmpty}</p>;

  const twoPeople = people.length === 2 && !withBracket;
  return (
    <div className="flex flex-col gap-2">
      {twoPeople ? (
        <DiffForest rows={usable} a={people[0]} b={people[1]} name={name} />
      ) : (
        <SpreadForest
          rows={usable}
          people={people}
          bracketCv={bracketCv}
          withBracket={withBracket}
          name={name}
        />
      )}
      {skipped.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t.notCompared(
            MIN_GAMES,
            skipped.map((r) => `${name(r.hero)}（${r.games.map((g) => g.length).join(" · ")}）`).join("、"),
          )}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{twoPeople ? t.forestHowTo : t.spreadHowTo}</p>
    </div>
  );
}

type Row = { hero: number; games: number[][] };

// Long names would run into the bars, so the charts shorten them.
const NAME_CHARS = 12;
function short(label: string) {
  return label.length > NAME_CHARS ? `${label.slice(0, NAME_CHARS - 1)}…` : label;
}

// Two players: the difference of their volatility with its 95% interval, per hero.
function DiffForest({
  rows,
  a,
  b,
  name,
}: {
  rows: Row[];
  a: Person;
  b: Person;
  name: (id: number) => string;
}) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.compare;
  const compared = rows
    .map((r) => {
      const [ga, gb] = r.games;
      if (ga.length < MIN_GAMES || gb.length < MIN_GAMES) return { r, ok: false as const };
      const cA = cvOf(ga)!;
      const cB = cvOf(gb)!;
      const se = Math.sqrt(stdErr(cA, ga.length) ** 2 + stdErr(cB, gb.length) ** 2) * 100;
      const diff = (cA - cB) * 100;
      const lo = diff - Z * se;
      const hi = diff + Z * se;
      return {
        r,
        ok: true as const,
        cA: cA * 100,
        cB: cB * 100,
        diff,
        lo,
        hi,
        verdict: lo > 0 ? "B" : hi < 0 ? "A" : "tie",
        low: ga.length < LOW_GAMES || gb.length < LOW_GAMES,
      };
    })
    .filter((c) => c.ok)
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  if (!compared.length) return <p className="text-sm text-muted-foreground">{t.forestEmpty}</p>;

  const W = 760;
  const L = 170;
  const R = 560;
  const mid = (L + R) / 2;
  const rowH = 64;
  const head = 48;
  const H = head + compared.length * rowH;
  const extent = Math.max(20, ...compared.flatMap((c) => [Math.abs(c.lo), Math.abs(c.hi)]));
  const M = Math.ceil(extent / 10) * 10;
  const x = (v: number) => mid + (Math.max(-M, Math.min(M, v)) / M) * ((R - L) / 2);
  const tone = (verdict: string) => (verdict === "A" ? a.color : verdict === "B" ? b.color : "#94a3b8");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-140"
        role="img"
        aria-label={t.forestLabel(a.label, b.label)}
      >
        <text x={L} y={16} fontSize={12} fill={a.color}>
          {t.leftSteadier(a.label)}
        </text>
        <text x={R} y={16} textAnchor="end" fontSize={12} fill={b.color}>
          {t.rightSteadier(b.label)}
        </text>
        <text x={mid} y={34} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
          {t.zeroSame}
        </text>
        <line x1={mid} x2={mid} y1={head - 6} y2={H - 10} stroke="#94a3b8" strokeDasharray="4 3" />
        {compared.map((c, i) => {
          const y = head + i * rowH + rowH / 2;
          const col = tone(c.verdict);
          const verdict =
            c.verdict === "A" ? t.steadier(a.label) : c.verdict === "B" ? t.steadier(b.label) : t.tie;
          return (
            <g key={c.r.hero}>
              <title>
                {`${name(c.r.hero)}｜${a.label} ${c.cA.toFixed(1)}%（${c.r.games[0].length}）｜${b.label} ${c.cB.toFixed(1)}%（${c.r.games[1].length}）｜${t.diff} ${c.diff.toFixed(1)}｜95% ${c.lo.toFixed(1)} – ${c.hi.toFixed(1)}`}
              </title>
              <line x1={L} x2={R} y1={y} y2={y} className="stroke-border" />
              <line
                x1={x(c.lo)}
                x2={x(c.hi)}
                y1={y}
                y2={y}
                stroke={col}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <line x1={x(c.lo)} x2={x(c.lo)} y1={y - 6} y2={y + 6} stroke={col} strokeWidth={2} />
              <line x1={x(c.hi)} x2={x(c.hi)} y1={y - 6} y2={y + 6} stroke={col} strokeWidth={2} />
              <circle cx={x(c.diff)} cy={y} r={7} fill={col} className="stroke-background" strokeWidth={2} />
              <text
                x={x(c.diff)}
                y={y - 13}
                textAnchor="middle"
                fontSize={12}
                fontWeight={500}
                className="fill-foreground"
              >
                {t.diff} {signed(c.diff)}
              </text>
              <text
                x={x(c.lo)}
                y={y + 21}
                textAnchor="middle"
                fontSize={11}
                className="fill-muted-foreground"
              >
                {signed(c.lo)}
              </text>
              <text
                x={x(c.hi)}
                y={y + 21}
                textAnchor="middle"
                fontSize={11}
                className="fill-muted-foreground"
              >
                {signed(c.hi)}
              </text>
              <text x={8} y={y - 4} fontSize={13} fontWeight={500} className="fill-foreground">
                {name(c.r.hero)}
              </text>
              <text x={8} y={y + 12} fontSize={11} className="fill-muted-foreground">
                {[a, b].map((p, k) => (
                  <tspan key={k}>
                    {k > 0 && " "}
                    <tspan fill={p.color}>●</tspan>
                    {` ${c.r.games[k].length}`}
                  </tspan>
                ))}
                {` ${t.matchesUnit}${c.low ? ` · ${t.rough}` : ""}`}
              </text>
              <text
                x={R + 16}
                y={y - 2}
                fontSize={12}
                className={c.verdict === "tie" ? "fill-muted-foreground" : "fill-foreground"}
              >
                {verdict}
              </text>
              <text x={R + 16} y={y + 14} fontSize={11} className="fill-muted-foreground">
                {`${Math.round(c.cA)}% · ${Math.round(c.cB)}%`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Three sides, or the bracket: each player's volatility with its 95% interval on one axis, the
// bracket's sampled players behind as grey dots, and where each player stands.
function SpreadForest({
  rows,
  people,
  bracketCv,
  withBracket,
  name,
}: {
  rows: Row[];
  people: Person[];
  bracketCv: Record<number, number[]>;
  withBracket: boolean;
  name: (id: number) => string;
}) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.compare;
  const W = 760;
  const L = 170;
  const R = 520;
  const lineH = 18;
  const rowH = Math.max(56, 24 + people.length * lineH);
  const H = 28 + rows.length * rowH;
  const all = rows.flatMap((r) => [
    ...r.games.flatMap((g) => {
      const c = g.length >= 2 ? cvOf(g) : null;
      return c == null ? [] : [c + Z * stdErr(c, g.length)];
    }),
    ...(bracketCv[r.hero] ?? []),
  ]);
  const max = Math.min(1, Math.max(0.2, ...all));
  const M = Math.ceil(max * 10) / 10;
  const x = (v: number) => L + (Math.max(0, Math.min(M, v)) / M) * (R - L);
  const ticks = Array.from({ length: Math.round(M * 10) + 1 }, (_, i) => i / 10);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-150" role="img" aria-label={t.spreadLabel}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={20} y2={H} className="stroke-border" strokeDasharray="2 4" />
            <text x={x(v)} y={14} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
              {Math.round(v * 100)}%
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const top = 28 + i * rowH;
          const crowd = bracketCv[r.hero] ?? [];
          const cvs = r.games.map((g) => (g.length >= MIN_GAMES ? cvOf(g) : null));
          const notes: string[] = [];
          if (withBracket && crowd.length)
            people.forEach((p, k) => {
              if (cvs[k] != null)
                notes.push(t.steadierThanBracket(p.label, Math.round(steadierThan(cvs[k]!, crowd) * 100)));
            });
          // The page player against each other player: the difference rule.
          people.slice(1).forEach((p, k) => {
            const ga = r.games[0];
            const gb = r.games[k + 1];
            if (ga.length < MIN_GAMES || gb.length < MIN_GAMES) return;
            const cA = cvOf(ga)!;
            const cB = cvOf(gb)!;
            const se = Math.sqrt(stdErr(cA, ga.length) ** 2 + stdErr(cB, gb.length) ** 2);
            const diff = cA - cB;
            notes.push(
              diff + Z * se < 0
                ? t.steadier(people[0].label)
                : diff - Z * se > 0
                  ? t.steadier(p.label)
                  : t.tieBetween(people[0].label, p.label),
            );
          });
          return (
            <g key={r.hero}>
              <line x1={8} x2={W - 8} y1={top + rowH - 4} y2={top + rowH - 4} className="stroke-border" />
              <text x={8} y={top + 16} fontSize={13} fontWeight={500} className="fill-foreground">
                {name(r.hero)}
              </text>
              <text x={8} y={top + 32} fontSize={11} className="fill-muted-foreground">
                {/* Each player's match count behind a dot of their color. */}
                {r.games.map((g, k) => (
                  <tspan key={k}>
                    {k > 0 && " "}
                    <tspan fill={people[k].color}>●</tspan>
                    {` ${g.length}`}
                  </tspan>
                ))}
                {` ${t.matchesUnit}`}
                {crowd.length ? ` · ${t.bracketSampled(crowd.length)}` : ""}
                {r.games.some((g) => g.length && g.length < LOW_GAMES) ? ` · ${t.rough}` : ""}
              </text>
              {crowd.map((v, k) => (
                <circle key={k} cx={x(v)} cy={top + rowH / 2 - 2} r={3} fill="#94a3b8" opacity={0.45}>
                  <title>{`${Math.round(v * 100)}%`}</title>
                </circle>
              ))}
              {people.map((p, k) => {
                const c = cvs[k];
                if (c == null) return null;
                const n = r.games[k].length;
                const se = stdErr(c, n);
                const y = top + 12 + k * lineH;
                return (
                  <g key={p.key} opacity={n < LOW_GAMES ? 0.55 : 1}>
                    <title>{`${p.label}｜${(c * 100).toFixed(1)}%（${n}）｜95% ${(Math.max(0, c - Z * se) * 100).toFixed(1)} – ${((c + Z * se) * 100).toFixed(1)}`}</title>
                    <line
                      x1={x(c - Z * se)}
                      x2={x(c + Z * se)}
                      y1={y}
                      y2={y}
                      stroke={p.color}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                    <circle
                      cx={x(c)}
                      cy={y}
                      r={5.5}
                      fill={p.color}
                      className="stroke-background"
                      strokeWidth={1.5}
                    />
                  </g>
                );
              })}
              {notes.map((note, k) => (
                <text key={k} x={R + 16} y={top + 14 + k * 15} fontSize={11} className="fill-foreground">
                  {note}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
