import Image from "next/image";
import type { Dictionary } from "@/i18n/dictionaries";
import type { HeroInfo, ItemInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";

// Small pieces DotaHub's pages share.

type T = Dictionary["dotahub"];

export function HeroImage({
  hero,
  lang,
  className,
}: {
  hero: HeroInfo | undefined;
  lang: "zh" | "en";
  className?: string;
}) {
  if (!hero) return <span className={cn("inline-block rounded bg-muted", className)} />;
  return (
    <Image
      src={hero.img}
      alt={hero[lang]}
      title={hero[lang]}
      width={256}
      height={144}
      unoptimized
      className={cn("rounded object-cover", className)}
    />
  );
}

export function ItemImage({ item, lang }: { item: ItemInfo | undefined; lang: "zh" | "en" }) {
  if (!item) return <span className="inline-block h-6 w-8 rounded-sm bg-muted/60" />;
  return (
    <Image
      src={item.img}
      alt={item[lang]}
      title={item[lang]}
      width={88}
      height={64}
      unoptimized
      className="h-6 w-8 rounded-sm object-cover"
    />
  );
}

// The rank medal (OpenDota's icons): rank_tier is medal × 10 + stars.
export function Medal({ tier, t, size = 56 }: { tier: number | null; t: T; size?: number }) {
  if (!tier) return null;
  const medal = Math.floor(tier / 10);
  const stars = tier % 10;
  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
      title={medalName(tier, t)}
    >
      <Image
        src={`https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_${medal}.png`}
        alt={medalName(tier, t)}
        width={size}
        height={size}
        unoptimized
      />
      {stars > 0 && (
        <Image
          src={`https://www.opendota.com/assets/images/dota2/rank_icons/rank_star_${stars}.png`}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="absolute inset-0"
        />
      )}
    </span>
  );
}

export function medalName(tier: number | null, t: T) {
  if (!tier) return t.overview.unranked;
  const medal = Math.floor(tier / 10);
  const stars = tier % 10;
  return `${t.medals[medal] ?? ""}${stars > 0 ? ` ${stars}` : ""}`.trim();
}

export function duration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ago(unix: number, t: T, now = Date.now()) {
  const minutes = Math.max(1, Math.round((now - unix * 1000) / 60000));
  if (minutes < 60) return t.ago.minutes(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t.ago.hours(hours);
  return t.ago.days(Math.round(hours / 24));
}

export function modeName(mode: number, lobby: number, t: T) {
  const name = t.modes[mode] ?? t.modes[0];
  return lobby === 7 ? `${t.ranked} · ${name}` : name;
}

export function ResultBadge({ won, t }: { won: boolean; t: T }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded text-xs font-semibold",
        won
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/15 text-red-600 dark:text-red-400",
      )}
    >
      {won ? t.match.win : t.match.lose}
    </span>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">{children}</div>;
}

// Dota Plus hero levels by tier: Bronze 1–5, Silver 6–11, Gold 12–17, Platinum 18–24, Master 25–29,
// Grandmaster 30. Badge pictures 1–6 are Valve's (Plus_Hero_Badge_N on the Dota 2 Fandom wiki),
// kept in public/dota/plus.
const PLUS_TIER_FROM = [1, 6, 12, 18, 25, 30];

export function plusTier(level: number) {
  let tier = 1;
  PLUS_TIER_FROM.forEach((from, i) => {
    if (level >= from) tier = i + 1;
  });
  return tier;
}

// From 32px up the level is written on the badge (fontSize defaults to a third of it); smaller
// ones put it beside.
export function PlusBadge({
  level,
  t,
  size = 20,
  fontSize = Math.round(size * 0.34),
}: {
  level: number;
  t: T;
  size?: number;
  fontSize?: number;
}) {
  const tier = plusTier(level);
  const label = t.signature.heroLevel(t.signature.plusTiers[tier - 1], level);
  const image = (
    <Image
      src={`/dota/plus/${tier}.webp`}
      alt={label}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
  if (size >= 32)
    return (
      <span className="relative inline-flex shrink-0 drop-shadow-md" title={label}>
        {image}
        <span
          className="absolute inset-0 flex items-center justify-center font-extrabold text-white tabular-nums"
          style={{
            fontSize,
            textShadow: "0 0 3px #000, 0 0 2px #000, 0 1px 1px #000",
          }}
        >
          {level}
        </span>
      </span>
    );
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" title={label}>
      {image}
      <span className="text-[11px] font-semibold tabular-nums">{level}</span>
    </span>
  );
}
