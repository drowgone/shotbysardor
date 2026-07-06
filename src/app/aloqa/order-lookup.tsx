"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, AlertCircle, Lock } from "lucide-react";
import { uz } from "@/lib/i18n/uz";
import { OrderStatusCard } from "@/app/order/[token]/status-card";

type ContactType = "phone" | "email" | "other";

export function OrderLookup() {
  const [code, setCode] = useState("");
  const [verify, setVerify] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [order, setOrder] = useState<Parameters<typeof OrderStatusCard>[0]["order"] | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [contactType, setContactType] = useState<ContactType | null>(null);

  async function search() {
    setBusy(true);
    setErr(null);
    setOrder(null);
    try {
      const normalized = code.trim().replace(/^#/, "");
      const url = new URL(`/api/orders/by-code/${encodeURIComponent(normalized)}`, window.location.origin);
      const trimmedVerify = verify.trim();
      if (trimmedVerify) url.searchParams.set("verify", trimmedVerify);
      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error?.message ?? "Bunday kod bo'yicha buyurtma topilmadi");
        setNeedsVerify(false);
        setContactType(null);
        return;
      }
      setContactType((data?.contactType as ContactType) ?? null);
      if (data?.token) {
        // Tasdiq muvaffaqiyatli — to'liq holat kartasini ko'rsatamiz.
        setOrder(data);
        setNeedsVerify(false);
        setVerify("");
      } else if (data?.verifyFailed) {
        // Foydalanuvchi 4 raqam kiritdi ammo mos kelmadi — aniq xato ko'rsatamiz.
        setNeedsVerify(true);
        setErr("Kiritilgan raqamlar mos kelmadi. Buyurtmada ko'rsatilgan aloqa raqamining oxirgi 4 raqamini tekshirib qayta kiriting.");
        setVerify("");
      } else if (data?.verifyRequired) {
        setNeedsVerify(true);
      } else {
        // Tekshiruv umuman shart emas (masalan aloqa raqamida raqam yo'q) —
        // token bo'sh, faqat status ko'rinadi. Bu holat kam uchraydi.
        setNeedsVerify(false);
      }
    } catch {
      setErr(uz.states.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) search();
        }}
        className="flex flex-col gap-2"
        autoComplete="off"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] font-mono text-sm pointer-events-none">
              #
            </span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/^#/, "").toUpperCase())}
              placeholder="SB-1042"
              autoComplete="off"
              maxLength={16}
              className="w-full h-12 pl-7 pr-4 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] font-mono text-sm outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>
          <motion.button
            type="submit"
            disabled={busy || !code.trim()}
            whileTap={{ scale: 0.96 }}
            className="h-12 px-5 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium disabled:opacity-50 inline-flex items-center gap-2 text-sm"
          >
            <Search size={16} strokeWidth={2} />
            <span className="hidden sm:inline">
              {busy ? "Qidirilmoqda…" : uz.order.codeLookupSubmit}
            </span>
          </motion.button>
        </div>

        {/* Yuklab olish token'ini ochish uchun aloqa oxirgi 4 raqami */}
        <AnimatePresence>
          {needsVerify && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2 pt-1">
                <div className="text-xs text-[var(--text-muted)] flex items-start gap-2">
                  <Lock size={13} strokeWidth={1.75} className="shrink-0 mt-0.5" />
                  <span>
                    Yuklab olish uchun buyurtma qilganingizda ko&apos;rsatilgan{" "}
                    {contactType === "email"
                      ? "aloqa manzilingizdagi oxirgi 4 raqamni"
                      : "telefon raqamingizning oxirgi 4 raqamini"}{" "}
                    kiriting. Bu — buyurtma egasi ekaningizni tasdiqlash uchun.
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    inputMode="numeric"
                    value={verify}
                    onChange={(e) => setVerify(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    autoComplete="off"
                    maxLength={4}
                    aria-label="Aloqa raqamining oxirgi 4 raqami"
                    className="flex-1 h-11 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] font-mono text-sm tracking-[0.4em] text-center outline-none focus:border-[var(--accent)] transition-colors"
                  />
                  <motion.button
                    type="submit"
                    disabled={busy || verify.length !== 4}
                    whileTap={{ scale: 0.96 }}
                    className="h-11 px-4 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium disabled:opacity-50 text-sm"
                  >
                    Tasdiqlash
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      <AnimatePresence mode="wait">
        {err && (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-start gap-2 text-sm text-[var(--danger)] p-3 rounded-[var(--r-control)] bg-[var(--danger)]/8 border border-[var(--danger)]/30"
          >
            <AlertCircle size={14} strokeWidth={1.75} className="shrink-0 mt-0.5" />
            <span>{err}</span>
          </motion.div>
        )}
        {order && (
          <motion.div
            key="order"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <OrderStatusCard order={order} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
