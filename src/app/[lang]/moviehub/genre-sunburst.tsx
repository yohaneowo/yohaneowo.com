"use client";
import type { EChartsOption } from "echarts";
import Image from "next/image";
import { useMemo, useState } from "react";
import { EChart } from "@/components/charts/echart";
import { useLocale } from "@/i18n/locale-provider";
import { genreColor, genresOf, type ScoredFilm } from "./stats";

// What you watch, as a sunburst: the inner ring is the genres (a film counts in each of its
// genres), the outer ring splits each genre by how you rated it. Pointing at a segment lists the
// films in it under the chart; clicking a genre zooms into it (ECharts' own behaviour).
const GENRE_LIMIT = 8;
const LIST_LIMIT = 8;
type Band = "high" | "mid" | "low" | "unrated";
const BANDS: Band[] = ["high", "mid", "low", "unrated"];
const BAND_OPACITY: Record<Band, number> = { high: 1, mid: 0.76, low: 0.52, unrated: 0.3 };

function bandOf(film: ScoredFilm): Band {
  if (film.myRating == null) return "unrated";
  if (film.myRating >= 9) return "high";
  if (film.myRating >= 7) return "mid";
  return "low";
}

type Segment = { genre: string | null; band: Band | null; films: ScoredFilm[] };

type Node = {
  name: string;
  value: number;
  itemStyle: { color: string; opacity?: number };
  segment: Segment;
  children?: Node[];
};

export function GenreSunburst({
  films,
  genreLabel,
  otherLabel,
  muted = false,
}: {
  films: ScoredFilm[];
  genreLabel: (genre: string) => string;
  // The name of the bucket for genres past the top few.
  otherLabel: string;
  muted?: boolean;
}) {
  const { t, lang } = useLocale();
  const s = t.profile.sunburst;
  const [picked, setPicked] = useState<Segment | null>(null);

  const { data, total } = useMemo(() => {
    const byGenre = new Map<string, ScoredFilm[]>();
    for (const film of films)
      for (const genre of genresOf(film)) byGenre.set(genre, [...(byGenre.get(genre) ?? []), film]);
    const ranked = [...byGenre.entries()].sort((a, b) => b[1].length - a[1].length);
    const top = ranked.slice(0, GENRE_LIMIT);
    const rest = ranked.slice(GENRE_LIMIT).flatMap(([, items]) => items);
    const groups: [string | null, ScoredFilm[]][] = [
      ...top,
      ...(rest.length ? [[null, rest] as [null, ScoredFilm[]]] : []),
    ];
    const nodes: Node[] = groups.map(([genre, items]) => {
      const color = genre ? genreColor(genre) : "#8b93a1";
      const children = BANDS.map((band) => ({ band, items: items.filter((film) => bandOf(film) === band) }))
        .filter(({ items: inBand }) => inBand.length > 0)
        .map(({ band, items: inBand }) => ({
          name: s.bands[band],
          value: inBand.length,
          itemStyle: { color, opacity: BAND_OPACITY[band] },
          segment: { genre, band, films: inBand },
        }));
      return {
        name: genre ? genreLabel(genre) : otherLabel,
        value: items.length,
        itemStyle: { color },
        segment: { genre, band: null, films: items },
        children,
      };
    });
    return { data: nodes, total: nodes.reduce((sum, node) => sum + node.value, 0) };
  }, [films, genreLabel, otherLabel, s]);

  const option = useMemo<EChartsOption>(
    () => ({
      animationDuration: 500,
      title: {
        text: String(films.length),
        subtext: s.center,
        left: "center",
        top: "center",
        textStyle: { fontSize: 22, fontWeight: 700, fontFamily: "var(--display)" },
        subtextStyle: { fontSize: 11 },
        itemGap: 2,
      },
      tooltip: { show: false },
      series: [
        {
          type: "sunburst",
          data,
          radius: ["24%", "96%"],
          sort: undefined,
          nodeClick: "rootToNode",
          // Point at a segment: its genre stays bright, the rest only fades a little (CJK labels
          // read better upright than along the arc).
          emphasis: { focus: "ancestor" },
          blur: { itemStyle: { opacity: 0.4 } },
          itemStyle: {
            borderWidth: 2,
            borderColor: "transparent",
            borderRadius: 4,
            opacity: muted ? 0.6 : undefined,
          },
          levels: [
            {},
            {
              r0: "24%",
              r: "64%",
              label: {
                rotate: 0,
                minAngle: 16,
                fontSize: 11,
                color: "#fff",
                fontWeight: 600,
                textShadowBlur: 3,
                textShadowColor: "rgba(0,0,0,0.65)",
              },
            },
            { r0: "66%", r: "96%", label: { show: false } },
          ],
        },
      ],
    }),
    [data, films.length, muted, s],
  );

  const events = useMemo(
    () => ({
      mouseover: (params: { data?: Node }) => params.data?.segment && setPicked(params.data.segment),
      click: (params: { data?: Node }) => params.data?.segment && setPicked(params.data.segment),
    }),
    [],
  );

  const shown = picked ?? null;
  const listed = shown
    ? [...shown.films].sort(
        (a, b) => (b.myRating ?? -1) - (a.myRating ?? -1) || b.watchedAt.localeCompare(a.watchedAt),
      )
    : [];
  const heading = shown
    ? `${shown.genre ? genreLabel(shown.genre) : otherLabel}${shown.band ? ` · ${s.bands[shown.band]}` : ""} · ${s.count(shown.films.length)}`
    : null;

  return (
    <div className="sunburst">
      <div className="sunburst-chart" role="img" aria-label={t.profile.genreChart}>
        <EChart option={option} onEvents={events} />
      </div>
      <div className="sunburst-list" aria-live="polite">
        {shown ? (
          <>
            <div className="sunburst-head">{heading}</div>
            <ul>
              {listed.slice(0, LIST_LIMIT).map((film) => (
                <li key={`${film.id}-${film.watchedAt}`}>
                  <span
                    className="sb-poster"
                    style={{ background: genreColor(film.genre) }}
                    aria-hidden="true"
                  >
                    {film.poster ? (
                      <Image src={film.poster} alt="" width={24} height={34} unoptimized />
                    ) : (
                      film.title.slice(0, 1)
                    )}
                  </span>
                  <span className="sb-title">
                    {lang === "en" && film.titleEn ? film.titleEn : film.title}
                    {film.year ? <small> {film.year}</small> : null}
                  </span>
                  <span className="sb-rating num">{film.myRating == null ? "–" : film.myRating}</span>
                </li>
              ))}
            </ul>
            {listed.length > LIST_LIMIT && (
              <div className="sunburst-more">{s.more(listed.length - LIST_LIMIT)}</div>
            )}
          </>
        ) : (
          <div className="sunburst-hint">{s.hint}</div>
        )}
      </div>
    </div>
  );
}
