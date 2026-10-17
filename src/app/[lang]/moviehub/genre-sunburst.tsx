"use client";
import type { EChartsOption } from "echarts";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { EChart } from "@/components/charts/echart";
import { useLocale } from "@/i18n/locale-provider";
import type { ListSource } from "@/lib/movie-types";
import { genreColor, publicScore, type ScoredFilm } from "./stats";

// Two independent rings over the same films (the Stratz 趋势 layout): one ring is each film's
// main genre (its own hue), the other the viewer's rating bands (one neutral ramp, brighter = higher).
// Neither nests in the other; a button swaps which is inside. Pointing at a slice lists its films
// in the tooltip and puts its count in the centre. A stats strip sits under the chart.
const TOOLTIP_FILMS = 8;

type BandKey = "9" | "8" | "7" | "6" | "low" | "unrated";
// t: position on the brightness ramp.
const BANDS: { key: BandKey; test: (r: number | null) => boolean; t: number }[] = [
  { key: "9", test: (r) => r != null && r >= 9, t: 1 },
  { key: "8", test: (r) => r != null && r >= 8 && r < 9, t: 0.74 },
  { key: "7", test: (r) => r != null && r >= 7 && r < 8, t: 0.5 },
  { key: "6", test: (r) => r != null && r >= 6 && r < 7, t: 0.3 },
  { key: "low", test: (r) => r != null && r < 6, t: 0.14 },
  { key: "unrated", test: (r) => r == null, t: 0 },
];

type Slice = {
  name: string;
  long: string;
  value: number;
  films: ScoredFilm[];
  // Top genres first, 其他 last (the genre ring only).
  other?: boolean;
  itemStyle: { color: string };
  label: object;
};

type Palette = {
  panel: string;
  panel2: string;
  line: string;
  fg: string;
  fg2: string;
  fg3: string;
  rampLo: string;
  rampHi: string;
  display: string;
  body: string;
  dark: boolean;
};

