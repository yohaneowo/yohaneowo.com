"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/locale-provider";
import { requestStatisticsRefresh } from "./actions";

// Shared by the gate cards and the profile: polls while a sync is running, and either
// re-reads the page (checkOnly) or queues a new sync.
export function useStatisticsRefresh({ poll, checkOnly }: { poll: boolean; checkOnly: boolean }) {
  const router = useRouter();
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!poll) return;
    // Stop automatic polling after five minutes; a manual check is always available.
    let count = 0;
    const timer = setInterval(() => {
      if (++count >= 20) clearInterval(timer);
      if (document.visibilityState === "visible") router.refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [poll, router]);
  function refresh() {
    startTransition(async () => {
      if (checkOnly) {
        router.refresh();
        return;
      }
      try {
        const result = await requestStatisticsRefresh();
        setMessage(result.error ? t.movies.errors[result.error] : t.movies.refresh.queued);
        router.refresh();
      } catch {
        setMessage(t.movies.refresh.offline);
      }
    });
  }
  return { pending, message, refresh };
}
