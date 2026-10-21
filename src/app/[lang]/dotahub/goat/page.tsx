import type { Metadata } from "next";
import { after, connection } from "next/server";
import { Suspense } from "react";
import { getDictionary } from "@/i18n/server";
import { getGoatScene, getTeamView } from "@/lib/dota/goat";
import { getPsSchedule } from "@/lib/dota/pandascore";
import { ago, Notice } from "../parts";
import { SourceNote } from "./parts";
import { TeamGrid } from "./team-grid";
import { LoadingPanel } from "../loading-panel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.goat.title };
}

async function Body() {
  await connection();
  const t = (await getDictionary()).dotahub;
  const [scene, schedule] = await Promise.all([
    getGoatScene().catch(() => null),
    getPsSchedule().catch(() => null),
  ]);
  if (!scene) return <Notice>{t.goat.unavailable}</Notice>;
  // Warm the top teams' pages in the background, one after another (gentle on OpenDota): the next
  // click on one of them finds it cached. Each costs nothing while its data is still fresh.
  after(async () => {
    for (const team of scene.teams.slice(0, 10)) await getTeamView(team.id).catch(() => null);
  });
  const byTeam = new Map<number, typeof scene.players>();
  for (const p of scene.players)
    if (p.teamId && !p.stale) byTeam.set(p.teamId, [...(byTeam.get(p.teamId) ?? []), p]);
  const series = [...(schedule?.running ?? []), ...(schedule?.upcoming ?? [])];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {t.goat.teamsHint} {t.goat.updated(ago(scene.at / 1000, t))}
        {scene.psAt ? ` · ${t.goat.ps.source}` : ""}
      </p>
      <SourceNote source={scene.source} at={scene.at} t={t} />
      <TeamGrid
        teams={scene.teams.map((team) => {
          const next = team.ps
            ? series.find((m) => m.opponents.some((o) => o.id === team.ps!.id))
            : undefined;
          const opponent = next?.opponents.find((o) => o.id !== team.ps!.id);
          return {
            id: team.id,
            rank: team.rank,
            name: team.name,
            tag: team.tag,
            logo: team.logo ?? team.ps?.image ?? null,
            rating: team.rating,
            wins: team.wins,
            losses: team.losses,
            lastMatch: ago(team.lastMatch, t),
            next: next
              ? {
                  live: next.status === "running",
                  begin: next.begin,
                  opponent: opponent?.name ?? "TBD",
                  bestOf: next.bestOf,
                }
              : null,
            // PandaScore's roster when it has one (each with their account), else the ones who
            // played last first: the current five, not old accounts still listed.
            roster: [
              ...(byTeam.get(team.id) ?? [])
                .sort(
                  (a, b) =>
                    (a.ps?.role ?? 9) - (b.ps?.role ?? 9) ||
                    (b.accounts[0].lastMatch ?? 0) - (a.accounts[0].lastMatch ?? 0),
                )
                .map((p) => ({
                  id: p.accounts[0].accountId,
                  name: p.name,
                  avatar: p.ps?.photo ?? p.accounts[0].avatar,
                  accounts: p.accounts.map((a) => a.accountId),
                })),
              ...team.psOnly.map((p) => ({ id: -p.id, name: p.name, avatar: p.photo, accounts: [] })),
            ],
          };
        })}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingPanel kind="goatTeams" />}>
      <Body />
    </Suspense>
  );
}
