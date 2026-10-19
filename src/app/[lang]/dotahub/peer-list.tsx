import Image from "next/image";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getPeers } from "@/lib/dota/data";
import { ago, Notice } from "./parts";

// The people most often on the same team as accountId, by games together.
export async function PeerList({
  t,
  lang,
  accountId,
}: {
  t: Dictionary["dotahub"];
  lang: Locale;
  accountId: number;
}) {
  let peers;
  try {
    peers = await getPeers(accountId);
  } catch {
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
                  <Link
                    href={localePath(lang, `/dotahub/players/${p.account_id}`)}
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
                  </Link>
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
