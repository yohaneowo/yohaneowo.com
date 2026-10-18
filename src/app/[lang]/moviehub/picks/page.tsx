import type { Metadata } from "next";
import { DicesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getDictionary } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { MockFrame } from "../mock-frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).moviehub.picks.title };
}

// Mock-up: the web side of the Discord recommendations.
export default async function PicksPage() {
  const t = (await getDictionary()).moviehub.picks;
  const quotas = [
    { label: t.movie, left: 2, total: 3, bonus: 100 },
    { label: t.anime, left: 4, total: 5, bonus: 105 },
  ];
  const statusText = (status: string, rating = 0) =>
    status === "want"
      ? t.status.want
      : status === "watched"
        ? t.status.watched(rating)
        : status === "skipped"
          ? t.status.skipped
          : t.status.pending;
  return (
    <MockFrame title={t.title} description={t.description}>
      <section className="grid gap-4 sm:grid-cols-2" aria-label={t.quota}>
        {quotas.map((quota) => (
          <Card key={quota.label} size="sm">
            <CardHeader>
              <CardTitle>{quota.label}</CardTitle>
              <CardDescription>
                {t.left(quota.left, quota.total)} · {t.bonus(quota.bonus)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={(quota.left / quota.total) * 100} aria-label={quota.label} />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{t.today}</h2>
          <span className={cn(buttonVariants({ size: "sm", variant: "outline" }), "pointer-events-none")}>
            <DicesIcon aria-hidden />
            {t.draw}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {t.items.map((item, index) => (
            <Card key={item.title} className={item.status === "skipped" ? "opacity-60" : undefined}>
              <div
                aria-hidden
                className="mx-4 aspect-[16/9] rounded-md"
                style={{
                  background: `linear-gradient(135deg, hsl(${index * 70 + 20} 45% 35%), hsl(${index * 70 + 60} 40% 18%))`,
                }}
              />
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.mode}</Badge>
                  <span className="text-xs text-muted-foreground">{statusText(item.status)}</span>
                </div>
                <CardTitle className="leading-snug">{item.title}</CardTitle>
                <CardDescription>{item.meta}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{item.reason}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t.history}</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 font-normal">{t.columns.title}</th>
                <th className="px-3 py-2 font-normal">{t.columns.mode}</th>
                <th className="px-3 py-2 font-normal">{t.columns.result}</th>
                <th className="px-3 py-2 text-right font-normal">{t.columns.day}</th>
              </tr>
            </thead>
            <tbody>
              {t.past.map((row) => (
                <tr key={row.title} className="border-b last:border-0">
                  <td className="px-3 py-2">{row.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.mode}</td>
                  <td className="px-3 py-2">{statusText(row.result, row.rating)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{row.day}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </MockFrame>
  );
}
