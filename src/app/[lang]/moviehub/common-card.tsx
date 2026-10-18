"use client";
import { useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import type { ProfileFilm } from "@/lib/movie-types";

// 共同片单, on someone else's page: the titles of the current tab both people have watched, with
// both ratings side by side, the biggest disagreements first. The taste figure uses the same rule
// as the bonds card (admin's bonds.taste): 100% for matching ratings, 0% from a 4-point gap.
const TASTE_SPREAD = 4;
const TASTE_MIN_PAIRS = 5;
const PAGE = 8;

type Row = { film: ProfileFilm; theirs: number | null; mine: number | null };

function titleOf(film: ProfileFilm, lang: string) {
  return lang === "en" ? film.titleEn || film.title : film.title;
}

export function CommonCard({
  theirs,
  mine,
  subject,
  viewer,
  noun,
}: {
  // The page's list for the current tab (titles, posters) and the visitor's (ids and ratings).
  theirs: ProfileFilm[];
  mine: ProfileFilm[];
  subject: string;
  viewer: string;
  noun: string;
}) {
  const { t, lang } = useLocale();
  const c = t.profile.common;
  const [shown, setShown] = useState(PAGE);
  const myRating = new Map<number, number | null>();
  for (const film of mine) if (!myRating.has(film.id)) myRating.set(film.id, film.myRating);
  const seen = new Set<number>();
  const rows: Row[] = [];
  for (const film of theirs) {
    if (seen.has(film.id) || !myRating.has(film.id)) continue;
    seen.add(film.id);
    rows.push({ film, theirs: film.myRating, mine: myRating.get(film.id) ?? null });
  }
  const both = rows.filter((row) => row.theirs != null && row.mine != null);
  const gap = (row: Row) => Math.abs((row.theirs ?? 0) - (row.mine ?? 0));
  // Rated by both, widest gap first; then the rest in the page's order (newest first).
  const ordered = [...both.sort((a, b) => gap(b) - gap(a)), ...rows.filter((row) => !both.includes(row))];
  const taste =
    both.length >= TASTE_MIN_PAIRS
      ? Math.round(
          Math.max(0, 1 - both.reduce((sum, row) => sum + gap(row), 0) / both.length / TASTE_SPREAD) * 100,
        )
      : null;

  return (
    <section className="card common">
      <h2>
        {c.title} <small>{rows.length ? c.subtitle(rows.length, noun, both.length) : null}</small>
      </h2>
      {rows.length === 0 ? (
        <p className="empty">{c.empty(noun)}</p>
      ) : (
        <>
          {taste != null && (
            <p className="common-taste" title={t.profile.bonds.tasteHint(both.length)}>
              {t.profile.bonds.taste(taste)}
            </p>
          )}
          <div className="common-head" aria-hidden="true">
            <span />
            <span title={subject}>{subject}</span>
            <span title={viewer}>{viewer}</span>
          </div>
          <ul className="common-list">
            {ordered.slice(0, shown).map((row) => {
              const diff = row.theirs != null && row.mine != null ? row.theirs - row.mine : null;
              return (
                <li key={row.film.id} className="common-row">
                  <span className="common-title">
                    {titleOf(row.film, lang)}
                    {row.film.year && <small className="num"> {row.film.year}</small>}
                  </span>
                  <span className="num common-score">{row.theirs ?? "–"}</span>
                  <span
                    className={
                      diff == null || diff === 0
                        ? "num common-score mine"
                        : diff > 0
                          ? "num common-score mine lower"
                          : "num common-score mine higher"
                    }
                  >
                    {row.mine ?? "–"}
                  </span>
                </li>
              );
            })}
          </ul>
          {shown < ordered.length && (
            <button type="button" className="more" onClick={() => setShown((count) => count + PAGE)}>
              {t.profile.more(ordered.length - shown)}
            </button>
          )}
          <p className="note">{c.hint}</p>
        </>
      )}
    </section>
  );
}
