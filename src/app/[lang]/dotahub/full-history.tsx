"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HistoryIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/i18n/locale-provider";
import type { GuestStatus } from "@/lib/dota/admin";
import { cn } from "@/lib/utils";
import { requestFullHistory } from "./full-history-actions";

// Told when a request is queued, so the notifications look again at once.
export const FULL_HISTORY_EVENT = "dota-full-history";

// About how many minutes reading n matches takes: a page of 100 a minute.
const minutes = (n: number) => Math.max(1, Math.ceil(n / 100));

// 读取全部: a button and the confirmation before an account's whole ranked history is queued at
// admin. compact: a small link (the compare notes); otherwise a button with the explanation.
function Request({
  accountId,
  estimate,
  compact,
  onQueued,
}: {
  accountId: number;
  estimate: number | null;
  compact?: boolean;
  onQueued: (status: GuestStatus) => void;
}) {
  const { t, href } = useLocale();
  const f = t.dotahub.full;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await requestFullHistory(accountId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onQueued(result.status);
      window.dispatchEvent(new Event(FULL_HISTORY_EVENT));
      router.refresh();
    });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={cn(
          "inline-flex shrink-0 cursor-pointer items-center gap-1.5 transition-colors",
          compact
            ? "text-xs text-foreground underline underline-offset-2"
            : "rounded-md bg-amber-500 px-3.5 py-2 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-400",
        )}
      >
        {!compact && <HistoryIcon className="size-4" aria-hidden />}
        {f.readAll}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{f.confirmTitle}</DialogTitle>
            <DialogDescription>
              {estimate ? f.confirmBody(estimate, minutes(estimate)) : f.confirmBodyUnknown}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{f.confirmRules}</p>
          {error && (
            <p className="text-sm text-destructive">
              {error === "signIn" ? (
                <Link href={href("/login")} className="underline underline-offset-2">
                  {f.signIn}
                </Link>
              ) : (
                f.errors[error as "linked" | "tooMany" | "unavailable"]
              )}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {f.cancel}
            </Button>
            <Button onClick={confirm} disabled={pending}>
              {pending && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
              {f.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Above a public page that shows only STRATZ's newest 100: the offer to read them all, or where
// the reading stands once asked.
export function FullHistoryBanner({
  accountId,
  guest: initial,
  estimate,
}: {
  accountId: number;
  guest: GuestStatus | null;
  estimate: number | null;
}) {
  const f = useLocale().t.dotahub.full;
  const [guest, setGuest] = useState(initial);
  if (guest?.historyDone) return null;
  return (
    // Amber and up front: easy to miss otherwise, and it's the only way to 全部 for this player.
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
      {guest ? (
        <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
          <Loader2Icon className="size-4 shrink-0 animate-spin" aria-hidden />
          {guest.state === "queued" ? f.queued(guest.ahead) : f.reading(guest.read)}
        </p>
      ) : (
        <>
          <HistoryIcon className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-amber-900 dark:text-amber-100">{f.only100(estimate)}</p>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/70">{f.offerHint}</p>
          </div>
          <Request accountId={accountId} estimate={estimate} onQueued={setGuest} />
        </>
      )}
    </div>
  );
}

// The compare notes' small 读取全部 for a compared player with only the newest 100.
export function FullHistoryLink({ accountId }: { accountId: number }) {
  const f = useLocale().t.dotahub.full;
  const [queued, setQueued] = useState(false);
  return queued ? (
    <span className="text-xs">{f.queuedShort}</span>
  ) : (
    <Request accountId={accountId} estimate={null} compact onQueued={() => setQueued(true)} />
  );
}
