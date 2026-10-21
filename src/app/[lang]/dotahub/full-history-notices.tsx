"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2Icon, HistoryIcon, Loader2Icon, UserIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale } from "@/i18n/locale-provider";
import { FULL_HISTORY_EVENT } from "./full-history";
import { type FullHistoryNotice, myFullHistory } from "./full-history-actions";

const DISMISSED = "dota-full-history-dismissed";
// Finished ones show for a day after they were asked for, until closed.
const SHOW_DONE = 24 * 3600;
const POLL = 20_000;

// Still worth showing: under way, or finished less than a day after it was asked for.
const current = (x: FullHistoryNotice) => !x.historyDone || Date.now() / 1000 - x.requestedAt < SHOW_DONE;

function readDismissed(): number[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED) ?? "[]") as number[];
  } catch {
    return [];
  }
}

// Top right on DotaHub pages: the signed-in user's 读取全部 requests while they wait or are read
// (checked every 20 seconds), and a note when one is done, with the way to its pages.
export function FullHistoryNotices() {
  const { t, href } = useLocale();
  const f = t.dotahub.full;
  const [items, setItems] = useState<FullHistoryNotice[]>([]);
  const [dismissed, setDismissed] = useState<number[]>(readDismissed);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let stop = false;
    myFullHistory()
      .then((list) => !stop && setItems(list ?? []))
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [tick]);

  // Look again while something is under way, and at once when a request is made.
  const active = items.some((x) => !x.historyDone);
  useEffect(() => {
    const again = () => setTick((n) => n + 1);
    window.addEventListener(FULL_HISTORY_EVENT, again);
    const timer = active ? setInterval(again, POLL) : null;
    return () => {
      window.removeEventListener(FULL_HISTORY_EVENT, again);
      if (timer) clearInterval(timer);
    };
  }, [active]);

  const shown = items.filter((x) => !dismissed.includes(x.accountId) && current(x));
  const dismiss = (id: number) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED, JSON.stringify(next.slice(-50)));
    } catch {
      // Storage blocked: closed for this visit only.
    }
  };

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-28 right-4 z-40 flex w-[min(320px,calc(100vw-2rem))] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {shown.map((x) => (
          <motion.div
            key={x.accountId}
            layout
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur"
          >
            <span className="relative size-9 shrink-0">
              {x.avatar ? (
                <Image
                  src={x.avatar}
                  alt=""
                  width={36}
                  height={36}
                  unoptimized
                  className="size-9 rounded-full"
                />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <UserIcon className="size-4 text-muted-foreground" aria-hidden />
                </span>
              )}
              <span className="absolute -right-1 -bottom-1 rounded-full bg-background p-0.5">
                {x.historyDone ? (
                  <CheckCircle2Icon className="size-3.5 text-emerald-500" aria-hidden />
                ) : x.state === "reading" ? (
                  <Loader2Icon className="size-3.5 animate-spin text-amber-500" aria-hidden />
                ) : (
                  <HistoryIcon className="size-3.5 text-muted-foreground" aria-hidden />
                )}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{x.name}</p>
              <p className="text-xs text-muted-foreground">
                {x.historyDone
                  ? f.noticeDone(x.read)
                  : x.state === "reading"
                    ? f.noticeReading(x.read)
                    : f.noticeQueued(x.ahead)}
              </p>
              {!x.historyDone && x.state === "reading" && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <span className="loading-bar relative block h-full w-1/3 rounded-full bg-amber-500/80" />
                </div>
              )}
              {x.error && !x.historyDone && <p className="mt-1 text-xs text-amber-600">{f.noticeRetry}</p>}
              <Link
                href={href(`/dotahub/players/${x.accountId}/economy`)}
                className="mt-1 inline-block text-xs underline underline-offset-2"
              >
                {f.open}
              </Link>
            </div>
            <button
              type="button"
              onClick={() => dismiss(x.accountId)}
              aria-label={f.dismiss}
              className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-4" aria-hidden />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
