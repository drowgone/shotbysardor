"use client";

import { useEffect, useRef, useState } from "react";

export function Hero({
  content,
  tagline,
}: {
  content: {
    previewUrl: string;
    posterUrl: string | null;
    thumbUrl: string;
    type: "PHOTO" | "VIDEO";
    blurhash: string;
    width: number;
    height: number;
    title: string;
  } | null;
  tagline: string;
}) {
  const [reverse, setReverse] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const key = "hero-kb-dir";
    const prev = localStorage.getItem(key);
    const dir = prev === "1" ? "0" : "1";
    localStorage.setItem(key, dir);
    setReverse(dir === "1");
  }, []);

  // Rasm cache'dan darrov yuklansa onLoad ba'zan chaqirilmaydi — ref orqali tekshiramiz.
  // Fallback timeout: 1.2s dan keyin har qanday holatda blur ko'tariladi
  // (video ijro etilgani bilan bir xil vaqt — MasonryGrid.BlurImage bilan bir hilda).
  useEffect(() => {
    if (!content) return;
    if (content.type === "PHOTO" && imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setMediaReady(true);
      return;
    }
    const t = setTimeout(() => setMediaReady(true), 1200);
    return () => clearTimeout(t);
  }, [content]);

  return (
    <section className="relative h-[85vh] md:h-[95vh] w-full overflow-hidden bg-[var(--placeholder)] media-protect">
      {/* Thumbnail — silliq o'tish uchun blurred placeholder */}
      {content?.thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={content.thumbUrl}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "blur(24px)", transform: "scale(1.1)" }}
        />
      )}
      {/* Fon — kontent bo'lsa clean preview, bo'lmasa oddiy dark */}
      {content && (
        content.type === "VIDEO" ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={content.previewUrl}
            poster={content.posterUrl ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            onLoadedData={() => setMediaReady(true)}
            onCanPlay={() => setMediaReady(true)}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: mediaReady ? 1 : 0,
              filter: mediaReady ? "blur(0px)" : "blur(18px)",
              transform: mediaReady ? "scale(1)" : "scale(1.04)",
              transition:
                "opacity 900ms cubic-bezier(0.22, 1, 0.36, 1), filter 900ms cubic-bezier(0.22, 1, 0.36, 1), transform 1100ms cubic-bezier(0.22, 1, 0.36, 1)",
              willChange: "opacity, filter, transform",
            }}
            onContextMenu={(e) => e.preventDefault()}
            controlsList="nodownload"
          />
        ) : (
          <div className="absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                animation: `kb 14s var(--ease) both`,
                animationDirection: reverse ? "reverse" : "normal",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={content.previewUrl}
                alt={content.title}
                onLoad={() => setMediaReady(true)}
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
                className="w-full h-full object-cover"
                style={{
                  opacity: mediaReady ? 1 : 0,
                  filter: mediaReady ? "blur(0px)" : "blur(18px)",
                  transform: mediaReady ? "scale(1)" : "scale(1.04)",
                  transition:
                    "opacity 900ms cubic-bezier(0.22, 1, 0.36, 1), filter 900ms cubic-bezier(0.22, 1, 0.36, 1), transform 1100ms cubic-bezier(0.22, 1, 0.36, 1)",
                  willChange: "opacity, filter, transform",
                }}
              />
            </div>
          </div>
        )
      )}

      {/* Ustki qorong'ilik — matn o'qilishi uchun */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(8,8,9,0.35) 0%, rgba(8,8,9,0.7) 100%)" }}
      />

      {/* Katta markazlashgan wordmark — kompozitsion belgi */}
      <HeroWordmark tagline={tagline} />

      {/* Pastdagi ingichka scroll cue */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:block">
        <div
          className="w-px h-10 bg-[var(--text-muted)] opacity-60"
          style={{ animation: "pulse 2s var(--ease) infinite" }}
        />
      </div>

      <style>{`
        @keyframes kb { from { transform: scale(1); } to { transform: scale(1.08); } }
        @keyframes pulse { 0%, 100% { opacity: .25; } 50% { opacity: .9; } }
        @keyframes drawIn {
          from { stroke-dashoffset: 100; opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes riseIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

// Katta, chiroyli, markazlashgan wordmark — viewfinder brackets bilan
function HeroWordmark({ tagline }: { tagline: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-6 pointer-events-none">
      <div className="relative flex flex-col items-center gap-4 md:gap-6">
        <div className="relative inline-block">
          {/* To'rt burchak — bracketlar (klassik viewfinder) */}
          <BracketCorner pos="tl" />
          <BracketCorner pos="tr" />
          <BracketCorner pos="bl" />
          <BracketCorner pos="br" />

          {/* Wordmark — juda katta, moslashuvchi */}
          <div
            className="font-display text-[var(--text)] whitespace-nowrap leading-none px-6 md:px-10 py-4 md:py-6"
            style={{
              fontWeight: 500,
              letterSpacing: "-0.03em",
              fontSize: "clamp(2.75rem, 12vw, 8.5rem)",
              textShadow: "0 4px 32px rgba(0,0,0,0.6)",
              animation: "riseIn .7s var(--ease) .35s both",
            }}
          >
            shot by sardor
          </div>
        </div>

        {tagline && (
          <div
            className="meta text-center max-w-xs md:max-w-md text-[var(--text)] opacity-80"
            style={{ animation: "riseIn .5s var(--ease) .7s both" }}
          >
            {tagline}
          </div>
        )}
      </div>
    </div>
  );
}

function BracketCorner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  // Bracket o'lchamlari: mobil kichikroq, desktop kattaroq
  const base = "absolute w-6 h-6 md:w-10 md:h-10";
  const offset = "-1.25rem md:-1.75rem";
  const positions: Record<typeof pos, string> = {
    tl: `top-[-1rem] left-[-1rem] md:top-[-1.5rem] md:left-[-1.5rem] border-l-2 border-t-2`,
    tr: `top-[-1rem] right-[-1rem] md:top-[-1.5rem] md:right-[-1.5rem] border-r-2 border-t-2`,
    bl: `bottom-[-1rem] left-[-1rem] md:bottom-[-1.5rem] md:left-[-1.5rem] border-l-2 border-b-2`,
    br: `bottom-[-1rem] right-[-1rem] md:bottom-[-1.5rem] md:right-[-1.5rem] border-r-2 border-b-2`,
  };
  const delay: Record<typeof pos, string> = {
    tl: "0ms",
    tr: "100ms",
    br: "200ms",
    bl: "300ms",
  };
  return (
    <span
      aria-hidden="true"
      className={`${base} ${positions[pos]} border-[var(--text)]`}
      style={{
        boxShadow: "0 0 24px rgba(0,0,0,0.5)",
        animation: `riseIn .4s var(--ease) ${delay[pos]} both`,
      }}
    />
  );
}
