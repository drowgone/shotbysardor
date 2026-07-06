"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Copy,
  Check,
  Download,
  Clock,
  ShieldCheck,
  XCircle,
  MessageCircle,
  ArrowUpRight,
  Timer,
  AlertTriangle,
} from "lucide-react";
import { uz } from "@/lib/i18n/uz";
import { formatUZS, formatDate, formatTimeAgo, cn } from "@/lib/utils";
import { useLiveEvent } from "@/lib/live/use-live";

type Order = {
  code: string;
  token: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  title: string;
  thumbUrl: string;
  priceUZS: number;
  expiresAt: string | null;
  downloadsLeft: number;
  maxDownloads: number;
  rejectReason: string | null;
  createdAt: string;
  approvedAt: string | null;
};

const ease = [0.22, 1, 0.36, 1] as const;

export function OrderStatusCard({ order: initial }: { order: Order }) {
  const [order, setOrder] = useState(initial);
  const [copied, setCopied] = useState(false);

  // Live: shu tokenli buyurtma o'zgarganda darhol refetch qilamiz. Polling emas —
  // server hodisasi kelganda tezkor. Ulanish uzilsa EventSource avtomatik qayta ulanadi.
  useLiveEvent(`orders:${order.token}`, () => {
    fetch(`/api/orders/${order.token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setOrder((prev) => ({ ...prev, ...d }));
      })
      .catch(() => {});
  });

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(`#${order.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignored
    }
  }

  const expiresPassed = order.expiresAt && new Date(order.expiresAt).getTime() <= Date.now();
  const usedDownloads = order.maxDownloads - order.downloadsLeft;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
      }}
      className="flex flex-col gap-4"
    >
      {/* Holat hero — foydalanuvchi darrov nima bo'layotganini tushunadi */}
      <StatusHero status={order.status} expiresPassed={!!expiresPassed} />

      {/* Buyurtma bo'yicha qisqa ma'lumot */}
      <motion.div
        variants={fadeUpVariant}
        transition={{ duration: 0.5, ease }}
        className="rounded-[var(--r-card)] bg-[var(--surface)] border border-[var(--border)] p-4 md:p-5 flex gap-4"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={order.thumbUrl}
          alt=""
          className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-[var(--r-media)] shrink-0"
          onContextMenu={(e) => e.preventDefault()}
          draggable={false}
        />
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="meta">{uz.order.title}</div>
          <div className="font-display text-base md:text-lg leading-tight truncate">
            {order.title}
          </div>
          <div className="text-sm text-[var(--accent)] mt-0.5">
            {order.priceUZS > 0 ? formatUZS(order.priceUZS) : uz.order.priceNegotiable}
          </div>
        </div>
      </motion.div>

      {/* Kod kartochkasi */}
      <motion.div
        variants={fadeUpVariant}
        transition={{ duration: 0.5, ease }}
        className="rounded-[var(--r-card)] bg-[var(--bg)] border border-[var(--border-strong)] p-4 flex items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="meta text-[10px] leading-none mb-1.5">{uz.order.orderCode}</div>
          <div className="font-mono text-xl md:text-2xl font-display leading-none tracking-wider">
            #{order.code}
          </div>
          <div className="meta text-[10px] mt-1.5 text-[var(--text-faint)]">
            {formatTimeAgo(order.createdAt).toLowerCase()}
          </div>
        </div>
        <button
          onClick={copyCode}
          className={cn(
            "h-10 px-3 rounded-[var(--r-control)] border text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0",
            copied
              ? "border-[var(--success)] text-[var(--success)]"
              : "border-[var(--border-strong)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
          )}
        >
          {copied ? (
            <>
              <Check size={13} strokeWidth={2.5} />
              Olindi
            </>
          ) : (
            <>
              <Copy size={13} strokeWidth={1.75} />
              Nusxa
            </>
          )}
        </button>
      </motion.div>

      {/* Timeline — 3 qadamli progress */}
      <motion.div
        variants={fadeUpVariant}
        transition={{ duration: 0.5, ease }}
      >
        <Timeline
          createdAt={order.createdAt}
          approvedAt={order.approvedAt}
          status={order.status}
          downloadedAny={usedDownloads > 0}
        />
      </motion.div>

      {/* Holatga qarab harakat bloki */}
      <motion.div
        variants={fadeUpVariant}
        transition={{ duration: 0.5, ease }}
      >
        {order.status === "PENDING" && <PendingBlock createdAt={order.createdAt} />}
        {order.status === "APPROVED" && (
          <ApprovedBlock
            token={order.token}
            expiresAt={order.expiresAt}
            expiresPassed={!!expiresPassed}
            downloadsLeft={order.downloadsLeft}
            maxDownloads={order.maxDownloads}
          />
        )}
        {order.status === "REJECTED" && (
          <RejectedBlock reason={order.rejectReason} />
        )}
      </motion.div>

      {/* Yordam kerakmi */}
      <motion.div
        variants={fadeUpVariant}
        transition={{ duration: 0.5, ease }}
        className="mt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[var(--text-muted)]"
      >
        <div className="flex items-center gap-2">
          <MessageCircle size={14} strokeWidth={1.75} className="opacity-60" />
          Savolingiz bormi?
        </div>
        <Link
          href="/aloqa"
          className="group inline-flex items-center gap-1.5 text-[var(--text)] hover:text-[var(--accent)]"
        >
          Sardor bilan bog&apos;lanish
          <ArrowUpRight
            size={13}
            strokeWidth={1.75}
            className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
          />
        </Link>
      </motion.div>
    </motion.div>
  );
}

