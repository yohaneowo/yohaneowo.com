import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDictionary } from "@/i18n/server";
import { getProScene } from "@/lib/dota/pro";
import { ago, Notice } from "../../parts";
import { PlayerDirectory } from "./player-directory";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getDictionary()).dotahub.goat;
  return { title: `${t.tabs.players} · ${t.title}` };
}

async function Body() {
  await connection();
  const t = (await getDictionary()).dotahub;
  const scene = await getProScene().catch(() => null);
  if (!scene) return <Notice>{t.goat.unavailable}</Notice>;
  const teams = new Map(scene.teams.map((team) => [team.id, team]));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {t.goat.players.hint} {t.goat.updated(ago(scene.at / 1000, t))}
      </p>
      <PlayerDirectory
        rows={scene.players.map((p) => {
          const team = teams.get(p.teamId);
          return {
            key: p.key,
            name: p.name,
            avatar: p.accounts[0].avatar,
            country: p.country,
            role: p.role,
            team: team ? { id: team.id, name: team.name, logo: team.logo, rank: team.rank } : null,
            lastMatch: p.accounts[0].lastMatch ?? 0,
            accounts: p.accounts.map((a) => ({
              id: a.accountId,
              persona: a.persona,
              lastPlayed: a.lastMatch ? ago(a.lastMatch, t) : t.goat.account.never,
            })),
          };
        })}
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
