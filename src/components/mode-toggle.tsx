// Lucian UX/UI Prompt #219 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#219
"use client";

import { flushSync } from "react-dom";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";

// The circle's timing, from the original (#219): 0.7s, slow in and out.
const REVEAL_MS = 700;
const REVEAL_EASING = "cubic-bezier(.65,0,.35,1)";

// Circular reveal: dark spreads out in a circle from the button until it covers the page, and
// going back to light the dark circle shrinks into the button again. The browser snapshots the
// old page (View Transitions), so the whole site switches at once underneath; the circle is a
// clip-path on the new snapshot (to dark) or on the old one (to light; globals.css keeps that one
// on top). Without View Transitions, or with reduced motion, the theme simply switches.
export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useLocale();

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof document.startViewTransition !== "function" || reduce) {
      setTheme(next);
      return;
    }
    // The button's center (also right for keyboard presses, which have no pointer position).
    const box = event.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const root = document.documentElement;
    const expand = next === "dark";
    root.dataset.themeReveal = expand ? "expand" : "shrink";
    const transition = document.startViewTransition(() => {
      // next-themes applies the class in an effect; flushSync runs it before the new snapshot.
      flushSync(() => setTheme(next));
      // The new icon turns in (globals.css); set only now so the old snapshot shows it at rest.
      root.dataset.themeTurn = "";
    });
    transition.ready
      .then(() => {
        const circle = [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`];
        root.animate(
          { clipPath: expand ? circle : [...circle].reverse() },
          {
            duration: REVEAL_MS,
            easing: REVEAL_EASING,
            fill: "forwards",
            pseudoElement: expand ? "::view-transition-new(root)" : "::view-transition-old(root)",
          },
        );
      })
      .catch(() => undefined);
    transition.finished.finally(() => {
      delete root.dataset.themeReveal;
      delete root.dataset.themeTurn;
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t.header.toggleTheme}
      onClick={toggle}
      className="theme-toggle"
    >
      <SunIcon className="dark:hidden" />
      <MoonIcon className="hidden dark:block" />
    </Button>
  );
}