const fadeUpVariant = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function StatusHero({
  status,
  expiresPassed,
}: {
  status: Order["status"];
  expiresPassed: boolean;
}) {
  const map = {
    PENDING: {
      icon: <Clock size={26} strokeWidth={1.75} />,
      title: uz.order.pending,
      subtitle: "Chekingiz tekshirilmoqda. Odatda 24 soat ichida javob keladi.",
      bg: "bg-[var(--accent)]/10 border-[var(--accent)]/40",
      color: "text-[var(--accent)]",
      chip: "border-[var(--accent)] text-[var(--accent)]",
    },
    APPROVED: expiresPassed
      ? {
          icon: <Timer size={26} strokeWidth={1.75} />,
          title: uz.order.expired,
          subtitle: "Yuklab olish muddati tugagan. Yangi murojaat qilishingiz kerak.",
          bg: "bg-[var(--danger)]/10 border-[var(--danger)]/40",
          color: "text-[var(--danger)]",
          chip: "border-[var(--danger)] text-[var(--danger)]",
        }
      : {
          icon: <ShieldCheck size={26} strokeWidth={1.75} />,
          title: uz.order.approved,
          subtitle: "Buyurtmangiz tayyor — pastdagi tugmadan yuklab oling.",
          bg: "bg-[var(--success)]/10 border-[var(--success)]/40",
          color: "text-[var(--success)]",
          chip: "border-[var(--success)] text-[var(--success)]",
        },
    REJECTED: {
      icon: <XCircle size={26} strokeWidth={1.75} />,
      title: uz.order.rejected,
      subtitle: "Buyurtma qabul qilinmadi. Sabab quyida ko'rsatilgan.",
      bg: "bg-[var(--danger)]/10 border-[var(--danger)]/40",
      color: "text-[var(--danger)]",
      chip: "border-[var(--danger)] text-[var(--danger)]",
    },
  }[status];

  return (
    <motion.div
      variants={fadeUpVariant}
      transition={{ duration: 0.6, ease }}
      className={cn(
        "rounded-[var(--r-card)] border p-5 md:p-6 flex items-start gap-4",
        map.bg,
      )}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease }}
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
          "bg-[var(--bg-elevated)]",
          map.color,
        )}
      >
        {map.icon}
      </motion.div>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className={cn("h-6 px-2.5 rounded-[var(--r-pill)] border text-[10px] inline-flex items-center self-start", map.chip)}>
          {map.title.toUpperCase()}
        </div>
        <div className="font-display text-lg md:text-xl leading-tight">{map.title}</div>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">{map.subtitle}</p>
      </div>
    </motion.div>
  );
}

