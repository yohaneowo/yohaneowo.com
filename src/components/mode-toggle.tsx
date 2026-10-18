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
// The page backgrounds (globals.css --background), for the overlay variant.
const BACKGROUND = { light: "oklch(1 0 0)", dark: "oklch(0.145 0 0)" };

// TEMPORARY (finding a one-frame flash): ?reveal=a|b|c|d picks how the switch is done.
// a: view transition, theme applied with flushSync inside the callback (the original approach)
// b: view transition, the callback only flips the <html> class; React catches up afterwards
// c: view transition, the callback waits 50ms before applying the theme
// d: no view transition: a circle of the new background grows over the page, then the theme flips
// e: view transition with the browser's default cross-fade (no circle)
// f: like a, with the header's and sub-navigation's backdrop blur turned off during the switch
// g: like a, without the old theme's color under the snapshots
// h: to dark too, the old snapshot stays on top and a growing circular hole opens in it (the same
//    layering as going back to light, which doesn't flash)
type Variant = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
const VARIANTS: Variant[] = ["a", "b", "c", "d", "e", "f", "g", "h"];

function variant(): Variant {
  const value = new URLSearchParams(window.location.search).get("reveal");
  return VARIANTS.find((v) => v === value) ?? "a";
}

function applyClass(theme: "light" | "dark") {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

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
    const mode = variant();
    if ((mode !== "d" && typeof document.startViewTransition !== "function") || reduce) {
      setTheme(next);
      return;
    }
    // The button's center (also right for keyboard presses, which have no pointer position).
    const box = event.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const root = document.documentElement;
    const circle = [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`];

    if (mode === "d") {
      const overlay = document.createElement("div");
      overlay.setAttribute("aria-hidden", "true");
      Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483647",
        pointerEvents: "none",
        background: BACKGROUND[next],
        clipPath: circle[0],
      });
      document.body.appendChild(overlay);
      const grow = overlay.animate(
        { clipPath: circle },
        { duration: REVEAL_MS, easing: REVEAL_EASING, fill: "forwards" },
      );
      grow.finished.then(() => {
        flushSync(() => setTheme(next));
        const fade = overlay.animate(
          { opacity: [1, 0] },
          { duration: 180, easing: "ease-out", fill: "forwards" },
        );
        fade.finished.finally(() => overlay.remove());
      });
      return;
    }

    if (mode === "e") {
      document.startViewTransition(() => flushSync(() => setTheme(next)));
      return;
    }
    if (mode === "f") root.dataset.themeNoBlur = "";
    if (mode === "g") root.dataset.themeNoBackdrop = "";

    const expand = next === "dark";
    root.dataset.themeReveal = expand ? (mode === "h" ? "hole" : "expand") : "shrink";
    // Where the circle starts; globals.css clips the new snapshot to it from its very first frame,
    // since the script's animation only starts a frame later (after `ready`).
    root.style.setProperty("--theme-reveal-at", `${x}px ${y}px`);
    const transition = document.startViewTransition(async () => {
      if (mode === "c") await new Promise((resolve) => setTimeout(resolve, 50));
      if (mode === "b") applyClass(next);
      // next-themes applies the class in an effect; flushSync runs it before the new snapshot.
      else flushSync(() => setTheme(next));
      // The new icon turns in (globals.css); set only now so the old snapshot shows it at rest.
      root.dataset.themeTurn = "";
    });
    if (mode === "b") transition.updateCallbackDone.then(() => setTheme(next)).catch(() => undefined);
    transition.ready
      .then(() => {
        if (expand && mode === "h") {
          // The hole is a mask on the old snapshot (globals.css) sized by --theme-hole.
          root.animate(
            { "--theme-hole": ["0px", `${radius}px`] },
            {
              duration: REVEAL_MS,
              easing: REVEAL_EASING,
              fill: "forwards",
              pseudoElement: "::view-transition-old(root)",
            },
          );
          return;
        }
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
      delete root.dataset.themeNoBlur;
      delete root.dataset.themeNoBackdrop;
      root.style.removeProperty("--theme-reveal-at");
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
