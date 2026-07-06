"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Check,
  Trash2,
  MessageSquareReply,
  Send,
  Heart,
  CornerDownRight,
  MessagesSquare,
  ExternalLink,
  X,
  Circle,
  CheckCheck,
  MessageCircle,
} from "lucide-react";
import { useCsrf } from "../csrf-provider";
import { uz } from "@/lib/i18n/uz";
import { formatTimeAgo, cn } from "@/lib/utils";
import { useLiveData } from "@/lib/live/use-live";

type CommentRow = {
  id: string;
  name: string;
  text: string;
  imageUrl?: string | null;
  status: "PENDING" | "APPROVED";
  createdAt: string;
  isAdmin: boolean;
  likesCount: number;
  replies?: CommentRow[];
};
type Group = {
  kind?: "content" | "page";
  content: { id: string; slug: string; title: string; thumbUrl: string; href?: string };
  comments: CommentRow[];
  pendingCount: number;
};

type StatusKey = "unread" | "replied" | "viewed";

function groupStatus(g: Group): StatusKey {
  if (g.pendingCount > 0) return "unread";
  const topLevel = g.comments.filter((c) => !c.isAdmin);
  if (topLevel.length === 0) return "viewed";
  const anyReplied = topLevel.some((c) => (c.replies ?? []).some((r) => r.isAdmin));
  return anyReplied ? "replied" : "viewed";
}

const STATUS_META: Record<StatusKey, { label: string; short: string; color: string; dot: string }> = {
  unread: {
    label: "O'qilmagan",
    short: "Yangi",
    color: "text-[var(--accent)] bg-[var(--accent)]/10 border-[var(--accent)]/30",
    dot: "bg-[var(--accent)]",
  },
  replied: {
    label: "Javob berilgan",
    short: "Javob berilgan",
    color: "text-[var(--success)] bg-[var(--success)]/10 border-[var(--success)]/30",
    dot: "bg-[var(--success)]",
  },
  viewed: {
    label: "Ko'rilgan",
    short: "Ko'rilgan",
    color: "text-[var(--text-muted)] bg-[var(--bg)] border-[var(--border)]",
    dot: "bg-[var(--text-muted)]",
  },
};

