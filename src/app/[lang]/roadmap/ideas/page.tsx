import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { ROADMAP } from "@/lib/roadmap";
import { listIdeas } from "@/lib/roadmap-store";
import { SuggestionForm } from "../suggestion-form";
import { IdeaBox, type IdeaLink } from "./idea-box";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).roadmap.ideas.title };
}

async function Ideas() {
  const lang = await getLocale();
  const t = (await getDictionary()).roadmap;
  const session = await getSession();
  const ideas = await listIdeas(session?.user.id ?? null);
  const links: Record<string, IdeaLink> = Object.fromEntries(
    ROADMAP.map((item) => [
      item.id,
      {
        href: `${item.status === "shipped" ? "/roadmap/changelog" : "/roadmap"}#item-${item.id}`,
        title: item.title[lang],
      },
    ]),
  );
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t.suggest.title}</CardTitle>
          <CardDescription>{t.suggest.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {session ? (
            <SuggestionForm />
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {t.suggest.signIn}
              <Link
                href={localePath(lang, "/login?next=/roadmap/ideas")}
                className={buttonVariants({ size: "sm" })}
              >
                {t.signIn}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
      <IdeaBox ideas={ideas} links={links} signedIn={Boolean(session)} />
    </>
  );
}

// The public idea box: everyone's suggestions, liked by whoever wants them too.
export default async function IdeasPage() {
  const t = (await getDictionary()).roadmap.ideas;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <Ideas />
      </Suspense>
    </div>
  );
}
