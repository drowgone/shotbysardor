"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, ExternalLink, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CARD_BRANDS,
  formatCardNumber,
  getBrandInfo,
  normalizePayment,
  type LegacyPaymentDetails,
} from "@/lib/cards";

const ease = [0.22, 1, 0.36, 1] as const;

// Umumiy to'lov usullarini ko'rsatuvchi komponent — Order modal va Donate sahifasida ishlatiladi.
// `onCardCopy` beriladigan bo'lsa, karta nusxa olinganda callback ishlaydi (masalan buyurtma jarayonida
// 1-qadamni "bajarildi" deb belgilash uchun).
export function PaymentMethods({
  payment,
  onCardCopy,
  onOnlinePay,
  compact,
}: {
  payment: LegacyPaymentDetails | undefined | null;
  onCardCopy?: () => void;
  onOnlinePay?: (kind: "payme" | "click") => void;
  compact?: boolean;
}) {
  const { cards, paymeUrl, clickUrl } = normalizePayment(payment);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  async function copyNumber(number: string, idx: number) {
    const clean = number.replace(/\D/g, "");
    try {
      await navigator.clipboard.writeText(clean);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = clean;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // ignore
      }
      document.body.removeChild(ta);
    }
    setCopiedIdx(idx);
    onCardCopy?.();
    setTimeout(() => setCopiedIdx((prev) => (prev === idx ? null : prev)), 1600);
  }

  const hasAny = cards.length > 0 || paymeUrl || clickUrl;
  if (!hasAny) return null;

  return (
    <div className="flex flex-col gap-3">
      {cards.length > 0 && (
        <div className={cn("grid gap-2", cards.length > 1 && !compact && "sm:grid-cols-2")}>
          {cards.map((card, i) => (
            <PaymentCardTile
              key={i}
              card={card}
              copied={copiedIdx === i}
              onCopy={() => copyNumber(card.number, i)}
              compact={compact}
            />
          ))}
        </div>
      )}
      {(paymeUrl || clickUrl) && (
        <div className={cn("grid gap-2", paymeUrl && clickUrl && "sm:grid-cols-2")}>
          {paymeUrl && (
            <OnlinePayLink
              href={paymeUrl}
              label="Payme"
              color="#00c7ff"
              onClick={() => onOnlinePay?.("payme")}
            />
          )}
          {clickUrl && (
            <OnlinePayLink
              href={clickUrl}
              label="Click"
              color="#00a3ff"
              onClick={() => onOnlinePay?.("click")}
            />
          )}
        </div>
      )}
    </div>
  );
}

function PaymentCardTile({
  card,
  copied,
  onCopy,
  compact,
}: {
  card: { brand: string; number: string; holder: string };
  copied: boolean;
  onCopy: () => void;
  compact?: boolean;
}) {
  const brand = getBrandInfo(card.brand as never);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}
      className={cn(
        "relative rounded-[var(--r-card)] border overflow-hidden",
        compact ? "p-3" : "p-4",
        "bg-[var(--surface)] border-[var(--border-strong)]",
      )}
      style={{
        background: `linear-gradient(135deg, ${brand.bg} 0%, transparent 60%), var(--surface)`,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <BrandBadge brand={card.brand as never} />
        <button
          onClick={onCopy}
          className={cn(
            "h-8 px-2.5 rounded-[var(--r-control)] border text-xs inline-flex items-center gap-1 whitespace-nowrap shrink-0",
            copied
              ? "border-[var(--success)] text-[var(--success)]"
              : "border-[var(--border-strong)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
          )}
          aria-label="Nusxa olish"
        >
          {copied ? (
            <>
              <Check size={12} strokeWidth={2.5} />
              Olindi
            </>
          ) : (
            <>
              <Copy size={12} strokeWidth={1.75} />
              Nusxa
            </>
          )}
        </button>
      </div>
      <div
        className={cn(
          "font-mono font-display leading-none tracking-wider truncate",
          compact ? "text-base" : "text-lg md:text-xl",
        )}
      >
        {formatCardNumber(card.number)}
      </div>
      {card.holder && (
        <div className="meta text-[10px] mt-2 text-[var(--text-muted)] truncate">
          {card.holder}
        </div>
      )}
    </motion.div>
  );
}

export function BrandBadge({ brand, size = "sm" }: { brand: string; size?: "sm" | "md" }) {
  const b = getBrandInfo(brand as never);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--r-pill)] font-medium tracking-wide uppercase",
        size === "sm" ? "h-5 px-2 text-[9px]" : "h-6 px-2.5 text-[10px]",
      )}
      style={{ background: b.bg, color: b.color }}
    >
      <CreditCard size={size === "sm" ? 9 : 11} strokeWidth={2} />
      {b.name}
    </span>
  );
}

function OnlinePayLink({
  href,
  label,
  color,
  onClick,
}: {
  href: string;
  label: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.4, ease }}
      className="group h-11 px-3 rounded-[var(--r-control)] bg-[var(--surface)] border border-[var(--border-strong)] hover:border-[var(--accent)] inline-flex items-center gap-3 text-sm"
    >
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
        style={{ background: color }}
      >
        {label[0]}
      </span>
      <span className="flex-1 min-w-0 truncate">{label}&apos;da to&apos;lash</span>
      <ExternalLink
        size={13}
        strokeWidth={1.75}
        className="text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0"
      />
    </motion.a>
  );
}

export { CARD_BRANDS };
