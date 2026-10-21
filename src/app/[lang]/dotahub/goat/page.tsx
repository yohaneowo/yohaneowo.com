import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDictionary } from "@/i18n/server";
import { getProScene } from "@/lib/dota/pro";
import { ago, Notice } from "../parts";
import { TeamGrid } from "./team-grid";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.goat.title };
}

async function Body() {
  await connection();
  const t = (await getDictionary()).dotahub;
  const scene = await getProScene().catch(() => null);
  if (!scene) return <Notice>{t.goat.unavailable}</Notice>;
  const byTeam = new Map<number, typeof scene.players>();
  for (const p of scene.players) if (p.teamId) byTeam.set(p.teamId, [...(byTeam.get(p.teamId) ?? []), p]);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {t.goat.teamsHint} {t.goat.updated(ago(scene.at / 1000, t))}
      </p>
      <TeamGrid
        teams={scene.teams.map((team) => ({
          id: team.id,
          rank: team.rank,
          name: team.name,
          tag: team.tag,
          logo: team.logo,
          rating: team.rating,
          wins: team.wins,
          losses: team.losses,
          lastMatch: ago(team.lastMatch, t),
          // The ones who played last first: the current five, not old accounts still listed.
          roster: (byTeam.get(team.id) ?? [])
            .sort((a, b) => (b.accounts[0].lastMatch ?? 0) - (a.accounts[0].lastMatch ?? 0))
            .map((p) => ({
              id: p.accounts[0].accountId,
              name: p.name,
              avatar: p.accounts[0].avatar,
              accounts: p.accounts.map((a) => a.accountId),
            })),
        }))}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
      <Body />
    </Suspense>
  );
}
