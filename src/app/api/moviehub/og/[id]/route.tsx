import { ImageResponse } from "next/og";
import type { Locale } from "@/i18n/config";
import { DICTIONARIES } from "@/i18n/dictionaries";
import { genreName } from "@/i18n/genres";
import { getDiscordAccount } from "@/lib/discord-account";
import { getSiteUser } from "@/lib/movie-bonds";
import type { MovieResponse, ProfileFilm } from "@/lib/movie-types";
import { viewMovieStatistics } from "@/lib/movies";
import { AXES, styleOf } from "@/app/[lang]/moviehub/stats";

// The link preview (og:image) for someone's statistics page, /moviehub/u/<id>: name, avatar, the
// style title and radar of their latest 25 films (as the page opens), and their totals. It lives
// under /api so the language proxy leaves it alone; ?lang=en draws the English version.
const WIDTH = 1200;
const HEIGHT = 630;
const C = {
  bg: "#101318",
  panel: "#171b22",
  line: "#2b3240",
  fg: "#e6e8ec",
  fg2: "#9aa1ad",
  fg3: "#6b7280",
  gold: "#e0b04a",
};

// Satori's built-in font has no Chinese: fetch Noto Sans SC from Google Fonts, cut down to the
// characters drawn. Google serves TrueType to a client that doesn't announce woff2 support.
const fontCache = new Map<string, ArrayBuffer>();
async function notoSans(text: string, weight: 500 | 700): Promise<ArrayBuffer | null> {
  const chars = [...new Set(text)].sort().join("");
  const key = `${weight}:${chars}`;
  const cached = fontCache.get(key);
  if (cached) return cached;
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@${weight}&text=${encodeURIComponent(chars)}`,
      { signal: AbortSignal.timeout(5000) },
    ).then((response) => response.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const data = await fetch(url, { signal: AbortSignal.timeout(5000) }).then((response) =>
      response.arrayBuffer(),
    );
    if (fontCache.size > 200) fontCache.clear();
    fontCache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

// Trakt's image CDN answers 403 to clients that don't look like a browser, so the avatar is
// fetched here (as a browser would) and handed to Satori as a data URL; null when it fails.
async function avatarData(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        Accept: "image/png,image/jpeg,image/*;q=0.8",
      },
      signal: AbortSignal.timeout(5000),
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) return null;
    // Satori decodes PNG and JPEG, not WebP; anything else falls back to the initial.
    if (!/image\/(png|jpe?g)/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

type Card = {
  name: string;
  avatar: string | null;
  title: string | null;
  standout: string | null;
  scope: string | null;
  axes: { label: string; value: number | null }[] | null;
  totals: string[];
  footer: string;
};

function describe(name: string, result: MovieResponse | null, lang: Locale): Card {
  const t = DICTIONARIES[lang];
  const snapshot = result?.subscription && result.snapshot ? result.snapshot : null;
  const base = {
    name,
    avatar: result?.subscription?.traktAvatar ?? null,
    footer: `yohaneowo.com · ${t.movies.title}`,
  };
  if (!snapshot)
    return { ...base, title: null, standout: null, scope: null, axes: null, totals: [t.movies.subheading] };
  const platform = result?.platform ?? null;
  // The page opens on the films tab; someone without films is drawn from anime or shows.
  const media: "movie" | "anime" | "show" = snapshot.films.length
    ? "movie"
    : snapshot.anime?.items.length
      ? "anime"
      : "show";
  const items: ProfileFilm[] =
    media === "movie" ? snapshot.films : ((media === "anime" ? snapshot.anime : snapshot.shows)?.items ?? []);
  const sample = items.slice(0, 25);
  const isShow = media !== "movie";
  const withProgress = isShow
    ? (sample as (ProfileFilm & { episodesWatched?: number; episodesAired?: number | null })[]).filter(
        (item) => item.episodesAired,
      )
    : [];
  const style = styleOf(sample, {
    kind: isShow ? "show" : "movie",
    noun: t.profile.words[media].noun,
    source: media === "anime" ? (lang === "zh" ? "bangumi" : "mal") : "imdb",
    genreLabel: (genre) => genreName(genre, lang),
    t: t.style,
    depth: isShow
      ? withProgress.length
        ? withProgress.reduce(
            (sum, item) => sum + Math.min(1, (item.episodesWatched ?? 0) / item.episodesAired!),
            0,
          ) / withProgress.length
        : null
      : snapshot.depth,
    depthGroups: isShow ? withProgress.length : snapshot.depthGroups,
    watchedPercentile:
      media === "movie"
        ? (platform?.watchedPercentile ?? null)
        : media === "anime"
          ? (platform?.animePercentile ?? null)
          : (platform?.showsPercentile ?? null),
    watchedCount:
      media === "movie"
        ? snapshot.watchedCount
        : ((media === "anime" ? snapshot.anime : snapshot.shows)?.watchedCount ?? 0),
    platformUsers:
      media === "movie"
        ? (platform?.users ?? 0)
        : media === "anime"
          ? (platform?.animeUsers ?? 0)
          : (platform?.showUsers ?? 0),
  });
  const og = t.profile.og;
  const totals = [
    og.movies(snapshot.watchedCount),
    snapshot.shows?.watchedCount ? og.shows(snapshot.shows.watchedCount) : null,
    snapshot.anime?.watchedCount ? og.anime(snapshot.anime.watchedCount) : null,
    snapshot.mean != null ? og.mean(snapshot.mean.toFixed(1)) : null,
  ].filter((value): value is string => Boolean(value));
  return {
    ...base,
    title: style?.title ?? null,
    standout: style
      ? t.profile.standout(style.top.map((axis) => t.style.axes[axis]).join(t.style.separator))
      : null,
    scope: og.scope(t.profile.media[media], sample.length),
    axes: style
      ? AXES.map((axis, index) => ({ label: t.style.axes[axis], value: style.scores[index] }))
      : null,
    totals,
  };
}

const R_BOX = 460;
const R_CENTER = R_BOX / 2;
const R_RADIUS = 150;
function point(index: number, count: number, radius: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return [R_CENTER + Math.cos(angle) * radius, R_CENTER + Math.sin(angle) * radius] as const;
}

function RadarImage({ axes }: { axes: { label: string; value: number | null }[] }) {
  const count = axes.length;
  const ring = (scale: number) =>
    axes.map((_, index) => point(index, count, R_RADIUS * scale).join(",")).join(" ");
  const shape = axes
    .map((axis, index) => point(index, count, R_RADIUS * (Math.max(axis.value ?? 0, 3) / 100)).join(","))
    .join(" ");
  return (
    <div style={{ display: "flex", position: "relative", width: R_BOX, height: R_BOX }}>
      <svg width={R_BOX} height={R_BOX} viewBox={`0 0 ${R_BOX} ${R_BOX}`}>
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon key={scale} points={ring(scale)} fill="none" stroke={C.line} strokeWidth="1.5" />
        ))}
        {axes.map((axis, index) => {
          const [x, y] = point(index, count, R_RADIUS);
          return (
            <line
              key={axis.label}
              x1={R_CENTER}
              y1={R_CENTER}
              x2={x}
              y2={y}
              stroke={C.line}
              strokeWidth="1.5"
            />
          );
        })}
        <polygon
          points={shape}
          fill={C.gold}
          fillOpacity="0.25"
          stroke={C.gold}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {axes.map((axis, index) => {
          const [x, y] = point(index, count, R_RADIUS * (Math.max(axis.value ?? 0, 3) / 100));
          return <circle key={axis.label} cx={x} cy={y} r="6" fill={C.gold} stroke={C.bg} strokeWidth="2" />;
        })}
      </svg>
      {axes.map((axis, index) => {
        const [x, y] = point(index, count, R_RADIUS + 42);
        return (
          <div
            key={axis.label}
            style={{
              position: "absolute",
              left: x - 70,
              top: y - 26,
              width: 140,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 24, color: C.fg }}>{axis.label}</span>
            <span style={{ fontSize: 20, color: C.gold, fontWeight: 700 }}>
              {axis.value == null ? "—" : (axis.value / 10).toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Picture({ card }: { card: Card }) {
  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        background: C.bg,
        color: C.fg,
        fontFamily: "Noto Sans SC",
        padding: "56px 56px 48px 64px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 104,
              height: 104,
              borderRadius: 52,
              border: `4px solid ${C.gold}`,
              background: C.panel,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              fontSize: 48,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {card.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img>
              <img src={card.avatar} width={96} height={96} alt="" style={{ borderRadius: 48 }} />
            ) : (
              card.name.slice(0, 1)
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.15 }}>{card.name}</span>
            {card.scope && <span style={{ fontSize: 24, color: C.fg2 }}>{card.scope}</span>}
          </div>
        </div>
        {card.title && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
            <span style={{ fontSize: 76, fontWeight: 700, color: C.gold, lineHeight: 1.1 }}>
              {card.title}
            </span>
            {card.standout && (
              <span style={{ fontSize: 28, color: C.fg2, marginTop: 12 }}>{card.standout}</span>
            )}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: "auto" }}>
          {card.totals.map((item) => (
            <span
              key={item}
              style={{
                fontSize: 23,
                padding: "7px 14px",
                borderRadius: 10,
                background: C.panel,
                border: `1px solid ${C.line}`,
              }}
            >
              {item}
            </span>
          ))}
        </div>
        <span style={{ fontSize: 22, color: C.fg3, marginTop: 22 }}>{card.footer}</span>
      </div>
      {card.axes && (
        <div style={{ display: "flex", alignItems: "center", marginLeft: 16 }}>
          <RadarImage axes={card.axes} />
        </div>
      )}
    </div>
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const lang: Locale = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "zh";
  const person = await getSiteUser(id);
  if (!person) return new Response("Not found", { status: 404 });
  let result: MovieResponse | null = null;
  try {
    const linked = await getDiscordAccount(id);
    result = await viewMovieStatistics(id, linked?.accountId ?? null);
  } catch {
    // admin unreachable: the card still names the person.
  }
  const card = describe(person.name, result, lang);
  card.avatar = await avatarData(card.avatar);
  const text = [
    card.name,
    card.title,
    card.standout,
    card.scope,
    card.footer,
    ...card.totals,
    ...(card.axes ?? []).map((axis) => axis.label),
    "0123456789.—",
  ].join("");
  const [regular, bold] = await Promise.all([notoSans(text, 500), notoSans(text, 700)]);
  const fonts = [
    ...(regular
      ? [{ name: "Noto Sans SC", data: regular, weight: 500 as const, style: "normal" as const }]
      : []),
    ...(bold ? [{ name: "Noto Sans SC", data: bold, weight: 700 as const, style: "normal" as const }] : []),
  ];
  return new ImageResponse(<Picture card={card} />, {
    width: WIDTH,
    height: HEIGHT,
    fonts: fonts.length ? fonts : undefined,
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}
