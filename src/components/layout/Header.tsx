"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Instagram, Menu, X, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { uz } from "@/lib/i18n/uz";
import { Wordmark, Monogram } from "@/components/brand/Monogram";
import { cn } from "@/lib/utils";

export function Header({ instagramHandle = "shotbysardor" }: { instagramHandle?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 80);
      if (window.innerWidth < 768) {
        setHidden(y > lastY && y > 120);
      }
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Filter bar va boshqa sticky elementlar uchun global offset
  useEffect(() => {
    document.documentElement.style.setProperty("--header-h", hidden ? "0px" : "64px");
    return () => {
      document.documentElement.style.removeProperty("--header-h");
    };
  }, [hidden]);

  // Menu ochilganda body scroll qulflash + Esc bilan yopish
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
          scrolled ? "bg-[var(--bg-elevated)]/90 backdrop-blur-md border-b border-[var(--border)]" : "bg-transparent",
          hidden && "-translate-y-full",
        )}
      >
        <div className="mx-auto flex items-center justify-between px-3 md:px-4 lg:px-6 h-16">
          <Link href="/" className="flex items-center gap-2" aria-label="shot by sardor">
            <span className="hidden sm:inline-flex text-[15px]">
              <Wordmark />
            </span>
            <span className="sm:hidden">
              <Monogram size={28} />
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm">
            <Link href="/" className="hover:text-[var(--accent)] transition-colors">
              {uz.nav.gallery}
            </Link>
            <Link href="/haqida" className="hover:text-[var(--accent)] transition-colors">
              {uz.nav.about}
            </Link>
            <Link href="/aloqa" className="hover:text-[var(--accent)] transition-colors">
              {uz.nav.contact}
            </Link>
            <Link
              href="/donate"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--r-pill)] border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)]"
            >
              <Heart size={13} strokeWidth={1.75} />
              {uz.nav.donate}
            </Link>
            <a
              href={`https://instagram.com/${instagramHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="hover:text-[var(--accent)] transition-colors"
            >
              <Instagram size={20} strokeWidth={1.5} />
            </a>
          </nav>

          <button
            className="md:hidden inline-flex items-center justify-center w-11 h-11"
            onClick={() => setOpen(true)}
            aria-label="Menu"
          >
            <Menu size={22} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[60] bg-[var(--bg)] flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-3 h-16 relative z-10">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={uz.common.close}
                className="inline-flex items-center opacity-70 hover:opacity-100 transition-opacity"
              >
                <Wordmark />
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text)] transition-colors"
                onClick={() => setOpen(false)}
                aria-label={uz.common.close}
              >
                <X size={22} strokeWidth={1.5} />
              </button>
            </div>
            <motion.nav
              className="flex-1 flex flex-col items-center justify-center gap-6 -mt-16"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
                hidden: { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
              }}
            >
              {[
                { href: "/", label: uz.nav.gallery },
                { href: "/haqida", label: uz.nav.about },
                { href: "/aloqa", label: uz.nav.contact },
                { href: "/donate", label: uz.nav.donate, accent: true },
              ].map((item) => (
                <motion.div
                  key={item.href}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "text-3xl font-display transition-colors inline-flex items-center gap-2",
                      item.accent
                        ? "text-[var(--accent)]"
                        : "hover:text-[var(--accent)]",
                    )}
                  >
                    {item.accent && <Heart size={22} strokeWidth={1.75} />}
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <motion.a
                href={`https://instagram.com/${instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="mt-6 inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <Instagram size={20} strokeWidth={1.5} />
                @{instagramHandle}
              </motion.a>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
