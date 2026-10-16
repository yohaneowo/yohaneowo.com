"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClapperboardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/i18n/locale-provider";
import type { Region } from "@/lib/regions";
import { createMovieProfile } from "./actions";

// The form a signed-in account fills once: its public Trakt profile and where it watches films.
// The region comes pre-selected from the visitor's network location (Cloudflare's country header).
export function ProfileSetup({ regions, defaultRegion }: { regions: Region[]; defaultRegion: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [trakt, setTrakt] = useState("");
  const [region, setRegion] = useState(defaultRegion);
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await createMovieProfile({ trakt, region });
        if (result.error) setError(t.movies.errors[result.error]);
        else router.refresh();
      } catch {
        setError(t.movies.refresh.offline);
      }
    });
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <ClapperboardIcon className="mb-2 size-7 text-muted-foreground" />
        <CardTitle>{t.movies.setup.title}</CardTitle>
        <CardDescription>{t.movies.setup.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="trakt">{t.movies.setup.traktLabel}</Label>
            <Input
              id="trakt"
              name="trakt"
              value={trakt}
              onChange={(e) => setTrakt(e.target.value)}
              placeholder={t.movies.setup.traktPlaceholder}
              autoComplete="off"
              required
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">{t.movies.setup.traktHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">{t.movies.setup.regionLabel}</Label>
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
            <p className="text-xs text-muted-foreground">{t.movies.setup.regionHint}</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending || !trakt.trim()}>
            {pending ? t.movies.setup.saving : t.movies.setup.submit}
          </Button>
          <p className="text-xs text-muted-foreground">{t.movies.setup.discord}</p>
        </form>
      </CardContent>
    </Card>
  );
}
