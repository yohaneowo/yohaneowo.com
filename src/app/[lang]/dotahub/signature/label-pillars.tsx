"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { XIcon } from "lucide-react";
import { LayoutGroup, MotionConfig, motion, useAnimate, useReducedMotion } from "motion/react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export type LabelGroup = {
  key: "historic" | "current" | "potential";
  name: string;
  cards: ReactNode[];
  // The heroes painted on the pillar (a few, first ones first).
  art: { id: number; name: string; render: string; attr: number }[];
  // Each card's hero, in card order, for the entrance.
  cast: { name: string; render: string }[];
};

// One size for every render, so the entrance reuses the pictures the pillars loaded.
const RENDER_SIZES = "320px";

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

// Behind each hero's render, its primary attribute's colour (strength, agility, intelligence,
// universal), like the art panels of the Art Book Next theme.
const ATTR_BG = [
  "radial-gradient(circle at 50% 30%, #d0574a, #3a0f0b 75%)",
  "radial-gradient(circle at 50% 30%, #4fae5c, #0d2912 75%)",
  "radial-gradient(circle at 50% 30%, #4f8fe0, #0c1a38 75%)",
  "radial-gradient(circle at 50% 30%, #a56ad8, #22103a 75%)",
];
const RING: Record<LabelGroup["key"], string> = {
  current: "ring-amber-400/80",
  historic: "ring-white/25",
  potential: "ring-sky-400/70",
};
const NUMBER: Record<LabelGroup["key"], string> = {
  current: "text-amber-300",
  historic: "text-white/85",
  potential: "text-sky-300",
};

// A pillar's face: its heroes side by side in slanted strips, darkened toward the bottom.
function Art({ g }: { g: LabelGroup }) {
  return (
    <span
      className={cn(
        "absolute inset-0 -skew-x-[8deg] overflow-hidden rounded-xl bg-black",
        g.key === "current" && "shadow-[0_0_28px_-4px] shadow-amber-500/50",
      )}
    >
      <span className="absolute inset-0 flex gap-[3px]">
        {g.art.length ? (
          g.art.map((a) => (
            <span
              key={a.id}
              className="relative flex-1 overflow-hidden"
              style={{ background: ATTR_BG[a.attr] }}
            >
              <Image
                src={a.render}
                alt={a.name}
                fill
                sizes={RENDER_SIZES}
                className="origin-[50%_22%] scale-[1.5] skew-x-[8deg] object-cover object-[50%_22%] brightness-90 transition duration-500 group-enabled:group-hover:scale-[1.65] group-enabled:group-hover:brightness-110"
              />
            </span>
          ))
        ) : (
          <span className="flex-1 bg-[repeating-linear-gradient(135deg,#1c1c1f_0_10px,#151517_10px_20px)]" />
        )}
      </span>
      <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
      <span className={cn("absolute inset-0 rounded-xl ring-2 ring-inset", RING[g.key])} />
    </span>
  );
}

const SPRING = { type: "spring", stiffness: 260, damping: 30 } as const;

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

