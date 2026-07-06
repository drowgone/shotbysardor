"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Info, MessageSquare, Share2, ShoppingCart, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { uz } from "@/lib/i18n/uz";
import { formatDate, cn } from "@/lib/utils";
import { CommentsDrawer } from "@/components/comments/CommentsDrawer";
import { OrderModal } from "@/components/order/OrderModal";
import { GesturePlayer } from "./GesturePlayer";

export type LightboxContent = {
  id: string;
  slug: string;
  type: "PHOTO" | "VIDEO";
  title: string;
  description: string | null;
  previewUrl: string;
  posterUrl: string | null;
  width: number;
  height: number;
  genres: { name: string }[];
  location: { name: string };
  capturedAt: string;
  viewsCount: number;
  commentsCount: number;
  priceUZS: number;
  durationSec: number | null;
};

export function Lightbox({
  content,
  onClose,
  overlay = true,
}: {
  content: LightboxContent;
  onClose?: () => void;
  overlay?: boolean;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [viewCount, setViewCount] = useState(content.viewsCount);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 3 soniyalik ko'rish qoidasi
  useEffect(() => {
    viewTimer.current = setTimeout(() => {
      fetch(`/api/contents/${content.slug}/view`, { method: "POST" })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setViewCount((v) => v + 1);
        })
        .catch(() => {});
    }, 3000);
    return () => {
      if (viewTimer.current) clearTimeout(viewTimer.current);
    };
  }, [content.slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Orqa sahifa scroll bo'lmasin — faqat lightbox ichi scroll qiladi.
  useEffect(() => {
    const prev = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (sw > 0) document.body.style.paddingRight = `${sw}px`;
    return () => {
      document.body.style.overflow = prev;
      document.body.style.paddingRight = prevPadding;
    };
  }, []);

  async function share() {
    const url = window.location.origin + `/p/${content.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: content.title, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      alert(uz.toasts.copied);
    }
  }

  const meta = `${content.genres.map((g) => g.name.toUpperCase()).join(" · ")} · ${content.location.name.toUpperCase()} · ${formatDate(content.capturedAt)} · ${viewCount} ${uz.card.views}`;

  return (
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={content.title}
      initial={overlay ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 bg-[var(--bg)]/95 backdrop-blur-md flex items-center justify-center media-protect"
    >
      {onClose && (
        <button
          onClick={onClose}
          aria-label={uz.common.close}
          className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text)] z-40"
        >
          <X size={20} strokeWidth={1.5} />
        </button>
      )}

      <div className="relative w-full h-full flex items-center justify-center p-4 md:p-8">
        <div
          className="relative max-w-[92vw] max-h-[88vh] flex items-center justify-center"
          style={{ aspectRatio: `${content.width} / ${content.height}` }}
        >
          <motion.div
            layoutId={`card-${content.slug}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full relative"
          >
            {content.type === "PHOTO" ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={content.previewUrl}
                alt={content.title}
                className="w-full h-full object-contain"
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
              />
            ) : (
              <GesturePlayer src={content.previewUrl} poster={content.posterUrl} />
            )}
          </motion.div>
        </div>

        {/* Bottom bar */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-0 bottom-0 p-4 md:p-6 scrim-grad z-40"
        >
          <div className="max-w-4xl mx-auto flex flex-col gap-2">
            <div className="flex items-end justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="h3">{content.title}</h1>
                <div className="meta mt-1 flex items-center gap-2">
                  <span className="flex items-center gap-1"><Eye size={12} strokeWidth={1.5} /></span>
                  <span>{meta}</span>
                  {content.description && (
                    <button
                      onClick={() => setShowInfo((v) => !v)}
                      className="ml-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                      aria-label={uz.lightbox.info}
                    >
                      <Info
                        size={14}
                        strokeWidth={1.5}
                        className={cn("transition-transform", showInfo && "rotate-180")}
                      />
                    </button>
                  )}
                </div>
                <AnimatePresence initial={false}>
                  {showInfo && content.description && (
                    <motion.p
                      key="desc"
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="text-sm text-[var(--text-muted)] max-w-[60ch] overflow-hidden"
                    >
                      {content.description}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setCommentsOpen(true)}
                  className="inline-flex items-center gap-2 h-11 px-3 rounded-[var(--r-control)] border border-[var(--border-strong)] hover:border-[var(--accent)]"
                  aria-label={uz.lightbox.comments}
                >
                  <MessageSquare size={16} strokeWidth={1.5} />
                  <span className="hidden md:inline text-sm">{content.commentsCount}</span>
                </button>
                <button
                  onClick={share}
                  className="inline-flex items-center gap-2 h-11 px-3 rounded-[var(--r-control)] border border-[var(--border-strong)] hover:border-[var(--accent)]"
                  aria-label={uz.lightbox.share}
                >
                  <Share2 size={16} strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setOrderOpen(true)}
                  className="inline-flex items-center gap-2 h-11 px-4 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium transition-colors"
                >
                  <ShoppingCart size={16} strokeWidth={1.5} />
                  <span className="hidden sm:inline text-sm">{uz.lightbox.order}</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {commentsOpen && (
          <CommentsDrawer contentSlug={content.slug} onClose={() => setCommentsOpen(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {orderOpen && (
          <OrderModal
            content={{
              id: content.id,
              slug: content.slug,
              title: content.title,
              thumbUrl: content.previewUrl,
              priceUZS: content.priceUZS,
            }}
            onClose={() => setOrderOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
