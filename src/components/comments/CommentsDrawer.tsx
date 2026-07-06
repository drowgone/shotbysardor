"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Send, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { uz } from "@/lib/i18n/uz";
import { formatTimeAgo, cn, randomId } from "@/lib/utils";
import { useLiveEvent } from "@/lib/live/use-live";

type Comment = {
  id: string;
  name: string;
  text: string;
  createdAt: string;
  isAdmin: boolean;
  likesCount: number;
  likedByMe: boolean;
  replies: Comment[];
  optimistic?: boolean;
};

export function CommentsDrawer({ contentSlug, onClose }: { contentSlug: string; onClose: () => void }) {
  const [items, setItems] = useState<Comment[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lastSubmit = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem("sbs-name");
    if (stored) setName(stored);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/contents/${contentSlug}/comments`, { cache: "no-store" });
      const d = await res.json();
      const withDefaults = (c: Partial<Comment>): Comment => ({
        id: c.id!,
        name: c.name!,
        text: c.text!,
        createdAt: c.createdAt!,
        isAdmin: !!c.isAdmin,
        likesCount: c.likesCount ?? 0,
        likedByMe: !!c.likedByMe,
        replies: (c.replies ?? []).map(withDefaults),
      });
      setItems((d.items ?? []).map(withDefaults));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [contentSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live: shu kontent'ning izohlariga tegishli event (tasdiqlash, javob, like) —
  // avtomatik refetch. Foydalanuvchi yozayotgan matnga tegmaymiz (o'zgarmagan).
  useLiveEvent(`comments:${contentSlug}`, () => {
    void load();
  });

  async function submit() {
    if (!name.trim() || !text.trim()) return;
    const now = Date.now();
    if (now - lastSubmit.current < 30_000) {
      setPendingMsg(uz.states.error);
      return;
    }
    lastSubmit.current = now;
    localStorage.setItem("sbs-name", name.trim());

    const tempId = `tmp-${randomId(8)}`;
    const optimistic: Comment = {
      id: tempId,
      name: name.trim(),
      text: text.trim(),
      createdAt: new Date().toISOString(),
      isAdmin: false,
      likesCount: 0,
      likedByMe: false,
      replies: [],
      optimistic: true,
    };
    setItems((s) => [optimistic, ...s]);
    setText("");
    setBusy(true);
    setPendingMsg(null);

    try {
      const res = await fetch(`/api/contents/${contentSlug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), text: text.trim(), website }),
      });
      const data = await res.json();
      if (!res.ok) {
        setItems((s) => s.filter((c) => c.id !== tempId));
        setPendingMsg(data?.error?.message ?? uz.states.error);
      } else if (data.pending) {
        setItems((s) => s.filter((c) => c.id !== tempId));
        setPendingMsg(uz.comments.pending);
      } else {
        setItems((s) =>
          s.map((c) =>
            c.id === tempId
              ? {
                  ...data.item,
                  isAdmin: false,
                  likesCount: 0,
                  likedByMe: false,
                  replies: [],
                  optimistic: false,
                }
              : c,
          ),
        );
      }
    } catch {
      setItems((s) => s.filter((c) => c.id !== tempId));
      setPendingMsg(uz.states.error);
    } finally {
      setBusy(false);
    }
  }

  async function toggleLike(id: string) {
    // Optimistic toggle
    setItems((s) => toggleLikeIn(s, id));
    try {
      const res = await fetch(`/api/contents/${contentSlug}/comments/${id}/like`, {
        method: "POST",
      });
      if (!res.ok) {
        // Rollback
        setItems((s) => toggleLikeIn(s, id));
        return;
      }
      const data = await res.json();
      setItems((s) => setLikeCountIn(s, id, data.likesCount, data.liked));
    } catch {
      setItems((s) => toggleLikeIn(s, id));
    }
  }

  return (
    <motion.div
      role="dialog"
      aria-label={uz.lightbox.comments}
      className="fixed inset-0 z-[60]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-[var(--scrim)]" onClick={onClose} />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: [0.2, 0.6, 0.2, 1] }}
        className="absolute inset-y-0 right-0 w-full md:w-[400px] bg-[var(--surface)] rounded-l-[var(--r-modal)] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="font-display text-lg">{uz.lightbox.comments}</div>
          <button onClick={onClose} aria-label={uz.common.close} className="w-10 h-10 flex items-center justify-center">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {loading ? (
            <div className="meta">{uz.states.loading}</div>
          ) : items.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="meta"
            >
              {uz.comments.empty}
            </motion.div>
          ) : (
            <AnimatePresence initial={false}>
              {items.map((c) => (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col gap-2"
                >
                  <CommentRow c={c} onLike={() => toggleLike(c.id)} />
                  {c.replies.length > 0 && (
                    <div className="pl-6 flex flex-col gap-2">
                      {c.replies.map((r) => (
                        <CommentRow key={r.id} c={r} onLike={() => toggleLike(r.id)} isReply />
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="px-4 py-3 border-t border-[var(--border)] flex flex-col gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={uz.comments.namePlaceholder}
            className="h-10 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] text-sm outline-none focus:border-[var(--accent)]"
            maxLength={30}
          />
          {/* Honeypot */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="absolute -left-[10000px] w-0 h-0 opacity-0"
            aria-hidden="true"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={uz.comments.textPlaceholder}
            rows={2}
            className="px-3 py-2 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] text-sm outline-none focus:border-[var(--accent)] resize-none"
            maxLength={1000}
          />
          <div className="flex items-center justify-between">
            <div className="meta text-[var(--text-muted)]">{pendingMsg}</div>
            <button
              type="submit"
              disabled={busy || !name.trim() || !text.trim()}
              className="h-10 px-4 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium text-sm inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Send size={14} strokeWidth={1.5} />
              {uz.comments.submit}
            </button>
          </div>
        </form>
        <style>{`
          @keyframes pulseBrass {
            0% { background: rgba(201,154,63,0.15); }
            100% { background: transparent; }
          }
        `}</style>
      </motion.aside>
    </motion.div>
  );
}

function CommentRow({
  c,
  onLike,
  isReply,
}: {
  c: Comment;
  onLike: () => void;
  isReply?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-[var(--r-control)]",
        c.optimistic && "animate-[pulseBrass_1s_ease-out]",
        // Admin javobi — nozik brass border-left, subtle surface tint
        c.isAdmin && "pl-3 border-l-2 border-[var(--accent)]/60 bg-[var(--surface-hover)]/50 py-1",
      )}
    >
      <div
        className={cn(
          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm",
          c.isAdmin
            ? "bg-[var(--accent)] text-[var(--on-accent)]"
            : "bg-[var(--accent)] text-[var(--on-accent)]",
        )}
      >
        {c.name[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="font-medium text-sm">{c.name}</div>
          {c.isAdmin && (
            <span className="meta text-[9px] px-1.5 py-0.5 rounded border border-[var(--accent)]/60 text-[var(--accent)]">
              {uz.comments.authorBadge}
            </span>
          )}
          <div className="meta text-[10px] text-[var(--text-faint)]">{formatTimeAgo(c.createdAt)}</div>
        </div>
        <p className="text-sm text-[var(--text)] whitespace-pre-wrap break-words">{c.text}</p>
        {/* Like — top-level va replies ikkalasida ham. Optimistic yozuvlarda yashiramiz. */}
        {!c.optimistic && (
          <button
            onClick={onLike}
            aria-pressed={c.likedByMe}
            aria-label={c.likedByMe ? "Bekor qilish" : "Yoqdi"}
            className={cn(
              "mt-1 inline-flex items-center gap-1.5 h-7 pr-2 pl-1 rounded-full text-[11px] transition-colors",
              c.likedByMe
                ? "text-[var(--accent)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            <Heart
              size={14}
              strokeWidth={1.5}
              className={cn(c.likedByMe && "fill-[var(--accent)]")}
            />
            <span className="meta">{c.likesCount || 0}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Utility: like holatini nested strukturada toggle qilish
function toggleLikeIn(items: Comment[], id: string): Comment[] {
  return items.map((c) => {
    if (c.id === id) {
      const nowLiked = !c.likedByMe;
      return { ...c, likedByMe: nowLiked, likesCount: Math.max(0, c.likesCount + (nowLiked ? 1 : -1)) };
    }
    if (c.replies.length > 0) {
      return { ...c, replies: toggleLikeIn(c.replies, id) };
    }
    return c;
  });
}

function setLikeCountIn(items: Comment[], id: string, count: number, liked: boolean): Comment[] {
  return items.map((c) => {
    if (c.id === id) return { ...c, likesCount: count, likedByMe: liked };
    if (c.replies.length > 0) return { ...c, replies: setLikeCountIn(c.replies, id, count, liked) };
    return c;
  });
}
