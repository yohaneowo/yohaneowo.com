"use client";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { useStatisticsRefresh } from "./use-statistics-refresh";

export function RefreshButton({
  queued = false,
  poll = false,
  checkOnly = false,
}: {
  queued?: boolean;
  poll?: boolean;
  checkOnly?: boolean;
}) {
  const { pending, message, refresh } = useStatisticsRefresh({ poll, checkOnly: checkOnly || queued });
  const { t } = useLocale();
  return (
    <div className="space-y-2">
      <Button variant="outline" disabled={pending} onClick={refresh}>
        <RefreshCwIcon className={pending ? "animate-spin" : ""} />
        {pending
          ? t.movies.refresh.checking
          : checkOnly
            ? t.movies.refresh.recheck
            : queued
              ? t.movies.refresh.progress
              : t.movies.refresh.update}
      </Button>
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
