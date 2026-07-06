"use client";

import { useEffect, useRef, useState } from "react";
import { X, Copy, UploadCloud, Check, ExternalLink, Info, Lock, AlertTriangle, ArrowRight, Clock, Bell, BellRing, BellOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { uz } from "@/lib/i18n/uz";
import { formatUZS, cn } from "@/lib/utils";
import { normalizePhoneRaw } from "@/lib/format";
import { PhoneInput } from "@/components/inputs/FormattedInput";
import { PaymentMethods } from "@/components/payment/PaymentMethods";
import { normalizePayment, type LegacyPaymentDetails } from "@/lib/cards";
import { addPendingOrder } from "@/components/notifications/NotificationPoller";

type Content = { id: string; slug: string; title: string; thumbUrl: string; priceUZS: number };

type PaymentDetails = LegacyPaymentDetails;

export function OrderModal({ content, onClose }: { content: Content; onClose: () => void }) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; token: string } | null>(null);
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Ketma-ketlik holatlari
  const [paymentDone, setPaymentDone] = useState(false); // qadam 1
  const [lockedShake, setLockedShake] = useState(false);
  const [showLockedAlert, setShowLockedAlert] = useState(false);
  const [receiptWarn, setReceiptWarn] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sbs-name");
    if (stored) setName(stored);
    fetch("/api/order-config")
      .then((r) => r.json())
      .then((d) => setPayment(d.payment))
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    };
  }, [receiptPreview]);

  function markPaid(kind: "card" | "payme" | "click") {
    setPaymentDone(true);
    // Nusxa olish PaymentMethods komponenti ichida — bu yerda faqat holatni yangilaymiz
    void kind;
  }

  async function copy(t: string, key: string) {
    if (!t) return;
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(t);
        ok = true;
      }
    } catch {
      // pastda fallback
    }
    if (!ok) {
      // Insecure context (network IP orqali kirilganda) — execCommand fallback
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
    }
    if (ok) {
      setCopied(key);
      setTimeout(() => setCopied(null), 1200);
    }
  }

  function requireStep1(): boolean {
    if (paymentDone) return true;
    setLockedShake(true);
    setShowLockedAlert(true);
    setTimeout(() => setLockedShake(false), 400);
    setTimeout(() => setShowLockedAlert(false), 4000);
    return false;
  }

  // Chek rasmni tekshirish — hajm va aspect ratio geuristik
  async function handleReceiptSelect(file: File | null) {
    if (!file) {
      setReceipt(null);
      setReceiptPreview(null);
      return;
    }
    // Kichik hajmli fayl — ehtimol screenshot emas
    const url = URL.createObjectURL(file);
    const img = new Image();
    const looksLikeReceipt = await new Promise<boolean>((resolve) => {
      img.onload = () => {
        const ar = img.width / img.height;
        const tooSmall = file.size < 20 * 1024; // <20KB
        const badAspect = ar > 2.2 || ar < 0.25; // juda keng yoki juda tor
        const tooTinyPixels = img.width < 300 || img.height < 300;
        resolve(!tooSmall && !badAspect && !tooTinyPixels);
      };
      img.onerror = () => resolve(false);
      img.src = url;
    });

    if (!looksLikeReceipt) {
      setReceiptWarn({ file, url });
      return;
    }
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceipt(file);
    setReceiptPreview(url);
  }

  function acceptWarnedReceipt() {
    if (!receiptWarn) return;
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceipt(receiptWarn.file);
    setReceiptPreview(receiptWarn.url);
    setReceiptWarn(null);
  }

  function rejectWarnedReceipt() {
    if (receiptWarn) URL.revokeObjectURL(receiptWarn.url);
    setReceiptWarn(null);
  }

  async function submit() {
    if (!requireStep1()) return;
    if (!receipt) {
      setErr("Chek yuklanmagan — 2-qadamni bajaring");
      return;
    }
    if (!name.trim() || !contact.trim()) {
      setErr("Ism va aloqa majburiy");
      return;
    }
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("contentId", content.id);
    fd.set("name", name.trim());
    fd.set("contact", contact ? normalizePhoneRaw(contact) : contact);
    if (note.trim()) fd.set("note", note.trim());
    fd.set("receipt", receipt);
    try {
      const res = await fetch("/api/orders", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        // 422 receipt_invalid — OCR hech qanday chek elementini topa olmadi:
        // foydalanuvchidan haqiqiy chek qayta so'raladi.
        if (res.status === 422 && data?.error?.code === "receipt_invalid") {
          setErr(data.error.message);
          // Chekni tozalash — user boshqa rasm tanlashi uchun
          if (receiptPreview) URL.revokeObjectURL(receiptPreview);
          setReceipt(null);
          setReceiptPreview(null);
        } else {
          setErr(data?.error?.message ?? uz.states.error);
        }
      } else {
        localStorage.setItem("sbs-name", name.trim());
        setResult(data);
        setStep("success");
      }
    } catch {
      setErr(uz.states.error);
    } finally {
      setBusy(false);
    }
  }

  const normalized = normalizePayment(payment);
  const hasPayment = normalized.cards.length > 0 || !!normalized.paymeUrl || !!normalized.clickUrl;
  const inputsDisabled = !paymentDone || !receipt;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={uz.order.title}
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-[var(--scrim)]" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.3, ease: [0.2, 0.6, 0.2, 1] }}
        className="relative w-full md:max-w-[560px] max-h-[92vh] overflow-y-auto bg-[var(--surface)] rounded-t-[var(--r-modal)] md:rounded-[var(--r-modal)] p-5 md:p-6"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center z-10" aria-label={uz.common.close}>
          <X size={18} strokeWidth={1.5} />
        </button>

        <AnimatePresence mode="wait" initial={false}>
        {step === "form" ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Sarlavha + rasm */}
            <div className="flex items-start gap-4 mb-5 pr-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={content.thumbUrl} alt="" className="w-16 h-16 object-cover rounded-[var(--r-media)]" />
              <div>
                <div className="meta">{uz.order.title}</div>
                <div className="font-display text-lg leading-tight">{content.title}</div>
                <div className="meta mt-1 text-[var(--accent)]">
                  {content.priceUZS > 0 ? formatUZS(content.priceUZS) : uz.order.priceNegotiable}
                </div>
              </div>
            </div>

            {/* Qadamlar yo'riqnomasi */}
            <div className="mb-5 p-3 rounded-[var(--r-card)] bg-[var(--bg)] border border-[var(--border)]">
              <div className="flex items-center gap-2 meta mb-2">
                <Info size={12} strokeWidth={1.5} />
                {uz.order.steps.title}
              </div>
              <ol className="flex flex-col gap-1.5 text-[13px] leading-snug">
                <StepItem n={1} done={paymentDone} text={uz.order.steps.s1} />
                <StepItem n={2} done={!!receipt} text={uz.order.steps.s2} />
                <StepItem n={3} done={false} text={uz.order.steps.s3} />
              </ol>
            </div>

            {/* 1-qadam: To'lov */}
            {hasPayment && (
              <section className="mb-5">
                <div className="meta mb-2 flex items-center gap-2">
                  <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px]", paymentDone ? "bg-[var(--success)] text-[var(--on-accent)]" : "bg-[var(--accent)] text-[var(--on-accent)]")}>
                    {paymentDone ? <Check size={10} strokeWidth={2.5} /> : "1"}
                  </span>
                  {uz.order.paymentStep}
                </div>
                <PaymentMethods
                  payment={payment}
                  compact
                  onCardCopy={() => markPaid("card")}
                  onOnlinePay={(k) => markPaid(k)}
                />
              </section>
            )}

            {/* Qulflangan qism: chek + inputlar */}
            <div
              onClick={() => !paymentDone && requireStep1()}
              className={cn(
                "relative rounded-[var(--r-card)] transition-all",
                !paymentDone && "cursor-not-allowed",
                lockedShake && "shake",
              )}
            >
              {!paymentDone && (
                <div className="absolute inset-0 z-10 bg-[var(--bg)]/60 backdrop-blur-[2px] rounded-[var(--r-card)] flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center gap-2 text-center max-w-xs px-4">
                    <Lock size={22} strokeWidth={1.5} className="text-[var(--accent)]" />
                    <div className="text-sm font-medium">{uz.order.lockedTitle}</div>
                  </div>
                </div>
              )}

              <div className={cn("flex flex-col gap-4 pointer-events-auto", !paymentDone && "opacity-40 pointer-events-none")}>
                {/* 2-qadam: Chek */}
                <section>
                  <div className="meta mb-2 flex items-center gap-2">
                    <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px]", receipt ? "bg-[var(--success)] text-[var(--on-accent)]" : "bg-[var(--accent)] text-[var(--on-accent)]")}>
                      {receipt ? <Check size={10} strokeWidth={2.5} /> : "2"}
                    </span>
                    {uz.order.receiptStep}
                  </div>
                  <Dropzone value={receipt} previewUrl={receiptPreview} onSelect={handleReceiptSelect} />
                </section>

                {/* 3-qadam: Ma'lumotlar */}
                <section>
                  <div className="meta mb-2 flex items-center gap-2">
                    <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px]", "bg-[var(--accent)] text-[var(--on-accent)]")}>
                      3
                    </span>
                    {uz.order.infoStep}
                  </div>
                  <div className="flex flex-col gap-3">
                    <Field label={uz.order.customerName} required>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={inputsDisabled}
                        onFocus={(e) => {
                          if (!paymentDone) {
                            e.target.blur();
                            requireStep1();
                          }
                        }}
                        className={cn(
                          "w-full h-11 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)]",
                          inputsDisabled && "opacity-60",
                        )}
                      />
                    </Field>
                    <Field label={uz.order.contact} required>
                      <PhoneInput
                        value={contact}
                        onValueChange={(raw) => setContact(raw)}
                        disabled={inputsDisabled}
                        className={cn(inputsDisabled && "opacity-60")}
                      />
                    </Field>
                    <Field label={uz.order.note}>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        disabled={inputsDisabled}
                        rows={2}
                        className={cn(
                          "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)] resize-none",
                          inputsDisabled && "opacity-60",
                        )}
                      />
                    </Field>
                  </div>
                </section>
              </div>
            </div>

            {/* Locked alert toast */}
            <AnimatePresence>
              {showLockedAlert && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-4 p-3 rounded-[var(--r-card)] bg-[var(--accent)]/10 border border-[var(--accent)]/40 flex items-start gap-3"
                >
                  <AlertTriangle size={18} strokeWidth={1.5} className="text-[var(--accent)] shrink-0 mt-0.5" />
                  <div className="text-sm leading-snug">
                    <div className="font-medium mb-1">{uz.order.lockedTitle}</div>
                    <div className="text-[var(--text-muted)]">{uz.order.lockedBody}</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {err && <div className="mt-3 text-sm text-[var(--danger)]">{err}</div>}

            <button
              onClick={submit}
              disabled={busy}
              className="mt-5 h-12 w-full rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium disabled:opacity-50 transition-colors"
            >
              {busy ? uz.states.scanningReceipt : uz.order.submit}
            </button>
          </motion.div>
        ) : result ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <SuccessCard
              result={result}
              contentTitle={content.title}
              onCopy={copy}
              copied={copied}
              onClose={onClose}
            />
          </motion.div>
        ) : null}
        </AnimatePresence>

        {/* Chek tasdiq modali */}
        <AnimatePresence>
          {receiptWarn && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[var(--bg)]/85 backdrop-blur-sm rounded-[var(--r-modal)]"
            >
              <div className="w-full max-w-sm bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--r-card)] p-5 flex flex-col gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receiptWarn.url} alt="" className="w-full max-h-40 object-contain rounded-[var(--r-media)] bg-[var(--bg)]" />
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} strokeWidth={1.5} className="text-[var(--accent)] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-sm mb-1">{uz.order.receiptCheckTitle}</div>
                    <div className="text-xs text-[var(--text-muted)] leading-snug">{uz.order.receiptCheckBody}</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={rejectWarnedReceipt}
                    className="flex-1 h-10 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm"
                  >
                    {uz.order.receiptRetry}
                  </button>
                  <button
                    onClick={acceptWarnedReceipt}
                    className="flex-1 h-10 rounded-[var(--r-control)] bg-[var(--accent)] text-[var(--on-accent)] text-sm font-medium"
                  >
                    {uz.order.receiptConfirm}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function StepItem({ n, done, text }: { n: number; done: boolean; text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={cn(
          "shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] mt-[1px]",
          done ? "bg-[var(--success)] text-[var(--on-accent)]" : "bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text-muted)]",
        )}
      >
        {done ? <Check size={10} strokeWidth={2.5} /> : n}
      </span>
      <span className={cn(done ? "text-[var(--text-muted)] line-through" : "text-[var(--text)]")}>{text}</span>
    </li>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="meta">
        {label}
        {required && "*"}
      </span>
      {children}
    </label>
  );
}

