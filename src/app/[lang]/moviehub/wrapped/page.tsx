import type { Metadata } from "next";
import { Share2Icon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { MockFrame } from "../mock-frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).moviehub.wrapped.title };
}

const MONTHS = [9, 12, 8, 14, 10, 7, 15, 13, 11, 16, 12, 7];

// Mock-up: the year in review, the kind of page that gets shared as one image.
export default async function WrappedPage() {
  const t = (await getDictionary()).moviehub.wrapped;
  const most = Math.max(...MONTHS);
  return (
    <MockFrame title={t.title} description={t.description}>
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-bold tracking-tight">{t.year(2026)}</h2>
        <span className={cn(buttonVariants({ size: "sm", variant: "outline" }), "pointer-events-none")}>
          <Share2Icon aria-hidden />
          {t.share}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {t.stats.map((stat) => (
          <Card key={stat.label} size="sm">
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.months}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-36 items-end gap-1.5">
              {MONTHS.map((count, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
                  <div
                    className="w-full rounded-t-[4px] bg-primary/80"
                    style={{ height: `${(count / most) * 100}px` }}
                    aria-label={`${t.monthNames[index]}: ${count}`}
                  />
                  <span className="text-[10px] text-muted-foreground">{t.monthNames[index]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.favourites}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {[
              [t.genre, t.genreValue],
              [t.director, t.directorValue],
              [t.studio, t.studioValue],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b pb-2 last:border-0">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
            <div>
              <div className="mb-2 text-muted-foreground">{t.top}</div>
              <ol className="flex flex-col gap-1">
                {t.topFilms.map((title, index) => (
                  <li key={title} className="flex gap-2">
                    <span className="w-4 text-muted-foreground tabular-nums">{index + 1}</span>
                    {title}
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </MockFrame>
  );
}
