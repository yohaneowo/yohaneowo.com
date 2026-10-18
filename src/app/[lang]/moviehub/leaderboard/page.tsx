import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { MockFrame } from "../mock-frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).moviehub.leaderboard.title };
}

const BOARDS = ["month", "strict", "anime"] as const;
const MEDALS = ["🥇", "🥈", "🥉"];

// Mock-up: site-wide rankings, three boards side by side.
export default async function LeaderboardPage() {
  const t = (await getDictionary()).moviehub.leaderboard;
  return (
    <MockFrame title={t.title} description={t.description}>
      <div className="grid gap-4 lg:grid-cols-3">
        {BOARDS.map((board) => {
          // The toughest raters have the lowest mean; the others rank high to low.
          const rows = [...t.rows].sort((a, b) =>
            board === "strict" ? a[board] - b[board] : b[board] - a[board],
          );
          return (
            <Card key={board}>
              <CardHeader>
                <CardTitle>{t.boards[board]}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col">
                  {rows.map((row, index) => (
                    <li
                      key={row.name}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-2 py-2",
                        "you" in row && row.you && "bg-muted",
                      )}
                    >
                      <span
                        className="w-6 text-center tabular-nums"
                        aria-label={`${t.columns.rank} ${index + 1}`}
                      >
                        {MEDALS[index] ?? index + 1}
                      </span>
                      <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-medium uppercase">
                        {row.name.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      {"you" in row && row.you && <Badge variant="secondary">{t.you}</Badge>}
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {t.units[board](row[board])}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </MockFrame>
  );
}
