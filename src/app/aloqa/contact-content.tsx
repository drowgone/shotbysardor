"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  Send,
  Instagram,
  MessageCircle,
  Search,
  Copy,
  Check,
  ArrowUpRight,
  Clock,
  Package,
  HelpCircle,
} from "lucide-react";
import { uz } from "@/lib/i18n/uz";
import { cn } from "@/lib/utils";
import { OrderLookup } from "./order-lookup";

type Socials = { instagram: string; telegram: string; phone: string; email: string };

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUpVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export function ContactContent({ socials }: { socials: Socials }) {
  return (
    <div className="pt-24 md:pt-32 px-4 md:px-6 lg:px-8 max-w-4xl mx-auto pb-24">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
        }}
        className="flex flex-col gap-10 md:gap-14"
      >
        {/* Sarlavha */}
        <motion.header
          variants={fadeUpVariants}
          transition={{ duration: 0.6, ease }}
          className="flex flex-col gap-3"
        >
          <div className="meta text-[var(--accent)]">Aloqa</div>
          <h1 className="display-1">Bog&apos;lanish</h1>
          <p className="text-lg text-[var(--text-muted)] leading-relaxed max-w-[52ch]">
            Buyurtma, hamkorlik yoki oddiy savol — quyidagi kanallardan istagan birini tanlang.
            Odatda 24 soat ichida javob beramiz.
          </p>
        </motion.header>

        {/* Aloqa kartochkalari */}
        <motion.section
          variants={fadeUpVariants}
          transition={{ duration: 0.6, ease }}
          className="flex flex-col gap-4"
        >
          <div className="meta inline-flex items-center gap-1.5">
            <MessageCircle size={12} strokeWidth={1.75} className="opacity-60" />
            To&apos;g&apos;ridan-to&apos;g&apos;ri aloqa
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {socials.telegram && (
              <ContactCard
                href={`https://t.me/${socials.telegram}`}
                icon={<Send size={20} strokeWidth={1.5} />}
                label="Telegram"
                value={`@${socials.telegram}`}
                description="Eng tez javob shu yerda"
                accent
                external
                delay={0.05}
              />
            )}
            {socials.instagram && (
              <ContactCard
                href={`https://instagram.com/${socials.instagram}`}
                icon={<Instagram size={20} strokeWidth={1.5} />}
                label="Instagram"
                value={`@${socials.instagram}`}
                description="DM va yangi ishlar"
                external
                delay={0.1}
              />
            )}
            {socials.phone && (
              <ContactCard
                href={`tel:${socials.phone}`}
                icon={<Phone size={20} strokeWidth={1.5} />}
                label="Telefon"
                value={socials.phone}
                description="Ish soatlari: 09:00 – 21:00"
                copyable
                copyValue={socials.phone}
                delay={0.15}
              />
            )}
            {socials.email && (
              <ContactCard
                href={`mailto:${socials.email}`}
                icon={<Mail size={20} strokeWidth={1.5} />}
                label="Email"
                value={socials.email}
                description="Rasmiy so'rovlar uchun"
                copyable
                copyValue={socials.email}
                delay={0.2}
              />
            )}
          </div>
        </motion.section>

        {/* Buyurtma tekshirish */}
        <motion.section
          variants={fadeUpVariants}
          transition={{ duration: 0.6, ease }}
          className="flex flex-col gap-4"
        >
          <div className="meta inline-flex items-center gap-1.5">
            <Package size={12} strokeWidth={1.75} className="opacity-60" />
            Buyurtma
          </div>
          <div className="rounded-[var(--r-card)] bg-[var(--surface)] border border-[var(--border)] p-5 md:p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
                <Search size={16} strokeWidth={1.75} className="text-[var(--accent)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg leading-tight">
                  {uz.order.codeLookupTitle}
                </div>
                <div className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
                  Buyurtma bergandan so&apos;ng olgan <span className="font-mono text-[var(--text)]">#SB-XXXX</span> kodini
                  kiriting — holatini va yuklab olish havolasini ko&apos;rasiz.
                </div>
              </div>
            </div>
            <OrderLookup />
          </div>
        </motion.section>

        {/* FAQ / Ma'lumot */}
        <motion.section
          variants={fadeUpVariants}
          transition={{ duration: 0.6, ease }}
          className="flex flex-col gap-4"
        >
          <div className="meta inline-flex items-center gap-1.5">
            <HelpCircle size={12} strokeWidth={1.75} className="opacity-60" />
            Ko&apos;p so&apos;raladigan
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <FaqCard
              icon={<Clock size={16} strokeWidth={1.5} />}
              q="Javob qancha vaqtda keladi?"
              a="Odatda 24 soat ichida. Telegram tezroq — bir necha soat ichida."
              delay={0.05}
            />
            <FaqCard
              icon={<Package size={16} strokeWidth={1.5} />}
              q="Buyurtma qanday beriladi?"
              a="Katalogdagi ishni tanlab, kartochkadagi «Buyurtma» tugmasini bosing. Chek yuklab, ma'lumotlaringizni kiriting."
              delay={0.1}
            />
            <FaqCard
              icon={<Send size={16} strokeWidth={1.5} />}
              q="To'lov qanday amalga oshadi?"
              a="Karta orqali, Payme yoki Click ilovasi orqali. Chekning skrinshotini yuklaganingizdan so'ng buyurtma qabul qilinadi."
              delay={0.15}
            />
            <FaqCard
              icon={<HelpCircle size={16} strokeWidth={1.5} />}
              q="Hamkorlik qilishni istayman"
              a="Telegram yoki Email orqali yozing — loyihangizni qisqacha tushuntirib bering. Har bir so'rov ko'rib chiqiladi."
              delay={0.2}
            />
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}

