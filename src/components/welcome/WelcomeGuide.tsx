"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Camera,
  Filter,
  ShoppingCart,
  Bell,
  BellRing,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sbs-welcome-seen-v1";
const NOTIF_STORAGE_KEY = "sbs-notif-asked-v1";

const ease = [0.22, 1, 0.36, 1] as const;

type Step = {
  id: string;
  icon: React.ReactNode;
  title: string;
  body: string;
};

const steps: Step[] = [
  {
    id: "welcome",
    icon: <Sparkles size={22} strokeWidth={1.75} />,
    title: "Xush kelibsiz",
    body: "Bu shot by sardor — Sardorning fotografiya galereyasi. Sayt qanday ishlashini qisqacha ko'rsatib qo'yaman.",
  },
  {
    id: "browse",
    icon: <Camera size={22} strokeWidth={1.75} />,
    title: "Kadrlarni ko'rish",
    body: "Har bir kadrni bosing — to'liq ekranda ochiladi. Video kadrlar avtomatik ijro etiladi.",
  },
  {
    id: "filter",
    icon: <Filter size={22} strokeWidth={1.75} />,
    title: "Filtr va qidiruv",
    body: "Yuqoridagi filtr paneli orqali janr, joylashuv va yil bo'yicha ajratib olishingiz mumkin.",
  },
  {
    id: "order",
    icon: <ShoppingCart size={22} strokeWidth={1.75} />,
    title: "Buyurtma berish",
    body: "Katta o'lchamli original rasm kerak bo'lsa — kadr ustidagi «Buyurtma» tugmasini bosing.",
  },
];

