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
