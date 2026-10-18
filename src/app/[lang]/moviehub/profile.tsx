"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";
import { genreName, sourceName, tagName } from "@/i18n/genres";
import { useLocale } from "@/i18n/locale-provider";
import {
  SCORE_SOURCES,
  type AnimeRole,
  personCardSchema,
  studioCardSchema,
  type ListSource,
  type MovieSnapshot,
  type PersonCard,
  type StudioCard as StudioCardData,
  type ProfileFilm,
  type ScoreSource,
  type ShowItem,
  type ShowSection,
} from "@/lib/movie-types";
import { saveScoreSource } from "./actions";
import { BondsCard, type BondsProp } from "./bonds-card";
import type { StyleProfile } from "./compare";
import { CYCLE_ICON, CycleButton, type CycleOption } from "./cycle-button";
import { GenreSunburst } from "./genre-sunburst";
import {
  ANIMATION_GENRES,
  AXES,
  SCORE_LABELS,
  abovePublic,
  dateLabel,
  daysAgo,
  formatSigned,
  genreColor,
  genresOf,
  publicScore,
  ratingOf,
  scoreTone,
  styleOf,
  withoutAnimation,
} from "./stats";
import { useStatisticsRefresh } from "./use-statistics-refresh";
import "./profile.css";

// people: directors (movies), creators (shows) or staff (anime); cast: actors or voice cast.
type Tab = "overview" | "people" | "cast";
type RadarMode = "genre" | "style";
type Media = "movie" | "show" | "anime";
// A movie, or a show (same fields, plus episode progress; director is the creator) or an anime
// series (plus Bangumi / MyAnimeList scores and staff).
type ListItem = ProfileFilm &
  Partial<
    Pick<
      ShowItem,
      | "episodesWatched"
      | "episodesAired"
      | "seasons"
      | "staff"
      | "bangumiId"
      | "bangumiScore"
      | "bangumiVotes"
    > &
      Pick<ShowItem, "malId" | "malScore" | "malVotes">
  >;
type Season = ShowItem["seasons"][number];
type PersonRow = MovieSnapshot["people"][number] | ShowSection["people"][number];
const MEDIA: Media[] = ["movie", "show", "anime"];
// The taste sample: the last 25, the last 100, or everything. The second button alternates
// between 100 and all; picking 25 puts it back to 100.
type WindowSize = 25 | 100 | "all";
type TimeFilter = "all" | "month" | "quarter" | "older";
type AnimeFilter = "all" | "exclude" | "only";
type Filters = { time: TimeFilter; genre: string; anime: AnimeFilter };
const TABS: Tab[] = ["overview", "people", "cast"];
// The anime staff tab shows one role at a time, picked with buttons in this order.
const STAFF_ROLES: AnimeRole[] = ["studio", "original", "director", "music", "chiefAnimationDirector"];
const TIMES: TimeFilter[] = ["all", "month", "quarter", "older"];
// Films only: anime series have their own tab, anime films stay with the films.
const ANIME_FILTERS: AnimeFilter[] = ["all", "exclude", "only"];

// The title in the page's language (TMDB's English title when there is one).
function titleOf(film: { title: string; titleEn?: string | null }, lang: string) {
  return lang === "en" ? film.titleEn || film.title : film.title;
}

function personName(person: { name: string; nameEn?: string | null }, lang: string) {
  return lang === "en" ? person.nameEn || person.name : person.name;
}

const RADAR_CENTER = { x: 160, y: 140 };
const RADAR_RADIUS = 95;

function radarPoint(index: number, count: number, radius: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return [RADAR_CENTER.x + Math.cos(angle) * radius, RADAR_CENTER.y + Math.sin(angle) * radius] as const;
}

type RadarAxis = { label: string; value: number | null; headline: string; detail: string };
// The comparison radar: the viewer's own scores drawn over the profile's, with both names.
type RadarOverlay = { subject: string; name: string; values: (number | null)[]; headlines: string[] };

function Radar({
  axes,
  muted,
  label,
  overlay = null,
}: {
  axes: RadarAxis[];
  muted: boolean;
  label: string;
  overlay?: RadarOverlay | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active == null) return;
    // Touch screens have no mouseleave: a tap elsewhere closes the card.
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setActive(null);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [active]);
  const count = axes.length;
  const at = (index: number, value: number | null) =>
    radarPoint(index, count, RADAR_RADIUS * (Math.max(value ?? 0, 3) / 100));
  const stroke = muted ? "var(--fg-3)" : "var(--gold)";
  const open = (index: number) => ({
    onMouseEnter: () => setActive(index),
    onFocus: () => setActive(index),
    onBlur: () => setActive(null),
    onClick: () => setActive(index),
  });
  const tip = active == null ? null : axes[active];
  const [tipX, tipY] = active == null ? [0, 0] : at(active, axes[active].value);
  return (
    <div className="radar" ref={wrapRef} onMouseLeave={() => setActive(null)}>
      <svg
        viewBox="0 0 320 270"
        width="100%"
        role="img"
        aria-label={`${label}: ${axes.map((axis) => `${axis.label} ${axis.headline}`).join(", ")}`}
      >
        {[0.25, 0.5, 0.75, 1].map((step) => (
          <polygon
            key={step}
            points={axes.map((_, index) => radarPoint(index, count, RADAR_RADIUS * step).join(",")).join(" ")}
            fill="none"
            stroke="var(--line)"
          />
        ))}
        {axes.map((axis, index) => {
          const [x, y] = radarPoint(index, count, RADAR_RADIUS);
          const [labelX, labelY] = radarPoint(index, count, RADAR_RADIUS + 20);
          return (
            <g key={axis.label}>
              <line x1={RADAR_CENTER.x} y1={RADAR_CENTER.y} x2={x} y2={y} stroke="var(--line)" />
              <text
                x={labelX}
                y={labelY + 5}
                textAnchor="middle"
                fill={active === index ? "var(--fg)" : "var(--fg-2)"}
                fontSize="13"
                className="radar-label"
                {...open(index)}
              >
                {axis.label}
              </text>
            </g>
          );
        })}
        <polygon
          points={axes.map((axis, index) => at(index, axis.value).join(",")).join(" ")}
          fill={muted ? "var(--fg-3)" : "var(--gold)"}
          fillOpacity={muted ? 0.16 : 0.22}
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {overlay && (
          <>
            <polygon
              points={axes.map((_, index) => at(index, overlay.values[index]).join(",")).join(" ")}
              fill="var(--compare)"
              fillOpacity={0.12}
              stroke="var(--compare)"
              strokeWidth="2"
              strokeDasharray="5 3"
              strokeLinejoin="round"
              pointerEvents="none"
            />
            {axes.map((axis, index) => {
              const [x, y] = at(index, overlay.values[index]);
              return (
                <circle
                  key={axis.label}
                  cx={x}
                  cy={y}
                  r={active === index ? 4.5 : 3}
                  fill="var(--compare)"
                  stroke="var(--panel)"
                  strokeWidth="1.5"
                  pointerEvents="none"
                />
              );
            })}
          </>
        )}
        {axes.map((axis, index) => {
          const [x, y] = at(index, axis.value);
          return (
            <g key={axis.label}>
              <circle
                cx={x}
                cy={y}
                r={active === index ? 5 : 3.5}
                fill={stroke}
                stroke="#171b22"
                strokeWidth="1.5"
              />
              {/* Each axis owns the slice of the chart around it, so points bunched at the centre
                  never cover each other and the whole area is an easy mouse or finger target. */}
              <polygon
                points={[
                  [RADAR_CENTER.x, RADAR_CENTER.y],
                  radarPoint(index - 0.5, count, RADAR_RADIUS + 34),
                  radarPoint(index, count, RADAR_RADIUS + 34),
                  radarPoint(index + 0.5, count, RADAR_RADIUS + 34),
                ]
                  .map((point) => point.join(","))
                  .join(" ")}
                fill="transparent"
                className="radar-hit"
                tabIndex={0}
                role="button"
                aria-label={`${axis.label} ${axis.headline}`}
                {...open(index)}
              />
            </g>
          );
        })}
      </svg>
      {tip && (
        <div
          className={tipY < RADAR_CENTER.y ? "radar-tip below" : "radar-tip"}
          style={{
            left: `clamp(110px, ${(tipX / 320) * 100}%, calc(100% - 110px))`,
            top: `${(tipY / 270) * 100}%`,
          }}
          role="status"
        >
          <div className="radar-tip-head">
            <span>{tip.label}</span>
            {!overlay && <b className="num">{tip.headline}</b>}
          </div>
          {overlay && active != null && (
            <div className="radar-tip-rows">
              <span className="radar-swatch" aria-hidden="true" />
              <span>{overlay.subject}</span>
              <b className="num">{tip.headline}</b>
              <span className="radar-swatch compare" aria-hidden="true" />
              <span>{overlay.name}</span>
              <b className="num">{overlay.headlines[active]}</b>
            </div>
          )}
          <p>{tip.detail}</p>
        </div>
      )}
    </div>
  );
}

