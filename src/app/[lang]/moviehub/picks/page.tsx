import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { getPicks, MoviesUnavailable, type PicksView } from "@/lib/movies";
import { cn } from "@/lib/utils";
import { PicksBody } from "./picks-body";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).moviehub.picks.title };
}

type Kind = "movie" | "show" | "anime";
const KINDS: Kind[] = ["movie", "show", "anime"];
type SearchParams = Promise<{ kind?: string | string[] }>;
function Message({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">{children}</div>;
}

async function Picks({ searchParams }: { searchParams: SearchParams }) {
  const lang = await getLocale();
  const t = (await getDictionary()).moviehub.picks;
  const raw = (await searchParams).kind;
  const kind: Kind = KINDS.find((k) => k === (Array.isArray(raw) ? raw[0] : raw)) ?? "movie";
  const session = await getSession();

  let body: React.ReactNode;
  if (!session) {
    body = (
      <Message>
        <p>{t.signedOut}</p>
        <Link
          href={localePath(lang, "/login?next=/moviehub/picks")}
          className={cn(buttonVariants({ size: "sm" }), "mt-3")}
        >
          {t.signIn}
        </Link>
      </Message>
    );
  } else if (kind === "show") {
    body = (
      <Message>
        <p>{t.showPlanned}</p>
        <Link
          href={localePath(lang, "/roadmap#item-show-picks")}
          className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-3")}
        >
          {(await getDictionary()).moviehub.planned.vote}
        </Link>
      </Message>
    );
  } else {
    let view: PicksView | null = null;
    let failed = false;
    try {
      view = await getPicks(session.user.id, kind);
    } catch (error) {
      if (!(error instanceof MoviesUnavailable)) throw error;
      failed = true;
    }
    body = failed ? (
      <Message>{t.unavailable}</Message>
    ) : view ? (
      <PicksBody t={t} lang={lang} view={view} />
    ) : (
      <Message>
        <p>{t.noProfile}</p>
        <Link href={localePath(lang, "/moviehub")} className={cn(buttonVariants({ size: "sm" }), "mt-3")}>
          {t.toStats}
        </Link>
      </Message>
    );
  }

  return (
    <>
      <nav aria-label={t.kindsLabel} className="flex gap-1 self-start rounded-lg bg-muted p-1 text-sm">
        {KINDS.map((k) => (
          <Link
            key={k}
            href={localePath(lang, `/moviehub/picks?kind=${k}`)}
            aria-current={k === kind ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1 transition-colors",
              k === kind
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.kinds[k]}
          </Link>
        ))}
      </nav>
      {body}
    </>
  );
}

// The Discord recommendations, read-only: films and anime (shows aren't built yet).
export default async function PicksPage({ searchParams }: { searchParams: SearchParams }) {
  const t = (await getDictionary()).moviehub.picks;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<Message>{t.loading}</Message>}>
        <Picks searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
