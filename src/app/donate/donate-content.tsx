"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Heart,
  CreditCard,
  Sparkles,
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Coffee,
  Gift,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { formatUZS, cn, formatNumber } from "@/lib/utils";
import { PaymentMethods } from "@/components/payment/PaymentMethods";
import { normalizePayment, type LegacyPaymentDetails } from "@/lib/cards";
import { PageComments } from "@/components/comments/PageComments";

type Payment = LegacyPaymentDetails;

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export function DonateContent({
  enabled,
  title,
  description,
  thankYou,
  payment,
  suggestedAmounts,
}: {
  enabled: boolean;
  title: string;
  description: string;
  thankYou: string;
  payment: Payment;
  suggestedAmounts: number[];
}) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  if (!enabled) {
    return <DisabledState />;
  }

  const normalized = normalizePayment(payment);
  const hasAnyPayment =
    normalized.cards.length > 0 || !!normalized.paymeUrl || !!normalized.clickUrl;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease }}
      className="relative pt-24 md:pt-32 px-4 md:px-6 lg:px-8 max-w-6xl mx-auto pb-24 flex flex-col gap-10 md:gap-14"
    >
      {/* Fon shu'lasi — sahifa ochilganda accent aylanadigan yumshoq glow */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease }}
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] -z-10"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, color-mix(in oklab, var(--accent) 22%, transparent) 0%, transparent 70%)",
        }}
      />
      {/*
        Layout:
          1) YUQORIDA (markazda) — sarlavha bloki (yurak ikoni, tagline, tavsif). To'liq kenglik.
          2) O'RTADA (2 ustun grid) — chapda izohlar, o'ngda maqsad kartalari + summa + to'lov.
          3) PASTDA (markazda) — minnatdorchilik va galereyaga qaytish. To'liq kenglik.
      */}

      {/* 1) Sarlavha bloki — yuqorida, markazda */}
      <motion.header
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease, delay: 0.1 }}
        className="flex flex-col items-center text-center gap-4 mx-auto"
      >
        {/* Yurak ikoni — bir necha qatlam animatsiya:
            1) pastdan kirib scale bilan chiqadi
            2) ostidagi ring "pulse" — cheksiz sekin nafas oladi
            3) yurak ichida beat animatsiya (2s intervalda) */}
        <div className="relative">
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[var(--accent)]/30"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.9, 1.4, 0.9], opacity: [0.45, 0, 0.45] }}
            transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity, delay: 0.8 }}
          />
          <motion.div
            initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.05 }}
            className="relative w-16 h-16 rounded-full bg-[var(--accent)]/10 border-2 border-[var(--accent)]/40 flex items-center justify-center"
          >
            <motion.div
              animate={{ scale: [1, 1.12, 1, 1.06, 1] }}
              transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 1.2, delay: 1 }}
            >
              <Heart
                size={26}
                strokeWidth={1.75}
                className="text-[var(--accent)]"
                fill="currentColor"
                fillOpacity={0.15}
              />
            </motion.div>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.35 }}
          className="meta text-[var(--accent)]"
        >
          Qo&apos;llab-quvvatlash
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.42 }}
          className="display-1 max-w-[18ch]"
        >
          {title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.5 }}
          className="text-base md:text-lg text-[var(--text-muted)] leading-relaxed max-w-[52ch]"
        >
          {description}
        </motion.p>
      </motion.header>

      {/* 2) 2 ustun grid: chap — izohlar, o'ng — forma (maqsad + summa + to'lov) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease, delay: 0.55 }}
        className="grid gap-8 md:gap-10 md:grid-cols-2 md:items-stretch"
      >
        {/*
          Desktop'da chat'ning balandligi aynan o'ng ustunga (form ustunga) teng
          bo'lishi kerak. Muammo — PageComments ichidagi barcha xabarlar oddiy
          flow'da renderilanganda aside ustunning INTRINSIC balandligini
          o'stiradi va grid row shu balandlikka kengayadi (o'ng ustundan pastga
          tushib ketadi).

          Yechim: mobile'da oddiy flow (aside'ning tabiiy balandligi ishlaydi);
          desktopda `relative` aside + `absolute inset-0` PageComments. Absolute
          element flow'ga hissa qo'shmaydi, shuning uchun aside 0 intrinsic
          bo'ladi va `items-stretch` uni o'ng ustun balandligiga moslashtiradi.
          PageComments esa aside'ning ichini to'liq egallaydi va ichida scroll qiladi.
        */}
        <aside className="order-2 md:order-1 md:relative">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.7 }}
            className="md:absolute md:inset-0 md:flex md:flex-col"
          >
            <PageComments page="donate" />
          </motion.div>
        </aside>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
          }}
          className="order-1 md:order-2 flex flex-col gap-8"
        >
          {/* Sizning yordamingiz nima beradi */}
          <motion.section
            variants={fadeUp}
            transition={{ duration: 0.6, ease }}
            className="grid sm:grid-cols-3 gap-3"
          >
            <PurposeCard
              icon={<Coffee size={16} strokeWidth={1.5} />}
              label="Yo'lda"
              text="Kofe, yoqilg'i, kunlik xarajat"
              delay={0.05}
            />
            <PurposeCard
              icon={<Camera size={16} strokeWidth={1.5} />}
              label="Jihoz"
              text="Ob'ektiv, xotira karta, aksessuar"
              delay={0.12}
            />
            <PurposeCard
              icon={<MapPin size={16} strokeWidth={1.5} />}
              label="Safar"
              text="Yangi joylar, yangi kadrlar"
              delay={0.19}
            />
          </motion.section>

          {/* Miqdor tanlash */}
          {suggestedAmounts.length > 0 && (
            <motion.section
              variants={fadeUp}
              transition={{ duration: 0.6, ease }}
              className="flex flex-col gap-3"
            >
              <div className="meta inline-flex items-center gap-1.5">
                <Sparkles size={12} strokeWidth={1.75} className="opacity-60" />
                Taxminiy miqdor
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedAmounts.map((amount) => (
                  <motion.button
                    key={amount}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setSelectedAmount(amount === selectedAmount ? null : amount)}
                    className={cn(
                      "h-11 px-4 rounded-[var(--r-pill)] text-sm border font-mono",
                      "transition-[color,border-color,background-color] duration-200",
                      selectedAmount === amount
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                        : "border-[var(--border-strong)] bg-[var(--surface)] hover:border-[var(--accent)]",
                    )}
                  >
                    {formatNumber(amount)} <span className="opacity-60">so&apos;m</span>
                  </motion.button>
                ))}
              </div>
              <AnimatePresence>
                {selectedAmount && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    transition={{ duration: 0.3, ease }}
                    className="text-xs text-[var(--text-muted)] overflow-hidden"
                  >
                    Tanladingiz:{" "}
                    <span className="text-[var(--accent)] font-mono">
                      {formatUZS(selectedAmount)}
                    </span>{" "}
                    · Quyidagi usullardan biriga o&apos;tkazishingiz mumkin.
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          )}

          {/* To'lov usullari — o'ng ustunning oxirgi bloki */}
          <motion.section
            variants={fadeUp}
            transition={{ duration: 0.6, ease }}
            className="flex flex-col gap-3"
          >
            <div className="meta inline-flex items-center gap-1.5">
              <CreditCard size={12} strokeWidth={1.75} className="opacity-60" />
              To&apos;lov usuli
            </div>

            {!hasAnyPayment ? (
              <div className="p-5 rounded-[var(--r-card)] bg-[var(--surface)] border border-[var(--border)] flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
                  <MessageCircle size={16} strokeWidth={1.75} className="text-[var(--accent)]" />
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <div className="text-sm text-[var(--text)] leading-snug">
                    Hozircha to&apos;lov usullari sozlanmagan.
                  </div>
                  <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Sardor bilan bevosita bog&apos;laning — Telegram yoki Instagram orqali.
                  </div>
                  <Link
                    href="/aloqa"
                    className="mt-1 inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline w-fit"
                  >
                    Aloqa sahifasi
                    <ArrowUpRight size={13} strokeWidth={1.75} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <PaymentMethods payment={payment} />
                {normalized.cards.length > 0 && (
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Kartaga o&apos;tkazganingizdan so&apos;ng ixtiyoriy — Telegramda xabar
                    bering, minnatdorlik bildiraman.
                  </p>
                )}
              </div>
            )}
          </motion.section>
        </motion.div>
      </motion.div>

      {/* 3) Minnatdorchilik — pastda, markazda */}
      <motion.section
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease }}
        className="relative flex flex-col items-center text-center gap-3 p-6 rounded-[var(--r-card)] bg-[var(--accent)]/5 border border-[var(--accent)]/20 mx-auto max-w-2xl w-full overflow-hidden"
      >
        {/* Sparkle — accent yaltiroq shu'la yuqori chetdan chapdan o'ngga sekin sirg'aladi */}
        <motion.div
          aria-hidden
          initial={{ x: "-50%", opacity: 0 }}
          whileInView={{ x: "150%", opacity: [0, 0.5, 0] }}
          viewport={{ once: true }}
          transition={{ duration: 1.8, ease, delay: 0.3 }}
          className="pointer-events-none absolute top-0 left-0 w-1/3 h-full"
          style={{
            background:
              "linear-gradient(105deg, transparent 30%, color-mix(in oklab, var(--accent) 25%, transparent) 50%, transparent 70%)",
          }}
        />
        <motion.div
          initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
          whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease, delay: 0.15 }}
        >
          <Gift size={22} strokeWidth={1.5} className="text-[var(--accent)]" />
        </motion.div>
        <div className="font-display text-lg leading-tight max-w-[36ch]">{thankYou}</div>
        <Link
          href="/"
          className="mt-2 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Galereyaga qaytish
        </Link>
      </motion.section>
    </motion.div>
  );
}

