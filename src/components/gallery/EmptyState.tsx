"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { uz } from "@/lib/i18n/uz";

export function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-[40vh] flex flex-col items-center justify-center gap-4 py-12"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="w-16 h-16 relative"
      >
        <span className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-[var(--text-faint)]" />
        <span className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-[var(--text-faint)]" />
        <span className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-[var(--text-faint)]" />
        <span className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-[var(--text-faint)]" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="text-[var(--text-muted)]"
      >
        {uz.states.empty}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link
          href="/"
          className="h-10 px-4 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm inline-flex items-center hover:border-[var(--accent)] transition-colors"
        >
          {uz.filters.clear}
        </Link>
      </motion.div>
    </motion.div>
  );
}
