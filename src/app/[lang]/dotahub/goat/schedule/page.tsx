import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import { getGoatScene } from "@/lib/dota/goat";
import { getPsSchedule, type PsMatch } from "@/lib/dota/pandascore";
import { ago, Notice } from "../../parts";
import { AutoRefresh } from "../live/auto-refresh";
import { SeriesRow } from "../series-row";

type T = Dictionary["dotahub"];

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getDictionary()).dotahub.goat;
  return { title: `${t.tabs.schedule} · ${t.title}` };
}

function Block({
  title,
  matches,
  t,
  lang,
  odTeams,
  empty,
}: {
  title: string;
  matches: PsMatch[];
  t: T;
  lang: Locale;
  odTeams: Map<number, number>;
  empty?: string;
}) {
  if (!matches.length && !empty) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">
        {title} <span className="text-sm text-muted-foreground tabular-nums">{matches.length || ""}</span>
      </h2>
      {matches.length ? (
        <ul className="grid gap-2 lg:grid-cols-2">
          {matches.map((m) => (
            <SeriesRow key={m.id} m={m} t={t} lang={lang} odTeams={odTeams} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border px-4 py-4 text-center text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

async function Body({ t, lang }: { t: T; lang: Locale }) {
  await connection();
  const s = t.goat.schedule;
  const [schedule, scene] = await Promise.all([
    getPsSchedule().catch(() => null),
    getGoatScene().catch(() => null),
  ]);
  if (!schedule) return <Notice>{s.unavailable}</Notice>;
  const odTeams = new Map((scene?.teams ?? []).filter((x) => x.ps).map((x) => [x.ps!.id, x.id]));
  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh seconds={120} />
      <p className="text-xs text-muted-foreground">
        {s.hint} {s.updated(ago(schedule.at / 1000, t))}
      </p>
      <Block title={s.running} matches={schedule.running} t={t} lang={lang} odTeams={odTeams} />
      <Block
        title={s.upcoming}
        matches={schedule.upcoming.slice(0, 40)}
        t={t}
        lang={lang}
        odTeams={odTeams}
        empty={s.none}
      />
      <Block title={s.past} matches={schedule.past.slice(0, 30)} t={t} lang={lang} odTeams={odTeams} />
    </div>
  );
}

export default async function Page() {
  const [dict, lang] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
      <Body t={dict.dotahub} lang={lang} />
    </Suspense>
  );
}
