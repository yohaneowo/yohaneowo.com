"use client";
import Link from "next/link";
import { useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { authClient } from "@/lib/auth-client";
import type { Bond } from "@/lib/movies";

export type BondRow = Bond & { name: string; image: string | null };
export type BondsProp = { state: "unlinked" | "reauthorize"; rows: [] } | { state: "ready"; rows: BondRow[] };

// 羁绊: people who share a Discord server with you and have a movie profile, with how much of
// what you watched they have watched too (movies and shows per title, anime per season).
export function BondsCard({ bonds }: { bonds: BondsProp }) {
  const { t, href } = useLocale();
  const b = t.profile.bonds;
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function reauthorize() {
    setPending(true);
    setFailed(false);
    const { error } = await authClient.linkSocial({
      provider: "discord",
      scopes: ["identify", "email", "guilds"],
      callbackURL: href("/moviehub"),
      errorCallbackURL: href("/moviehub"),
    });
    if (error) {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <section className="card bonds">
      <h2>
        {b.title} <small>{b.subtitle}</small>
      </h2>
      {bonds.state === "unlinked" ? (
        <div className="bonds-empty">
          <p>{b.unlinked}</p>
          <Link href={href("/connect/discord")} className="bonds-action">
            {b.linkAction}
          </Link>
        </div>
      ) : bonds.state === "reauthorize" ? (
        <div className="bonds-empty">
          <p>{b.reauthorize}</p>
          <button type="button" className="bonds-action" onClick={reauthorize} disabled={pending}>
            {pending ? b.working : b.reauthAction}
          </button>
          {failed && <p className="bonds-error">{b.failed}</p>}
        </div>
      ) : bonds.rows.length === 0 ? (
        <p className="bonds-empty">{b.empty}</p>
      ) : (
        <ul className="bonds-list">
          {bonds.rows.map((row) => {
            const percent = Math.round(row.total.share * 100);
            return (
              <li key={row.discordId} className="bond">
                <span className="bond-avatar" aria-hidden="true">
                  {row.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Discord's CDN, no loader
                    <img src={row.image} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    row.name.slice(0, 1)
                  )}
                </span>
                <span className="bond-main">
                  <span className="bond-name">{row.name}</span>
                  <span className="bond-detail">
                    {b.breakdown(row.movies.common, row.shows.common, row.animeSeasons.common)}
                  </span>
                  <span className="track">
                    <i style={{ width: `${percent}%` }} />
                  </span>
                </span>
                <span className="bond-stat">
                  <span className="num">{row.total.common}</span>
                  <span className="bond-percent num">{percent}%</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="note">{b.hint}</p>
    </section>
  );
}
