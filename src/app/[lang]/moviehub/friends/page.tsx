import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getDictionary } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { MockFrame } from "../mock-frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).moviehub.friends.title };
}

// Mock-up: the bonds card grown into a page of its own.
export default async function FriendsPage() {
  const t = (await getDictionary()).moviehub.friends;
  return (
    <MockFrame title={t.title} description={t.description}>
      <div className="grid gap-4 sm:grid-cols-2">
        {t.people.map((person) => (
          <Card key={person.name}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-muted font-medium uppercase">
                  {person.name.slice(0, 1)}
                </span>
                <div>
                  <CardTitle>{person.name}</CardTitle>
                  <CardDescription>{t.common(person.common)}</CardDescription>
                </div>
              </div>
              <CardAction>
                <span
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }), "pointer-events-none")}
                >
                  {t.compare}
                </span>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t.similarity}</span>
                  <span className="tabular-nums">{person.similarity}%</span>
                </div>
                <Progress value={person.similarity} aria-label={t.similarity} />
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">{t.recent}：</span>
                {person.recent}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </MockFrame>
  );
}