export function WelcomeGuide() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [askNotif, setAskNotif] = useState(false);
  const [notifState, setNotifState] = useState<"idle" | "granted" | "denied" | "unsupported">(
    "idle",
  );

  // localStorage'ni faqat clientda tekshiramiz — SSR mismatch bo'lmasin.
  useEffect(() => {
    setMounted(true);
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        // Sahifa yuklanishi bilan darrov emas, ozgina kechroq — hero animatsiya tugagach.
        const t = setTimeout(() => setOpen(true), 900);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage yopilgan bo'lsa — foydalanuvchini bezovta qilmaymiz
    }
  }, []);

  // Esc bilan yopish
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  }

  function next() {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      // Oxirgi qadam — bildirishnoma so'raymiz (agar oldin so'ralmagan bo'lsa)
      try {
        const asked = localStorage.getItem(NOTIF_STORAGE_KEY);
        if (!asked && "Notification" in window && Notification.permission === "default") {
          setAskNotif(true);
          return;
        }
      } catch {
        // ignore
      }
      close();
    }
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1);
  }

  async function requestNotification() {
    try {
      localStorage.setItem(NOTIF_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    if (!("Notification" in window)) {
      setNotifState("unsupported");
      setTimeout(close, 1400);
      return;
    }
    // Xavfsiz kontekst tekshiruvi — HTTPS yoki localhost bo'lmasa Notification API
    // brauzer'da mavjud bo'lsa ham, requestPermission jimgina "denied" qaytaradi va
    // native prompt umuman ko'rinmaydi. Foydalanuvchiga aniq tushuntiramiz.
    if (!window.isSecureContext) {
      setNotifState("unsupported");
      setTimeout(close, 2400);
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setNotifState("granted");
        // Silliq minnatdorlik demo — yangi kontent kelganda backend'dan push jo'natilishi mumkin.
        try {
          new Notification("shot by sardor", {
            body: "Rahmat! Yangi kadrlar chiqqanda xabar beramiz.",
            icon: "/favicon.ico",
          });
        } catch {
          // ignore
        }
      } else {
        setNotifState("denied");
      }
    } catch {
      setNotifState("denied");
    }
    setTimeout(close, 1600);
  }

  function skipNotification() {
    try {
      localStorage.setItem(NOTIF_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    close();
  }

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Fon: barcha qurilmalarda blur + scrim */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={close}
            className="fixed inset-0 z-[70] bg-[var(--bg)]/70 backdrop-blur-md"
          />

          {/* Card — barcha qurilmalarda o'rtada, desktopda kattaroq */}
          <div className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="card"
              role="dialog"
              aria-modal="true"
              aria-label="Xush kelibsiz"
              initial={{ opacity: 0, y: 20, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.94 }}
              transition={{ duration: 0.45, ease }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "w-full max-w-[420px] md:max-w-[480px]",
                "bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-[var(--r-modal)] overflow-hidden",
                "pointer-events-auto",
              )}
              style={{ boxShadow: "var(--shadow-modal)" }}
            >
            {askNotif ? (
              <NotificationPrompt
                state={notifState}
                onEnable={requestNotification}
                onSkip={skipNotification}
              />
            ) : (
              <>
                {/* Header — progress + close */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)]">
                  <div className="flex items-center gap-1.5">
                    {steps.map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1 rounded-full transition-all duration-300",
                          i === step
                            ? "w-6 bg-[var(--accent)]"
                            : i < step
                            ? "w-2 bg-[var(--accent)]/60"
                            : "w-2 bg-[var(--border-strong)]",
                        )}
                      />
                    ))}
                  </div>
                  <button
                    onClick={close}
                    aria-label="Yopish"
                    className="w-8 h-8 rounded-full hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-muted)]"
                  >
                    <X size={16} strokeWidth={1.75} />
                  </button>
                </div>

                {/* Step content */}
                <div className="p-5 pb-3">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={steps[step].id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.28, ease }}
                      className="flex flex-col gap-3"
                    >
                      <div className="w-11 h-11 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
                        {steps[step].icon}
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="meta text-[var(--text-muted)]">
                          {step + 1} / {steps.length}
                        </div>
                        <h2 className="font-display text-xl leading-tight">
                          {steps[step].title}
                        </h2>
                        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                          {steps[step].body}
                        </p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Actions */}
                <div className="px-5 py-3 flex items-center justify-between gap-3 border-t border-[var(--border)]">
                  {step > 0 ? (
                    <button
                      onClick={prev}
                      className="h-10 px-3 text-sm text-[var(--text-muted)] hover:text-[var(--text)] inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft size={14} strokeWidth={1.75} />
                      Orqaga
                    </button>
                  ) : (
                    <button
                      onClick={close}
                      className="h-10 px-3 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      O&apos;tkazib yuborish
                    </button>
                  )}
                  <motion.button
                    onClick={next}
                    whileTap={{ scale: 0.96 }}
                    className="h-10 px-4 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium text-sm inline-flex items-center gap-1.5"
                  >
                    {step < steps.length - 1 ? "Keyingi" : "Boshlash"}
                    <ArrowRight size={14} strokeWidth={2} />
                  </motion.button>
                </div>
              </>
            )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function NotificationPrompt({
  state,
  onEnable,
  onSkip,
}: {
  state: "idle" | "granted" | "denied" | "unsupported";
  onEnable: () => void;
  onSkip: () => void;
}) {
  if (state === "granted") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease }}
        className="p-6 flex flex-col items-center text-center gap-3"
      >
        <div className="w-12 h-12 rounded-full bg-[var(--success)]/15 border-2 border-[var(--success)]/50 flex items-center justify-center text-[var(--success)]">
          <Check size={22} strokeWidth={2.5} />
        </div>
        <div className="font-display text-lg">Rahmat!</div>
        <p className="text-sm text-[var(--text-muted)]">
          Yangi kadrlar chiqqanda sizga xabar beramiz.
        </p>
      </motion.div>
    );
  }

  if (state === "denied" || state === "unsupported") {
    const isInsecure =
      state === "unsupported" &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      !window.isSecureContext;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease }}
        className="p-6 flex flex-col items-center text-center gap-3"
      >
        <div className="w-12 h-12 rounded-full bg-[var(--surface)] border border-[var(--border-strong)] flex items-center justify-center text-[var(--text-faint)]">
          <Bell size={22} strokeWidth={1.75} />
        </div>
        <div className="font-display text-lg">
          {isInsecure
            ? "HTTPS talab qilinadi"
            : state === "unsupported"
            ? "Qurilma qo'llab-quvvatlamaydi"
            : "Yaxshi, keyinroq"}
        </div>
        <p className="text-sm text-[var(--text-muted)] max-w-[36ch] leading-snug">
          {isInsecure
            ? "Bildirishnoma faqat xavfsiz ulanishda (HTTPS) ishlaydi. Instagram yoki Telegramda kuzatib borishingiz mumkin."
            : "Instagram yoki Telegramda kuzatib borishingiz mumkin."}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] shrink-0">
          <BellRing size={22} strokeWidth={1.75} />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <div className="meta text-[var(--accent)]">Oxirgi qadam</div>
          <h2 className="font-display text-lg leading-tight">
            Yangi kadrlardan xabardor bo&apos;ling
          </h2>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Sardor yangi ish yuklaganda bildirishnoma yuboramiz. Xohlagan payt o&apos;chirishingiz
            mumkin.
          </p>
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <button
          onClick={onSkip}
          className="flex-1 h-10 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Kerakmas
        </button>
        <motion.button
          onClick={onEnable}
          whileTap={{ scale: 0.96 }}
          className="flex-1 h-10 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium text-sm inline-flex items-center justify-center gap-1.5"
        >
          <Bell size={14} strokeWidth={2} />
          Yoqish
        </motion.button>
      </div>
    </div>
  );
}
