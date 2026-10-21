import Image from "next/image";
import Link from "next/link";
import { ShieldIcon, TvIcon } from "lucide-react";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { PsMatch } from "@/lib/dota/pandascore";
import { cn } from "@/lib/utils";
import { LocalTime } from "./local-time";

type T = Dictionary["dotahub"];

const TIER: Record<string, string> = {
  S: "border-amber-400/70 text-amber-600 dark:text-amber-300",
  A: "border-violet-400/70 text-violet-600 dark:text-violet-300",
  B: "border-sky-400/70 text-sky-600 dark:text-sky-300",
};

function Side({
  o,
  odTeam,
  lang,
  won,
  right,
}: {
  o: PsMatch["opponents"][number] | undefined;
  odTeam: number | undefined;
  lang: Locale;
  won: boolean | null;
  right?: boolean;
}) {
  const logo = (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded bg-muted/60">
      {o?.image ? (
        <Image src={o.image} alt="" width={28} height={28} unoptimized className="size-full object-contain" />
      ) : (
        <ShieldIcon className="size-4 text-muted-foreground" aria-hidden />
      )}
    </span>
  );
  const name = (
    <span
      className={cn(
        "min-w-0 truncate",
        won === true && "font-semibold",
        won === false && "text-muted-foreground",
      )}
    >
      {o?.name ?? "TBD"}
    </span>
  );
  const body = (
    <span className={cn("flex min-w-0 items-center gap-2", right && "flex-row-reverse text-right")}>
      {logo}
      {name}
    </span>
  );
  return odTeam ? (
    <Link href={localePath(lang, `/dotahub/goat/teams/${odTeam}`)} className="min-w-0 flex-1 hover:underline">
      {body}
    </Link>
  ) : (
    <span className="min-w-0 flex-1">{body}</span>
  );
}

// One series: when, the two teams (linked to their GOAT page when we know them), the score, the
// tournament and its tier, and where to watch.
export function SeriesRow({
  m,
  t,
  lang,
  odTeams,
}: {
  m: PsMatch;
  t: T;
  lang: Locale;
  // PandaScore team id → OpenDota team id.
  odTeams: Map<number, number>;
}) {
  const s = t.goat.schedule;
  const [a, b] = m.opponents;
  const done = m.status === "finished";
  const live = m.status === "running";
  const stream = m.streams[0];
  return (
    <li
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border px-3 py-2",
        live && "border-red-500/50 bg-red-500/5",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        {live ? (
          <span className="rounded bg-red-500/15 px-1.5 font-semibold text-red-600 dark:text-red-400">
            LIVE
          </span>
        ) : m.begin ? (
          <LocalTime iso={m.begin} />
        ) : (
          <span>{s.tbd}</span>
        )}
        {m.tier && (
          <span
            className={cn("rounded border px-1 leading-4 font-semibold", TIER[m.tier] ?? "border-border")}
          >
            {s.tier(m.tier)}
          </span>
        )}
        <span className="min-w-0 truncate">
          {[m.league.name, m.serie, m.tournament].filter(Boolean).join(" · ")}
        </span>
        <span className="ml-auto shrink-0">{s.bo(m.bestOf)}</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <Side o={a} odTeam={a && odTeams.get(a.id)} lang={lang} won={done ? m.winnerId === a?.id : null} />
        <span className="shrink-0 font-mono font-semibold tabular-nums">
          {done || live ? `${a?.score ?? 0} : ${b?.score ?? 0}` : s.vs}
        </span>
        <Side
          o={b}
          odTeam={b && odTeams.get(b.id)}
          lang={lang}
          won={done ? m.winnerId === b?.id : null}
          right
        />
      </div>
      {stream && !done && (
        <a
          href={stream.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 self-start text-[11px] text-muted-foreground hover:text-foreground hover:underline"
        >
          <TvIcon className="size-3" aria-hidden />
          {s.watch} · {stream.language.toUpperCase()}
          {m.streams.length > 1 && ` +${m.streams.length - 1}`}
        </a>
      )}
    </li>
  );
}
