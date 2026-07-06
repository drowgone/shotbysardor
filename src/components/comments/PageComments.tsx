"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Heart,
  Image as ImageIcon,
  X,
  Trash2,
  MessageSquareReply,
  MessageCircle,
  Wallet,
  CornerDownRight,
} from "lucide-react";
import { cn, formatTimeAgo, formatNumber } from "@/lib/utils";
import { uz } from "@/lib/i18n/uz";
import { useLiveEvent } from "@/lib/live/use-live";

// ============================================================
// Serverdan keladigan turlar
// ============================================================
type Comment = {
  id: string;
  name: string;
  text: string;
  imageUrl: string | null;
  createdAt: string;
  isAdmin: boolean;
  likesCount: number;
  likedByMe: boolean;
  donateAmount: number | null;
  replies?: Comment[];
};

type Viewer = {
  isAdmin: boolean;
  csrf: string | null;
  displayName: string | null;
};

type ListResponse = {
  items: Comment[];
  viewer: Viewer;
  page: { key: string; label: string };
};

// ============================================================
// Asosiy komponent — Telegram uslubidagi chat oynasi.
// Yuqorida sarlavha, o'rtasida yozishmalar (scroll), pastda kompozitor.
// Kontener `md:h-full` bilan grid ustunini to'liq egallaydi — parent
// `md:items-stretch` bo'lishi kerak.
// ============================================================
export function PageComments({ page }: { page: string }) {
  const [items, setItems] = useState<Comment[]>([]);
  const [viewer, setViewer] = useState<Viewer>({ isAdmin: false, csrf: null, displayName: null });
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [donateAmount, setDonateAmount] = useState<string>(""); // raw digits
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const lastSubmit = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastItemsLenRef = useRef(0);

  const isDonatePage = page === "donate";

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/page-comments/${page}`, { cache: "no-store" });
      if (!res.ok) return;
      const d = (await res.json()) as ListResponse;
      setItems(d.items ?? []);
      setViewer(d.viewer ?? { isAdmin: false, csrf: null, displayName: null });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
    const stored = localStorage.getItem("sbs-name");
    if (stored) setName(stored);
  }, [load]);

  useLiveEvent(`comments:page:${page}`, () => {
    void load();
  });

  useEffect(() => {
    if (viewer.isAdmin && viewer.displayName) setName(viewer.displayName);
  }, [viewer.isAdmin, viewer.displayName]);

  // Faqat yangi xabar qo'shilganda pastga scroll qilamiz.
  // Like bosilganda yoki reply/delete bo'lganda scroll pozitsiyasini saqlaymiz —
  // aks holda foydalanuvchi o'qiyotgan joyidan pastga sakrab tushib qoladi.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (items.length > lastItemsLenRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    lastItemsLenRef.current = items.length;
  }, [items]);

  function onPickImage(f: File | null) {
    setImage(f);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    if (f) {
      setImagePreview(URL.createObjectURL(f));
    } else {
      setImagePreview(null);
    }
  }

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (!name.trim() || !text.trim()) {
      setErr("Ism va matn kiriting");
      return;
    }
    const now = Date.now();
    if (!viewer.isAdmin && now - lastSubmit.current < 30_000) {
      setErr("Iltimos, biroz kutib turing");
      return;
    }
    lastSubmit.current = now;
    if (!viewer.isAdmin) localStorage.setItem("sbs-name", name.trim());
    setBusy(true);
    setErr(null);
    setPendingMsg(null);

    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("text", text.trim());
      form.set("website", website);
      if (image) form.set("image", image);
      if (isDonatePage && donateAmount) form.set("donateAmount", donateAmount);

      const headers: Record<string, string> = {};
      if (viewer.isAdmin && viewer.csrf) headers["x-csrf-token"] = viewer.csrf;

      const res = await fetch(`/api/page-comments/${page}`, {
        method: "POST",
        headers,
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErr(data?.error?.message ?? "Xatolik yuz berdi");
        return;
      }
      if (data?.pending) {
        setPendingMsg("Izohingiz tekshiruvga yuborildi — tez orada ko'rinadi.");
      }
      setText("");
      setDonateAmount("");
      onPickImage(null);
      // Textarea balandligini boshlang'ich holatga qaytaramiz (auto-o'sishdan keyin).
      if (textareaRef.current) textareaRef.current.style.height = "";
      void load();
    } catch {
      setErr("Ulanish xatosi");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLike(id: string) {
    setItems((prev) => prev.map((c) => updateLike(c, id)));
    try {
      await fetch(`/api/page-comments/${page}/${id}/like`, { method: "POST" });
    } catch {
      // silent
    }
  }

  async function del(id: string) {
    if (!viewer.isAdmin || !viewer.csrf) return;
    if (!confirm("Izohni o'chirishga aminmisiz?")) return;
    try {
      await fetch(`/api/admin/comments/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": viewer.csrf },
      });
    } catch {
      // ignore
    }
  }

  async function submitReply(parentId: string, replyText: string) {
    if (!viewer.isAdmin || !viewer.csrf) return;
    if (!replyText.trim()) return;
    try {
      const res = await fetch(`/api/admin/comments/${parentId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": viewer.csrf,
        },
        body: JSON.stringify({ text: replyText.trim() }),
      });
      if (res.ok) setReplyingTo(null);
    } catch {
      // ignore
    }
  }

  // Server yangi -> eski tartibda qaytaradi. Chat uslubida yangi xabar pastda bo'lishi kerak.
  const ordered = [...items].reverse();

  return (
    <div className="flex flex-col h-[70vh] min-h-[420px] md:h-full md:min-h-0 md:flex-1 rounded-[var(--r-card)] bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      {/* Sarlavha (Telegram chat header'iga o'xshash — ixcham) */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)] bg-[var(--bg)]/40">
        <MessageCircle size={15} strokeWidth={1.75} className="text-[var(--accent)]" />
        <h2 className="font-display text-sm">Izohlar</h2>
        {items.length > 0 && (
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{items.length}</span>
        )}
        {viewer.isAdmin && (
          <span className="ml-auto text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-[var(--accent)]/60 text-[var(--accent)]">
            Muallif
          </span>
        )}
      </div>

      {/* Xabarlar oqimi — flex-1, ichida scroll */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2.5 flex flex-col gap-1"
      >
        {loading ? (
          <div className="meta">{uz.states.loading}</div>
        ) : ordered.length === 0 ? (
          <div className="m-auto text-sm text-[var(--text-muted)] text-center py-8">
            Hozircha izohlar yo&apos;q. Birinchi bo&apos;lib fikr bildiring.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {ordered.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <MessageBubble
                  c={c}
                  isAdmin={viewer.isAdmin}
                  onLike={() => toggleLike(c.id)}
                  onDelete={() => del(c.id)}
                  onReplyClick={() =>
                    setReplyingTo((s) => (s === c.id ? null : c.id))
                  }
                  replyOpen={replyingTo === c.id}
                  onReplySubmit={(t) => submitReply(c.id, t)}
                  onDeleteReply={(rid) => del(rid)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Xabar/pending banner — kompozitor ustida */}
      <AnimatePresence>
        {err && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-3 mb-2 text-xs text-[var(--danger)] px-2.5 py-1.5 rounded-[var(--r-control)] bg-[var(--danger)]/10 border border-[var(--danger)]/30"
          >
            {err}
          </motion.div>
        )}
        {pendingMsg && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-3 mb-2 text-xs text-[var(--accent)] px-2.5 py-1.5 rounded-[var(--r-control)] bg-[var(--accent)]/10 border border-[var(--accent)]/30"
          >
            {pendingMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kompozitor — pastda, chatning tubi */}
      <form
        onSubmit={submit}
        className="border-t border-[var(--border)] bg-[var(--bg)]/40 px-2 py-2 flex flex-col gap-1.5"
      >
        {/* Rasm preview — kompakt, birinchi qatorda */}
        {imagePreview && (
          <div className="relative inline-block w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt=""
              className="max-h-20 rounded-[var(--r-media)] border border-[var(--border)]"
            />
            <button
              type="button"
              onClick={() => onPickImage(null)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--danger)] text-white flex items-center justify-center"
              aria-label="Rasmni olib tashlash"
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* Ism + summa (donate sahifasida) — foydalanuvchi uchun; admin uchun yashiriladi */}
        {!viewer.isAdmin && (
          <div className="flex gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ismingiz"
              maxLength={80}
              className="flex-1 min-w-0 h-8 px-2 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] text-xs outline-none focus:border-[var(--accent)]"
            />
            {isDonatePage && (
              <div className="w-[46%] shrink-0">
                <CompactCurrencyInput
                  value={donateAmount}
                  onValueChange={setDonateAmount}
                  placeholder="Summa"
                />
              </div>
            )}
          </div>
        )}

        {/* Admin uchun summa — donate sahifasida ham beriladi */}
        {viewer.isAdmin && isDonatePage && (
          <CompactCurrencyInput
            value={donateAmount}
            onValueChange={setDonateAmount}
            placeholder="Summa (ixtiyoriy)"
          />
        )}

        {/* Honeypot */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden
        />

        {/* Chat inputi: rasm + textarea + yuborish (bir qatorda) */}
        <div className="flex items-end gap-1.5">
          <label
            className="h-9 w-9 shrink-0 rounded-[var(--r-control)] text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer inline-flex items-center justify-center transition-colors"
            title="Rasm ilova qilish"
          >
            <ImageIcon size={16} strokeWidth={1.75} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 128) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={
                viewer.isAdmin ? "Muallif nomidan yozing…" : "Fikringizni yozing…"
              }
              rows={1}
              maxLength={1000}
              className="w-full min-h-9 max-h-32 pl-3 pr-10 py-2 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[18px] text-sm leading-snug outline-none focus:border-[var(--accent)] resize-none"
            />
            {/* Belgilar hisoblagichi — faqat limitga yaqinlashganda */}
            {text.length > 800 && (
              <span
                className={cn(
                  "absolute right-3 bottom-1 text-[9px] tabular-nums pointer-events-none",
                  text.length >= 1000 ? "text-[var(--danger)]" : "text-[var(--text-faint)]",
                )}
              >
                {text.length}/1000
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={busy || !name.trim() || !text.trim()}
            aria-label="Yuborish"
            className="h-9 w-9 shrink-0 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center transition-opacity"
          >
            <Send size={14} strokeWidth={2} />
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// Xabar bubble — Telegram uslubidagi tozalangan blok.
// - Admin xabarlari: o'ngda, accent fon, `rounded-br-md` "tail"
// - Foydalanuvchi: chapda, surface fon, `rounded-bl-md` "tail"
// - Sarlavha qatori: ism · +summa · vaqt
// - Amallar: like doim ko'rinadi (pill), reply/delete faqat admin uchun va hoverda
// - Replylar: parent'ning o'ng-pastida mini bubble sifatida (thread chizig'isiz),
//   `↳` ikoncha bilan "reply" ekanini bildiradi
// ============================================================
function MessageBubble({
  c,
  isAdmin,
  onLike,
  onDelete,
  onReplyClick,
  replyOpen,
  onReplySubmit,
  onDeleteReply,
}: {
  c: Comment;
  isAdmin: boolean;
  onLike: () => void;
  onDelete: () => void;
  onReplyClick: () => void;
  replyOpen: boolean;
  onReplySubmit: (text: string) => void;
  onDeleteReply: (id: string) => void;
}) {
  const [replyText, setReplyText] = useState("");
  const mine = c.isAdmin;
  const hasReplies = (c.replies ?? []).length > 0;
  const hasLikes = c.likesCount > 0;

  return (
    <div className="flex flex-col gap-1">
      {/* Parent bubble */}
      <div className={cn("group flex", mine ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "relative max-w-[85%] rounded-[16px] px-2.5 py-1.5 border text-[13px] leading-[1.4]",
            mine
              ? "bg-[var(--accent)]/12 border-[var(--accent)]/30 rounded-br-[6px]"
              : "bg-[var(--surface)] border-[var(--border)] rounded-bl-[6px]",
          )}
        >
          {/* Sarlavha: ism + summa + vaqt */}
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span
              className={cn(
                "text-[11.5px] font-semibold truncate max-w-[10rem]",
                mine ? "text-[var(--accent)]" : "text-[var(--text)]",
              )}
            >
              {c.name}
            </span>
            {c.donateAmount && c.donateAmount > 0 && (
              <span
                className="inline-flex items-baseline text-[9.5px] font-mono font-semibold px-1.5 py-[1px] rounded-full bg-[var(--accent)] text-[var(--on-accent)] leading-none shrink-0"
                title="Qo'llash summasi"
              >
                +{formatNumber(c.donateAmount)}
                <span className="ml-0.5 opacity-80 font-normal">so&apos;m</span>
              </span>
            )}
            <span className="text-[9.5px] text-[var(--text-faint)] ml-auto tabular-nums shrink-0">
              {formatTimeAgo(c.createdAt)}
            </span>
          </div>

          {/* Matn */}
          <p className="whitespace-pre-wrap break-words">{c.text}</p>

          {/* Rasm */}
          {c.imageUrl && (
            <a
              href={c.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.imageUrl}
                alt=""
                className="max-h-40 max-w-full rounded-[8px] border border-[var(--border)]"
                loading="lazy"
              />
            </a>
          )}

          {/* Amallar qatori — like doim ko'rinadi (pill),
              admin uchun reply/delete faqat hoverda (mobilda ham hover holati yo'q, shuning uchun ochiq) */}
          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={onLike}
              className={cn(
                "inline-flex items-center gap-1 text-[10.5px] leading-none px-1.5 py-1 rounded-full transition-colors",
                c.likedByMe
                  ? "text-[var(--accent)] bg-[var(--accent)]/12"
                  : "text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/8",
              )}
              aria-label="Yoqtirish"
            >
              <Heart
                size={11}
                strokeWidth={1.75}
                className={cn(c.likedByMe && "fill-[var(--accent)]")}
              />
              {hasLikes && <span className="tabular-nums">{c.likesCount}</span>}
            </button>

            {isAdmin && (
              <div
                className={cn(
                  "ml-auto flex items-center gap-0.5 transition-opacity",
                  replyOpen
                    ? "opacity-100"
                    : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100",
                )}
              >
                <button
                  onClick={onReplyClick}
                  title="Javob berish"
                  className={cn(
                    "inline-flex items-center text-[10px] px-1.5 py-1 rounded-full transition-colors",
                    replyOpen
                      ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/8",
                  )}
                >
                  <MessageSquareReply size={11} strokeWidth={1.75} />
                </button>
                <button
                  onClick={onDelete}
                  title="O'chirish"
                  className="inline-flex items-center text-[10px] px-1.5 py-1 rounded-full text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                >
                  <Trash2 size={11} strokeWidth={1.75} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Replylar — parent ostida, mini o'ng-align bubble; thread chizig'isiz */}
      {(hasReplies || (isAdmin && replyOpen)) && (
        <div className="flex flex-col gap-1 pl-6 sm:pl-8">
          {(c.replies ?? []).map((r) => (
            <ReplyBubble
              key={r.id}
              r={r}
              isAdmin={isAdmin}
              onDelete={() => onDeleteReply(r.id)}
            />
          ))}

          {isAdmin && replyOpen && (
            <div className="flex items-end gap-1.5 justify-end">
              <textarea
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value);
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 96) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (replyText.trim()) {
                      onReplySubmit(replyText);
                      setReplyText("");
                    }
                  }
                }}
                placeholder="Javob yozing…"
                rows={1}
                maxLength={1000}
                className="flex-1 max-w-[85%] min-h-8 max-h-24 px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[14px] text-xs leading-snug outline-none focus:border-[var(--accent)] resize-none"
              />
              <button
                onClick={() => {
                  if (!replyText.trim()) return;
                  onReplySubmit(replyText);
                  setReplyText("");
                }}
                disabled={!replyText.trim()}
                className="h-8 w-8 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] inline-flex items-center justify-center disabled:opacity-40 shrink-0"
                aria-label="Javob yuborish"
              >
                <Send size={12} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReplyBubble({
  r,
  isAdmin,
  onDelete,
}: {
  r: Comment;
  isAdmin: boolean;
  onDelete: () => void;
}) {
  // Reply har doim admin tomonidan yoziladi (server logikasi shuni ta'minlaydi).
  // Shuning uchun har doim o'ng tomonda, accent uslubda, chapga qaragan "tail" (rounded-tl) bilan.
  return (
    <div className="group flex justify-end">
      <div className="relative max-w-[90%] rounded-[14px] rounded-tr-[6px] bg-[var(--accent)]/10 border border-[var(--accent)]/25 px-2.5 py-1.5 text-[12.5px] leading-[1.4]">
        <div className="flex items-center gap-1.5 mb-0.5">
          <CornerDownRight
            size={10}
            strokeWidth={2}
            className="text-[var(--accent)]/60 shrink-0"
          />
          <span className="text-[10.5px] font-semibold text-[var(--accent)] truncate max-w-[8rem]">
            {r.name}
          </span>
          <span className="text-[9px] text-[var(--text-faint)] ml-auto tabular-nums shrink-0">
            {formatTimeAgo(r.createdAt)}
          </span>
          {isAdmin && (
            <button
              onClick={onDelete}
              title="O'chirish"
              className="text-[var(--text-faint)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            >
              <Trash2 size={10} strokeWidth={1.75} />
            </button>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words">{r.text}</p>
      </div>
    </div>
  );
}

// ============================================================
// Kichik CurrencyInput — chat kompozitorida joy tejash uchun ixcham variant.
// ============================================================
function CompactCurrencyInput({
  value,
  onValueChange,
  placeholder,
}: {
  value: string;
  onValueChange: (raw: string) => void;
  placeholder?: string;
}) {
  // Display = raqamlar guruhlangan ("50 000"), value = raw digits ("50000").
  const display = value ? formatNumber(Number(value)) : "";
  return (
    <div className="relative flex items-center">
      <Wallet
        size={12}
        strokeWidth={1.75}
        className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none"
      />
      <input
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "");
          onValueChange(raw);
        }}
        placeholder={placeholder}
        className="w-full h-9 pl-7 pr-11 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)] transition-colors text-xs tabular-nums"
      />
      <span className="absolute right-2.5 text-[10px] text-[var(--text-muted)] pointer-events-none select-none">
        so&apos;m
      </span>
    </div>
  );
}

// ============================================================
// Optimistik like helper
// ============================================================
function updateLike(c: Comment, id: string): Comment {
  if (c.id === id) {
    return {
      ...c,
      likedByMe: !c.likedByMe,
      likesCount: c.likedByMe
        ? Math.max(0, c.likesCount - 1)
        : c.likesCount + 1,
    };
  }
  if (c.replies?.length) {
    return { ...c, replies: c.replies.map((r) => updateLike(r, id)) };
  }
  return c;
}
