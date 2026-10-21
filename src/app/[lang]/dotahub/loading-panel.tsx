"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export type LoadingKind = "deaths" | "economy" | "imp" | "signature";

const Block = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-xl bg-muted/50", className)} />
);

// The page's own outline while its data loads.
function Outline({ kind }: { kind: LoadingKind }) {
  if (kind === "deaths")
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Block className="aspect-square max-h-[560px] w-full" />
        <div className="flex flex-col gap-3">
          <Block className="h-24" />
          <Block className="h-40" />
          <Block className="h-28" />
        </div>
      </div>
    );
  if (kind === "signature")
    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-4 px-5">
          {[1, 1.4, 1].map((grow, i) => (
            <div
              key={i}
              className="h-64 -skew-x-[8deg] animate-pulse rounded-xl bg-muted/50"
              style={{ flex: grow }}
            />
          ))}
        </div>
        <Block className="h-40" />
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Block key={i} className="h-20" />
        ))}
      </div>
      <Block className="h-72" />
      <Block className="h-56" />
    </div>
  );
}

// What a page shows while it loads: its outline, a moving bar and what it's doing. The steps move on
// by time (the server can't report progress), stopping at the last; the note says the first visit
// is the slow one. Plain CSS animation, no Motion: as a Suspense fallback it's prerendered, where
// Motion reads the clock and random values (Next.js refuses both there).
export function LoadingPanel({ kind }: { kind: LoadingKind }) {
  const t = useLocale().t.dotahub.loading;
  const steps = t.steps[kind];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1800);
    return () => clearInterval(timer);
  }, [steps.length]);
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="relative h-1 overflow-hidden rounded-full bg-muted">
          <span className="loading-bar absolute inset-y-0 w-1/3 rounded-full bg-amber-500/80" />
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          {/* A new key per step replays the entrance (tw-animate-css, which honours reduced motion). */}
          <span key={step} className="animate-in font-medium duration-300 fade-in slide-in-from-bottom-1">
            {steps[step]}
          </span>
          <span className="text-xs text-muted-foreground">{t.firstVisit}</span>
        </div>
      </div>
      <Outline kind={kind} />
    </div>
  );
}
