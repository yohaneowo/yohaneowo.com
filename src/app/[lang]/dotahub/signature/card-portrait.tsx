"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// Behind each hero's render, its primary attribute's colour (strength, agility, intelligence,
// universal), like the art panels of the Art Book Next theme.
export const ATTR_BG = [
  "radial-gradient(circle at 50% 30%, #d0574a, #3a0f0b 75%)",
  "radial-gradient(circle at 50% 30%, #4fae5c, #0d2912 75%)",
  "radial-gradient(circle at 50% 30%, #4f8fe0, #0c1a38 75%)",
  "radial-gradient(circle at 50% 30%, #a56ad8, #22103a 75%)",
];

// The same size hint as the pillars', so the flying picture is the one already loaded.
export const RENDER_SIZES = "(min-width: 640px) 240px, 160px";

export type PortraitHero = { id: number; name: string; render: string; attr: number };

// Zoomed to the bust; the idle video uses the same framing so it lines up with the picture.
const FRAME = "origin-[50%_22%] scale-[2.4] object-cover object-[50%_22%]";

// A signature card's hero: the transparent render over its attribute's colour. With a layoutId it
// flies in from the pillar it was painted on. Hovering the card (or, on touch screens, the card
// being in view) loads and loops the hero's idle video from Valve's CDN; it stays the still picture
// with reduced motion, Data Saver, or a video that fails.
export function CardPortrait({
  hero,
  layoutId,
  delay,
}: {
  hero: PortraitHero;
  layoutId?: string;
  delay: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(false);
  const [wanted, setWanted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  // Renders live under /videos/…/renders/<slug>.png, next to <slug>.webm and <slug>.mov.
  const clip = hero.render.includes("/renders/") ? hero.render.replace(/\.png$/, "") : null;

  useEffect(() => {
    const card = box.current?.closest("[data-sig-card]");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (reduce || !clip || !card || connection?.saveData) return;
    const show = (on: boolean) => {
      setActive(on);
      if (on) setWanted(true);
    };
    if (window.matchMedia("(pointer: fine)").matches) {
      const enter = () => show(true);
      const leave = () => show(false);
      card.addEventListener("pointerenter", enter);
      card.addEventListener("pointerleave", leave);
      return () => {
        card.removeEventListener("pointerenter", enter);
        card.removeEventListener("pointerleave", leave);
      };
    }
    const seen = new IntersectionObserver(([entry]) => show(entry.isIntersecting), { threshold: 0.6 });
    seen.observe(card);
    return () => seen.disconnect();
  }, [reduce, clip]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (active) v.play().catch(() => {});
    else v.pause();
  }, [active, wanted]);

  return (
    <motion.div
      ref={box}
      layoutId={layoutId}
      transition={{ layout: { type: "spring", stiffness: 240, damping: 28, delay } }}
      // Above the card's cover only when it flies in; otherwise it shows with the card.
      className={cn("relative size-16 shrink-0 overflow-hidden", layoutId && "z-20")}
      style={{ background: ATTR_BG[hero.attr], borderRadius: 8 }}
    >
      <Image
        src={hero.render}
        alt={hero.name}
        title={hero.name}
        fill
        sizes={RENDER_SIZES}
        className={FRAME}
      />
      {clip && wanted && !failed && (
        <video
          ref={video}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          onPlaying={() => setPlaying(true)}
          className={cn(
            "absolute inset-0 size-full transition-opacity",
            FRAME,
            playing ? "opacity-100" : "opacity-0",
          )}
        >
          {/* Safari takes the HEVC .mov; the others skip it for the VP9 .webm. */}
          <source src={`${clip}.mov`} type='video/mp4; codecs="hvc1"' />
          <source src={`${clip}.webm`} type="video/webm" onError={() => setFailed(true)} />
        </video>
      )}
    </motion.div>
  );
}
