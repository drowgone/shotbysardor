"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Instagram, Send, Phone, Mail, ArrowUpRight, Camera, MapPin, Layers } from "lucide-react";
import { Monogram } from "@/components/brand/Monogram";
import { formatNumber } from "@/lib/utils";

type Socials = { instagram: string; telegram: string; phone: string; email: string };

export function AboutContent({
  bio,
  tagline,
  socials,
  stats,
  portraitUrl,
}: {
  bio: string;
  tagline: string;
  socials: Socials;
  stats: { photos: number; locations: number; genres: number; sinceYear: number | null };
  portraitUrl: string | null;
}) {
  const ease = [0.22, 1, 0.36, 1] as const;

  const socialLinks: {
    href: string;
    label: string;
    icon: React.ReactNode;
    show: boolean;
  }[] = [
    {
      href: `https://instagram.com/${socials.instagram}`,
      label: `@${socials.instagram}`,
      icon: <Instagram size={16} strokeWidth={1.5} />,
      show: !!socials.instagram,
    },
    {
      href: `https://t.me/${socials.telegram}`,
      label: `@${socials.telegram}`,
      icon: <Send size={16} strokeWidth={1.5} />,
      show: !!socials.telegram,
    },
    {
      href: `tel:${socials.phone}`,
      label: socials.phone,
      icon: <Phone size={16} strokeWidth={1.5} />,
      show: !!socials.phone,
    },
    {
      href: `mailto:${socials.email}`,
      label: socials.email,
      icon: <Mail size={16} strokeWidth={1.5} />,
      show: !!socials.email,
    },
  ];

  return (
    <div className="pt-24 md:pt-32 px-4 md:px-6 lg:px-8 max-w-6xl mx-auto pb-24">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
        }}
        className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 md:gap-16"
      >
        {/* Chap: portret joyi */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 24 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.7, ease }}
          className="md:sticky md:top-24 md:self-start"
        >
          <PortraitFrame portraitUrl={portraitUrl} />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5, ease }}
            className="mt-4 meta text-[var(--text-muted)] flex items-center justify-between"
          >
            <span>Portret</span>
            {stats.sinceYear && <span>{stats.sinceYear} —</span>}
          </motion.div>
        </motion.div>

        {/* O'ng: kontent */}
        <div className="flex flex-col gap-8">
          {/* Sarlavha bloki */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.6, ease }}
            className="flex flex-col gap-3"
          >
            <div className="meta text-[var(--accent)]">Fotograf</div>
            <h1 className="display-1">Sardor</h1>
            {tagline && (
              <div className="text-lg md:text-xl text-[var(--text-muted)] leading-relaxed max-w-[42ch]">
                {tagline}
              </div>
            )}
          </motion.div>

          {/* Bio */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.6, ease }}
            className="text-[var(--text)] whitespace-pre-wrap leading-relaxed max-w-[62ch]"
          >
            {bio || (
              <span className="text-[var(--text-muted)] italic">
                Bio hozircha kiritilmagan. Sozlamalarda qo&apos;shishingiz mumkin.
              </span>
            )}
          </motion.div>

          {/* Statistika bloki */}
          {(stats.photos > 0 || stats.locations > 0 || stats.genres > 0) && (
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 16 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.6, ease }}
              className="grid grid-cols-3 gap-3 md:gap-4 pt-2"
            >
              <StatCard
                icon={<Camera size={14} strokeWidth={1.5} />}
                value={stats.photos}
                label="Ish"
              />
              <StatCard
                icon={<MapPin size={14} strokeWidth={1.5} />}
                value={stats.locations}
                label="Joylashuv"
              />
              <StatCard
                icon={<Layers size={14} strokeWidth={1.5} />}
                value={stats.genres}
                label="Janr"
              />
            </motion.div>
          )}

          {/* Ajratuvchi */}
          <motion.div
            variants={{
              hidden: { opacity: 0, scaleX: 0 },
              visible: { opacity: 1, scaleX: 1 },
            }}
            transition={{ duration: 0.7, ease }}
            style={{ transformOrigin: "left" }}
            className="h-px bg-[var(--border-strong)] my-2"
          />

          {/* Aloqa bloki */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.6, ease }}
            className="flex flex-col gap-4"
          >
            <div className="meta">Aloqa</div>
            <div className="flex flex-wrap gap-2">
              {socialLinks
                .filter((l) => l.show)
                .map((l, i) => (
                  <motion.a
                    key={l.href}
                    href={l.href}
                    target={l.href.startsWith("http") ? "_blank" : undefined}
                    rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.5 + i * 0.06, ease }}
                    whileHover={{ y: -2 }}
                    className="group inline-flex items-center gap-2 h-11 pl-4 pr-3 rounded-[var(--r-pill)] bg-[var(--surface)] border border-[var(--border-strong)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-sm"
                  >
                    <span className="text-[var(--accent)]">{l.icon}</span>
                    <span>{l.label}</span>
                    <ArrowUpRight
                      size={13}
                      strokeWidth={1.75}
                      className="ml-1 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                    />
                  </motion.a>
                ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.6, ease }}
            className="pt-4"
          >
            <Link
              href="/aloqa"
              className="group inline-flex items-center gap-3 h-12 pl-5 pr-4 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium"
            >
              Buyurtma va aloqa
              <ArrowUpRight
                size={16}
                strokeWidth={2}
                className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
              />
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="p-4 md:p-5 rounded-[var(--r-card)] bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-2 hover:border-[var(--border-strong)] transition-colors">
      <div className="meta inline-flex items-center gap-1.5 text-[var(--text-muted)]">
        <span className="text-[var(--accent)]">{icon}</span>
        {label}
      </div>
      <div className="font-display text-2xl md:text-3xl leading-none">{formatNumber(value)}</div>
    </div>
  );
}

