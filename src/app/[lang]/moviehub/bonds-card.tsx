"use client";
import Link from "next/link";
import { useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { authClient } from "@/lib/auth-client";
import type { Bond } from "@/lib/movies";

export type BondRow = Bond & { userId: string; name: string; image: string | null };
export type BondsProp = { state: "unlinked" | "reauthorize"; rows: [] } | { state: "ready"; rows: BondRow[] };

// 羁绊: people who share a Discord server with you and have a movie profile, with how much of
// what you watched they have watched too (movies and shows per title, anime per season). Each
// row opens that person's statistics. owner: on someone else's page, whose bonds these are (no
// authorize buttons then); viewerId marks the visitor's own row.
export function BondsCard({
  bonds,
  owner = null,
  viewerId = null,
}: {
  bonds: BondsProp;
  owner?: string | null;
  viewerId?: string | null;
}) {
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
        {b.title} <small>{owner ? b.viewingSubtitle(owner) : b.subtitle}</small>
      </h2>
      {owner && bonds.state !== "ready" ? (
        <p className="bonds-empty">
          {bonds.state === "unlinked" ? b.viewingUnlinked(owner) : b.viewingReauthorize(owner)}
        </p>
      ) : bonds.state === "unlinked" ? (
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
        <p className="bonds-empty">{owner ? b.viewingEmpty(owner) : b.empty}</p>
      ) : (
        <ul className="bonds-list">
          {bonds.rows.map((row) => {
            const percent = Math.round(row.total.share * 100);
            const mine = row.userId === viewerId;
            return (
              <li key={row.discordId}>
                <Link
                  href={href(mine ? "/moviehub" : `/moviehub/u/${encodeURIComponent(row.userId)}`)}
                  className="bond"
                >
                  <span className="bond-avatar" aria-hidden="true">
                    {row.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Discord's CDN, no loader
                      <img src={row.image} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      row.name.slice(0, 1)
                    )}
                  </span>
                  <span className="bond-main">
                    <span className="bond-name">
                      {row.name}
                      {mine && <small> · {b.you}</small>}
                    </span>
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
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="note">{owner ? b.viewingHint(owner) : b.hint}</p>
    </section>
  );
}