function Timeline({
  createdAt,
  approvedAt,
  status,
  downloadedAny,
}: {
  createdAt: string;
  approvedAt: string | null;
  status: Order["status"];
  downloadedAny: boolean;
}) {
  const steps = [
    {
      label: uz.order.timelineSent,
      done: true,
      current: status === "PENDING",
      time: formatDate(createdAt),
    },
    {
      label: uz.order.timelineApproved,
      done: status === "APPROVED",
      current: status === "APPROVED" && !downloadedAny,
      time: approvedAt ? formatDate(approvedAt) : status === "PENDING" ? "kutilmoqda" : "—",
      rejected: status === "REJECTED",
    },
    {
      label: uz.order.timelineDownloaded,
      done: downloadedAny,
      current: downloadedAny,
      time: downloadedAny ? "bajarildi" : "—",
    },
  ];

  return (
    <div className="rounded-[var(--r-card)] bg-[var(--surface)] border border-[var(--border)] p-4 md:p-5">
      <div className="meta mb-4">Jarayon</div>
      <div className="flex items-start">
        {steps.map((step, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 relative">
            {/* Chiziq */}
            {i > 0 && (
              <div
                className={cn(
                  "absolute top-3 -left-1/2 w-full h-px",
                  steps[i - 1].done && !step.rejected
                    ? "bg-[var(--accent)]"
                    : step.rejected
                    ? "bg-[var(--danger)]/40"
                    : "bg-[var(--border-strong)]",
                )}
              />
            )}
            {/* Nuqta */}
            <div
              className={cn(
                "relative z-10 w-6 h-6 rounded-full flex items-center justify-center border-2",
                step.rejected
                  ? "bg-[var(--danger)] border-[var(--danger)]"
                  : step.done
                  ? "bg-[var(--accent)] border-[var(--accent)]"
                  : step.current
                  ? "bg-[var(--bg)] border-[var(--accent)]"
                  : "bg-[var(--bg)] border-[var(--border-strong)]",
              )}
            >
              {step.done && !step.rejected && (
                <Check size={12} strokeWidth={2.5} className="text-[var(--on-accent)]" />
              )}
              {step.rejected && <XCircle size={12} strokeWidth={2.5} className="text-[var(--on-accent)]" />}
              {step.current && !step.done && (
                <motion.span
                  animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-[var(--accent)]/40"
                />
              )}
            </div>
            {/* Label */}
            <div className="text-center flex flex-col gap-0.5">
              <div
                className={cn(
                  "text-[11px] font-medium leading-tight",
                  step.done || step.current || step.rejected
                    ? "text-[var(--text)]"
                    : "text-[var(--text-faint)]",
                )}
              >
                {step.label}
              </div>
              <div className="meta text-[9px] leading-tight">{step.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingBlock({ createdAt }: { createdAt: string }) {
  return (
    <div className="rounded-[var(--r-card)] bg-[var(--surface)] border border-[var(--border)] p-4 md:p-5 flex flex-col gap-3">
      <div className="meta inline-flex items-center gap-1.5">
        <Clock size={11} strokeWidth={1.75} className="opacity-60" />
        Kutilmoqda
      </div>
      <ul className="flex flex-col gap-2 text-sm text-[var(--text-muted)] leading-relaxed">
        <li className="flex items-start gap-2">
          <span className="text-[var(--accent)] shrink-0 mt-0.5">·</span>
          <span>Chek Sardor tomonidan qo&apos;lda tekshiriladi</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[var(--accent)] shrink-0 mt-0.5">·</span>
          <span>Tasdiqlanganda shu sahifada yuklab olish tugmasi paydo bo&apos;ladi</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[var(--accent)] shrink-0 mt-0.5">·</span>
          <span>Sahifa har 30 soniyada avtomatik yangilanadi — yopib qo&apos;yishingiz mumkin</span>
        </li>
      </ul>
      <div className="text-xs text-[var(--text-faint)] pt-1 border-t border-[var(--border)]">
        Yuborilgan: {formatDate(createdAt)}
      </div>
    </div>
  );
}

function ApprovedBlock({
  token,
  expiresAt,
  expiresPassed,
  downloadsLeft,
  maxDownloads,
}: {
  token: string;
  expiresAt: string | null;
  expiresPassed: boolean;
  downloadsLeft: number;
  maxDownloads: number;
}) {
  if (expiresPassed) {
    return (
      <div className="rounded-[var(--r-card)] bg-[var(--danger)]/8 border border-[var(--danger)]/30 p-4 md:p-5 flex items-start gap-3">
        <AlertTriangle size={18} strokeWidth={1.75} className="text-[var(--danger)] shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-medium text-sm mb-1">{uz.order.expired}</div>
          <div className="text-xs text-[var(--text-muted)] leading-relaxed">
            Yuklab olish havolasi vaqti tugagan. Yangi buyurtma berish uchun galereyaga qayting.
          </div>
        </div>
      </div>
    );
  }

  if (downloadsLeft <= 0) {
    return (
      <div className="rounded-[var(--r-card)] bg-[var(--surface)] border border-[var(--border)] p-4 md:p-5 text-sm text-[var(--text-muted)] text-center">
        Yuklab olish limitidan foydalanib bo&apos;lingansiz.
      </div>
    );
  }

  const hoursLeftValue = expiresAt ? hoursLeft(expiresAt) : 0;

  return (
    <div className="rounded-[var(--r-card)] bg-[var(--success)]/8 border border-[var(--success)]/30 p-4 md:p-5 flex flex-col gap-3">
      <div className="meta inline-flex items-center gap-1.5 text-[var(--success)]">
        <ShieldCheck size={11} strokeWidth={1.75} />
        Tayyor
      </div>
      <a
        href={`/api/orders/${token}/download`}
        className="group h-12 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium inline-flex items-center justify-center gap-2"
      >
        <Download
          size={16}
          strokeWidth={1.75}
          className="group-hover:translate-y-0.5 transition-transform"
        />
        {uz.order.download}
      </a>
      <div className="grid grid-cols-2 gap-3 text-center pt-2 border-t border-[var(--border)]">
        <div className="flex flex-col gap-1">
          <div className="meta text-[10px]">Yuklab olish qoldi</div>
          <div className="font-mono text-lg text-[var(--text)]">
            {downloadsLeft}
            <span className="text-[var(--text-faint)] text-sm"> / {maxDownloads}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="meta text-[10px]">Havola muddati</div>
          <div className="font-mono text-lg text-[var(--text)]">
            {hoursLeftValue}
            <span className="text-[var(--text-faint)] text-sm"> soat</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RejectedBlock({ reason }: { reason: string | null }) {
  return (
    <div className="rounded-[var(--r-card)] bg-[var(--danger)]/8 border border-[var(--danger)]/30 p-4 md:p-5 flex flex-col gap-3">
      <div className="meta inline-flex items-center gap-1.5 text-[var(--danger)]">
        <XCircle size={11} strokeWidth={1.75} />
        Rad etish sababi
      </div>
      <div className="text-sm text-[var(--text)] leading-relaxed">
        {reason?.trim() || "Sabab kiritilmagan — Sardor bilan bog'laning."}
      </div>
      <div className="pt-2 border-t border-[var(--danger)]/20">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
        >
          Yangi buyurtma berish
          <ArrowUpRight size={13} strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  );
}

function hoursLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.round(ms / (60 * 60 * 1000)));
}
