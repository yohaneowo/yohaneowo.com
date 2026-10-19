import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { dotaViewer, syncDotaLink } from "./account";
import { Overview } from "./overview";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.title };
}

type SearchParams = Promise<{ steam?: string | string[] }>;
type T = Dictionary["dotahub"];

function ConnectCard({ t, lang, signedIn }: { t: T; lang: Locale; signedIn: boolean }) {
  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle>{t.connect.title}</CardTitle>
        <CardDescription>{signedIn ? t.connect.description : t.connect.signedOut}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {signedIn ? (
          <a href={`/api/steam/connect?lang=${lang}`} className={cn(buttonVariants(), "self-start")}>
            {t.connect.action}
          </a>
        ) : (
          <Link
            href={localePath(lang, "/login?next=/dotahub")}
            className={cn(buttonVariants(), "self-start")}
          >
            {t.connect.signIn}
          </Link>
        )}
        <p className="text-xs text-muted-foreground">{t.connect.publicData}</p>
      </CardContent>
    </Card>
  );
}

async function Body({ searchParams }: { searchParams: SearchParams }) {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const raw = (await searchParams).steam;
  const result = Array.isArray(raw) ? raw[0] : raw;
  const notice = result && result in t.notices ? t.notices[result as keyof T["notices"]] : null;
  const viewer = await dotaViewer();
  // Make sure admin checks this account (death maps, DMs), e.g. one linked before admin did.
  if (viewer.state === "linked") await syncDotaLink(viewer);
  return (
    <>
      {notice && (
        <p role="status" className="rounded-lg border px-4 py-3 text-sm">
          {notice}
        </p>
      )}
      {viewer.state === "linked" ? (
        <Overview t={t} lang={lang} accountId={viewer.accountId} steamId={viewer.steamId} own />
      ) : (
        <ConnectCard t={t} lang={lang} signedIn={viewer.state === "notLinked"} />
      )}
    </>
  );
}

export default async function DotaHubPage({ searchParams }: { searchParams: SearchParams }) {
  const t = (await getDictionary()).dotahub;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
