"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Play } from "lucide-react";
import { BlurImage } from "./BlurImage";
import { uz } from "@/lib/i18n/uz";
import { formatYear, qualityLabel, cn } from "@/lib/utils";
import type { ContentCard } from "./types";

export function MasonryGrid({
  items,
  loading,
}: {
  items: ContentCard[];
  loading?: boolean;
}) {
  const [cols, setCols] = useState(3);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      if (w >= 1536) setCols(4);
      else if (w >= 1024) setCols(3);
      else if (w >= 640) setCols(2);
      else setCols(1);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Chapdan-o'ngga taqsimlash — eng past ustunga qo'shish (JS masonry).
  const layout = useMemo(() => {
    const columns: ContentCard[][] = Array.from({ length: cols }, () => []);
    const heights = new Array<number>(cols).fill(0);
    for (const it of items) {
      let minIdx = 0;
      let mh = heights[0];
      for (let i = 1; i < cols; i++) {
        if (heights[i] < mh) {
          mh = heights[i];
          minIdx = i;
        }
      }
      const aspect = it.width / it.height;
      columns[minIdx].push(it);
      heights[minIdx] += 1 / aspect;
    }
    return columns;
  }, [items, cols]);

  return (
    <div className="w-full">
      <div className="grid gap-3 md:gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {layout.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-3 md:gap-4">
            <AnimatePresence initial>
              {col.map((it, idx) => (
                <MasonryCard key={it.slug} item={it} priority={ci === 0 && idx === 0} />
              ))}
            </AnimatePresence>
          </div>
        ))}
      </div>
      {loading && <div className="h-16 flex items-center justify-center meta">{uz.states.loading}</div>}
    </div>
  );
}

function MasonryCard({ item, priority }: { item: ContentCard; priority?: boolean }) {
  return (
    <motion.div
      layout
      layoutId={`card-${item.slug}`}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.97 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="group relative media-protect"
    >
      <Link href={`/p/${item.slug}`} className="block relative">
        <div className="relative rounded-[var(--r-media)] overflow-hidden bg-[var(--placeholder)]">
          <BlurImage
            src={item.thumbUrl}
            alt={item.title}
            blurhash={item.blurhash}
            width={item.width}
            height={item.height}
            eager={priority}
            sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="transition-transform duration-[700ms] ease-[cubic-bezier(.2,.6,.2,1)] group-hover:scale-[1.03]"
          />
          {item.type === "VIDEO" && item.previewUrl && (
            <AutoPlayVideo src={item.previewUrl} poster={item.posterUrl ?? item.thumbUrl} />
          )}
          <QualityBadge
            origWidth={item.origWidth ?? item.width}
            origHeight={item.origHeight ?? item.height}
          />
        </div>
        {item.type === "VIDEO" && item.durationSec !== null && (
          <span className="absolute top-2 right-2 meta bg-[var(--scrim)] text-[var(--text)] px-2 py-1 rounded">
            {formatDuration(item.durationSec ?? 0)}
          </span>
        )}
        {item.type === "VIDEO" && (
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <Play size={40} strokeWidth={1.5} className="text-white" />
          </span>
        )}
        {/* Hover meta (desktop) */}
        <div className="hidden md:flex absolute inset-x-0 bottom-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none scrim-grad flex-col gap-1">
          <h3 className="font-body font-medium text-[var(--text)]">{item.title}</h3>
          <div className="flex items-center gap-2 meta">
            <span>{item.genres.map((g) => g.name.toUpperCase()).join(" · ")} · {item.location.name.toUpperCase()} · {formatYear(item.capturedAt)}</span>
            <span className="ml-auto flex items-center gap-1"><Eye size={12} strokeWidth={1.5} /> {item.viewsCount}</span>
          </div>
        </div>
        {/* Mobile meta always */}
        <div className="md:hidden mt-2 flex flex-col gap-1">
          <h3 className="font-body text-sm text-[var(--text)]">{item.title}</h3>
          <div className="meta text-[10px]">
            {item.genres.map((g) => g.name.toUpperCase()).join(" · ")} · {item.location.name.toUpperCase()} · {formatYear(item.capturedAt)}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// Ovozsiz avto-ijro: karta ekrandan chiqqanda pauza qiladi, kirganda ijro etadi.
// Poster BlurImage tepasida — video preload va play qilmaguncha yashiramiz.
function AutoPlayVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Foydalanuvchi "reduced motion" tanlasa avto-ijro qilmaymiz
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5) {
            el.play().catch(() => {
              // Autoplay taqiqlangan bo'lsa jim qolamiz — poster ko'rinib turadi
            });
          } else {
            el.pause();
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      onPlaying={() => setReady(true)}
      className={cn(
        "absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300",
        ready ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

function formatDuration(s: number) {
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// Sifat rozetkasi — design.md §7 dagi video duration chip pattern'i bilan bir xil:
// mono, --scrim fon, bone matn, soyasiz. Top-left (duration top-right'da).
function QualityBadge({
  origWidth,
  origHeight,
}: {
  origWidth: number | null;
  origHeight: number | null;
}) {
  const label = qualityLabel(origWidth, origHeight);
  if (!label) return null;
  return (
    <span
      className="absolute top-2 left-2 meta bg-[var(--scrim)] text-[var(--text)] px-2 py-1 rounded pointer-events-none"
      aria-label={`Sifat: ${label}`}
    >
      {label}
    </span>
  );
}