// An opened pillar. Its heroes come on one at a time: each one's render appears big in the middle of
// the screen, then shrinks onto its card's hero picture and fades there, and that card shows. A click
// anywhere skips the rest. The cards keep their own small pictures; only the entrance uses renders.
function Panel({ g, onClose }: { g: LabelGroup; onClose: () => void }) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const grid = useRef<HTMLDivElement>(null);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [playing, setPlaying] = useState(!reduce && g.cast.length > 0);
  const [revealed, setRevealed] = useState(playing ? 0 : g.cards.length);
  const skipped = useRef(false);
  const running = useRef<{ complete: () => void }[]>([]);

  function skip() {
    skipped.current = true;
    running.current.forEach((a) => a.complete());
  }

  useEffect(() => {
    if (!playing) return;
    let stop = false;
    const run = async () => {
      // Let the panel finish growing, so the cards are where they will stay.
      await wait(450);
      for (let i = 0; i < g.cast.length; i++) {
        if (stop || skipped.current) break;
        const actor = scope.current?.querySelector<HTMLElement>(`[data-actor="${i}"]`);
        const target = grid.current?.children[i]?.querySelector("[data-sig-hero]")?.getBoundingClientRect();
        if (actor && target) {
          const from = actor.getBoundingClientRect();
          const enter = animate(
            actor,
            { opacity: [0, 1], scale: [0.7, 1] },
            { duration: 0.3, ease: "easeOut" },
          );
          running.current = [enter];
          await enter;
          if (stop || skipped.current) break;
          const fly = animate(
            actor,
            {
              x: target.left + target.width / 2 - (from.left + from.width / 2),
              y: target.top + target.height / 2 - (from.top + from.height / 2),
              scale: (target.height * 1.8) / from.height,
            },
            { delay: 0.3, duration: 0.45, ease: [0.4, 0, 0.2, 1] },
          );
          const fade = animate(actor, { opacity: 0 }, { delay: 0.62, duration: 0.15 });
          running.current = [fly, fade];
          await Promise.all([fly, fade]);
        }
        if (!stop) setRevealed(i + 1);
      }
      if (!stop) {
        setRevealed(g.cards.length);
        setPlaying(false);
      }
    };
    run();
    return () => {
      stop = true;
    };
  }, [playing, g, animate, scope]);

  return (
    <div className="flex flex-col gap-3 p-3">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.15 } }}
        className="flex items-center justify-between"
      >
        <span className={cn("font-medium", INK[g.key])}>
          {g.name} <span className="text-sm text-muted-foreground tabular-nums">{g.cards.length}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.dotahub.signature.closePillar}
          title={t.dotahub.signature.closePillar}
          className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      </motion.div>
      <div
        ref={grid}
        className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-x-3 gap-y-5 pt-3 pr-2"
      >
        {g.cards.map((card, i) => (
          <motion.div
            key={i}
            className="grid"
            initial={{ opacity: 0, y: 12 }}
            animate={i < revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          >
            {card}
          </motion.div>
        ))}
      </div>
      {/* Fixed to the screen, so outside the panel (its layout animation transforms it). */}
      {playing &&
        createPortal(
          <div ref={scope} onClick={skip} role="presentation" className="fixed inset-0 z-50 cursor-pointer">
            {g.cast.map((c, i) => (
              <div
                key={i}
                data-actor={i}
                className="absolute top-1/2 left-1/2 size-[min(300px,70vw)] -translate-x-1/2 -translate-y-1/2 opacity-0 drop-shadow-[0_10px_24px_rgb(0_0_0/0.6)]"
              >
                <Image src={c.render} alt={c.name} fill sizes={RENDER_SIZES} className="object-contain" />
              </div>
            ))}
            <p className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
              {t.dotahub.signature.skipIntro}
            </p>
          </div>,
          document.body,
        )}
    </div>
  );
}

// The signature labels as three slanted art pillars (historic / current / potential, current the
// widest), after the system view of the ES-DE theme Art Book Next. Clicking one grows it into the
// panel of its cards while the other two shrink to strips at its sides, which switch to theirs; the
// cross on the panel puts the pillars back.
export function LabelPillars({ groups }: { groups: LabelGroup[] }) {
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
          className={cn(
            "flex flex-col gap-3 sm:flex-row",
            open ? "sm:items-stretch" : "px-2 sm:gap-4 sm:px-5",
          )}
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
                  "relative",
                  state === "panel" && "overflow-hidden border border-border sm:flex-1",
                  state === "pillar" &&
                    (g.key === "current" ? "h-28 sm:h-64 sm:flex-[1.4]" : "h-24 sm:h-64 sm:flex-1"),
                  state === "strip" && cn("overflow-hidden border sm:w-14 sm:shrink-0", TONE[g.key]),
                  empty && "opacity-60",
                )}
              >
                {state === "panel" ? (
                  <Panel key="panel" g={g} onClose={() => setOpen(null)} />
                ) : state === "pillar" ? (
                  <motion.button
                    key="pillar"
                    type="button"
                    data-pillar
                    disabled={empty}
                    aria-expanded={false}
                    onClick={() => setOpen(g.key)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={empty ? undefined : { y: -4 }}
                    whileTap={empty ? undefined : { scale: 0.98 }}
                    className="group relative flex size-full flex-col items-center justify-center text-white enabled:cursor-pointer sm:justify-end sm:pb-6"
                  >
                    <Art g={g} />
                    <span className="relative flex items-baseline gap-3 [text-shadow:0_2px_8px_rgb(0_0_0/0.8)] sm:flex-col sm:items-center sm:gap-0">
                      <span className="text-xl font-black tracking-wider sm:text-2xl">{g.name}</span>
                      <span className={cn("text-3xl font-black tabular-nums sm:text-5xl", NUMBER[g.key])}>
                        {g.cards.length}
                      </span>
                    </span>
                  </motion.button>
                ) : (
                  <button
                    type="button"
                    data-pillar
                    disabled={empty}
                    aria-expanded={false}
                    onClick={() => setOpen(g.key)}
                    className="flex size-full items-center gap-3 p-3 text-left enabled:cursor-pointer sm:flex-col sm:justify-start sm:gap-2 sm:px-0 sm:pt-4"
                  >
                    <motion.span
                      layout="position"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "font-medium sm:tracking-widest sm:[writing-mode:vertical-rl]",
                        INK[g.key],
                      )}
                    >
                      {g.name}
                    </motion.span>
                    <span className="ml-auto text-sm text-muted-foreground tabular-nums sm:ml-0">
                      {g.cards.length}
                    </span>
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
