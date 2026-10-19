import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { DotaUnavailable, getPeers } from "@/lib/dota/data";
import { dotaViewer } from "../account";
import { ago, Notice } from "../parts";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.peers.title };
}

// The people most often on the same team, by games together.
async function Peers() {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const viewer = await dotaViewer();
  if (viewer.state !== "linked")
    return (
      <Notice>
        <Link href={localePath(lang, "/dotahub")} className="underline underline-offset-2">
          {t.connect.title}
        </Link>
      </Notice>
    );
  let peers;
  try {
    peers = await getPeers(viewer.accountId);
  } catch (error) {
    if (!(error instanceof DotaUnavailable)) throw error;
    return <Notice>{t.unavailable}</Notice>;
  }
  const shown = peers
    .filter((p) => p.with_games >= 3)
    .sort((a, b) => b.with_games - a.with_games)
    .slice(0, 50);
  if (!shown.length) return <Notice>{t.peers.empty}</Notice>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-2 font-normal">{t.match.player}</th>
            <th className="px-3 py-2 text-right font-normal">{t.peers.games}</th>
            <th className="px-3 py-2 text-right font-normal">{t.peers.winRate}</th>
            <th className="hidden px-3 py-2 text-right font-normal sm:table-cell">{t.peers.lastPlayed}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => {
            const rate = (p.with_win / p.with_games) * 100;
            return (
              <tr key={p.account_id} className="border-b last:border-0">
                <td className="px-3 py-1.5">
                  <a
                    href={`https://www.opendota.com/players/${p.account_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 hover:underline"
                  >
                    {p.avatarfull ? (
                      <Image
                        src={p.avatarfull}
                        alt=""
                        width={28}
                        height={28}
                        unoptimized
                        className="size-7 rounded-full"
                      />
                    ) : (
                      <span className="size-7 rounded-full bg-muted" />
                    )}
                    <span className="truncate">{p.personaname || p.account_id}</span>
                  </a>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{p.with_games}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{rate.toFixed(0)}%</td>
                <td className="hidden px-3 py-1.5 text-right text-muted-foreground sm:table-cell">
                  {ago(p.last_played, t)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function PeersPage() {
  const t = (await getDictionary()).dotahub.peers;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <Peers />
      </Suspense>
    </div>
  );
}
