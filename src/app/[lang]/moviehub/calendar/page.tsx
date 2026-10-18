import type { Metadata } from "next";
import { ClockIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { MockFrame } from "../mock-frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).moviehub.calendar.title };
}

// The mock's "today": Thursday.
const TODAY = 3;

// Mock-up: this week's episodes of what the person follows.
export default async function CalendarPage() {
  const t = (await getDictionary()).moviehub.calendar;
  const next = t.shows.find((show) => show.day === TODAY) ?? t.shows[0];
  return (
    <MockFrame title={t.title} description={t.description}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="text-muted-foreground">{t.following(t.shows.length)}</span>
        <span className="flex items-center gap-1.5">
          <ClockIcon className="size-4 text-muted-foreground" aria-hidden />
          {t.next}：{t.nextIn(next.title, "6:42:10")}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {t.days.map((day, index) => {
          const shows = t.shows
            .filter((show) => show.day === index)
            .sort((a, b) => a.time.localeCompare(b.time));
          return (
            <Card key={day} size="sm" className={cn(index === TODAY && "ring-2 ring-primary/60")}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  {day}
                  {index === TODAY && (
                    <span className="text-xs font-normal text-muted-foreground">{t.today}</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-16 flex-col gap-2">
                {shows.map((show) => (
                  <div key={show.title} className="rounded-md bg-muted/60 px-2 py-1.5">
                    <div className="text-xs text-muted-foreground tabular-nums">{show.time}</div>
                    <div className="leading-snug font-medium">{show.title}</div>
                    <div className="text-xs text-muted-foreground">{t.episode(show.episode)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </MockFrame>
  );
}
