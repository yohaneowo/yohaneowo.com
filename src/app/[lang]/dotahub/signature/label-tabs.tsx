"use client";

import { type ReactNode, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { cn } from "@/lib/utils";

export type LabelGroup = { key: string; name: string; cards: ReactNode[] };

// The signature cards one label at a time (current / potential / historic), with a sliding
// highlight under the tabs and the cards rising in one after another on a switch.
export function LabelTabs({ groups }: { groups: LabelGroup[] }) {
  const shown = groups.filter((g) => g.cards.length);
  const [active, setActive] = useState(shown[0]?.key);
  const group = shown.find((g) => g.key === active) ?? shown[0];
  if (!group) return null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-3">
        <div role="tablist" className="flex gap-1 self-start rounded-lg bg-muted p-1 text-sm">
          {shown.map((g) => (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={g.key === group.key}
              onClick={() => setActive(g.key)}
              className={cn(
                "relative cursor-pointer rounded-md px-3 py-1 transition-colors",
                g.key === group.key ? "font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {g.key === group.key && (
                <motion.span
                  layoutId="signature-tab"
                  className="absolute inset-0 rounded-md bg-background shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative">
                {g.name} <span className="text-xs text-muted-foreground tabular-nums">{g.cards.length}</span>
              </span>
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={group.key}
            role="tabpanel"
            className="grid gap-3 pt-3 sm:grid-cols-2 xl:grid-cols-3"
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
          >
            {group.cards.map((card, i) => (
              <motion.div
                key={i}
                className="grid"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 32, delay: Math.min(i, 8) * 0.04 }}
              >
                {card}
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
