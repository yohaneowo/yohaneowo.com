"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon, XIcon } from "lucide-react";
import { cn } from "cn";
import { useLocale } from "@/i18n/locale-provider";

export type LightboxState = { images: string[]; index: number } | null;

let state: LightboxState = null;
const listeners = new Set<() => void>();

const lightbox = {
  get: () => state,
  set(next: LightboxState) {
    state = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function openLightbox(images: string[], index = 0): void {
  if (!images.length) {
    closeLightbox();
    return;
  }
  const i = Number.isFinite(index) ? Math.trunc(index) : 0;
  lightbox.set({ images: [...images], index: ((i % images.length) + images.length) % images.length });
}

// Whether it is showing (others' Escape / click-outside handlers leave it alone then).
export function lightboxOpen(): boolean {
  return lightbox.get() !== null;
}

export function closeLightbox(): void {
  lightbox.set(null);
}

function moveImage(delta: number) {
  const current = lightbox.get();
  if (!current || current.images.length < 2) return;
  lightbox.set({
    ...current,
    index: (current.index + delta + current.images.length) % current.images.length,
  });
}

function LightboxImage({ src }: { src: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [zoomed, setZoomed] = useState(false);

  return (
    <div className="absolute inset-0 flex overflow-auto px-[4vw] py-[5vh]">
      {status === "loading" && (
        <Loader2Icon className="pointer-events-none fixed top-1/2 left-1/2 size-8 -translate-1/2 animate-spin" />
      )}
      {status === "error" && <span className="m-auto">—</span>}
      <button
        type="button"
        className={cn(
          "m-auto shrink-0 focus-visible:outline-2 focus-visible:outline-white",
          zoomed ? "cursor-zoom-out" : "cursor-zoom-in",
          status !== "ready" && "invisible",
          status === "error" && "hidden",
        )}
        onClick={(event) => {
          event.stopPropagation();
          setZoomed((value) => !value);
        }}
        disabled={status !== "ready"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- private images through our own proxy */}
        <img
          src={src}
          alt=""
          className={cn(
            "block object-contain",
            zoomed ? "max-h-none max-w-none" : "max-h-[90vh] max-w-[92vw]",
          )}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
          draggable={false}
        />
      </button>
    </div>
  );
}

export function ImageLightbox(): React.ReactElement | null {
  const current = useSyncExternalStore(lightbox.subscribe, lightbox.get, () => null);
  const { t } = useLocale();
  const text = t.coinhub.posts.lightbox;
  const open = current !== null;

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    const focused = document.activeElement;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        moveImage(event.key === "ArrowLeft" ? -1 : 1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKeyDown);
      if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
    };
  }, [open]);

  if (!current || typeof document === "undefined") return null;
  const src = current.images[current.index];
  const control =
    "absolute z-10 flex size-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={text.original}
      className="fixed inset-0 z-[100] bg-black/85 text-white"
      onClick={closeLightbox}
    >
      <LightboxImage key={`${current.index}:${src}`} src={src} />
      <button
        type="button"
        autoFocus
        aria-label={text.close}
        className={cn(control, "top-4 right-4")}
        onClick={(event) => {
          event.stopPropagation();
          closeLightbox();
        }}
      >
        <XIcon className="size-5" />
      </button>
      {current.images.length > 1 && (
        <>
          <button
            type="button"
            aria-label={text.previous}
            className={cn(control, "top-1/2 left-4 -translate-y-1/2")}
            onClick={(event) => {
              event.stopPropagation();
              moveImage(-1);
            }}
          >
            <ChevronLeftIcon className="size-6" />
          </button>
          <button
            type="button"
            aria-label={text.next}
            className={cn(control, "top-1/2 right-4 -translate-y-1/2")}
            onClick={(event) => {
              event.stopPropagation();
              moveImage(1);
            }}
          >
            <ChevronRightIcon className="size-6" />
          </button>
          <div
            className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-sm"
            aria-live="polite"
          >
            {current.index + 1} / {current.images.length}
          </div>
        </>
      )}
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="absolute right-4 bottom-4 z-10 rounded bg-black/40 px-3 py-2 text-sm hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        {text.original}
      </a>
    </div>,
    document.body,
  );
}
