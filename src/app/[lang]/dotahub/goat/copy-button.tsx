"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

// A value with a button that copies it (an account ID, a Steam ID).
export function CopyValue({ value, label, className }: { value: string; label: string; className?: string }) {
  const t = useLocale().t.dotahub.goat.account;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      title={`${t.copy} ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          window.prompt(label, value);
        }
      }}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded px-1 font-mono text-xs text-muted-foreground tabular-nums transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {value}
      {copied ? (
        <CheckIcon className="size-3 text-emerald-500" aria-label={t.copied} />
      ) : (
        <CopyIcon className="size-3" aria-hidden />
      )}
    </button>
  );
}
