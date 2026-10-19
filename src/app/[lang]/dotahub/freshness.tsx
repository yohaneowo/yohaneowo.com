"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";

// How long after the server starts refreshing a stale entry the page asks again, and how often.
const RETRY_MS = 8000;
const MAX_TRIES = 3;
// Refresh attempts per section, and one shared timer: a refresh reloads every section at once.
const tries = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | null = null;

// The age of a section's OpenDota data ("3 分钟前更新"). Past staleAfter the server has started a
// background refresh while serving the old copy, so this says 更新中 and reloads the page data a few
// seconds later to pick the new copy up; after MAX_TRIES it keeps the old data and says so.
export function Freshness({ id, at, staleAfter }: { id: string; at: number; staleAfter: number }) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.fresh;
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  const stale = now !== null && now - at > staleAfter * 1000;

  useEffect(() => {
    if (!stale) {
      tries.delete(id);
      return;
    }
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const n = (tries.get(id) ?? 0) + 1;
      tries.set(id, n);
      if (n > MAX_TRIES) setGaveUp(true);
      else router.refresh();
    }, RETRY_MS);
  }, [stale, id, at, router]);

  if (now === null) return null;
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  const age =
    minutes < 1
      ? t.justNow
      : minutes < 60
        ? t.minutes(minutes)
        : minutes < 48 * 60
          ? t.hours(Math.floor(minutes / 60))
          : t.days(Math.floor(minutes / 1440));
  if (stale && !gaveUp)
    return (
      <span role="status" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2Icon className="size-3 animate-spin" aria-hidden />
        {t.updating(age)}
      </span>
    );
  return <span className="text-xs text-muted-foreground">{stale ? t.stale(age) : t.updated(age)}</span>;
}
