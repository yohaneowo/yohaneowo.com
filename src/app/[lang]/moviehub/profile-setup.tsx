"use client";
import { useState, useTransition } from "react";
import { ClapperboardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/i18n/locale-provider";
import type { Region } from "@/lib/regions";
import { startTraktConnect } from "./actions";

// The setup card: pick where you watch (pre-selected from the visitor's network location, via
// Cloudflare's country header) and authorize the site on Trakt; Trakt tells us who you are.
// Also shown when a connected Trakt account's authorization stopped working (reauth).
export function ProfileSetup({
  regions,
  defaultRegion,
  initialError,
  reauth = false,
}: {
  regions: Region[];
  defaultRegion: string;
  initialError?: string | null;
  reauth?: boolean;
}) {
  const { t, lang } = useLocale();
  const [pending, startTransition] = useTransition();
  const [region, setRegion] = useState(defaultRegion);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const s = t.movies.setup;

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
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <ClapperboardIcon className="mb-2 size-7 text-muted-foreground" />
        <CardTitle>{reauth ? s.reauthTitle : s.title}</CardTitle>
        <CardDescription>{reauth ? s.reauthDescription : s.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="region">{s.regionLabel}</Label>
          <select
            id="region"
            name="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            disabled={pending}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
          >
            {regions.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name} ({item.code})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{s.regionHint}</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button onClick={connect} disabled={pending}>
          {pending ? s.connecting : s.connect}
        </Button>
        <p className="text-xs text-muted-foreground">{s.traktHint}</p>
        <p className="text-xs text-muted-foreground">{s.discord}</p>
      </CardContent>
    </Card>
  );
}
