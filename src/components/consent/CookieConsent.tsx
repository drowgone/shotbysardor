"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Cookie, X, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sbs-cookie-consent-v1";
// 180 kunlik amal qilish muddati — undan keyin qayta so'raladi
const CONSENT_TTL_MS = 180 * 24 * 60 * 60 * 1000;

const ease = [0.22, 1, 0.36, 1] as const;

type Consent = {
  accepted: boolean;
  categories: {
    necessary: true;
    analytics: boolean;
    preferences: boolean;
  };
  timestamp: number;
};

// Boshqa komponentlar kerakli holatlarda tekshira olishi uchun eksport qilinadi.
export function getConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const c: Consent = JSON.parse(raw);
    if (!c.timestamp || Date.now() - c.timestamp > CONSENT_TTL_MS) return null;
    return c;
  } catch {
    return null;
  }
}

export function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [preferences, setPreferences] = useState(true);

  useEffect(() => {
    setMounted(true);
    // Sahifa yuklangandan biroz keyin ko'rsatish (WelcomeGuide dan keyin, foydalanuvchi asosiy
    // kontentga o'rganib olsin).
    const existing = getConsent();
    if (!existing) {
      const t = setTimeout(() => setShow(true), 1600);
      return () => clearTimeout(t);
    }
  }, []);

  function save(accepted: boolean, cats?: { analytics: boolean; preferences: boolean }) {
    const consent: Consent = {
      accepted,
      categories: {
        necessary: true,
        analytics: cats?.analytics ?? analytics,
        preferences: cats?.preferences ?? preferences,
      },
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch {
      // ignore
    }
    setShow(false);
  }

  function acceptAll() {
    save(true, { analytics: true, preferences: true });
  }

  function acceptNecessary() {
    save(false, { analytics: false, preferences: false });
  }

  function saveCustom() {
    save(analytics || preferences, { analytics, preferences });
  }

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.45, ease }}
          role="dialog"
          aria-label="Cookie ruxsati"
          className="fixed z-[65] left-3 right-3 bottom-3 md:left-4 md:right-auto md:bottom-4 md:w-[440px]"
        >
          <div
            className="rounded-[var(--r-modal)] bg-[var(--bg-elevated)] border border-[var(--border-strong)] overflow-hidden"
            style={{ boxShadow: "var(--shadow-modal)" }}
          >
            {/* Sarlavha bloki */}
            <div className="p-4 md:p-5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] shrink-0">
                <Cookie size={18} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-base leading-tight">
                  Cookie&apos;lardan foydalanamiz
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-1">
                  Sayt tajribasini yaxshilash uchun cookie va localStorage ishlatiladi:
                  sozlamalarni eslab qolish, analitika va xavfsizlik uchun.{" "}
                  <Link
                    href="/aloqa"
                    className="text-[var(--accent)] hover:underline whitespace-nowrap"
                  >
                    Batafsil
                  </Link>
                </p>
              </div>
              <button
                onClick={acceptNecessary}
                aria-label="Yopish"
                className="w-7 h-7 rounded-full hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-muted)] shrink-0"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>

            {/* Kategoriyalar accordion */}
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease }}
                  className="overflow-hidden"
                >
                  <div className="px-4 md:px-5 pb-4 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
                    <CategoryRow
                      title="Kerakli"
                      description="Sayt ishlashi uchun majburiy — sessiya, xavfsizlik."
                      value={true}
                      disabled
                    />
                    <CategoryRow
                      title="Sozlamalar"
                      description="Ismingiz, filtr tanlovlaringiz, welcome guide holati."
                      value={preferences}
                      onChange={setPreferences}
                    />
                    <CategoryRow
                      title="Analitika"
                      description="Tashriflar va foydalanish statistikasi — sayt yaxshilash uchun."
                      value={analytics}
                      onChange={setAnalytics}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Harakatlar */}
            <div className="px-4 md:px-5 pb-4 flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={acceptNecessary}
                  className="flex-1 h-10 rounded-[var(--r-control)] border border-[var(--border-strong)] text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-faint)] font-medium"
                >
                  Faqat kerakli
                </button>
                <button
                  onClick={expanded ? saveCustom : acceptAll}
                  className="flex-1 h-10 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-xs font-medium inline-flex items-center justify-center gap-1.5"
                >
                  <Check size={12} strokeWidth={2.5} />
                  {expanded ? "Tanlanganini saqlash" : "Barchasini qabul qilish"}
                </button>
              </div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="h-8 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] inline-flex items-center justify-center gap-1"
              >
                {expanded ? "Yig'ish" : "Sozlash"}
                <ChevronDown
                  size={11}
                  strokeWidth={1.75}
                  className={cn("transition-transform", expanded && "rotate-180")}
                />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CategoryRow({
  title,
  description,
  value,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <button
        type="button"
        onClick={() => !disabled && onChange?.(!value)}
        disabled={disabled}
        aria-pressed={value}
        className={cn(
          "relative w-9 h-5 rounded-full shrink-0 mt-0.5 transition-colors",
          value
            ? disabled
              ? "bg-[var(--text-faint)]"
              : "bg-[var(--accent)]"
            : "bg-[var(--border-strong)]",
          disabled && "cursor-not-allowed opacity-70",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--bg-elevated)] transition-transform",
            value && "translate-x-4",
          )}
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-[var(--text)]">{title}</div>
          {disabled && (
            <span className="meta text-[9px] text-[var(--text-faint)]">Har doim</span>
          )}
        </div>
        <div className="text-[11px] text-[var(--text-muted)] leading-snug">{description}</div>
      </div>
    </div>
  );
}