export function CommentsView() {
  const csrf = useCsrf();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"all" | StatusKey>("all");
  const [modalContentId, setModalContentId] = useState<string | null>(null);

  // Live: "comments" topic'ini tinglaymiz — yangi izoh, tasdiqlash, o'chirish, javob
  // event'lari avtomatik ravishda ro'yxatni yangilaydi.
  const query = useLiveData<{ items: Group[] }>("/api/admin/comments", ["comments"]);
  const items = query.data?.items ?? [];
  const loading = query.loading;

  async function approve(id: string) {
    await fetch(`/api/admin/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ action: "approve" }),
    });
    // Refetch bus event orqali avtomatik.
  }

  async function del(id: string) {
    if (!confirm("O'chirilsinmi?")) return;
    await fetch(`/api/admin/comments/${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrf },
    });
  }

  async function sendReply(parentId: string, text: string) {
    const t = text.trim();
    if (!t) return;
    setSending((s) => ({ ...s, [parentId]: true }));
    try {
      const res = await fetch(`/api/admin/comments/${parentId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ text: t }),
      });
      if (!res.ok) return;
      setReplyText((s) => ({ ...s, [parentId]: "" }));
      setReplyOpen((s) => ({ ...s, [parentId]: false }));
    } finally {
      setSending((s) => ({ ...s, [parentId]: false }));
    }
  }

  const counts = useMemo(() => {
    const c = { all: items.length, unread: 0, replied: 0, viewed: 0 };
    for (const g of items) {
      const st = groupStatus(g);
      c[st]++;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((g) => groupStatus(g) === tab);
  }, [items, tab]);

  const modalGroup = useMemo(
    () => (modalContentId ? items.find((g) => g.content.id === modalContentId) ?? null : null),
    [items, modalContentId],
  );

  if (loading) return <div className="meta">{uz.states.loading}</div>;

  return (
    <>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto -mx-1 px-1 pb-1">
        {(
          [
            { k: "all", label: "Barchasi", count: counts.all },
            { k: "unread", label: "O'qilmagan", count: counts.unread },
            { k: "replied", label: "Javob berilgan", count: counts.replied },
            { k: "viewed", label: "Ko'rilgan", count: counts.viewed },
          ] as const
        ).map((t) => {
          const active = tab === t.k;
          const isUnread = t.k === "unread";
          return (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              className={cn(
                "h-9 px-3 rounded-[var(--r-pill)] text-sm border inline-flex items-center gap-2 shrink-0 transition-colors",
                active
                  ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "tabular-nums text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                  active
                    ? "bg-[var(--accent)] text-[var(--on-accent)]"
                    : isUnread && t.count > 0
                    ? "bg-[var(--accent)] text-[var(--on-accent)]"
                    : "bg-[var(--bg)] text-[var(--text-muted)]",
                )}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="meta">{uz.states.empty}</div>
      ) : filtered.length === 0 ? (
        <div className="meta">Bu bo'limda kontent yo'q</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((g) => {
            const st = groupStatus(g);
            const meta = STATUS_META[st];
            const isOpen = !!open[g.content.id];
            return (
              <div
                key={g.content.id}
                className={cn(
                  "bg-[var(--surface)] rounded-[var(--r-card)] border transition-colors",
                  st === "unread"
                    ? "border-[var(--accent)]/40"
                    : "border-transparent",
                )}
              >
                <button
                  onClick={() => setOpen((s) => ({ ...s, [g.content.id]: !s[g.content.id] }))}
                  className="w-full flex items-center gap-3 p-3"
                >
                  <div className="relative shrink-0">
                    {g.content.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.content.thumbUrl}
                        alt=""
                        className="w-14 h-14 object-cover rounded-[var(--r-media)]"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-[var(--r-media)] bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] font-display text-lg">
                        {g.content.title[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <span
                      className={cn(
                        "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[var(--surface)]",
                        meta.dot,
                      )}
                      title={meta.label}
                    />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium truncate">{g.content.title}</div>
                    <div className="meta flex items-center gap-2 flex-wrap mt-0.5">
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full border",
                          meta.color,
                        )}
                      >
                        {meta.short}
                      </span>
                      <span>{g.comments.length} izoh</span>
                      {g.pendingCount > 0 && (
                        <span className="text-[var(--accent)]">· {g.pendingCount} kutilmoqda</span>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    size={18}
                    strokeWidth={1.5}
                    className={cn("transition-transform shrink-0", isOpen && "rotate-180")}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--border)] p-3 flex flex-col gap-3">
                    {g.comments.map((c) => {
                      const hasAdminReply = (c.replies ?? []).some((r) => r.isAdmin);
                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "flex flex-col gap-2 rounded-[var(--r-control)] transition-colors",
                            hasAdminReply && "bg-[var(--accent)]/5 border border-[var(--accent)]/25 p-2 -mx-1",
                          )}
                        >
                          <CommentBlock
                            c={c}
                            onApprove={() => approve(c.id)}
                            onDelete={() => del(c.id)}
                            onToggleReply={() =>
                              setReplyOpen((s) => ({ ...s, [c.id]: !s[c.id] }))
                            }
                            onOpenThread={() => setModalContentId(g.content.id)}
                            replyOpen={!!replyOpen[c.id]}
                            hasAdminReply={hasAdminReply}
                          />
                          {(c.replies ?? []).length > 0 && (
                            <div className="pl-6 border-l-2 border-[var(--accent)]/30 ml-4 flex flex-col gap-2">
                              {(c.replies ?? []).map((r) => (
                                <CommentBlock
                                  key={r.id}
                                  c={r}
                                  onApprove={() => approve(r.id)}
                                  onDelete={() => del(r.id)}
                                  isReply
                                />
                              ))}
                            </div>
                          )}
                          {replyOpen[c.id] && (
                            <div className="pl-6 ml-4 flex items-start gap-2">
                              <CornerDownRight
                                size={14}
                                strokeWidth={1.5}
                                className="mt-2 text-[var(--text-faint)] shrink-0"
                              />
                              <textarea
                                value={replyText[c.id] ?? ""}
                                onChange={(e) =>
                                  setReplyText((s) => ({ ...s, [c.id]: e.target.value }))
                                }
                                placeholder="Javob yozing…"
                                rows={2}
                                maxLength={1000}
                                className="flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] text-sm outline-none focus:border-[var(--accent)] resize-none"
                              />
                              <button
                                onClick={() => sendReply(c.id, replyText[c.id] ?? "")}
                                disabled={sending[c.id] || !(replyText[c.id] ?? "").trim()}
                                className="h-10 px-3 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                                aria-label="Yuborish"
                              >
                                <Send size={14} strokeWidth={1.5} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalGroup && (
        <ConversationModal
          group={modalGroup}
          onClose={() => setModalContentId(null)}
          onApprove={approve}
          onDelete={del}
          onReply={sendReply}
          sending={sending}
        />
      )}
    </>
  );
}

function CommentBlock({
  c,
  onApprove,
  onDelete,
  onToggleReply,
  onOpenThread,
  replyOpen,
  hasAdminReply,
  isReply,
}: {
  c: CommentRow;
  onApprove: () => void;
  onDelete: () => void;
  onToggleReply?: () => void;
  onOpenThread?: () => void;
  replyOpen?: boolean;
  hasAdminReply?: boolean;
  isReply?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={cn(
          "w-8 h-8 rounded-full text-sm flex items-center justify-center shrink-0",
          c.isAdmin
            ? "bg-[var(--accent)] text-[var(--on-accent)] ring-2 ring-[var(--accent)]/30"
            : "bg-[var(--accent)] text-[var(--on-accent)]",
        )}
      >
        {c.name[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-sm">{c.name}</span>
          {c.isAdmin && (
            <span className="meta text-[9px] px-1.5 py-0.5 rounded border border-[var(--accent)]/60 text-[var(--accent)]">
              MUALLIF
            </span>
          )}
          <span className="meta text-[10px]">{formatTimeAgo(c.createdAt)}</span>
          {c.status === "PENDING" && (
            <span className="meta text-[10px] text-[var(--accent)]">KUTILMOQDA</span>
          )}
          {!isReply && hasAdminReply && (
            <span className="meta text-[9px] px-1.5 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent)]">
              JAVOB BERILGAN
            </span>
          )}
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">{c.text}</p>
        {c.imageUrl && (
          <a
            href={c.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block max-w-[240px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.imageUrl}
              alt=""
              className="rounded-[var(--r-media)] max-h-40 w-auto border border-[var(--border)]"
              loading="lazy"
            />
          </a>
        )}
        {c.likesCount > 0 && (
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <Heart size={12} strokeWidth={1.5} className="fill-[var(--accent)] text-[var(--accent)]" />
            <span>{c.likesCount}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!isReply && onOpenThread && (
          <button
            onClick={onOpenThread}
            className="w-9 h-9 rounded-[var(--r-control)] hover:bg-[var(--surface-hover)]"
            aria-label="To'liq muhokamani ochish"
            title="To'liq muhokamani ochish"
          >
            <MessagesSquare
              size={16}
              strokeWidth={1.5}
              className="mx-auto text-[var(--text-muted)]"
            />
          </button>
        )}
        {!isReply && onToggleReply && (
          <button
            onClick={onToggleReply}
            className={cn(
              "w-9 h-9 rounded-[var(--r-control)] hover:bg-[var(--surface-hover)]",
              replyOpen && "bg-[var(--surface-hover)]",
            )}
            aria-label="Javob berish"
            title="Javob berish"
          >
            <MessageSquareReply
              size={16}
              strokeWidth={1.5}
              className="mx-auto text-[var(--accent)]"
            />
          </button>
        )}
        {c.status === "PENDING" && (
          <button
            onClick={onApprove}
            className="w-9 h-9 rounded-[var(--r-control)] hover:bg-[var(--surface-hover)]"
            aria-label={uz.admin.actions.approve}
            title={uz.admin.actions.approve}
          >
            <Check size={16} strokeWidth={1.5} className="mx-auto text-[var(--success)]" />
          </button>
        )}
        <button
          onClick={onDelete}
          className="w-9 h-9 rounded-[var(--r-control)] hover:bg-[var(--surface-hover)]"
          aria-label={uz.admin.actions.delete}
          title={uz.admin.actions.delete}
        >
          <Trash2 size={16} strokeWidth={1.5} className="mx-auto text-[var(--danger)]" />
        </button>
      </div>
    </div>
  );
}

const QUICK_REPLIES = [
  "Rahmat!",
  "Fikringiz uchun rahmat 🙌",
  "Xursandman, foydali bo'lganidan!",
  "Buni yozib qo'yaman, tekshirib ko'raman.",
  "Ha, aynan shunday!",
];

function ConversationModal({
  group,
  onClose,
  onApprove,
  onDelete,
  onReply,
  sending,
}: {
  group: Group;
  onClose: () => void;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (parentId: string, text: string) => void;
  sending: Record<string, boolean>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    () => group.comments[0]?.id ?? null,
  );
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Yangi izoh chiqqanda pastga scroll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [group.comments.length, selectedId]);

  const selected = group.comments.find((c) => c.id === selectedId) ?? group.comments[0];
  const totalMsgs = group.comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0);

  async function submit() {
    if (!selected) return;
    if (!text.trim()) return;
    await onReply(selected.id, text);
    setText("");
    textareaRef.current?.focus();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--r-modal)] w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        {/* Header */}
        <header className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
          {group.content.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.content.thumbUrl}
              alt=""
              className="w-12 h-12 object-cover rounded-[var(--r-media)] shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-[var(--r-media)] bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] font-display shrink-0">
              {group.content.title[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{group.content.title}</div>
            <div className="meta text-[11px] flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1">
                <MessageCircle size={11} /> {totalMsgs} xabar
              </span>
              <span>·</span>
              <span>{group.comments.length} muhokama</span>
              {group.pendingCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-[var(--accent)]">{group.pendingCount} kutilmoqda</span>
                </>
              )}
            </div>
          </div>
          <a
            href={group.content.href ?? `/p/${group.content.slug}#comments`}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-[var(--r-control)] text-xs text-[var(--text-muted)] hover:bg-[var(--bg)]"
            title="Saytda ochish"
          >
            <ExternalLink size={13} strokeWidth={1.5} />
            Saytda
          </a>
          <button
            onClick={onClose}
            className="w-9 h-9 inline-flex items-center justify-center rounded-[var(--r-control)] hover:bg-[var(--bg)]"
            aria-label="Yopish"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>

        {/* Body: sidebar (thread list) + main (selected conversation) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar: thread list */}
          <aside className="hidden md:flex flex-col w-64 border-r border-[var(--border)] overflow-y-auto overscroll-contain">
            {group.comments.map((c) => {
              const active = selected?.id === c.id;
              const replyCount = c.replies?.length ?? 0;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "text-left p-3 border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors",
                    active && "bg-[var(--accent)]/5",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[10px] flex items-center justify-center shrink-0">
                      {c.name[0]?.toUpperCase()}
                    </span>
                    <span className="text-xs font-medium truncate flex-1">{c.name}</span>
                    {c.status === "PENDING" && (
                      <Circle size={8} className="text-[var(--accent)] fill-[var(--accent)] shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] line-clamp-2">{c.text}</p>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] mt-1">
                    <span>{formatTimeAgo(c.createdAt)}</span>
                    {replyCount > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <CheckCheck size={10} /> {replyCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Main: selected thread + reply box */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selected ? (
              <>
                <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain p-4 flex flex-col gap-3">
                  <ThreadMessage
                    c={selected}
                    onApprove={() => onApprove(selected.id)}
                    onDelete={() => onDelete(selected.id)}
                  />
                  {(selected.replies ?? []).map((r) => (
                    <ThreadMessage
                      key={r.id}
                      c={r}
                      onApprove={() => onApprove(r.id)}
                      onDelete={() => onDelete(r.id)}
                      isReply
                    />
                  ))}
                  {(selected.replies?.length ?? 0) === 0 && (
                    <div className="text-center text-xs text-[var(--text-muted)] py-4">
                      Hali javob yo'q. Quyida yozib yuboring.
                    </div>
                  )}
                </div>

                {/* Quick replies */}
                <div className="px-4 pt-2 flex gap-1.5 flex-wrap border-t border-[var(--border)]">
                  {QUICK_REPLIES.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setText((t) => (t ? t + " " + q : q));
                        textareaRef.current?.focus();
                      }}
                      className="h-7 px-2.5 rounded-[var(--r-pill)] border border-[var(--border)] text-[11px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Reply box */}
                <div className="p-3 flex items-end gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          submit();
                        }
                      }}
                      placeholder={`«${selected.name}» ga javob…`}
                      rows={2}
                      maxLength={1000}
                      className="w-full px-3 py-2 pr-14 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] text-sm outline-none focus:border-[var(--accent)] resize-none min-h-[64px]"
                    />
                    <span className="absolute right-3 bottom-2 text-[10px] text-[var(--text-muted)] tabular-nums">
                      {text.length}/1000
                    </span>
                  </div>
                  <button
                    onClick={submit}
                    disabled={sending[selected.id] || !text.trim()}
                    className="h-11 px-4 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
                    title="Ctrl/Cmd + Enter"
                  >
                    <Send size={14} strokeWidth={1.5} />
                    Yuborish
                  </button>
                </div>
                <div className="px-4 pb-3 text-[10px] text-[var(--text-muted)]">
                  Tez yuborish uchun <kbd className="px-1 py-0.5 bg-[var(--bg)] border border-[var(--border)] rounded text-[9px]">Ctrl</kbd>
                  {" + "}
                  <kbd className="px-1 py-0.5 bg-[var(--bg)] border border-[var(--border)] rounded text-[9px]">Enter</kbd>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-muted)]">
                Muhokamalar yo'q
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThreadMessage({
  c,
  onApprove,
  onDelete,
  isReply,
}: {
  c: CommentRow;
  onApprove: () => void;
  onDelete: () => void;
  isReply?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 max-w-[85%]",
        isReply && c.isAdmin && "self-end flex-row-reverse ml-auto",
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-full text-xs flex items-center justify-center shrink-0",
          c.isAdmin
            ? "bg-[var(--accent)] text-[var(--on-accent)]"
            : "bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)]",
        )}
      >
        {c.name[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "flex items-baseline gap-2 flex-wrap text-[11px]",
            isReply && c.isAdmin && "justify-end",
          )}
        >
          <span className="font-medium">{c.name}</span>
          {c.isAdmin && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--accent)]/60 text-[var(--accent)]">
              MUALLIF
            </span>
          )}
          <span className="text-[var(--text-muted)]">{formatTimeAgo(c.createdAt)}</span>
          {c.status === "PENDING" && (
            <span className="text-[var(--accent)]">KUTILMOQDA</span>
          )}
        </div>
        <div
          className={cn(
            "mt-1 px-3 py-2 rounded-[var(--r-card)] text-sm whitespace-pre-wrap break-words",
            c.isAdmin
              ? "bg-[var(--accent)]/10 text-[var(--text)]"
              : "bg-[var(--bg)] border border-[var(--border)]",
          )}
        >
          {c.text}
        </div>
        {c.imageUrl && (
          <a
            href={c.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block max-w-[240px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.imageUrl}
              alt=""
              className="rounded-[var(--r-media)] max-h-40 w-auto border border-[var(--border)]"
              loading="lazy"
            />
          </a>
        )}
        {c.likesCount > 0 && (
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Heart size={10} strokeWidth={1.5} className="fill-[var(--accent)] text-[var(--accent)]" />
            <span>{c.likesCount}</span>
          </div>
        )}
        <div className="mt-1 flex items-center gap-1">
          {c.status === "PENDING" && (
            <button
              onClick={onApprove}
              className="text-[10px] text-[var(--success)] hover:underline"
            >
              Tasdiqlash
            </button>
          )}
          <button onClick={onDelete} className="text-[10px] text-[var(--danger)] hover:underline">
            O'chirish
          </button>
        </div>
      </div>
    </div>
  );
}
