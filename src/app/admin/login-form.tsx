"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Lock, Eye, EyeOff, AlertCircle, LogIn, ShieldAlert } from "lucide-react";
import { uz } from "@/lib/i18n/uz";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const r = useRouter();
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<{ code: string; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  // Bot uchun tuzoq — CSS bilan yashiringan, foydalanuvchi tegmaydi.
  const [hp, setHp] = useState("");
  // Forma render qilingan vaqti — juda tez yuborilgan so'rov bot deb hisoblanadi.
  const renderTs = useRef<number>(Date.now());

  // Sozlamalar sahifasida login o'zgartirilgan bo'lsa, yangi loginni bu yerda
  // avtomatik prefill qilamiz — foydalanuvchi eski loginni yozib xato olmasligi uchun.
  useEffect(() => {
    try {
      const last = localStorage.getItem("admin.lastUsername");
      if (last) setUsername(last);
    } catch {
      // localStorage o'chirilgan / private mode — jim
    }
  }, []);

  function handlePwKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (typeof e.getModifierState === "function") {
      setCapsLock(e.getModifierState("CapsLock"));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !pw) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          username: username.trim(),
          password: pw,
          hp,
          ts: renderTs.current,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code: string = data?.error?.code ?? "invalid_credentials";
        const msg =
          code === "locked"
            ? data?.error?.message ?? "Vaqtinchalik bloklangan."
            : code === "rate_limit"
              ? data?.error?.message ?? "Juda ko'p urinish. Keyinroq qayting."
              : data?.error?.message ?? uz.admin.login.error;
        setErr({ code, msg });
        setShake(true);
        setPw("");
        setTimeout(() => setShake(false), 400);
      } else {
        // Muvaffaqiyatli kirish — prefill uchun saqlangan loginni tozalaymiz.
        try {
          localStorage.removeItem("admin.lastUsername");
        } catch {
          // jim
        }
        r.push("/admin/boshqaruv");
        r.refresh();
      }
    } catch {
      setErr({ code: "network", msg: "Tarmoq xatosi. Internet aloqasini tekshiring." });
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = username.trim().length > 0 && pw.length > 0 && !busy;
  const locked = err?.code === "locked" || err?.code === "rate_limit";

  return (
    <form
      onSubmit={onSubmit}
      className={cn("w-full flex flex-col gap-3", shake && "shake")}
      autoComplete="on"
    >
      {/* Login */}
      <div className="relative">
        <User
          size={16}
          strokeWidth={1.75}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
        />
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={busy || locked}
          placeholder={uz.admin.login.usernamePlaceholder}
          autoComplete="username"
          autoFocus
          spellCheck={false}
          maxLength={64}
          className="w-full h-12 pl-11 pr-4 rounded-[var(--r-control)] bg-[var(--surface)] border border-[var(--border-strong)] outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-60"
        />
      </div>

      {/* Parol */}
      <div className="relative">
        <Lock
          size={16}
          strokeWidth={1.75}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
        />
        <input
          type={showPw ? "text" : "password"}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={handlePwKey}
          onKeyUp={handlePwKey}
          onBlur={() => setCapsLock(false)}
          disabled={busy || locked}
          placeholder={uz.admin.login.passwordPlaceholder}
          autoComplete="current-password"
          maxLength={256}
          className="w-full h-12 pl-11 pr-11 rounded-[var(--r-control)] bg-[var(--surface)] border border-[var(--border-strong)] outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          aria-label={showPw ? "Yashirish" : "Ko'rsatish"}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
        >
          {showPw ? (
            <EyeOff size={15} strokeWidth={1.75} />
          ) : (
            <Eye size={15} strokeWidth={1.75} />
          )}
        </button>
      </div>

      {/* Honeypot — foydalanuvchi ko'rmaydi, botlar to'ldiradi */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-10000px",
          top: "auto",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        <label>
          Website (bo&apos;sh qoldiring)
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
          />
        </label>
      </div>

      {/* Caps Lock ogohlantirishi */}
      <AnimatePresence>
        {capsLock && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] px-1">
              <AlertCircle size={13} strokeWidth={1.75} className="text-[var(--warning,#C99A3F)]" />
              <span>Caps Lock yoqilgan</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Xato */}
      <AnimatePresence>
        {err && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "flex items-start gap-2 text-sm p-3 rounded-[var(--r-control)] border",
                locked
                  ? "text-[var(--warning,#C99A3F)] bg-[var(--warning,#C99A3F)]/8 border-[var(--warning,#C99A3F)]/30"
                  : "text-[var(--danger)] bg-[var(--danger)]/8 border-[var(--danger)]/30",
              )}
            >
              {locked ? (
                <ShieldAlert size={14} strokeWidth={1.75} className="shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={14} strokeWidth={1.75} className="shrink-0 mt-0.5" />
              )}
              <span>{err.msg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Yuborish */}
      <motion.button
        type="submit"
        disabled={!canSubmit || locked}
        whileTap={canSubmit && !locked ? { scale: 0.98 } : undefined}
        className="w-full h-12 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-pressed)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--on-accent)] font-medium inline-flex items-center justify-center gap-2 mt-1"
      >
        {busy ? (
          uz.states.loading
        ) : (
          <>
            <LogIn size={16} strokeWidth={2} />
            {uz.admin.login.submit}
          </>
        )}
      </motion.button>
    </form>
  );
}
