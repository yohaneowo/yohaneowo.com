"use client";

import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export type LabelGroup = {
  key: "historic" | "current" | "potential";
  name: string;
  cards: ReactNode[];
  // A few hero pictures for the pillar.
  preview: ReactNode[];
};

const TONE: Record<LabelGroup["key"], string> = {
  current:
    "border-amber-500/50 bg-gradient-to-t from-amber-500/25 via-amber-500/5 to-transparent shadow-[0_0_24px_-6px] shadow-amber-500/40",
  historic: "border-foreground/20 bg-gradient-to-t from-foreground/10 to-transparent",
  potential: "border-sky-500/50 bg-gradient-to-t from-sky-500/20 to-transparent",
};
const INK: Record<LabelGroup["key"], string> = {
  current: "text-amber-600 dark:text-amber-400",
  historic: "text-foreground",
  potential: "text-sky-600 dark:text-sky-400",
};

const SPRING = { type: "spring", stiffness: 260, damping: 30 } as const;

// The signature labels as three pillars (historic / current / potential, current the tallest).
// Clicking one grows it into the panel of its cards while the other two shrink to strips at its
// sides, which switch to theirs; the cross on the panel puts the pillars back.
export function LabelPillars({ groups }: { groups: LabelGroup[] }) {
  const { t } = useLocale();
  const [open, setOpen] = useState<LabelGroup["key"] | null>(null);
  const row = useRef<HTMLDivElement>(null);

  // Left / right move between the pillars, like a tab list.
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const buttons = [
      ...(row.current?.querySelectorAll<HTMLButtonElement>("button[data-pillar]:enabled") ?? []),
    ];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    buttons[(at + (e.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
  }

  return (
    <MotionConfig reducedMotion="user" transition={SPRING}>
      <LayoutGroup>
        <div
          ref={row}
          onKeyDown={onKeyDown}
          className={cn("flex flex-col gap-3 sm:flex-row", open ? "sm:items-stretch" : "sm:items-end")}
        >
          {groups.map((g) => {
            const state = open == null ? "pillar" : open === g.key ? "panel" : "strip";
            const empty = !g.cards.length;
            return (
              <motion.div
                key={g.key}
                layout
                style={{ borderRadius: 12 }}
                className={cn(
                  "relative overflow-hidden border",
                  state === "panel" ? "border-border sm:flex-1" : TONE[g.key],
                  state === "pillar" && "sm:flex-1",
                  state === "pillar" && (g.key === "current" ? "sm:h-60" : "sm:h-44"),
                  state === "strip" && "sm:w-14 sm:shrink-0",
                  empty && "opacity-50",
                )}
              >
                {state === "panel" ? (
                  <motion.div
                    key="panel"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { delay: 0.15 } }}
                    className="flex flex-col gap-3 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn("font-medium", INK[g.key])}>
                        {g.name}{" "}
                        <span className="text-sm text-muted-foreground tabular-nums">{g.cards.length}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpen(null)}
                        aria-label={t.dotahub.signature.closePillar}
                        title={t.dotahub.signature.closePillar}
                        className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <XIcon className="size-4" aria-hidden />
                      </button>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-x-3 gap-y-5 pt-3 pr-2">
                      {g.cards.map((card, i) => (
                        <motion.div
                          key={i}
                          className="grid"
                          initial={{ opacity: 0, y: 16 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            transition: { ...SPRING, delay: 0.2 + Math.min(i, 8) * 0.05 },
                          }}
                        >
                          {card}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <button
                    type="button"
                    data-pillar
                    disabled={empty}
                    aria-expanded={false}
                    onClick={() => setOpen(g.key)}
                    className={cn(
                      "group flex size-full items-center gap-3 p-3 text-left enabled:cursor-pointer",
                      state === "pillar"
                        ? "sm:flex-col sm:justify-end sm:text-center"
                        : "sm:flex-col sm:justify-start sm:px-0 sm:pt-4",
                    )}
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={state}
                        layout="position"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                        className={cn(
                          "flex items-center gap-3",
                          state === "pillar"
                            ? "flex-1 sm:flex-none sm:flex-col"
                            : "flex-1 sm:flex-col sm:gap-2",
                        )}
                      >
                        {state === "pillar" && g.preview.length > 0 && (
                          <span className="flex -space-x-2 transition-transform group-enabled:group-hover:-translate-y-1">
                            {g.preview}
                          </span>
                        )}
                        <span
                          className={cn(
                            "font-medium",
                            INK[g.key],
                            state === "strip" && "sm:tracking-widest sm:[writing-mode:vertical-rl]",
                          )}
                        >
                          {g.name}
                        </span>
                        <span
                          className={cn(
                            "text-muted-foreground tabular-nums",
                            state === "pillar"
                              ? "ml-auto text-2xl font-semibold sm:ml-0"
                              : "ml-auto text-sm sm:ml-0",
                          )}
                        >
                          {g.cards.length}
                        </span>
                      </motion.span>
                    </AnimatePresence>
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