// Portret ramkasi — agar admin portret rasm yuklagan bo'lsa uni ko'rsatadi
// (monogramma esa kichrayib chap yuqori burchakka o'tadi). Aks holda default:
// gradient fon + markazda katta brass monogramma.
function PortraitFrame({ portraitUrl }: { portraitUrl: string | null }) {
  const hasPortrait = !!portraitUrl;
  return (
    <div
      className="relative aspect-[3/4] rounded-[var(--r-card)] overflow-hidden border border-[var(--border)] bg-[var(--placeholder)]"
      style={
        hasPortrait
          ? undefined
          : {
              background:
                "radial-gradient(circle at 30% 20%, rgba(201,154,63,0.10), transparent 55%), radial-gradient(circle at 70% 80%, rgba(76,141,255,0.06), transparent 60%), var(--placeholder)",
            }
      }
    >
      {/* Portret rasm — mavjud bo'lganda to'liq ramkani egallaydi */}
      {hasPortrait && (
        <motion.img
          src={portraitUrl!}
          alt="Sardor"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}

      {/* Portret ustidan nozik pastki gradient — matnlar o'qilishi uchun */}
      {hasPortrait && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(8,8,9,0) 55%, rgba(8,8,9,0.55) 100%)",
          }}
        />
      )}

      {/* Grain — faqat default holatda (portretda kerak emas) */}
      {!hasPortrait && (
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>\")",
          }}
        />
      )}

      {/* Viewfinder brackets — har doim ko'rinadi */}
      <BracketCorner pos="tl" hasPortrait={hasPortrait} />
      <BracketCorner pos="tr" hasPortrait={hasPortrait} />
      <BracketCorner pos="bl" hasPortrait={hasPortrait} />
      <BracketCorner pos="br" hasPortrait={hasPortrait} />

      {/* Monogramma — portret bo'lsa kichrayib chap yuqoriga, aks holda markazda katta */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{
          opacity: 1,
          scale: 1,
        }}
        transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={
          hasPortrait
            ? "absolute top-4 left-4 z-10"
            : "absolute inset-0 flex items-center justify-center"
        }
      >
        <Monogram size={hasPortrait ? 32 : 120} brass />
      </motion.div>

      {/* Pastdagi meta — har doim ko'rinadi, portret ustida ham o'qilsin uchun oq */}
      <div
        className={
          "absolute bottom-3 left-4 right-4 flex items-center justify-between meta z-10 " +
          (hasPortrait ? "text-[var(--text)]/90" : "text-[var(--text-muted)]")
        }
      >
        <span>SHOT BY SARDOR</span>
        <span className="tabular-nums">01</span>
      </div>
    </div>
  );
}

function BracketCorner({
  pos,
  hasPortrait,
}: {
  pos: "tl" | "tr" | "bl" | "br";
  hasPortrait?: boolean;
}) {
  const base = "absolute w-8 h-8 md:w-10 md:h-10 z-10";
  const positions: Record<typeof pos, string> = {
    tl: "top-3 left-3 border-l-2 border-t-2",
    tr: "top-3 right-3 border-r-2 border-t-2",
    bl: "bottom-3 left-3 border-l-2 border-b-2",
    br: "bottom-3 right-3 border-r-2 border-b-2",
  };
  const delay: Record<typeof pos, number> = { tl: 0.1, tr: 0.15, br: 0.2, bl: 0.25 };
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: delay[pos], ease: [0.22, 1, 0.36, 1] }}
      className={`${base} ${positions[pos]} ${
        hasPortrait ? "border-[var(--text)]/70" : "border-[var(--text-faint)]"
      }`}
      style={hasPortrait ? { boxShadow: "0 0 12px rgba(0,0,0,0.35)" } : undefined}
    />
  );
}