function Dropzone({
  value,
  previewUrl,
  onSelect,
}: {
  value: File | null;
  previewUrl: string | null;
  onSelect: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={() => ref.current?.click()}
      className="border-2 border-dashed border-[var(--border-strong)] hover:border-[var(--accent)] rounded-[var(--r-card)] p-4 text-center cursor-pointer transition-colors"
    >
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />
      {value && previewUrl ? (
        <div className="flex items-center gap-3 text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" className="w-16 h-16 object-cover rounded-[var(--r-media)]" />
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">{value.name}</div>
            <div className="meta text-[10px]">{Math.round(value.size / 1024)} KB · almashtirish uchun bosing</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
          <UploadCloud size={24} strokeWidth={1.5} />
          <div className="text-sm">{uz.order.receiptUpload}</div>
        </div>
      )}
    </div>
  );
}

function SuccessCard({
  result,
  contentTitle,
  onCopy,
  copied,
  onClose,
}: {
  result: { code: string; token: string };
  contentTitle: string;
  onCopy: (t: string, key: string) => void;
  copied: string | null;
  onClose: () => void;
}) {
  const ease = [0.22, 1, 0.36, 1] as const;
  const [codeCopied, setCodeCopied] = useState(false);
  const [notifState, setNotifState] = useState<
    "idle" | "prompting" | "granted" | "denied" | "unsupported"
  >("idle");

  // Nusxa olish — foydalanuvchi tomonidan ochiq harakat qilingandan keyingina
  // qolgan harakatlar ochiladi. `onCopy` prop yordamchi funktsiya (parent state uchun).
  async function handleCopy() {
    onCopy(result.code, "code");
    // Modal state ba'zan sync yangilanmaydi — biz o'z belgimizni ham qo'yamiz
    setCodeCopied(true);
    // Bildirishnoma holatini ham darrov tekshiramiz.
    // Xavfsiz kontekst (HTTPS/localhost) bo'lmasa Notification API foydalanib bo'lmaydi.
    if (!("Notification" in window) || !window.isSecureContext) {
      setNotifState("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      setNotifState("granted");
      subscribeToOrderNotifications();
    } else if (Notification.permission === "denied") {
      setNotifState("denied");
    } else {
      setNotifState("prompting");
    }
  }

  function subscribeToOrderNotifications() {
    addPendingOrder({
      token: result.token,
      code: result.code,
      title: contentTitle,
    });
  }

  async function enableNotifications() {
    if (!("Notification" in window) || !window.isSecureContext) {
      setNotifState("unsupported");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setNotifState("granted");
        subscribeToOrderNotifications();
        try {
          new Notification("shot by sardor", {
            body: `Rahmat! Buyurtma #${result.code} tasdiqlanganda xabar beramiz.`,
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
  }

  // "Nusxa olindi" ko'rsatkichi — parent'dagi `copied === "code"` yoki lokal `codeCopied`
  const isCopied = copied === "code" || codeCopied;

  return (
    <div className="flex flex-col gap-4 pt-2 pb-1">
      {/* Yashil belgi + sarlavha */}
      <div className="flex flex-col items-center gap-3">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease }}
          className="w-14 h-14 rounded-full bg-[var(--success)]/15 border-2 border-[var(--success)]/50 flex items-center justify-center"
        >
          <motion.span
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.4, delay: 0.2, ease }}
            className="text-[var(--success)]"
          >
            <Check size={26} strokeWidth={2.5} />
          </motion.span>
        </motion.div>
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="font-display text-xl leading-tight">{uz.order.acceptedTitle}</div>
          <p className="text-sm text-[var(--text-muted)] max-w-[38ch] leading-snug">
            {uz.order.acceptedBody}
          </p>
        </div>
      </div>

      {/* Muhim ogohlantirish — kod nusxalanmagunicha */}
      <AnimatePresence>
        {!isCopied && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden"
          >
            <div className="rounded-[var(--r-control)] bg-[var(--accent)]/8 border border-[var(--accent)]/40 p-3 flex items-start gap-2.5">
              <AlertTriangle
                size={16}
                strokeWidth={1.75}
                className="text-[var(--accent)] shrink-0 mt-0.5"
              />
              <div className="text-[12px] leading-snug text-[var(--text)]">
                <span className="font-medium">Muhim:</span> Iltimos, avval buyurtma kodini nusxa
                oling. Kelajakda buyurtmangizni <span className="text-[var(--accent)]">Aloqa</span>{" "}
                sahifasidan tekshirish uchun kerak bo&apos;ladi.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kod kartasi — kompakt, nusxa olish yonida */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease }}
        className={cn(
          "rounded-[var(--r-card)] p-3 flex items-center gap-3 transition-colors",
          !isCopied
            ? "bg-[var(--bg)] border-2 border-[var(--accent)]/60 animate-[pulseAccent_2.5s_ease-in-out_infinite]"
            : "bg-[var(--bg)] border border-[var(--border-strong)]",
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="meta text-[10px] leading-none mb-1">{uz.order.orderCode}</div>
          <div className="font-mono text-2xl font-display leading-none tracking-wider">
            #{result.code}
          </div>
        </div>
        <button
          onClick={handleCopy}
          className={cn(
            "h-10 px-3 rounded-[var(--r-control)] border text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 font-medium",
            isCopied
              ? "border-[var(--success)] text-[var(--success)] bg-[var(--success)]/8"
              : "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/15",
          )}
        >
          {isCopied ? (
            <>
              <Check size={13} strokeWidth={2.5} />
              Olindi
            </>
          ) : (
            <>
              <Copy size={13} strokeWidth={2} />
              Nusxa olish
            </>
          )}
        </button>
      </motion.div>

      {/* Nusxa olingandan keyin ochiladi: qolgan qismlar */}
      <AnimatePresence>
        {isCopied && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease }}
            className="flex flex-col gap-4 overflow-hidden"
          >
            {/* Bildirishnoma bloki */}
            <NotificationSection
              state={notifState}
              onEnable={enableNotifications}
              onSkip={() => setNotifState("denied")}
            />

            {/* Keyingi qadamlar */}
            <div className="flex flex-col gap-2">
              <div className="meta inline-flex items-center gap-1.5">
                <Clock size={11} strokeWidth={1.75} className="opacity-60" />
                Keyingi qadam
              </div>
              <ul className="flex flex-col gap-1.5 text-[13px] leading-snug text-[var(--text-muted)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--accent)] shrink-0">·</span>
                  <span>
                    Kod saqlangan — <span className="text-[var(--text)]">Aloqa</span> sahifasidan
                    tekshira olasiz.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--accent)] shrink-0">·</span>
                  <span>
                    To&apos;lov tasdiqlangach shu yerda{" "}
                    <span className="text-[var(--text)]">yuklab olish tugmasi</span> paydo bo&apos;ladi.
                  </span>
                </li>
              </ul>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-2">
              <a
                href={`/order/${result.token}`}
                onClick={onClose}
                className="group h-12 w-full rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium inline-flex items-center justify-center gap-2"
              >
                Buyurtma sahifasiga o&apos;tish
                <ArrowRight
                  size={16}
                  strokeWidth={2}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </a>
              <button
                onClick={onClose}
                className="h-10 w-full text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                Yopish
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kod olinmasa — tugmalar disabled ko'rinishida hint */}
      {!isCopied && (
        <div className="flex flex-col gap-2 mt-1">
          <div className="h-12 w-full rounded-[var(--r-control)] bg-[var(--surface)] border border-dashed border-[var(--border-strong)] text-[var(--text-faint)] font-medium inline-flex items-center justify-center gap-2 text-sm cursor-not-allowed select-none">
            <Lock size={14} strokeWidth={1.75} />
            Avval kodni nusxa oling
          </div>
        </div>
      )}
    </div>
  );
}

