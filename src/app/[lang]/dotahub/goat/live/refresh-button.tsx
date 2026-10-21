"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCwIcon } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { refreshLive } from "./actions";

// Fetches the live games again right away, instead of waiting for the minute.
export function RefreshButton({ updated }: { updated: string }) {
  const g = useLocale().t.dotahub.goat.live;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{g.updatedAgo(updated)}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await refreshLive();
            router.refresh();
          })
        }
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-foreground transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-60"
      >
        <RotateCwIcon className={cn("size-3.5", pending && "animate-spin")} aria-hidden />
        {pending ? g.refreshingNow : g.refreshNow}
      </button>
    </div>
  );
}
