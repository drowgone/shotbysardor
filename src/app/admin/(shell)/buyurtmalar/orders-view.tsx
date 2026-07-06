"use client";

import { useState } from "react";
import { Copy, Check, X as XIcon, ScanLine } from "lucide-react";
import { useCsrf } from "../csrf-provider";
import { uz } from "@/lib/i18n/uz";
import { formatUZS, formatTimeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLiveData } from "@/lib/live/use-live";

type FindingKey = "amount" | "card" | "date" | "currency" | "paymentSystem" | "statusText";
type Finding = { key: FindingKey; label: string; found: boolean; value?: string; match?: boolean };
type Ocr = {
  score: number | null;
  level: "high" | "medium" | "low" | null;
  findings: Finding[] | null;
  processedAt: string;
};

type Order = {
  id: string;
  code: string;
  token: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  title: string;
  thumbUrl: string;
  customerName: string;
  contact: string;
  note: string | null;
  priceUZS: number;
  receiptUrl: string | null;
  rejectReason: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  downloadCount: number;
  maxDownloads: number;
  createdAt: string;
  ocr: Ocr | null;
};

export function OrdersView() {
  const [tab, setTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const csrf = useCsrf();
  // Live: "orders" topic'ini tinglaymiz — yangi buyurtma, approve/reject event'lari
  // avtomatik ravishda ro'yxatni yangilaydi. Optimistik yangilash foydalanuvchi tugmani
  // bosganda darhol javob berish uchun saqlanadi.
  const { data, loading } = useLiveData<{ items: Order[] }>(
    `/api/admin/orders?status=${tab}`,
    ["orders"],
  );
  const orders = data?.items ?? [];

  async function approve(id: string) {
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ action: "approve" }),
    });
    // Refetch bus event orqali avtomatik ravishda ishga tushadi.
  }

  async function reject(id: string) {
    const reason = window.prompt(uz.admin.orders.rejectReason);
    if (!reason) return;
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ action: "reject", reason }),
    });
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "h-10 px-4 rounded-[var(--r-pill)] text-sm border",
              tab === k
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-[var(--border-strong)] text-[var(--text-muted)]",
            )}
          >
            {k === "PENDING" ? uz.admin.orders.pending : k === "APPROVED" ? uz.admin.orders.approved : uz.admin.orders.rejected}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="meta">{uz.states.loading}</div>
      ) : orders.length === 0 ? (
        <div className="meta">{uz.states.empty}</div>
      ) : (
        <div className="grid gap-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} onApprove={approve} onReject={reject} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  onApprove,
  onReject,
}: {
  order: Order;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(t: string, key: string) {
    await navigator.clipboard.writeText(t);
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  }
  const link = typeof window !== "undefined" ? `${window.location.origin}/order/${order.token}` : "";
  return (
    <div className="p-4 bg-[var(--surface)] rounded-[var(--r-card)] flex flex-col md:flex-row gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={order.thumbUrl} alt="" className="w-24 h-24 object-cover rounded-[var(--r-media)]" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="font-mono text-sm">#{order.code}</div>
          <div className="meta">{formatTimeAgo(order.createdAt)}</div>
        </div>
        <div className="font-medium">{order.title}</div>
        <div className="text-sm">
          <span className="text-[var(--text-muted)]">{uz.admin.orders.customer}: </span>
          {order.customerName}
        </div>
        <button
          onClick={() => copy(order.contact, "contact")}
          className="text-sm text-left inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          {order.contact}
          {copied === "contact" ? <Check size={12} /> : <Copy size={12} strokeWidth={1.5} />}
        </button>
        {order.note && <div className="text-sm text-[var(--text-muted)]">{order.note}</div>}
        <div className="meta">{formatUZS(order.priceUZS)}</div>
        {order.receiptUrl && (
          <a href={order.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--accent)]">
            {uz.admin.orders.viewReceipt}
          </a>
        )}
        {order.ocr && <OcrPanel ocr={order.ocr} />}
      </div>
      <div className="flex flex-col gap-2 md:w-52">
        {order.status === "PENDING" && (
          <>
            <button
              onClick={() => onApprove(order.id)}
              className="h-11 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium"
            >
              {uz.admin.actions.approve}
            </button>
            <button
              onClick={() => onReject(order.id)}
              className="h-11 rounded-[var(--r-control)] border border-[var(--border-strong)] text-[var(--danger)]"
            >
              {uz.admin.actions.reject}
            </button>
          </>
        )}
        {order.status === "APPROVED" && (
          <>
            <button
              onClick={() => copy(link, "link")}
              className="h-11 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm inline-flex items-center justify-center gap-2"
            >
              {copied === "link" ? <Check size={14} /> : <Copy size={14} strokeWidth={1.5} />}
              {uz.admin.actions.copyLink}
            </button>
            <div className="meta text-center">
              {order.downloadCount}/{order.maxDownloads} · {order.expiresAt ? new Date(order.expiresAt).toLocaleString("uz-UZ") : "-"}
            </div>
          </>
        )}
        {order.status === "REJECTED" && (
          <div className="meta text-center">{order.rejectReason}</div>
        )}
      </div>
    </div>
  );
}

