"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { askStratzToParse, askToParse, disconnectSteam } from "./actions";

export function DisconnectSteam() {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t.dotahub.connect.unlinkConfirm)) return;
        startTransition(async () => {
          await disconnectSteam();
        });
      }}
    >
      {t.dotahub.connect.unlink}
    </Button>
  );
}

// Sends a match STRATZ is slow to parse back to its parser (for IMP and the death map).
export function RequestStratzParse({ matchId }: { matchId: number }) {
  const { t } = useLocale();
  const m = t.dotahub.match;
  const [state, setState] = useState<"idle" | "sent" | "throttled" | "failed">("idle");
  const [pending, startTransition] = useTransition();
  if (state === "sent" || state === "throttled")
    return (
      <p className="text-sm text-muted-foreground">
        {state === "sent" ? m.stratzParseRequested : m.stratzParseThrottled}
      </p>
    );
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { result } = await askStratzToParse(matchId).catch(() => ({ result: "failed" as const }));
            setState(result);
          })
        }
      >
        {m.stratzParse}
      </Button>
      {state === "failed" && <p className="text-sm text-destructive">{m.parseFailed}</p>}
    </div>
  );
}

export function RequestParse({ matchId }: { matchId: number }) {
  const { t } = useLocale();
  const [state, setState] = useState<"idle" | "sent" | "failed">("idle");
  const [pending, startTransition] = useTransition();
  if (state === "sent")
    return <p className="text-sm text-muted-foreground">{t.dotahub.match.parseRequested}</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await askToParse(matchId);
            setState(result.ok ? "sent" : "failed");
          })
        }
      >
        {t.dotahub.match.requestParse}
      </Button>
      {state === "failed" && <p className="text-sm text-destructive">{t.dotahub.match.parseFailed}</p>}
    </div>
  );
}

// Copies the match ID (to paste into the Dota client's watch search or elsewhere).
export function CopyMatchId({ matchId }: { matchId: number }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      className="inline-flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(String(matchId));
          setCopied(true);
        } catch {
          window.prompt(t.dotahub.match.copyId, String(matchId));
        }
      }}
    >
      {copied ? t.dotahub.match.copied : t.dotahub.match.copyId}
      {copied ? <CheckIcon className="size-3" aria-hidden /> : <CopyIcon className="size-3" aria-hidden />}
    </button>
  );
}