function rgb(color: string): [number, number, number] | null {
  const m = /#([0-9a-f]{6})/i.exec(color);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// `fg` over `bg` at opacity t, as a solid colour (canvas has no color-mix).
function blend(fg: string, bg: string, t: number) {
  const a = rgb(fg);
  const b = rgb(bg);
  if (!a || !b) return fg;
  return `rgb(${a.map((v, i) => Math.round(b[i] + (v - b[i]) * t)).join(",")})`;
}

// A colour for any genre: the table's where it has one, otherwise a hue derived from the name
// (the same genre always gets the same hue).
function genreHue(genre: string) {
  const known = genreColor(genre);
  if (known !== "#8b93a1") return known;
  let hash = 0;
  for (const ch of genre) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  const h = hash / 360;
  // HSL(h, 0.45, 0.55) → hex
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = 0.45 * Math.min(0.55, 1 - 0.55);
    const c = 0.55 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function readPalette(el: HTMLElement, dark: boolean): Palette {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    panel: v("--panel"),
    panel2: v("--panel-2"),
    line: v("--line"),
    fg: v("--fg"),
    fg2: v("--fg-2"),
    fg3: v("--fg-3"),
    rampLo: v("--ramp-lo"),
    rampHi: v("--ramp-hi"),
    display: v("--display"),
    body: v("--body"),
    dark,
  };
}

export function GenreSunburst({
  films,
  genreLabel,
  otherLabel,
  source,
  sourceLabel,
  muted = false,
}: {
  films: ScoredFilm[];
  genreLabel: (genre: string) => string;
  otherLabel: string;
  source: ListSource;
  sourceLabel: string;
  muted?: boolean;
}) {
  const { t, lang } = useLocale();
  const s = t.profile.sunburst;
  const { resolvedTheme } = useTheme();
  const box = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<Palette | null>(null);
  const [centre, setCentre] = useState<number | null>(null);

  useEffect(() => {
    if (box.current) setPalette(readPalette(box.current, resolvedTheme === "dark"));
  }, [resolvedTheme]);

  const { genres, bands } = useMemo(() => {
    if (!palette) return { genres: [] as Slice[], bands: [] as Slice[] };
    const label = (top: string, count: number, color: string, mono: boolean) => ({
      show: true,
      position: "inside",
      formatter: `{t|${top}}\n{c|${count}}`,
      rich: {
        t: {
          color,
          fontSize: mono ? 14 : 12,
          fontWeight: 600,
          lineHeight: 16,
          fontFamily: mono ? palette.display : palette.body,
        },
        c: { color, opacity: 0.6, fontSize: 10, lineHeight: 12, fontFamily: palette.display },
      },
    });
    const byGenre = new Map<string | null, ScoredFilm[]>();
    for (const film of films) {
      const key = film.genre || null;
      byGenre.set(key, [...(byGenre.get(key) ?? []), film]);
    }
    const genres: Slice[] = [...byGenre.entries()]
      .map(([genre, items]) => {
        const name = genre ? genreLabel(genre) : otherLabel;
        return {
          name,
          long: name,
          value: items.length,
          films: items,
          other: genre == null,
          itemStyle: {
            color: blend(genre ? genreHue(genre) : "#6b7280", palette.panel, genre ? 0.55 : 0.3),
          },
          label: label(name, items.length, "#f3f4f6", false),
        };
      })
      .sort((a, b) => Number(a.other) - Number(b.other) || b.value - a.value);
    const bands: Slice[] = BANDS.map((band) => ({
      band,
      items: films
        .filter((film) => band.test(film.myRating))
        .sort((a, b) => (b.myRating ?? -1) - (a.myRating ?? -1)),
    }))
      .filter(({ items }) => items.length)
      .map(({ band, items }) => {
        // The ramp never gets bright enough for dark text in dark mode; light mode's low bands do.
        const text = palette.dark || band.t >= 0.6 ? "#f3f4f6" : "#2a2e38";
        return {
          name: s.bands[band.key],
          long: s.bandsLong[band.key],
          value: items.length,
          films: items,
          itemStyle: { color: blend(palette.rampHi, palette.rampLo, band.t) },
          label: label(s.bands[band.key], items.length, text, true),
        };
      })
      .sort((a, b) => b.value - a.value);
    return { genres, bands };
  }, [films, genreLabel, otherLabel, palette, s]);

  const option = useMemo<EChartsOption>(() => {
    if (!palette) return {};
    const titleOf = (film: ScoredFilm) => (lang === "en" && film.titleEn ? film.titleEn : film.title);
    const ring = (data: Slice[], radius: [string, string], borderWidth: number) => ({
      // Stratz order: start at 12 o'clock, run counterclockwise, biggest slice first.
      type: "pie" as const,
      data,
      radius,
      startAngle: 90,
      clockwise: false,
      avoidLabelOverlap: false,
      minShowLabelAngle: 9,
      itemStyle: { borderColor: palette.panel, borderWidth, borderRadius: 0, opacity: muted ? 0.65 : 1 },
      label: { position: "inside" as const },
      labelLine: { show: false },
      emphasis: { scale: false, itemStyle: { borderColor: palette.fg3 } },
      animationDurationUpdate: 400,
    });
    return {
      tooltip: {
        confine: true,
        backgroundColor: palette.panel2,
        borderColor: palette.line,
        padding: [10, 12],
        textStyle: { color: palette.fg, fontSize: 12 },
        formatter: (params) => {
          const p = params as unknown as { data: Slice; percent: number };
          const d = p.data;
          const sub = `color:${palette.fg2};font-size:11px`;
          const rated = d.films.filter((film) => film.myRating != null);
          const avg = rated.length
            ? rated.reduce((sum, film) => sum + (film.myRating ?? 0), 0) / rated.length
            : null;
          const head = `<div style="margin-bottom:4px"><b>${d.long}</b> <span style="${sub}">${s.tooltip(d.films.length, Math.round(p.percent))}${avg != null ? ` · ${s.average(avg.toFixed(1))}` : ""}</span></div>`;
          const rows = d.films
            .slice(0, TOOLTIP_FILMS)
            .map(
              (film) =>
                `<div style="display:flex;justify-content:space-between;gap:16px;${sub}"><span>${titleOf(film)}<span style="opacity:.6;margin-left:6px">${film.genre ? genreLabel(film.genre) : ""}</span></span><span style="font-family:${palette.display};font-weight:600;color:${palette.fg}">${film.myRating == null ? "–" : film.myRating}</span></div>`,
            )
            .join("");
          const more =
            d.films.length > TOOLTIP_FILMS
              ? `<div style="${sub}">${s.more(d.films.length - TOOLTIP_FILMS)}</div>`
              : "";
          return head + rows + more;
        },
      },
      // Ratings inside, genres outside.
      series: [ring(bands, ["18%", "50%"], 3), ring(genres, ["54%", "96%"], 2)],
    };
  }, [palette, bands, genres, muted, s, genreLabel, lang]);

  const events = useMemo(
    () => ({
      mouseover: (params: { data?: Slice }) => params.data && setCentre(params.data.films.length),
      mouseout: () => setCentre(null),
    }),
    [],
  );

  // The strip under the chart.
  const strip = useMemo(() => {
    const rated = films.filter((film) => film.myRating != null);
    const avg = rated.length
      ? rated.reduce((sum, film) => sum + (film.myRating ?? 0), 0) / rated.length
      : null;
    const pairs = rated.flatMap((film) => {
      const score = publicScore(film, source);
      return score == null ? [] : [(film.myRating ?? 0) - score];
    });
    const diff = pairs.length ? pairs.reduce((sum, d) => sum + d, 0) / pairs.length : null;
    const count = new Map<string, number>();
    for (const film of films) if (film.genre) count.set(film.genre, (count.get(film.genre) ?? 0) + 1);
    const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const nine = rated.filter((film) => (film.myRating ?? 0) >= 9).length;
    const best = [...rated].sort((a, b) => (b.myRating ?? 0) - (a.myRating ?? 0))[0] ?? null;
    return { avg, diff, top, nine, best };
  }, [films, source]);

  const bestTitle = strip.best
    ? lang === "en" && strip.best.titleEn
      ? strip.best.titleEn
      : strip.best.title
    : "–";

  return (
    <div className="rings" ref={box}>
      <div className="chart-box">
        <div className="rings-chart" role="img" aria-label={t.profile.genreChart}>
          {palette && <EChart option={option} onEvents={events} />}
        </div>
        <div className="rings-centre" aria-hidden="true">
          <div className="n num">{centre ?? films.length}</div>
        </div>
        <div className="rings-key">{s.keyRatingsInside}</div>
        <div className="rings-scale">
          {s.scaleLow} <i /> {s.scaleHigh}
        </div>
      </div>
      <div className="rings-stats">
        <div className="stat">
          <div className="k">{s.statAverage}</div>
          <div className="v num">
            {strip.avg == null ? "–" : strip.avg.toFixed(1)}
            {strip.diff != null && (
              <small className={strip.diff >= 0 ? "up" : "dn"}>
                {strip.diff >= 0 ? "▲" : "▼"} {s.statVersus(sourceLabel, Math.abs(strip.diff).toFixed(1))}
              </small>
            )}
          </div>
        </div>
        <div className="stat">
          <div className="k">{s.statTopGenre}</div>
          <div className="v" style={{ color: strip.top ? genreColor(strip.top[0]) : undefined }}>
            {strip.top ? genreLabel(strip.top[0]) : "–"}
            {strip.top && <small className="muted num">{s.count(strip.top[1])}</small>}
          </div>
        </div>
        <div className="stat">
          <div className="k">{s.statNine}</div>
          <div className="v num">
            {strip.nine}
            <small className="muted">
              {s.statNineShare(films.length ? Math.round((strip.nine / films.length) * 100) : 0)}
            </small>
          </div>
        </div>
        <div className="stat">
          <div className="k">{s.statBest}</div>
          <div className="v">
            {bestTitle}
            {strip.best && (
              <small
                className="num"
                style={{ color: strip.best.genre ? genreColor(strip.best.genre) : undefined }}
              >
                {strip.best.myRating}
              </small>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
