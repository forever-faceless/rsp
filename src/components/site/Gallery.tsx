"use client";

import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Props = { images: string[]; alt: string; className?: string; labels: { photos: string; previous: string; next: string; close: string } };

export function Gallery({ images, alt, className, labels }: Props) {
  const [index, setIndex] = useState<number | null>(null);
  const touch = useRef<number | null>(null);

  const close = useCallback(() => setIndex(null), []);
  const step = useCallback((delta: number) => setIndex((i) => (i == null ? i : (i + delta + images.length) % images.length)), [images.length]);

  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, close, step]);

  if (!images.length) return null;
  const [first, ...rest] = images;
  const side = rest.slice(0, 2);

  return (
    <>
      <div className={cn("relative grid gap-2", side.length ? "md:grid-cols-[2fr_1fr]" : "", className)}>
        <button type="button" onClick={() => setIndex(0)} className="group relative aspect-[16/10] overflow-hidden bg-paper-200" aria-label={`${alt} 1`}>
          <Image src={first} alt={`${alt} 1`} fill priority sizes="(min-width: 768px) 66vw, 100vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
        </button>
        {side.length ? (
          <div className={cn("hidden gap-2 md:grid", side.length === 2 ? "grid-rows-2" : "grid-rows-1")}>
            {side.map((src, i) => (
              <button key={src} type="button" onClick={() => setIndex(i + 1)} className="group relative overflow-hidden bg-paper-200" aria-label={`${alt} ${i + 2}`}>
                <Image src={src} alt={`${alt} ${i + 2}`} fill sizes="33vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
              </button>
            ))}
          </div>
        ) : null}
        {images.length > 1 ? (
          <button
            type="button"
            onClick={() => setIndex(0)}
            className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-[3px] bg-navy-900/90 px-3 py-2 text-[12.5px] font-semibold text-paper-0 transition-colors hover:bg-navy-900"
          >
            <Images className="h-4 w-4 text-gold-300" aria-hidden="true" />
            <span className="num">{images.length}</span> {labels.photos}
          </button>
        ) : null}
      </div>

      {index != null
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-950/96 p-3 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label={alt}
              onClick={close}
              onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touch.current == null) return;
                const dx = e.changedTouches[0].clientX - touch.current;
                touch.current = null;
                if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
              }}
            >
              <button
                type="button"
                onClick={close}
                className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-[3px] border border-paper-0/20 text-paper-0 hover:border-gold-300 hover:text-gold-200"
                aria-label={labels.close}
              >
                <X className="h-5 w-5" />
              </button>
              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      step(-1);
                    }}
                    className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[3px] border border-paper-0/20 text-paper-0 hover:border-gold-300 hover:text-gold-200 sm:inline-flex"
                    aria-label={labels.previous}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      step(1);
                    }}
                    className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[3px] border border-paper-0/20 text-paper-0 hover:border-gold-300 hover:text-gold-200 sm:inline-flex"
                    aria-label={labels.next}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
              <div className="relative h-[82vh] w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
                <Image key={images[index]} src={images[index]} alt={`${alt} ${index + 1}`} fill sizes="100vw" className="object-contain" />
              </div>
              <p className="num absolute bottom-4 text-[13px] text-navy-300">
                {index + 1} / {images.length}
              </p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
