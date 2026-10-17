"use client";
import { useState, useTransition } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { startTraktConnect } from "./actions";

// Shown on a profile that was built from a public Trakt account without the owner's authorization
// (the bot-era profiles): the statistics work, but the bot's 想看 / 看过了 need a token to write to
// Trakt, and private accounts need one to be read at all.
export function TraktConnectBanner({ region }: { region: string }) {
  const { t, lang } = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const c = t.movies.connect;

  function connect() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await startTraktConnect({ region, lang });
        if ("error" in result) setError(t.movies.errors[result.error]);
        else window.location.assign(result.url);
      } catch {
        setError(t.movies.refresh.offline);
      }
    });
  }

  return (
    <div className="notice" role="status">
      <div className="notice-text">
        <strong>{c.title}</strong>
        <span>{c.description}</span>
        {error && <span className="notice-error">{error}</span>}
      </div>
      <button type="button" className="notice-button" onClick={connect} disabled={pending}>
        {pending ? c.working : c.button}
      </button>
    </div>
  );
}
