import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { getDiscordAccount, hasOtherLogin } from "@/lib/discord-account";
import { getAnimeSettings } from "@/lib/movies";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AnimeSettings } from "./anime-settings";
import { DiscordLink } from "./discord-link";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settings.title };
}
async function SettingsContent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getSession();
  const lang = await getLocale();
  const t = await getDictionary();
  if (!session)
    return (
      <Link className={buttonVariants()} href={localePath(lang, "/login")}>
        {t.settings.signInFirst}
      </Link>
    );
  const linked = await getDiscordAccount(session.user.id);
  const { error } = await searchParams;
  // undefined: admin unreachable; null: no movie profile yet.
  const anime = await getAnimeSettings(session.user.id).catch(() => undefined);
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t.settings.current(session.user.name, session.user.email)}
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Discord</CardTitle>
          <CardDescription>{t.settings.discordDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <DiscordLink
            canUnlink={await hasOtherLogin(session.user.id)}
            linked={linked}
            configured={Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET)}
            initialError={Boolean(error)}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.anime.title}</CardTitle>
          <CardDescription>{t.settings.anime.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {anime ? (
            <AnimeSettings airing={anime.airing} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {anime === null ? t.settings.anime.noProfile : t.settings.anime.unavailable}
            </p>
          )}
        </CardContent>
      </Card>
      <Link href={localePath(lang, "/moviehub")} className={buttonVariants({ variant: "outline" })}>
        {t.settings.viewMovies}
      </Link>
    </div>
  );
}
export default async function SettingsPage(props: { searchParams: Promise<{ error?: string }> }) {
  const t = await getDictionary();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.settings.description}</p>
      </div>
      <Suspense fallback={<p role="status">{t.settings.loading}</p>}>
        <SettingsContent {...props} />
      </Suspense>
    </div>
  );
}