// Bildirishnoma so'rov bloki — SuccessCard ichida ishlatiladi.
// Uch holat: idle/prompting (so'rash), granted (rahmat), denied (nima uchun kerakligini tushuntirish).
function NotificationSection({
  state,
  onEnable,
  onSkip,
}: {
  state: "idle" | "prompting" | "granted" | "denied" | "unsupported";
  onEnable: () => void;
  onSkip: () => void;
}) {
  const ease = [0.22, 1, 0.36, 1] as const;

  if (state === "granted") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease }}
        className="rounded-[var(--r-control)] bg-[var(--success)]/8 border border-[var(--success)]/30 p-3 flex items-start gap-2.5"
      >
        <BellRing size={16} strokeWidth={1.75} className="text-[var(--success)] shrink-0 mt-0.5" />
        <div className="text-[12px] leading-snug flex-1">
          <div className="font-medium text-[var(--text)] mb-0.5">
            Bildirishnoma yoqilgan
          </div>
          <div className="text-[var(--text-muted)]">
            Admin buyurtmangizni tasdiqlagan zahoti sizga xabar keladi. Bosing va yuklab olish
            sahifasi ochiladi.
          </div>
        </div>
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
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease }}
        className="rounded-[var(--r-control)] bg-[var(--surface)] border border-[var(--border)] p-3 flex items-start gap-2.5"
      >
        <BellOff size={16} strokeWidth={1.75} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
        <div className="text-[12px] leading-snug flex-1">
          <div className="font-medium text-[var(--text)] mb-0.5">
            {isInsecure
              ? "Bildirishnoma HTTPS'da ishlaydi"
              : state === "unsupported"
              ? "Bu qurilma bildirishnomani qo'llab-quvvatlamaydi"
              : "Bildirishnoma o'chirilgan"}
          </div>
          <div className="text-[var(--text-muted)]">
            {isInsecure
              ? "Xavfsiz ulanish (HTTPS) yoki localhost'da ishlaydi. Hozircha buyurtma sahifasini o'zingiz kuzatib turing — 30 soniyada bir marta avtomatik yangilanadi."
              : state === "unsupported"
              ? "Buyurtma sahifasini o'zingiz vaqti-vaqti bilan tekshirib turing."
              : "Brauzer sozlamalaridan qayta yoqishingiz mumkin. Aks holda buyurtma sahifasini o'zingiz kuzatishingiz kerak."}
          </div>
        </div>
      </motion.div>
    );
  }

  // idle / prompting — asosiy so'rov
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease }}
      className="rounded-[var(--r-control)] bg-[var(--accent)]/8 border border-[var(--accent)]/30 p-3 flex flex-col gap-2.5"
    >
      <div className="flex items-start gap-2.5">
        <BellRing
          size={16}
          strokeWidth={1.75}
          className="text-[var(--accent)] shrink-0 mt-0.5"
        />
        <div className="text-[12px] leading-snug flex-1">
          <div className="font-medium text-[var(--text)] mb-0.5">
            Bildirishnoma yoqilsinmi?
          </div>
          <div className="text-[var(--text-muted)]">
            Admin buyurtmangizni tasdiqlagan zahoti sizga bildirishnoma yuboramiz. Uni bosganda
            yuklab olish sahifasi ochiladi — kutib o&apos;tirmaysiz.
          </div>
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <button
          onClick={onSkip}
          className="flex-1 h-9 rounded-[var(--r-control)] border border-[var(--border-strong)] text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Kerakmas
        </button>
        <button
          onClick={onEnable}
          className="flex-1 h-9 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium text-xs inline-flex items-center justify-center gap-1.5"
        >
          <Bell size={12} strokeWidth={2} />
          Yoqish
        </button>
      </div>
    </motion.div>
  );
}