// Brand-coloured text badges; no logo files are loaded from the platforms.
const BADGE_TEXT: Record<ListSource | "rt", string> = {
  imdb: "IMDb",
  tmdb: "TMDB",
  metacritic: "MC",
  rt: "RT",
  bangumi: "BGM",
  mal: "MAL",
};

function SourceBadge({ source }: { source: ListSource | "rt" }) {
  return (
    <span className={`src-badge ${source}`} aria-hidden="true">
      {BADGE_TEXT[source]}
    </span>
  );
}

function nativeScore(film: ListItem, source: ListSource) {
  if (source === "imdb") return film.imdbRating?.toFixed(1) ?? null;
  if (source === "metacritic") return film.metacritic == null ? null : String(film.metacritic);
  if (source === "bangumi") return film.bangumiScore?.toFixed(1) ?? null;
  // MyAnimeList shows two decimals.
  if (source === "mal") return film.malScore?.toFixed(2) ?? null;
  return film.publicScore?.toFixed(1) ?? null;
}

const TIP_GAP = 8;

// A fixed card opens under its anchor and flips above only when its real height would leave the
// viewport. Re-measured whenever `content` changes, since loaded data changes the height.
function usePlaceBelow(
  ref: RefObject<HTMLElement | null>,
  anchorTop: number,
  anchorBottom: number,
  content: unknown,
) {
  useLayoutEffect(() => {
    const card = ref.current;
    if (!card) return;
    const height = card.offsetHeight;
    const below = anchorBottom + TIP_GAP;
    const top = below + height > window.innerHeight - 12 ? Math.max(8, anchorTop - height - TIP_GAP) : below;
    card.style.top = `${top}px`;
  }, [ref, anchorTop, anchorBottom, content]);
}

function anchorLeft(rect: DOMRect, width: number) {
  return Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
}

