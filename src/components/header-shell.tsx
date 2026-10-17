"use client";
import { useEffect, useRef, useState } from "react";

// The sticky header slides away while the page scrolls down and comes back as soon as it scrolls
// up (or is near the top), so it never costs reading space but is always one flick away.
const HIDE_AFTER = 80;
const MIN_DELTA = 6;

export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;
        if (y <= HIDE_AFTER) setHidden(false);
        else if (delta > MIN_DELTA) setHidden(true);
        else if (delta < -MIN_DELTA) setHidden(false);
        if (Math.abs(delta) > MIN_DELTA) lastY.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-hidden={hidden || undefined}
      className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur transition-transform duration-300 data-[hidden]:-translate-y-full"
    >
      {children}
    </header>
  );
}
