"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/i18n/locale-provider";
import { ROADMAP_AREAS, type RoadmapArea } from "@/lib/roadmap";
import { suggestFeature } from "./actions";

type ErrorKey = keyof ReturnType<typeof useLocale>["t"]["roadmap"]["suggest"]["errors"];

export function SuggestionForm() {
  const { t: dict } = useLocale();
  const t = dict.roadmap.suggest;
  const [area, setArea] = useState<RoadmapArea>("moviehub");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<ErrorKey | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSent(false);
    startTransition(async () => {
      try {
        const result = await suggestFeature({ area, title, detail });
        if (result.error) {
          setError(result.error);
          return;
        }
        setTitle("");
        setDetail("");
        setSent(true);
      } catch {
        setError("failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="suggest-area">{t.area}</Label>
          <select
            id="suggest-area"
            value={area}
            onChange={(event) => setArea(event.target.value as RoadmapArea)}
            className="h-8 rounded-lg border bg-transparent px-2.5 text-sm dark:bg-input/30"
          >
            {ROADMAP_AREAS.map((value) => (
              <option key={value} value={value}>
                {dict.roadmap.areas[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="suggest-title">{t.name}</Label>
          <Input
            id="suggest-title"
            value={title}
            maxLength={60}
            required
            placeholder={t.namePlaceholder}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="suggest-detail">{t.detail}</Label>
        <Textarea
          id="suggest-detail"
          value={detail}
          maxLength={500}
          rows={3}
          placeholder={t.detailPlaceholder}
          onChange={(event) => setDetail(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t.sending : t.submit}
        </Button>
        {sent && (
          <p role="status" className="text-sm text-muted-foreground">
            {t.sent}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t.errors[error]}
          </p>
        )}
      </div>
    </form>
  );
}