function DiffChart({ diffs, label }: { diffs: number[]; label: string }) {
  const slot = 300 / diffs.length;
  return (
    <svg viewBox="0 0 320 90" width="100%" role="img" aria-label={label}>
      <line x1="10" y1="45" x2="310" y2="45" stroke="var(--fg-3)" />
      <text x="0" y="12" fill="var(--fg-3)" fontSize="11">
        +4
      </text>
      <text x="0" y="88" fill="var(--fg-3)" fontSize="11">
        −4
      </text>
      {diffs.map((diff, index) => {
        const height = Math.min(40, (Math.abs(diff) / 4) * 40);
        return (
          <rect
            key={index}
            x={10 + index * slot + slot * 0.15}
            y={diff >= 0 ? 45 - height : 45}
            width={Math.max(1, slot * 0.7)}
            height={Math.max(height, 1)}
            fill={diff >= 0 ? "var(--up)" : "var(--down)"}
            rx="1"
          >
            <title>{formatSigned(diff)}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function FilterMenu({
  value,
  active,
  options,
  onChange,
  open,
  onToggle,
}: {
  value: string;
  active: boolean;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const menuId = useId();
  const current = options.find((option) => option.value === value)?.label ?? "";
  return (
    <div className="filter">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        data-active={active}
        onClick={onToggle}
      >
        {current} ▾
      </button>
      {open && (
        <div className="menu" id={menuId} role="menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const TMDB_IMAGE = /^https:\/\/image\.tmdb\.org\/t\/p\/w185\/([A-Za-z0-9._-]+)$/;

// TMDB's full-size file for a w185 poster or profile photo; other hosts' URLs stay as they are.
function clearImageUrl(image: string) {
  const file = image.match(TMDB_IMAGE)?.[1];
  return file ? `https://image.tmdb.org/t/p/original/${file}` : image;
}

// A poster or a person's photo, opened large over the page (falls back to the small file).
// logo: a studio's logo, shown whole on a white card instead of as a photo.
type Lightbox = { key: string; image: string; alt: string; label: string; logo?: boolean };

function ImageOverlay({
  image,
  alt,
  label,
  logo = false,
  onClose,
}: Omit<Lightbox, "key"> & { onClose: () => void }) {
  const { t } = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [src, setSrc] = useState(() => clearImageUrl(image));
  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);
  return (
    <div className="lightbox" onMouseDown={onClose}>
      <div
        className="lightbox-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <Image
          src={src}
          alt={alt}
          width={780}
          height={1170}
          unoptimized
          // Bangumi's image host may turn away other sites' referers.
          referrerPolicy="no-referrer"
          className={logo ? "lightbox-poster logo" : "lightbox-poster"}
          onError={() => setSrc(image)}
        />
        <button
          ref={closeRef}
          type="button"
          className="lightbox-close"
          aria-label={t.profile.close}
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}

type CardSource = "imdb" | "rt" | "tmdb" | "metacritic";
type Platform = CardSource | "bangumi" | "mal";

// Brand colors of the score platforms; the same values color the badges in profile.css.
const PLATFORMS: Record<Platform, Omit<CycleOption<Platform>, "value">> = {
  imdb: { name: "IMDb", short: "IMDb", color: "#f5c518", ink: "#000000" },
  tmdb: { name: "TMDB", short: "TMDB", color: "#01b4e4", ink: "#0d253f" },
  rt: { name: "Rotten Tomatoes", short: "RT", color: "#fa320a", ink: "#ffffff" },
  metacritic: { name: "Metacritic", short: "MC", color: "#66cc33", ink: "#0d1a05" },
  bangumi: { name: "Bangumi", short: "BGM", color: "#f09199", ink: "#2b0f12" },
  mal: { name: "MyAnimeList", short: "MAL", color: "#2e51a2", ink: "#ffffff" },
};
const platformOptions = <T extends Platform>(values: readonly T[], t: Dictionary["profile"]) =>
  values.map((value) => ({
    value,
    ...PLATFORMS[value],
    ...(value === "rt" ? { name: t.rottenTomatoes } : {}),
  })) as CycleOption<T>[];
// The primary score cycles through the comparable platforms only (Rotten Tomatoes is a share of
// positive reviews, not an average); the director card can show all four. Anime add Bangumi and
// MyAnimeList, which most anime fans go by.
const CARD_SOURCES = ["imdb", "rt", "tmdb", "metacritic"] as const;
const ANIME_SOURCES = ["bangumi", "mal", "imdb", "tmdb"] as const;

function cardScore(film: NonNullable<PersonCard["films"]>[number], source: CardSource) {
  if (source === "imdb") return film.imdbRating?.toFixed(1) ?? null;
  if (source === "rt") return film.rottenTomatoes == null ? null : `${film.rottenTomatoes}%`;
  if (source === "metacritic") return film.metacritic == null ? null : String(film.metacritic);
  return film.tmdbRating?.toFixed(1) ?? null;
}

type DirectorTip = {
  key: string;
  name: string;
  personId: number | null;
  photo: string | null;
  // An anime studio (动画制作): the studio card instead of the director card.
  studio?: StudioIds | null;
  left: number;
  // Viewport edges of the hovered name; the card picks its side after measuring itself.
  anchorTop: number;
  anchorBottom: number;
};

type StudioIds = { anilistId: number | null; bangumiId: number | null };

function largerPhoto(photo: string | null) {
  return photo?.replace("/t/p/w185/", "/t/p/w342/") ?? null;
}

function DirectorName({
  name,
  label = name,
  personId,
  photo,
  studio = null,
  pinnedKey,
  onEnter,
  onLeave,
  onPin,
}: {
  // name finds the person (with personId); label is what is shown, in the page's language.
  name: string;
  label?: string;
  personId: number | null;
  photo: string | null;
  studio?: StudioIds | null;
  pinnedKey: string | null;
  onEnter: (tip: DirectorTip) => void;
  onLeave: () => void;
  onPin: (tip: DirectorTip) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const key = studio
    ? `studio:${studio.anilistId ?? ""}:${studio.bangumiId ?? ""}`
    : personId
      ? String(personId)
      : name;
  function locate(): DirectorTip | null {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return null;
    const left = anchorLeft(rect, Math.min(400, window.innerWidth - 24));
    return { key, name, personId, photo, studio, left, anchorTop: rect.top, anchorBottom: rect.bottom };
  }
  function show() {
    const tip = locate();
    if (tip) onEnter(tip);
  }
  function pin() {
    const tip = locate();
    if (tip) onPin(tip);
  }
  return (
    <span
      ref={ref}
      className={pinnedKey === key ? "director pinned" : "director"}
      tabIndex={0}
      aria-expanded={pinnedKey === key}
      onMouseEnter={show}
      onMouseLeave={onLeave}
      onFocus={show}
      onBlur={onLeave}
      onClick={pin}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        pin();
      }}
    >
      {label}
    </span>
  );
}

function DirectorCard({
  tip,
  pinned,
  ratedIds,
  source,
  onSource,
  onClose,
}: {
  tip: DirectorTip;
  pinned: boolean;
  ratedIds: Set<number>;
  source: CardSource;
  onSource: (source: CardSource) => void;
  onClose: () => void;
}) {
  const { t, lang } = useLocale();
  const [detail, setDetail] = useState<PersonCard | null>(null);
  const [failed, setFailed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  // The biography and film list arrive later and change the height.
  usePlaceBelow(cardRef, tip.anchorTop, tip.anchorBottom, detail ?? failed);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (tip.personId) params.set("id", String(tip.personId));
    else params.set("name", tip.name);
    params.set("lang", lang);
    fetch(`/api/moviehub/director?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((data) => {
        const parsed = personCardSchema.safeParse(data);
        if (parsed.success) setDetail(parsed.data);
        else setFailed(true);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, [tip.key, tip.name, tip.personId, lang]);
  const photo = detail?.photo ?? largerPhoto(tip.photo);
  return (
    <div ref={cardRef} className={pinned ? "person-card pinned" : "person-card"} style={{ left: tip.left }}>
      {pinned && (
        <button type="button" className="person-card-close" aria-label={t.profile.close} onClick={onClose}>
          ×
        </button>
      )}
      <div className="person-card-photo">
        {photo ? <Image src={photo} alt="" width={114} height={171} unoptimized /> : tip.name.slice(0, 1)}
      </div>
      <div>
        <div className="t">{detail?.name ?? tip.name}</div>
        <p>
          {detail
            ? detail.biography || t.profile.noBiography
            : failed
              ? t.profile.biographyFailed
              : t.profile.biographyLoading}
        </p>
      </div>
      {detail && (
        <div className="person-card-films">
          <div className="films-head">
            <span className="films-label">
              <span className="label">{t.profile.works}</span>
            </span>
            <CycleButton
              variant="chip"
              label={t.profile.worksSource}
              options={platformOptions(CARD_SOURCES, t.profile)}
              value={source}
              onChange={onSource}
            />
          </div>
          {detail.films == null ? (
            <div className="empty">{t.profile.worksFailed}</div>
          ) : detail.films.length === 0 ? (
            <div className="empty">{t.profile.noWorks}</div>
          ) : (
            <ul>
              {detail.films.map((film) => (
                <li key={film.id}>
                  <span className="num">{film.year ?? "—"}</span>
                  <span className="film-title" title={film.title}>
                    {film.title}
                  </span>
                  <span className="num film-score">{cardScore(film, source) ?? "—"}</span>
                  {/* Rated only: a seen-but-unrated film stays unmarked as a nudge to rate it. */}
                  <span className="rated" title={ratedIds.has(film.id) ? t.profile.rated : undefined}>
                    {ratedIds.has(film.id) ? "✓" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// The studio card: the director card's layout with the studio's logo, Bangumi's description and
// its best-known works, scored on Bangumi or MyAnimeList. ratedAnime holds "a<AniList ID>" and
// "b<Bangumi ID>" for every season of a rated series.
const STUDIO_SOURCES = ["bangumi", "mal"] as const;
type StudioSource = (typeof STUDIO_SOURCES)[number];

function StudioCard({
  tip,
  pinned,
  ratedAnime,
  source,
  onSource,
  onClose,
}: {
  tip: DirectorTip & { studio: StudioIds };
  pinned: boolean;
  ratedAnime: Set<string>;
  source: StudioSource;
  onSource: (source: StudioSource) => void;
  onClose: () => void;
}) {
  const { t, lang } = useLocale();
  const [detail, setDetail] = useState<StudioCardData | null>(null);
  const [failed, setFailed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  usePlaceBelow(cardRef, tip.anchorTop, tip.anchorBottom, detail ?? failed);
  const { anilistId, bangumiId } = tip.studio;
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ lang });
    if (anilistId) params.set("anilistId", String(anilistId));
    if (bangumiId) params.set("bangumiId", String(bangumiId));
    fetch(`/api/moviehub/studio?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((data) => {
        const parsed = studioCardSchema.safeParse(data);
        if (parsed.success) setDetail(parsed.data);
        else setFailed(true);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, [anilistId, bangumiId, lang]);
  const logo = detail?.logo ?? tip.photo;
  const rated = (work: StudioCardData["works"][number]) =>
    (work.anilistId != null && ratedAnime.has(`a${work.anilistId}`)) ||
    (work.bangumiId != null && ratedAnime.has(`b${work.bangumiId}`));
  const score = (work: StudioCardData["works"][number]) => {
    const value = source === "bangumi" ? work.bangumiScore : work.malScore;
    return value == null ? null : value.toFixed(source === "mal" ? 2 : 1);
  };
  return (
    <div ref={cardRef} className={pinned ? "person-card pinned" : "person-card"} style={{ left: tip.left }}>
      {pinned && (
        <button type="button" className="person-card-close" aria-label={t.profile.close} onClick={onClose}>
          ×
        </button>
      )}
      <div className="person-card-photo logo">
        {logo ? (
          <Image src={logo} alt="" width={114} height={171} unoptimized referrerPolicy="no-referrer" />
        ) : (
          tip.name.slice(0, 1)
        )}
      </div>
      <div>
        <div className="t">{detail?.name ?? tip.name}</div>
        <p>
          {detail
            ? detail.description || t.profile.studioNoDescription
            : failed
              ? t.profile.biographyFailed
              : t.profile.biographyLoading}
        </p>
      </div>
      {detail && (
        <div className="person-card-films">
          <div className="films-head">
            <span className="films-label">
              <span className="label">{t.profile.works}</span>
            </span>
            <CycleButton
              variant="chip"
              label={t.profile.worksSource}
              options={platformOptions(STUDIO_SOURCES, t.profile)}
              value={source}
              onChange={onSource}
            />
          </div>
          {detail.works.length === 0 ? (
            <div className="empty">{t.profile.studioNoWorks}</div>
          ) : (
            <ul>
              {detail.works.map((work) => (
                <li key={`${work.anilistId ?? ""}-${work.bangumiId ?? ""}`}>
                  <span className="num">{work.year ?? "—"}</span>
                  <span className="film-title" title={work.title}>
                    {work.title}
                  </span>
                  <span className="num film-score">{score(work) ?? "—"}</span>
                  <span className="rated" title={rated(work) ? t.profile.rated : undefined}>
                    {rated(work) ? "✓" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

type ScoreTip = {
  key: string;
  film: ListItem;
  anime: boolean;
  left: number;
  anchorTop: number;
  anchorBottom: number;
  pinned: boolean;
};

function ScoreCard({ tip, source }: { tip: ScoreTip; source: ListSource }) {
  const { t, lang } = useLocale();
  const cardRef = useRef<HTMLDivElement>(null);
  usePlaceBelow(cardRef, tip.anchorTop, tip.anchorBottom, tip.film);
  const { film } = tip;
  const votes = (count: number | null | undefined) => (count != null ? t.profile.votes(count) : undefined);
  const imdb = {
    key: "imdb",
    name: "IMDb",
    value: nativeScore(film, "imdb"),
    extra: votes(film.imdbVotes),
  } as const;
  const tmdb = { key: "tmdb", name: "TMDB", value: nativeScore(film, "tmdb") } as const;
  const rows: { key: ListSource | "rt"; name: string; value: string | null; extra?: string }[] = tip.anime
    ? [
        {
          key: "bangumi",
          name: "Bangumi",
          value: nativeScore(film, "bangumi"),
          extra: votes(film.bangumiVotes),
        },
        { key: "mal", name: "MyAnimeList", value: nativeScore(film, "mal"), extra: votes(film.malVotes) },
        imdb,
        tmdb,
      ]
    : [
        imdb,
        {
          key: "rt",
          name: t.profile.rottenTomatoes,
          value: film.rottenTomatoes == null ? null : `${film.rottenTomatoes}%`,
        },
        { key: "metacritic", name: "Metacritic", value: nativeScore(film, "metacritic") },
        tmdb,
      ];
  const links = [
    film.bangumiId ? { name: "Bangumi", url: `https://bgm.tv/subject/${film.bangumiId}` } : null,
    film.malId ? { name: "MyAnimeList", url: `https://myanimelist.net/anime/${film.malId}` } : null,
    film.imdbId ? { name: "IMDb", url: `https://www.imdb.com/title/${film.imdbId}/` } : null,
  ].filter((link) => link != null);
  return (
    <div
      ref={cardRef}
      className={tip.pinned ? "score-card pinned" : "score-card"}
      style={{ left: tip.left }}
      role="dialog"
      aria-label={t.profile.publicScores(titleOf(film, lang))}
    >
      <div className="t">{titleOf(film, lang)}</div>
      <ul>
        {rows.map((row) => (
          <li key={row.key} className={row.key === source ? "on" : undefined}>
            <SourceBadge source={row.key} />
            <span>{row.name}</span>
            <b className="num">{row.value ?? "—"}</b>
            {row.extra && <small>{row.extra}</small>}
          </li>
        ))}
      </ul>
      {!tip.anime && (
        <p>
          {source === "metacritic" ? t.profile.metacriticNote : ""}
          {t.profile.rtNote}
        </p>
      )}
      {links.length > 0 && (
        <div className="score-links">
          {links.map((link) => (
            <a key={link.name} href={link.url} target="_blank" rel="noreferrer">
              {t.profile.viewOn(link.name)}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function WatchRow({
  film,
  today,
  people,
  onOpenPoster,
  onDirectorEnter,
  onDirectorLeave,
  onDirectorPin,
  pinnedKey,
  source,
  scoreKey,
  onScoreEnter,
  onScoreLeave,
  onScorePin,
  media,
}: {
  film: ListItem;
  today: string;
  people: PersonRow[];
  onOpenPoster: (film: ProfileFilm) => void;
  onDirectorEnter: (tip: DirectorTip) => void;
  onDirectorLeave: () => void;
  onDirectorPin: (tip: DirectorTip) => void;
  pinnedKey: string | null;
  source: ListSource;
  scoreKey: string | null;
  onScoreEnter: (tip: ScoreTip) => void;
  onScoreLeave: () => void;
  onScorePin: (tip: ScoreTip) => void;
  media: Media;
}) {
  const { t, lang } = useLocale();
  const scoreRef = useRef<HTMLButtonElement>(null);
  const seasonsId = useId();
  // Shows open to their seasons: each season has its own rating, apart from the show's.
  const [open, setOpen] = useState(false);
  const series = media !== "movie";
  const seasons = series ? (film.seasons ?? []) : [];
  const title = titleOf(film, lang);
  // Anime: the director from Bangumi / AniList; other shows: TMDB's (first) creator.
  const animeDirector = film.staff?.find((person) => person.role === "director");
  const maker =
    media === "anime"
      ? animeDirector
        ? personName(animeDirector, lang)
        : null
      : lang === "en"
        ? film.directorEn || film.director
        : film.director;
  const key = `${film.id}-${film.watchedAt}`;
  const shown = publicScore(film, source);
  const comparable = film.myRating != null && shown != null;
  const diff = comparable ? film.myRating! - shown! : 0;
  function locate(pinned: boolean): ScoreTip | null {
    const rect = scoreRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const left = anchorLeft(rect, Math.min(260, window.innerWidth - 24));
    return {
      key,
      film,
      anime: media === "anime",
      left,
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
      pinned,
    };
  }
  const tone = film.myRating == null ? "eq" : comparable ? scoreTone(diff) : "eq";
  const width = Math.min(50, (Math.abs(diff) / 4) * 50);
  const positive = diff >= 0;
  const ago = daysAgo(film.watchedAt, today);
  return (
    <div
      // cn(): Prettier's class sorting trims the space out of `row expandable${" open"}`.
      className={cn("row", seasons.length > 0 && "expandable", seasons.length > 0 && open && "open")}
      onClick={(event) => {
        // The poster, scores and names keep their own clicks.
        if (!seasons.length || (event.target as Element).closest("button, a, .director")) return;
        setOpen((value) => !value);
      }}
    >
      {film.poster ? (
        <button
          type="button"
          className="poster"
          style={{ background: genreColor(film.genre) }}
          aria-label={t.profile.poster(title)}
          onClick={() => onOpenPoster(film)}
        >
          <Image src={film.poster} alt="" width={34} height={48} unoptimized />
        </button>
      ) : (
        <div className="poster" style={{ background: genreColor(film.genre) }} aria-hidden="true">
          {title.slice(0, 1)}
        </div>
      )}
      <div className="title">
        <div className="t">{title}</div>
        <div className={seasons.length ? "m with-seasons" : "m"}>
          <span className="m-text">
            {[
              film.year,
              series ? maker : null,
              media === "movie" && film.director ? (
                <DirectorName
                  key="director"
                  name={film.director}
                  label={lang === "en" ? film.directorEn || film.director : film.director}
                  personId={
                    film.directorId ??
                    people.find((person) => person.role === "director" && person.name === film.director)
                      ?.id ??
                    null
                  }
                  photo={
                    people.find((person) => person.role === "director" && person.name === film.director)
                      ?.photo ?? null
                  }
                  pinnedKey={pinnedKey}
                  onEnter={onDirectorEnter}
                  onLeave={onDirectorLeave}
                  onPin={onDirectorPin}
                />
              ) : null,
              film.genre ? genreName(film.genre, lang) : null,
              // Anime: where it was adapted from and its top AniList tags.
              film.source ? sourceName(film.source, lang) : null,
              film.tags.length
                ? film.tags
                    .slice(0, 3)
                    .map((tag) => tagName(tag, lang))
                    .join(" / ")
                : null,
              series && film.episodesWatched != null
                ? t.profile.episodes(
                    film.episodesWatched,
                    film.episodesAired == null ? "?" : String(film.episodesAired),
                  )
                : null,
            ]
              .filter((part) => part != null && part !== "")
              .map((part, index) => (
                <span key={index}>
                  {index > 0 && " · "}
                  {part}
                </span>
              ))}
          </span>
          {/* Outside the text so a narrow row never cuts it off. */}
          {seasons.length > 0 && (
            <button
              type="button"
              className="season-toggle"
              aria-expanded={open}
              aria-controls={seasonsId}
              onClick={() => setOpen((value) => !value)}
            >
              {t.profile.seasonCount(seasons.length)}
              <span aria-hidden="true">▾</span>
            </button>
          )}
        </div>
      </div>
      <div className={`score num ${tone}`}>{film.myRating == null ? "—" : film.myRating.toFixed(0)}</div>
      <button
        ref={scoreRef}
        type="button"
        className={scoreKey === key ? "pub pinned" : "pub"}
        aria-label={t.profile.scoreButton(
          SCORE_LABELS[source],
          nativeScore(film, source) ?? t.profile.noScore,
        )}
        aria-expanded={scoreKey === key}
        onMouseEnter={() => {
          const tip = locate(false);
          if (tip) onScoreEnter(tip);
        }}
        onMouseLeave={onScoreLeave}
        onClick={() => {
          const tip = locate(true);
          if (tip) onScorePin(tip);
        }}
      >
        <SourceBadge source={source} />
        <span className="num">{nativeScore(film, source) ?? "—"}</span>
      </button>
      <div className="diff">
        {comparable ? (
          <>
            <span className="num" style={{ color: positive ? "var(--up)" : "var(--down)" }}>
              {formatSigned(diff)}
            </span>
            <div className="bar" aria-hidden="true">
              <i
                style={{
                  background: positive ? "var(--up)" : "var(--down)",
                  width: `${width}%`,
                  ...(positive ? { left: "50%" } : { right: "50%" }),
                }}
              />
            </div>
          </>
        ) : (
          <span className="num">—</span>
        )}
      </div>
      <div className="when">
        {ago >= 0 && ago < 7 ? t.profile.daysAgo(ago) : dateLabel(film.watchedAt, t.profile)}
        <b>{film.myRating == null ? t.profile.unrated : t.profile.rated}</b>
      </div>
      {open && (
        <ol className="seasons" id={seasonsId} aria-label={t.profile.seasonsOf(title)}>
          {seasons.map((season) => {
            const [badge, score] = seasonScore(season, media === "anime" ? source : "tmdb");
            return (
              <li key={season.number}>
                <span className="sn">{seasonTitle(season, lang, t.profile)}</span>
                <span className="sm">
                  {[
                    season.episodes != null ? t.profile.seasonEpisodes(season.episodes) : null,
                    season.airDate?.slice(0, 4),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="sp num" title={SCORE_LABELS[badge]}>
                  <SourceBadge source={badge} />
                  {score ?? "—"}
                </span>
                <span className={season.myRating == null ? "sr" : "sr rated num"}>
                  {season.myRating == null ? t.profile.unrated : season.myRating.toFixed(0)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// A season's name: Bangumi's Chinese or AniList's English title for anime, else TMDB's.
function seasonTitle(season: Season, lang: string, t: Dictionary["profile"]) {
  const own = lang === "en" ? season.titleEn : season.titleZh;
  return own || season.name || t.season(season.number);
}

// A season's score on the anime platform in use (TMDB for other platforms and other shows).
function seasonScore(season: Season, source: ListSource): [ListSource, string | null] {
  if (source === "bangumi") return ["bangumi", season.bangumiScore?.toFixed(1) ?? null];
  if (source === "mal") return ["mal", season.malScore?.toFixed(2) ?? null];
  return ["tmdb", season.publicScore?.toFixed(1) ?? null];
}

// With cacheComponents, Next keeps a page it navigated away from (hidden, state intact) and shows
// it again on return. Keying on bfcacheId starts the page fresh (style radar, first tab, no
// filters) each time a link opens it, while the back button still restores where it was.
export function MovieProfile(props: React.ComponentProps<typeof ProfileView>) {
  const { bfcacheId } = useRouter();
  return <ProfileView key={bfcacheId} {...props} />;
}

function ProfileView({
  name,
  avatar = null,
  notice = null,
  bonds = null,
  traktUser,
  region,
  syncedAt,
  syncError,
  waiting,
  poll,
  watchedCount: movieWatchedCount,
  plays: moviePlays,
  showMean,
  showRatingCount,
  mean: movieMean,
  distribution: movieDistribution,
  sampleCount: movieSampleCount,
  genres: movieGenres,
  films: movieFilms,
  people: moviePeople,
  today,
  ratedIds,
  depth: movieDepth,
  depthGroups: movieDepthGroups,
  watchedPercentile: movieWatchedPercentile,
  platformUsers: moviePlatformUsers,
  scoreSource,
  shows = null,
  showsPercentile = null,
  showUsers = 0,
  anime = null,
  animePercentile = null,
  animeUsers = 0,
  viewing = null,
}: {
  name: string;
  avatar?: string | null;
  // Rendered under the hero: the "connect Trakt" prompt for profiles without a token.
  notice?: React.ReactNode;
  // 羁绊 (people sharing a Discord server), or null when the server could not compute them.
  bonds?: BondsProp | null;
  traktUser: string;
  region: string;
  syncedAt: string | null;
  syncError: string | null;
  waiting: boolean;
  poll: boolean;
  watchedCount: number;
  plays: number;
  showMean: number | null;
  showRatingCount: number;
  mean: number | null;
  distribution: number[];
  sampleCount: number;
  genres: MovieSnapshot["genres"];
  films: ProfileFilm[];
  people: MovieSnapshot["people"];
  today: string;
  ratedIds: number[];
  depth: number | null;
  depthGroups: number;
  watchedPercentile: number | null;
  platformUsers: number;
  scoreSource: ScoreSource;
  shows?: ShowSection | null;
  showsPercentile?: number | null;
  showUsers?: number;
  anime?: ShowSection | null;
  animePercentile?: number | null;
  animeUsers?: number;
  // Someone else's page: who it belongs to (their website name), the visitor's own style data
  // for the comparison radar (null when signed out or without statistics), and whether a new
  // score platform is saved as the visitor's preference.
  viewing?: {
    subject: string;
    compare: StyleProfile | null;
    saveSource: boolean;
    viewerId: string | null;
  } | null;
}) {
  const { t, lang } = useLocale();
  const { pending, message, refresh } = useStatisticsRefresh({ poll, checkOnly: waiting });
  const [source, setSource] = useState(scoreSource);
  // Anime: Bangumi on the Chinese page, MyAnimeList on the English one, until the user cycles.
  const [animeSource, setAnimeSource] = useState<ListSource>(lang === "zh" ? "bangumi" : "mal");
  const [sourceError, setSourceError] = useState("");
  const [radarMode, setRadarMode] = useState<RadarMode>("style");
  const [comparing, setComparing] = useState(false);
  const [staffRole, setStaffRole] = useState<AnimeRole>("studio");
  // The director card's score column; kept while moving between directors.
  const [cardSource, setCardSource] = useState<CardSource>("imdb");
  // The studio card's score column: Bangumi on the Chinese page, MyAnimeList on the English one.
  const [studioSource, setStudioSource] = useState<StudioSource>(lang === "zh" ? "bangumi" : "mal");
  const ratedAnime = useMemo(
    () =>
      new Set(
        (anime?.items ?? [])
          .filter((item) => item.myRating != null || item.seasons.some((season) => season.myRating != null))
          .flatMap((item) =>
            item.seasons.flatMap((season) => [
              ...(season.anilistId ? [`a${season.anilistId}`] : []),
              ...(season.bangumiId ? [`b${season.bangumiId}`] : []),
            ]),
          ),
      ),
    [anime],
  );
  const ratedSet = useMemo(() => new Set(ratedIds), [ratedIds]);
  const [scoreTip, setScoreTip] = useState<ScoreTip | null>(null);
  const scoreTimer = useRef<number | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [filters, setFilters] = useState<Filters>({ time: "all", genre: "all", anime: "all" });
  const [openFilter, setOpenFilter] = useState<keyof Filters | null>(null);
  const [windowSize, setWindowSize] = useState<WindowSize>(25);
  const [shown, setShown] = useState(12);
  // Films, shows or anime series: everything below reads the chosen set.
  const [media, setMedia] = useState<Media>("movie");
  const section = media === "show" ? shows : media === "anime" ? anime : null;
  const isShow = section != null;
  const words = t.profile.words[isShow ? media : "movie"];
  const mediaOptions = MEDIA.filter((value) => value === "movie" || (value === "show" ? shows : anime));
  const listSource: ListSource = media === "anime" ? animeSource : source;
  // On the anime tab "Animation" is every title's genre, so it is dropped from rows and charts.
  const films: ListItem[] = useMemo(
    () => (isShow ? (media === "anime" ? section.items.map(withoutAnimation) : section.items) : movieFilms),
    [isShow, media, section, movieFilms],
  );
  const people: PersonRow[] = isShow ? section.people : moviePeople;
  const genres = isShow
    ? media === "anime"
      ? section.genres.filter((row) => !ANIMATION_GENRES.has(row.name))
      : section.genres
    : movieGenres;
  const distribution = isShow ? section.distribution : movieDistribution;
  const mean = isShow ? section.mean : movieMean;
  const watchedCount = isShow ? section.watchedCount : movieWatchedCount;
  const plays = isShow ? section.episodes : moviePlays;
  const sampleCount = isShow ? section.items.length : movieSampleCount;
  const [lightbox, setLightbox] = useState<Lightbox | null>(null);
  const openPoster = useCallback(
    (film: ProfileFilm) => {
      if (!film.poster) return;
      const title = titleOf(film, lang);
      setLightbox({
        key: `film-${film.id}-${film.watchedAt}`,
        image: film.poster,
        alt: title,
        label: t.profile.posterOf(title),
      });
    },
    [lang, t],
  );
  const [directorTip, setDirectorTip] = useState<DirectorTip | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const directorTimer = useRef<number | null>(null);
  const pinnedKeyRef = useRef<string | null>(null);
  const suppressHover = useRef(false);
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const closeDirector = useCallback(() => {
    if (directorTimer.current) window.clearTimeout(directorTimer.current);
    pinnedKeyRef.current = null;
    setPinnedKey(null);
    setDirectorTip(null);
  }, []);
  const showDirector = useCallback((tip: DirectorTip) => {
    if (pinnedKeyRef.current || suppressHover.current) return;
    if (directorTimer.current) window.clearTimeout(directorTimer.current);
    setDirectorTip(tip);
  }, []);
  const hideDirector = useCallback(() => {
    suppressHover.current = false;
    if (pinnedKeyRef.current) return;
    if (directorTimer.current) window.clearTimeout(directorTimer.current);
    directorTimer.current = window.setTimeout(() => setDirectorTip(null), 220);
  }, []);
  const pinDirector = useCallback((tip: DirectorTip) => {
    if (directorTimer.current) window.clearTimeout(directorTimer.current);
    if (pinnedKeyRef.current === tip.key) {
      pinnedKeyRef.current = null;
      setPinnedKey(null);
      setDirectorTip(null);
      suppressHover.current = true;
      return;
    }
    pinnedKeyRef.current = tip.key;
    setPinnedKey(tip.key);
    setDirectorTip(tip);
  }, []);
  useEffect(() => {
    if (!directorTip) return;
    const close = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".person-card")) return;
      closeDirector();
    };
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [directorTip, closeDirector]);
  useEffect(() => {
    if (!pinnedKey) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(".person-card-close, .person-card p, .person-card .t, .person-card-films, .director")
      )
        return;
      const card = target.closest(".person-card");
      if (card instanceof HTMLElement) {
        const previous = card.style.pointerEvents;
        card.style.pointerEvents = "none";
        const under = document.elementFromPoint(event.clientX, event.clientY);
        card.style.pointerEvents = previous;
        const name = under instanceof Element ? under.closest(".director") : null;
        if (name instanceof HTMLElement) name.click();
        return;
      }
      closeDirector();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDirector();
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [pinnedKey, closeDirector]);
  // Public score card: hover previews it, a click (or a tap on touch screens) pins it.
  const showScore = useCallback((tip: ScoreTip) => {
    if (scoreTimer.current) window.clearTimeout(scoreTimer.current);
    setScoreTip((current) => (current?.pinned ? current : tip));
  }, []);
  const hideScore = useCallback(() => {
    if (scoreTimer.current) window.clearTimeout(scoreTimer.current);
    scoreTimer.current = window.setTimeout(
      () => setScoreTip((current) => (current?.pinned ? current : null)),
      150,
    );
  }, []);
  const pinScore = useCallback((tip: ScoreTip) => {
    if (scoreTimer.current) window.clearTimeout(scoreTimer.current);
    setScoreTip((current) => (current?.pinned && current.key === tip.key ? null : tip));
  }, []);
  useEffect(() => {
    if (!scoreTip) return;
    const close = () => setScoreTip(null);
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (scoreTip.pinned && target instanceof Element && !target.closest(".score-card, .pub")) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [scoreTip]);

  async function changeSource(next: ListSource) {
    // The anime platform isn't saved: its default follows the language.
    if (media === "anime") {
      setAnimeSource(next);
      return;
    }
    if (next === source || !(SCORE_SOURCES as readonly string[]).includes(next)) return;
    const chosen = next as ScoreSource;
    const previous = source;
    setSource(chosen);
    setSourceError("");
    if (viewing && !viewing.saveSource) return;
    try {
      const result = await saveScoreSource(chosen);
      if (result.error) {
        setSource(previous);
        setSourceError(t.movies.errors[result.error]);
      }
    } catch {
      setSource(previous);
      setSourceError(t.movies.errors.saveFailed);
    }
  }

  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openFilter) return;
    const onPointer = (event: PointerEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) setOpenFilter(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFilter(null);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [openFilter]);

  const keep = (film: ListItem) => {
    const ago = daysAgo(film.watchedAt, today);
    if (filters.time === "month" && ago > 30) return false;
    if (filters.time === "quarter" && ago > 90) return false;
    if (filters.time === "older" && ago <= 90) return false;
    if (filters.genre !== "all" && !genresOf(film).includes(filters.genre)) return false;
    if (!isShow && filters.anime === "exclude" && film.anime) return false;
    if (!isShow && filters.anime === "only" && !film.anime) return false;
    return true;
  };
  const filtered = films.filter(keep);
  const windowOf = (items: ListItem[]) => (windowSize === "all" ? items : items.slice(0, windowSize));
  const sample = windowOf(filtered);
  // The KPI counts what the filters leave; unfiltered (or from an older snapshot without plays) it
  // shows the totals, which also cover anything past the list's length limit.
  const filtering = filters.time !== "all" || filters.genre !== "all" || filters.anime !== "all";
  const countFiltered = filtering && filtered.every((film) => film.plays != null);
  const shownWatched = countFiltered ? filtered.filter((film) => film.plays! > 0).length : watchedCount;
  const shownPlays = countFiltered ? filtered.reduce((sum, film) => sum + film.plays!, 0) : plays;
  const sourceLabel = SCORE_LABELS[listSource];
  const genreLabel = (genre: string) => genreName(genre, lang);
  // Shows: 深度 is how much of each show in the window was watched (episode plays over aired).
  const styleFor = (
    items: ListItem[],
    who: {
      depth: number | null;
      depthGroups: number;
      percentile: number | null;
      watched: number;
      users: number;
    },
  ) => {
    const withProgress = items.filter((item) => item.episodesAired);
    return styleOf(items, {
      kind: isShow ? "show" : "movie",
      noun: words.noun,
      source: listSource,
      genreLabel,
      t: t.style,
      depth: isShow
        ? withProgress.length
          ? withProgress.reduce(
              (sum, item) => sum + Math.min(1, (item.episodesWatched ?? 0) / item.episodesAired!),
              0,
            ) / withProgress.length
          : null
        : who.depth,
      depthGroups: isShow ? withProgress.length : who.depthGroups,
      watchedPercentile: who.percentile,
      watchedCount: who.watched,
      platformUsers: who.users,
    });
  };
  const style = styleFor(sample, {
    depth: movieDepth,
    depthGroups: movieDepthGroups,
    percentile:
      media === "show" ? showsPercentile : media === "anime" ? animePercentile : movieWatchedPercentile,
    watched: watchedCount,
    users: media === "show" ? showUsers : media === "anime" ? animeUsers : moviePlatformUsers,
  });
  // The visitor's own style under the same tab, filters, window and platform.
  const mine = viewing?.compare ?? null;
  const mineItems: ListItem[] | null = !mine
    ? null
    : media === "show"
      ? mine.shows
      : media === "anime"
        ? (mine.anime?.map(withoutAnimation) ?? null)
        : mine.films;
  const mineStyle =
    mine && mineItems?.length
      ? styleFor(windowOf(mineItems.filter(keep)), {
          depth: mine.depth,
          depthGroups: mine.depthGroups,
          percentile: mine.percentile[media],
          watched: mine.watched[media],
          users: mine.users[media],
        })
      : null;
  const overlay =
    comparing && mine && mineStyle && viewing
      ? {
          subject: viewing.subject,
          name: mine.name,
          values: mineStyle.scores,
          headlines: mineStyle.scores.map((score) =>
            score == null ? "—" : `${(score / 10).toFixed(1)} / 10`,
          ),
        }
      : null;
  const rating = films.length ? ratingOf(sample, listSource) : null;
  // An empty or unrated sample falls back to the all-time distribution.
  const sampleRating = rating?.mine != null ? rating : null;
  const comparison = abovePublic(filtered, listSource);
  const shortSample = sample.length > 0 && sample.length < 20;
  const genreOptions = [...new Set(films.flatMap(genresOf))];
  const fallbackGenres = [...genres].sort((a, b) => b.count - a.count).slice(0, 5);
  // Anime staff: one role at a time, only roles with someone in them get a button. The chosen
  // role falls back to the first one with people (studio when there is any).
  const staffTab = media === "anime" && tab === "people";
  const staffCounts = STAFF_ROLES.map(
    (role) => [role, people.filter((person) => person.role === role).length] as const,
  ).filter(([, count]) => count > 0);
  const activeStaff = staffCounts.some(([role]) => role === staffRole)
    ? staffRole
    : (staffCounts[0]?.[0] ?? "studio");
  const roles: PersonRow["role"][] =
    tab === "cast" ? ["cast"] : media === "anime" ? [activeStaff] : [isShow ? "creator" : "director"];
  const peopleForTab = people.filter((person) => roles.includes(person.role));
  const tabLabel = (item: Tab) =>
    item === "overview"
      ? t.profile.tabs.overview
      : item === "cast"
        ? media === "anime"
          ? t.profile.tabs.voice
          : t.profile.tabs.cast
        : media === "anime"
          ? t.profile.tabs.staff
          : isShow
            ? t.profile.tabs.creator
            : t.profile.tabs.director;
  const sourceOptions = platformOptions(media === "anime" ? ANIME_SOURCES : SCORE_SOURCES, t.profile);

  function changeMedia(next: Media) {
    setMedia(next);
    setTab("overview");
    // Genres differ between the lists; start each from the top.
    setFilters({ time: "all", genre: "all", anime: "all" });
    setShown(12);
    closeDirector();
  }

  const setFilter = <Key extends keyof Filters>(key: Key, value: Filters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setShown(12);
    setOpenFilter(null);
  };

  return (
    <div className="profile">
      <header className="hero">
        <div className="hero-in">
          <div className="avatar" aria-hidden="true">
            {avatar ? (
              // Trakt's CDN refuses hotlinks that carry a referer, so none is sent.
              // eslint-disable-next-line @next/next/no-img-element -- Trakt's CDN, no loader
              <img
                src={avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              name.slice(0, 1)
            )}
          </div>
          <div className="identity">
            <h1 className="name">{name}</h1>
            <div className="sub">
              <a
                href={`https://trakt.tv/users/${encodeURIComponent(traktUser)}`}
                target="_blank"
                rel="noreferrer"
              >
                Trakt
              </a>
              {" · "}
              {region}
              {" · "}
              {syncedAt ? t.profile.updatedAt(syncedAt) : t.profile.firstSync}
              {showRatingCount > 0 && showMean != null ? ` · ${t.profile.showMean(showMean.toFixed(1))}` : ""}
            </div>
            {waiting && !viewing && (
              <p className="sub" role="status">
                {poll ? t.profile.syncing : t.profile.waiting}
              </p>
            )}
            {syncError && !viewing && (
              <p className="sub" role="status">
                {syncError}
              </p>
            )}
            {message && (
              <p className="sub" role="status">
                {message}
              </p>
            )}
          </div>
          {!viewing && (
            <button type="button" className="refresh" disabled={pending} onClick={refresh}>
              {pending
                ? t.movies.refresh.checking
                : waiting
                  ? t.movies.refresh.progress
                  : t.movies.refresh.update}
            </button>
          )}
          <nav className="tabs" aria-label={t.profile.pageSections}>
            {mediaOptions.length > 1 && (
              <span className="toggle media-toggle" role="group" aria-label={t.profile.mediaGroup}>
                {mediaOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={media === value ? "on" : undefined}
                    aria-pressed={media === value}
                    onClick={() => changeMedia(value)}
                  >
                    {t.profile.media[value]}
                  </button>
                ))}
              </span>
            )}
            {TABS.map((item) => (
              <button
                key={item}
                type="button"
                className={tab === item ? "on" : undefined}
                aria-current={tab === item ? "page" : undefined}
                onClick={() => setTab(item)}
              >
                {tabLabel(item)}
              </button>
            ))}
          </nav>
        </div>
      </header>
      {notice}

      <div className="wrap">
        <div className="filters" ref={filtersRef}>
          <FilterMenu
            value={filters.time}
            active={filters.time !== "all"}
            options={TIMES.map((value) => ({ value, label: t.profile.time[value] }))}
            open={openFilter === "time"}
            onToggle={() => setOpenFilter((current) => (current === "time" ? null : "time"))}
            onChange={(value) => setFilter("time", value as TimeFilter)}
          />
          <FilterMenu
            value={filters.genre}
            active={filters.genre !== "all"}
            options={[
              { value: "all", label: t.profile.allGenres },
              ...genreOptions.map((genre) => ({ value: genre, label: genreLabel(genre) })),
            ]}
            open={openFilter === "genre"}
            onToggle={() => setOpenFilter((current) => (current === "genre" ? null : "genre"))}
            onChange={(value) => setFilter("genre", value)}
          />
          {!isShow && films.some((film) => film.anime) && (
            <FilterMenu
              value={filters.anime}
              active={filters.anime !== "all"}
              options={ANIME_FILTERS.map((value) => ({ value, label: t.profile.animeFilter[value] }))}
              open={openFilter === "anime"}
              onToggle={() => setOpenFilter((current) => (current === "anime" ? null : "anime"))}
              onChange={(value) => setFilter("anime", value as AnimeFilter)}
            />
          )}
        </div>

        <section className="kpis" aria-label={t.profile.overview}>
          <div className="kpi">
            <div className="kpi-top">
              <span>
                <span className="kpi-v num" style={{ color: "var(--gold)" }}>
                  {shownWatched.toLocaleString("en-US")}
                </span>{" "}
                <span className="kpi-l">{words.watched}</span>
              </span>
              <span className="kpi-l">
                {t.profile.plays(shownPlays.toLocaleString("en-US"), words.plays)}
                {films.length ? "" : t.profile.sample(sampleCount)}
              </span>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-top">
              <span>
                <span className="kpi-l">{t.profile.above(sourceLabel)}</span>
                <span className="kpi-v num" style={{ color: "var(--up)" }}>
                  {comparison.total ? `${comparison.percent}%` : "–"}
                </span>
              </span>
              <span className="kpi-l num">
                {comparison.total
                  ? t.profile.aboveSplit(comparison.up, comparison.total - comparison.up)
                  : t.profile.aboveEmpty(sourceLabel)}
              </span>
            </div>
            <div className="split" aria-hidden="true">
              <i style={{ width: `${comparison.percent}%` }} />
            </div>
          </div>
        </section>

        <div className="grid">
          <section className="card" aria-label={tab === "overview" ? words.heading : tabLabel(tab)}>
            {tab === "overview" ? (
              <>
                <h2 className="wrap-h">
                  <span>
                    {words.heading} <small>{t.profile.newestFirst}</small>
                  </span>
                  <CycleButton
                    key={media === "anime" ? "anime" : "list"}
                    label={t.profile.scoreSource}
                    options={sourceOptions}
                    value={listSource}
                    onChange={changeSource}
                  />
                </h2>
                {sourceError && (
                  <p className="note" role="alert">
                    {sourceError}
                  </p>
                )}
                {films.length === 0 ? (
                  <p className="empty">{t.profile.noFilmsYet}</p>
                ) : filtered.length === 0 ? (
                  <p className="empty">{t.profile.nothingFiltered}</p>
                ) : (
                  filtered
                    .slice(0, shown)
                    .map((film) => (
                      <WatchRow
                        key={`${film.id}-${film.watchedAt}`}
                        film={film}
                        today={today}
                        people={people}
                        onOpenPoster={openPoster}
                        onDirectorEnter={showDirector}
                        onDirectorLeave={hideDirector}
                        onDirectorPin={pinDirector}
                        pinnedKey={pinnedKey}
                        source={listSource}
                        scoreKey={scoreTip?.pinned ? scoreTip.key : null}
                        onScoreEnter={showScore}
                        onScoreLeave={hideScore}
                        onScorePin={pinScore}
                        media={media}
                      />
                    ))
                )}
                {shown < filtered.length && (
                  <button type="button" className="more" onClick={() => setShown((count) => count + 10)}>
                    {t.profile.more(filtered.length - shown)}
                  </button>
                )}
              </>
            ) : (
              <>
                <h2>
                  {t.profile.favourites(staffTab ? t.profile.roles[activeStaff] : tabLabel(tab))}
                  <small>{t.profile.favouritesRule}</small>
                </h2>
                {staffTab && staffCounts.length > 0 && (
                  <div className="staff-roles">
                    <span className="toggle" role="group" aria-label={t.profile.staffRoles}>
                      {staffCounts.map(([role, count]) => (
                        <button
                          key={role}
                          type="button"
                          className={role === activeStaff ? "on" : undefined}
                          aria-pressed={role === activeStaff}
                          onClick={() => setStaffRole(role)}
                        >
                          {t.profile.roles[role]}
                          <span className="staff-count num">{count}</span>
                        </button>
                      ))}
                    </span>
                  </div>
                )}
                {peopleForTab.length === 0 ? (
                  <p className="empty">
                    {t.profile.noFavourites(staffTab ? t.profile.roles[activeStaff] : tabLabel(tab))}
                  </p>
                ) : (
                  peopleForTab.map((person) => (
                    <div className="row person" key={`${person.role}:${person.id}`}>
                      {person.photo ? (
                        <button
                          type="button"
                          className={person.role === "studio" ? "poster logo" : "poster"}
                          aria-label={t.profile.photo(personName(person, lang))}
                          onClick={() =>
                            setLightbox({
                              key: `person-${person.role}-${person.id}`,
                              image: person.photo!,
                              alt: personName(person, lang),
                              label: t.profile.photoOf(personName(person, lang)),
                              logo: person.role === "studio",
                            })
                          }
                        >
                          <Image
                            src={person.photo}
                            alt=""
                            width={34}
                            height={48}
                            unoptimized
                            referrerPolicy="no-referrer"
                          />
                        </button>
                      ) : (
                        <div className="poster" aria-hidden="true">
                          {personName(person, lang).slice(0, 1)}
                        </div>
                      )}
                      <div className="title">
                        <div className="t">
                          {/* Film directors open the TMDB director card; anime staff IDs are
                              AniList's, so anime directors don't. Studios open the studio card. */}
                          {person.role === "director" && media === "movie" ? (
                            <DirectorName
                              name={person.name}
                              label={personName(person, lang)}
                              personId={person.id}
                              photo={person.photo}
                              pinnedKey={pinnedKey}
                              onEnter={showDirector}
                              onLeave={hideDirector}
                              onPin={pinDirector}
                            />
                          ) : person.role === "studio" ? (
                            <DirectorName
                              name={person.name}
                              label={personName(person, lang)}
                              personId={null}
                              photo={person.photo}
                              studio={{
                                anilistId: person.id > 0 ? person.id : null,
                                bangumiId: person.bangumiId ?? (person.id < 0 ? -person.id : null),
                              }}
                              pinnedKey={pinnedKey}
                              onEnter={showDirector}
                              onLeave={hideDirector}
                              onPin={pinDirector}
                            />
                          ) : (
                            personName(person, lang)
                          )}
                        </div>
                        <div className="m">
                          {t.profile.personStats(person.count, person.average.toFixed(1))}
                        </div>
                      </div>
                      <div className="score num up">{person.average.toFixed(1)}</div>
                      <div className="person-films">
                        {person.films.map((film) => (
                          <span key={film.id}>
                            {film.title} <b className="num">{film.rating}</b>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </section>

          <aside className="stack">
            <section className={shortSample ? "card muted" : "card"} aria-label={t.profile.radar}>
              <h2 className="wrap-h">
                <span className="toggle" role="group" aria-label={t.profile.radarMode}>
                  {(
                    [
                      ["genre", t.profile.radarGenre],
                      ["style", t.profile.radarStyle],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={radarMode === mode ? "on" : undefined}
                      aria-pressed={radarMode === mode}
                      onClick={() => setRadarMode(mode)}
                    >
                      {label}
                    </button>
                  ))}
                </span>
                <span className="toggle" role="group" aria-label={t.profile.range}>
                  <button
                    type="button"
                    className={windowSize === 25 ? "on" : undefined}
                    aria-pressed={windowSize === 25}
                    onClick={() => setWindowSize(25)}
                  >
                    {t.profile.window(25)}
                  </button>
                  <button
                    type="button"
                    className={windowSize !== 25 ? "on" : undefined}
                    aria-pressed={windowSize !== 25}
                    onClick={() => setWindowSize(windowSize === 100 ? "all" : 100)}
                    title={t.profile.windowHint}
                  >
                    {windowSize === "all" ? t.profile.windowAll : t.profile.window(100)}
                    {/* Shows this button cycles between the last 100 and everything. */}
                    <span className="cycle-mark" aria-hidden="true">
                      {CYCLE_ICON}
                    </span>
                  </button>
                </span>
              </h2>
              {radarMode === "style" && style ? (
                <>
                  <div className="title-badge">
                    <b>{style.title}</b>
                    <span>
                      {t.profile.standout(
                        style.top.map((axis) => t.style.axes[axis]).join(t.style.separator),
                      )}
                    </span>
                  </div>
                  <Radar
                    label={t.profile.styleChart}
                    muted={shortSample}
                    overlay={overlay}
                    axes={AXES.map((axis, index) => {
                      const score = style.scores[index];
                      return {
                        label: t.style.axes[axis],
                        value: score,
                        headline: score == null ? "—" : `${(score / 10).toFixed(1)} / 10`,
                        detail: style.details[index],
                      };
                    })}
                  />
                  {mineStyle && viewing && (
                    <div className="radar-foot">
                      <label className="radar-compare" title={t.profile.viewing.compareHint}>
                        <input
                          type="checkbox"
                          checked={comparing}
                          onChange={(event) => setComparing(event.target.checked)}
                        />
                        {t.profile.viewing.compare}
                      </label>
                      {overlay && (
                        <ul className="radar-legend">
                          <li>
                            <span className="radar-swatch" aria-hidden="true" />
                            <span>{overlay.subject}</span>
                          </li>
                          <li>
                            <span className="radar-swatch compare" aria-hidden="true" />
                            <span>{overlay.name}</span>
                          </li>
                        </ul>
                      )}
                    </div>
                  )}
                </>
              ) : radarMode === "genre" && sample.length > 0 ? (
                <GenreSunburst
                  films={sample}
                  media={media}
                  genreLabel={genreLabel}
                  otherLabel={t.profile.sunburst.other}
                  source={listSource}
                  sourceLabel={sourceLabel}
                  muted={shortSample}
                />
              ) : (
                <>
                  <p className="empty">
                    {films.length === 0
                      ? t.profile.radarEmpty
                      : radarMode === "genre"
                        ? t.profile.radarFewGenres
                        : t.profile.nothingFiltered}
                  </p>
                  {fallbackGenres.length > 0 && (
                    <div className="chips">
                      {fallbackGenres.map((genre) => (
                        <span key={genre.id}>
                          {genreLabel(genre.name)}
                          <b className="num">
                            {sampleCount ? Math.round((genre.count / sampleCount) * 100) : 0}%
                          </b>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
              {/* The genre rings carry their own key; only the style radar needs a note. */}
              {(shortSample || radarMode !== "genre") && (
                <p className="note">
                  {shortSample
                    ? t.profile.radarShort
                    : `${t.profile.radarStyleNote}${isShow ? t.profile.radarShowScope : t.profile.radarMovieScope}`}
                </p>
              )}
            </section>

            <section className="card">
              <h2>
                {viewing ? t.profile.viewing.ratingsOf(viewing.subject) : t.profile.myRatings}{" "}
                <small>{sampleRating ? t.profile.recent(sample.length) : t.profile.allRated}</small>
              </h2>
              {sampleRating ? (
                <RatingBody rating={sampleRating} sourceLabel={sourceLabel} other={Boolean(viewing)} />
              ) : (
                <FallbackRatings
                  mean={mean}
                  distribution={distribution}
                  sourceLabel={sourceLabel}
                  other={Boolean(viewing)}
                />
              )}
              <p className="note">{t.profile.ratingNote}</p>
            </section>

            {bonds && (
              <BondsCard
                bonds={bonds}
                owner={viewing?.subject ?? null}
                viewerId={viewing ? viewing.viewerId : null}
              />
            )}
          </aside>
        </div>
        <p className="note">{t.profile.credits}</p>
      </div>
      {lightbox && (
        <ImageOverlay
          key={lightbox.key}
          image={lightbox.image}
          alt={lightbox.alt}
          label={lightbox.label}
          logo={lightbox.logo}
          onClose={closeLightbox}
        />
      )}
      {directorTip &&
        (directorTip.studio ? (
          <StudioCard
            key={directorTip.key}
            tip={{ ...directorTip, studio: directorTip.studio }}
            pinned={pinnedKey === directorTip.key}
            ratedAnime={ratedAnime}
            source={studioSource}
            onSource={setStudioSource}
            onClose={closeDirector}
          />
        ) : (
          <DirectorCard
            key={directorTip.key}
            tip={directorTip}
            pinned={pinnedKey === directorTip.key}
            ratedIds={ratedSet}
            source={cardSource}
            onSource={setCardSource}
            onClose={closeDirector}
          />
        ))}
      {scoreTip && <ScoreCard key={scoreTip.key} tip={scoreTip} source={listSource} />}
    </div>
  );
}

// other: someone else's ratings, so the labels don't say "my".
function RatingBody({
  rating,
  sourceLabel,
  other = false,
}: {
  rating: ReturnType<typeof ratingOf>;
  sourceLabel: string;
  other?: boolean;
}) {
  const { t } = useLocale();
  const max = Math.max(...rating.counts.map((item) => item.count), 1);
  return (
    <>
      <div className="rstats">
        <div className="rstat">
          <div className="l">{other ? t.profile.viewing.mean : t.profile.myMean}</div>
          <div className="v num">{rating.mine!.toFixed(1)}</div>
        </div>
        <div className="rstat">
          <div className="l">{t.profile.platformMean(sourceLabel)}</div>
          <div className="v num">{rating.publicMean == null ? "–" : rating.publicMean.toFixed(1)}</div>
        </div>
        <div className="rstat">
          <div className="l">{t.profile.bite}</div>
          <div
            className="v num"
            style={{ color: rating.bite == null ? undefined : rating.bite > 0 ? "var(--down)" : "var(--up)" }}
          >
            {rating.bite == null ? "–" : formatSigned(rating.bite)}
          </div>
        </div>
      </div>
      {rating.diffs.length > 0 && (
        <>
          <div className="sec">
            {other ? t.profile.viewing.diffs(sourceLabel) : t.profile.diffs(sourceLabel)}
          </div>
          <DiffChart diffs={rating.diffs} label={other ? t.profile.viewing.diffChart : t.profile.diffChart} />
        </>
      )}
      <div className="sec">{t.profile.distribution}</div>
      <div className="hist">
        {rating.counts.map((item) => (
          <div className="hrow" key={item.score}>
            <span>{t.profile.points(item.score)}</span>
            <div className="track">
              <i style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
            <span className="num" style={{ textAlign: "right" }}>
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function FallbackRatings({
  mean,
  distribution,
  sourceLabel,
  other = false,
}: {
  mean: number | null;
  distribution: number[];
  sourceLabel: string;
  other?: boolean;
}) {
  const { t } = useLocale();
  const counts = distribution.map((count, index) => ({ score: index + 1, count })).reverse();
  const max = Math.max(...distribution, 1);
  return (
    <>
      <div className="rstats">
        <div className="rstat">
          <div className="l">{other ? t.profile.viewing.mean : t.profile.myMean}</div>
          <div className="v num">{mean == null ? "–" : mean.toFixed(1)}</div>
        </div>
        <div className="rstat">
          <div className="l">{t.profile.platformMean(sourceLabel)}</div>
          <div className="v num">–</div>
        </div>
        <div className="rstat">
          <div className="l">{t.profile.bite}</div>
          <div className="v num">–</div>
        </div>
      </div>
      <div className="sec">{t.profile.allRated}</div>
      <div className="hist">
        {counts.map((item) => (
          <div className="hrow" key={item.score}>
            <span>{t.profile.points(item.score)}</span>
            <div className="track">
              <i style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
            <span className="num" style={{ textAlign: "right" }}>
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
