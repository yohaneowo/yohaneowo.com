import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileFilm } from "@/lib/movie-types";
import zh from "@/i18n/zh";
import { AXES, ratingOf, styleOf } from "../stats";
import { DiffBars, StyleRadar } from "./charts";

export const metadata: Metadata = { title: "图表预览" };

function film(
  title: string,
  watchedAt: string,
  releaseDate: string,
  director: string,
  genre: string,
  voteCount: number,
  myRating: number,
  publicScore: number,
): ProfileFilm {
  return {
    id: title.length * 100 + myRating,
    title,
    year: Number(releaseDate.slice(0, 4)),
    releaseDate,
    director,
    directorId: null,
    directorEn: null,
    genre,
    genres: [genre],
    country: "美国",
    publicScore,
    voteCount,
    imdbId: null,
    // Sample IMDb scores sit a little above TMDB, as they usually do.
    imdbRating: Math.min(10, Math.round((publicScore + 0.3) * 10) / 10),
    imdbVotes: voteCount * 4,
    rottenTomatoes: null,
    metacritic: null,
    myRating,
    anime: false,
    plays: 1,
    originalTitle: null,
    titleEn: null,
    watchedAt,
    poster: null,
  };
}

const films: ProfileFilm[] = [
  film("示例·新片甲", "2026-09-20", "2026-08-01", "林导", "科幻", 12000, 9, 7.4),
  film("示例·新片乙", "2026-08-11", "2026-07-02", "林导", "喜剧", 8000, 7, 6.6),
  film("示例·新片丙", "2026-07-18", "2026-06-20", "周导", "动画", 42000, 8, 8.4),
  film("示例·新片丁", "2026-06-02", "2026-05-01", "林导", "悬疑", 3000, 6, 7.1),
  film("示例·旧片甲", "2026-05-14", "1994-06-01", "林导", "剧情", 9000, 10, 8.8),
  film("示例·旧片乙", "2026-04-03", "1988-11-01", "赵导", "剧情", 210000, 8, 8.2),
  film("示例·旧片丙", "2026-03-22", "1979-04-01", "林导", "纪录", 6000, 7, 7.9),
  film("示例·旧片丁", "2026-02-16", "1999-09-01", "钱导", "惊悚", 18000, 5, 6.4),
  film("示例·旧片戊", "2026-01-09", "1982-01-01", "孙导", "喜剧", 70000, 9, 7.5),
  film("示例·冷门甲", "2025-12-12", "2016-03-01", "林导", "剧情", 2400, 8, 6.9),
  film("示例·冷门乙", "2025-11-02", "2014-08-01", "周导", "悬疑", 5100, 6, 6.2),
  film("示例·冷门丙", "2025-10-19", "2011-02-01", "吴导", "科幻", 900, 9, 7.0),
  film("示例·院线甲", "2025-09-01", "2019-07-01", "郑导", "动作", 160000, 7, 7.6),
  film("示例·院线乙", "2025-07-21", "2018-05-01", "周导", "爱情", 98000, 4, 6.8),
  film("示例·院线丙", "2025-06-08", "2017-12-01", "林导", "剧情", 54000, 8, 7.7),
  film("示例·短片甲", "2025-04-15", "2021-01-01", "冯导", "动画", 1500, 7, 6.1),
  film("示例·短片乙", "2025-03-03", "2020-06-01", "陈导", "纪录", 2200, 8, 7.3),
  film("示例·短片丙", "2025-01-28", "2015-10-01", "林导", "喜剧", 4300, 6, 5.8),
  film("示例·热门甲", "2024-11-11", "2013-03-01", "赵导", "科幻", 240000, 9, 8.1),
  film("示例·热门乙", "2024-08-19", "2008-07-01", "钱导", "动作", 310000, 7, 7.8),
];

export default function ChartPreviewPage() {
  // Design sandbox with sample data; not part of the public site.
  if (process.env.NODE_ENV === "production") notFound();
  const newestFirst = [...films].sort((a, b) => (a.watchedAt < b.watchedAt ? 1 : -1));
  const style = styleOf(newestFirst, {
    kind: "movie",
    noun: "",
    source: "imdb",
    depth: 0.42,
    depthGroups: 12,
    watchedPercentile: 63,
    watchedCount: 320,
    platformUsers: 8,
    genreLabel: (genre) => genre,
    t: zh.style,
  });
  const rating = ratingOf(newestFirst, "imdb");
  const labels = newestFirst
    .filter((item) => item.myRating != null && item.imdbRating != null)
    .reverse()
    .map((item) => item.title);
  if (!style) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">图表预览</h1>
        <p className="max-w-2xl text-muted-foreground">
          这里用 shadcn 的卡片和 ECharts
          画观影风格、分数差。数字来自同一套轴规则，片名都是示例，不是你的观影记录。正式档案页仍用手写 SVG。
        </p>
        <Link href="/moviehub" className={buttonVariants({ variant: "outline", className: "w-fit" })}>
          返回观影统计
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>观影风格</CardTitle>
            <CardDescription>{style.title}。前三轴按这 20 部示例算，深度和数量用固定示例值。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="h-80">
              <StyleRadar scores={style.scores.map((score) => score ?? 0)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {AXES.map((axis, index) => (
                <Badge key={axis} variant="outline">
                  {zh.style.axes[axis]} {style.scores[index] ?? "—"}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>和大众分的差</CardTitle>
            <CardDescription>我的分数减 IMDb 分，从旧到新。色条在 ±4 处截断，悬停可看原值。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <DiffBars diffs={rating.diffs} labels={labels} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
