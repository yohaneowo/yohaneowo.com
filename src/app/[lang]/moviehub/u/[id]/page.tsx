import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { FilmIcon } from "lucide-react";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { localePath } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { getDiscordAccount } from "@/lib/discord-account";
import { getSiteUser, loadBonds } from "@/lib/movie-bonds";
import { getScoreSource } from "@/lib/movie-preference";
import { refreshMovieStatistics, viewMovieStatistics } from "@/lib/movies";
import { styleProfile, type StyleProfile } from "../../compare";
import { MovieProfile } from "../../profile";

type Params = Promise<{ lang: string; id: string }>;

// Any account id can be opened, so there is no static shell to prerender: the page (layout
// included, whose client hooks read the path) renders per request.
export const instant = false;

// The link preview: Discord, LINE and others show the card drawn by /api/moviehub/og/<id>.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = await getDictionary();
  const lang = await getLocale();
  const id = decodeURIComponent((await params).id);
  const person = await getSiteUser(id);
  if (!person) return { title: t.movies.title };
  const title = t.profile.viewing.title(person.name);
  const description = t.profile.og.description(person.name);
  const origin = (process.env.BETTER_AUTH_URL ?? "").replace(/\/+$/, "");
  const image = `${origin}/api/moviehub/og/${encodeURIComponent(id)}${lang === "en" ? "?lang=en" : ""}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${origin}${localePath(lang, `/moviehub/u/${encodeURIComponent(id)}`)}`,
      siteName: "yohaneowo",
      type: "profile",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

function taipeiToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
}

// Someone else's page before their statistics exist: who it is and why there is nothing yet.
function Placeholder({ t, title, text }: { t: Dictionary; title: string; text: string }) {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-start gap-3">
        <FilmIcon className="mt-1 size-7 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-muted-foreground">{t.movies.subheading}</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardDescription>{text}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

// Under the hero: whose page this is, and the way back to one's own (or to signing in).
function ViewingNotice({
  t,
  lang,
  name,
  signedIn,
}: {
  t: Dictionary;
  lang: "zh" | "en";
  name: string;
  signedIn: boolean;
}) {
  const v = t.profile.viewing;
  return (
    <div className="notice" role="status">
      <div className="notice-text">
        <span>{v.banner(name)}</span>
      </div>
      <Link
        href={localePath(lang, signedIn ? "/moviehub" : "/login?next=/moviehub")}
        className="notice-button"
      >
        {signedIn ? v.back : v.signIn}
      </Link>
    </div>
  );
}

// The visitor's own style data for the comparison radar; null when there is nothing to compare.
async function visitorStyle(userId: string, name: string): Promise<StyleProfile | null> {
  try {
    const linked = await getDiscordAccount(userId);
    const own = await viewMovieStatistics(userId, linked?.accountId ?? null);
    return own.snapshot ? styleProfile(name, own.snapshot, own.platform) : null;
  } catch {
    return null;
  }
}

async function TheirStatistics({ params }: { params: Params }) {
  const lang = await getLocale();
  const t = await getDictionary();
  const v = t.profile.viewing;
  const id = decodeURIComponent((await params).id);
  const session = await getSession();
  if (session?.user.id === id) redirect(localePath(lang, "/moviehub"));
  const person = await getSiteUser(id);
  if (!person) notFound();
  const title = v.title(person.name);

  const linked = await getDiscordAccount(id);
  let result;
  try {
    result = await viewMovieStatistics(id, linked?.accountId ?? null);
  } catch {
    return <Placeholder t={t} title={title} text={v.unavailable} />;
  }
  const { subscription, snapshot, platform } = result;
  if (!subscription) return <Placeholder t={t} title={title} text={v.noProfile(person.name)} />;
  if (subscription.traktReauth) return <Placeholder t={t} title={title} text={v.reauth(person.name)} />;
  if (!snapshot) {
    // Their first sync hasn't finished: queue one now (admin ignores repeats while it runs).
    if (!subscription.syncRequested && !subscription.syncing)
      await refreshMovieStatistics(subscription.siteUserId ?? id).catch(() => undefined);
    return <Placeholder t={t} title={title} text={v.preparing(person.name)} />;
  }

  const [bonds, compare, scoreSource] = await Promise.all([
    loadBonds(id, { refresh: false }),
    session ? visitorStyle(session.user.id, session.user.name) : Promise.resolve(null),
    session ? getScoreSource(session.user.id) : Promise.resolve("imdb" as const),
  ]);
  return (
    <MovieProfile
      viewing={{
        subject: person.name,
        compare,
        saveSource: Boolean(session),
        viewerId: session?.user.id ?? null,
      }}
      bonds={bonds}
      name={subscription.traktName}
      avatar={subscription.traktAvatar}
      notice={<ViewingNotice t={t} lang={lang} name={person.name} signedIn={Boolean(session)} />}
      traktUser={subscription.traktUser}
      region={subscription.region}
      syncedAt={subscription.syncedAt}
      syncError={null}
      waiting={false}
      poll={false}
      watchedCount={snapshot.watchedCount}
      plays={snapshot.plays}
      showMean={snapshot.showMean}
      showRatingCount={snapshot.showRatingCount}
      mean={snapshot.mean}
      distribution={snapshot.distribution}
      sampleCount={snapshot.sampleCount}
      genres={snapshot.genres}
      films={snapshot.films}
      people={snapshot.people}
      today={taipeiToday()}
      ratedIds={snapshot.ratedIds}
      depth={snapshot.depth}
      depthGroups={snapshot.depthGroups}
      watchedPercentile={platform?.watchedPercentile ?? null}
      platformUsers={platform?.users ?? 0}
      shows={snapshot.shows}
      showsPercentile={platform?.showsPercentile ?? null}
      showUsers={platform?.showUsers ?? 0}
      anime={snapshot.anime}
      animePercentile={platform?.animePercentile ?? null}
      animeUsers={platform?.animeUsers ?? 0}
      scoreSource={scoreSource}
    />
  );
}

export default async function TheirMovieHubPage({ params }: { params: Params }) {
  const t = await getDictionary();
  return (
    <Suspense
      fallback={
        <div role="status" className="rounded-xl border p-8 text-sm text-muted-foreground">
          {t.movies.loading}
        </div>
      }
    >
      <TheirStatistics params={params} />
    </Suspense>
  );
}
