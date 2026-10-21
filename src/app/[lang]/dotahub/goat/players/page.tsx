import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDictionary } from "@/i18n/server";
import { getGoatScene, realName } from "@/lib/dota/goat";
import { ago, Notice } from "../../parts";
import { PlayerDirectory } from "./player-directory";
import { LoadingPanel } from "../../loading-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getDictionary()).dotahub.goat;
  return { title: `${t.tabs.players} · ${t.title}` };
}

async function Body() {
  await connection();
  const t = (await getDictionary()).dotahub;
  const scene = await getGoatScene().catch(() => null);
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
            avatar: p.ps?.photo ?? p.accounts[0].avatar,
            real: realName(p.ps),
            stale: !!p.stale,
            country: p.country,
            role: p.ps?.role ? (p.ps.role <= 3 ? 1 : 2) : p.role,
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
    <Suspense fallback={<LoadingPanel kind="goatPlayers" />}>
      <Body />
    </Suspense>
  );
}
