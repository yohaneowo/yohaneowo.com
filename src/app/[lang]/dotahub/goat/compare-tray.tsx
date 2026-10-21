"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckIcon, PlusIcon, UsersIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { compareHref, MAX_COMPARE } from "./compare-ids";

// The people picked for the compare page, kept in this browser (a convenience: losing it loses
// nothing). Every GOAT page can add to it; the bar at the bottom opens the compare.

const KEY = "goat-compare";
const EVENT = "goat-compare-change";

export type Pick = { id: number; name: string; avatar: string | null };

let cache: { raw: string | null; list: Pick[] } = { raw: null, list: [] };

function read(): Pick[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage blocked (private window): the list just doesn't persist.
  }
  if (raw === cache.raw) return cache.list;
  let list: Pick[] = [];
  try {
    const parsed = raw ? (JSON.parse(raw) as Pick[]) : [];
    list = Array.isArray(parsed) ? parsed.filter((p) => Number.isInteger(p?.id)).slice(0, MAX_COMPARE) : [];
  } catch {
    list = [];
  }
  cache = { raw, list };
  return list;
}

function write(list: Pick[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_COMPARE)));
  } catch {
    cache = { raw: JSON.stringify(list), list };
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(change: () => void) {
  window.addEventListener(EVENT, change);
  window.addEventListener("storage", change);
  return () => {
    window.removeEventListener(EVENT, change);
    window.removeEventListener("storage", change);
  };
}

const EMPTY: Pick[] = [];

export function usePicks() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function togglePick(pick: Pick) {
  const list = read();
  if (list.some((p) => p.id === pick.id)) write(list.filter((p) => p.id !== pick.id));
  else if (list.length < MAX_COMPARE) write([...list, pick]);
}

export function setPicks(list: Pick[]) {
  write(list);
}

// "Compare" on a player: adds them to the list, or takes them out again.
export function AddToCompare({ pick, className }: { pick: Pick; className?: string }) {
  const t = useLocale().t.dotahub.goat.tray;
  const picks = usePicks();
  const added = picks.some((p) => p.id === pick.id);
  const full = !added && picks.length >= MAX_COMPARE;
  return (
    <button
      type="button"
      onClick={() => togglePick(pick)}
      disabled={full}
      title={full ? t.full(MAX_COMPARE) : added ? t.remove : t.add}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors enabled:cursor-pointer disabled:opacity-50",
        added
          ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "text-muted-foreground enabled:hover:text-foreground",
        className,
      )}
    >
      {added ? <CheckIcon className="size-3.5" aria-hidden /> : <PlusIcon className="size-3.5" aria-hidden />}
      {added ? t.added : t.add}
    </button>
  );
}

// Adds several at once (a whole roster), as many as fit.
export function AddManyToCompare({ picks, label }: { picks: Pick[]; label: string }) {
  const current = usePicks();
  return (
    <button
      type="button"
      onClick={() => {
        const next = [...current];
        for (const p of picks)
          if (next.length < MAX_COMPARE && !next.some((x) => x.id === p.id)) next.push(p);
        setPicks(next);
      }}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <UsersIcon className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}

// The bar at the bottom while someone is picked: their faces, and the way to the compare page.
export function CompareBar() {
  const { t, href } = useLocale();
  const tray = t.dotahub.goat.tray;
  const picks = usePicks();
  return (
    <AnimatePresence>
      {picks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          role="region"
          aria-label={tray.label}
          className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border bg-background/95 py-1.5 pr-1.5 pl-3 shadow-lg backdrop-blur"
        >
          <ul className="flex items-center gap-1.5">
            {picks.map((p) => (
              <li key={p.id} className="group relative">
                <span title={p.name} className="block size-8 overflow-hidden rounded-full border bg-muted">
                  {p.avatar && (
                    <Image
                      src={p.avatar}
                      alt={p.name}
                      width={32}
                      height={32}
                      unoptimized
                      className="size-8"
                    />
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => togglePick(p)}
                  aria-label={`${tray.remove} ${p.name}`}
                  className="absolute -top-1 -right-1 hidden size-4 cursor-pointer items-center justify-center rounded-full bg-foreground text-background group-hover:flex"
                >
                  <XIcon className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setPicks([])}
            className="cursor-pointer px-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {tray.clear}
          </button>
          <Link
            href={href(compareHref(picks.map((p) => p.id)))}
            className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background"
          >
            {tray.open(picks.length)}
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