function PurposeCard({
  icon,
  label,
  text,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease }}
      className="rounded-[var(--r-card)] p-4 bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-2 hover:border-[var(--border-strong)] transition-colors"
    >
      <div className="flex items-center gap-2 text-[var(--accent)]">
        {icon}
        <div className="meta text-[var(--text-muted)]">{label}</div>
      </div>
      <div className="text-sm text-[var(--text)] leading-snug">{text}</div>
    </motion.div>
  );
}

function DisabledState() {
  return (
    <div className="pt-24 md:pt-32 px-4 max-w-md mx-auto pb-24 min-h-[60vh] flex flex-col items-center justify-center text-center gap-4">
      <div className="w-14 h-14 rounded-full bg-[var(--surface)] border border-[var(--border-strong)] flex items-center justify-center">
        <Heart size={22} strokeWidth={1.5} className="text-[var(--text-faint)]" />
      </div>
      <div className="font-display text-xl">Hozircha yopiq</div>
      <p className="text-sm text-[var(--text-muted)]">
        Qo&apos;llab-quvvatlash sahifasi vaqtincha ochilmagan. Keyingi safar tashrif buyuring.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
      >
        <ArrowLeft size={14} strokeWidth={1.75} />
        Galereyaga qaytish
      </Link>
    </div>
  );
}