function ContactCard({
  href,
  icon,
  label,
  value,
  description,
  accent,
  external,
  copyable,
  copyValue,
  delay = 0,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
  accent?: boolean;
  external?: boolean;
  copyable?: boolean;
  copyValue?: string;
  delay?: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // fallback ignored
    }
  }

  return (
    <motion.a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease }}
      whileHover={{ y: -2 }}
      className={cn(
        "group relative rounded-[var(--r-card)] p-4 md:p-5 flex flex-col gap-3 border overflow-hidden",
        accent
          ? "bg-[var(--accent)]/8 border-[var(--accent)]/40 hover:border-[var(--accent)]"
          : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-strong)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
            accent
              ? "bg-[var(--accent)] text-[var(--on-accent)]"
              : "bg-[var(--bg)] text-[var(--accent)] border border-[var(--border-strong)]",
          )}
        >
          {icon}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {copyable && (
            <button
              type="button"
              onClick={copy}
              aria-label="Nusxa olish"
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border",
                copied
                  ? "border-[var(--success)] text-[var(--success)]"
                  : "border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-faint)]",
              )}
            >
              {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={1.75} />}
            </button>
          )}
          <ArrowUpRight
            size={16}
            strokeWidth={1.75}
            className="opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
          />
        </div>
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="meta">{label}</div>
        <div className="font-display text-lg leading-tight truncate">{value}</div>
        <div className="text-xs text-[var(--text-muted)] leading-relaxed">{description}</div>
      </div>
    </motion.a>
  );
}

function FaqCard({
  icon,
  q,
  a,
  delay = 0,
}: {
  icon: React.ReactNode;
  q: string;
  a: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease }}
      className="rounded-[var(--r-card)] p-4 md:p-5 bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-2 hover:border-[var(--border-strong)] transition-colors"
    >
      <div className="flex items-center gap-2 text-[var(--accent)]">
        {icon}
        <div className="font-medium text-[var(--text)] text-sm">{q}</div>
      </div>
      <div className="text-sm text-[var(--text-muted)] leading-relaxed pl-6">{a}</div>
    </motion.div>
  );
}