const FOUND_LABELS: Record<FindingKey, { yes: string; no: string }> = {
  amount: { yes: uz.admin.orders.ocr.amount, no: uz.admin.orders.ocr.amountMiss },
  card: { yes: uz.admin.orders.ocr.card, no: uz.admin.orders.ocr.cardMiss },
  date: { yes: uz.admin.orders.ocr.date, no: uz.admin.orders.ocr.dateMiss },
  currency: { yes: uz.admin.orders.ocr.currency, no: uz.admin.orders.ocr.currencyMiss },
  paymentSystem: { yes: uz.admin.orders.ocr.paymentSystem, no: uz.admin.orders.ocr.paymentSystemMiss },
  statusText: { yes: uz.admin.orders.ocr.statusText, no: uz.admin.orders.ocr.statusTextMiss },
};

function OcrPanel({ ocr }: { ocr: Ocr }) {
  const findings = ocr.findings ?? [];
  const score = ocr.score ?? 0;
  const level = ocr.level ?? "low";
  const levelLabel =
    level === "high"
      ? uz.admin.orders.ocr.levelHigh
      : level === "medium"
        ? uz.admin.orders.ocr.levelMedium
        : uz.admin.orders.ocr.levelLow;
  const levelColor =
    level === "high" ? "var(--success)" : level === "medium" ? "var(--accent)" : "var(--danger)";
  return (
    <div className="mt-2 p-3 rounded-[var(--r-card)] bg-[var(--bg)] border border-[var(--border)]">
      <div className="flex items-center gap-2 mb-2">
        <ScanLine size={14} strokeWidth={1.5} className="text-[var(--text-muted)]" />
        <div className="meta">{uz.admin.orders.ocr.title}</div>
      </div>
      <ul className="flex flex-col gap-1 mb-3">
        {findings.map((f) => {
          const labels = FOUND_LABELS[f.key];
          return (
            <li key={f.key} className="flex items-start gap-2 text-sm leading-tight">
              {f.found ? (
                <Check size={14} className="text-[var(--success)] mt-[3px] shrink-0" strokeWidth={2} />
              ) : (
                <XIcon size={14} className="text-[var(--danger)] mt-[3px] shrink-0" strokeWidth={2} />
              )}
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={f.found ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>
                  {f.found ? labels.yes : labels.no}
                </span>
                {f.found && f.value && (
                  <span className="font-mono text-xs text-[var(--text-muted)]">{f.value}</span>
                )}
                {f.match && (
                  <span className="text-[10px] uppercase tracking-wider text-[var(--success)]">
                    · {uz.admin.orders.ocr.matchHint}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
        <div className="flex items-baseline gap-2">
          <div className="meta">{uz.admin.orders.ocr.confidence}</div>
          <div className="font-mono text-sm" style={{ color: levelColor }}>
            {score} / 100
          </div>
        </div>
        <div className="text-xs" style={{ color: levelColor }}>
          {levelLabel}
        </div>
      </div>
      <div className="mt-2 text-[10px] text-[var(--text-faint)] leading-snug">
        {uz.admin.orders.ocr.disclaimer}
      </div>
    </div>
  );
}
