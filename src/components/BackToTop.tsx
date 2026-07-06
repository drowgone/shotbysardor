"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function BackToTop({ threshold = 400 }: { threshold?: number }) {
  const [show, setShow] = useState(false);
  // Tugma footer chegarasiga tegib to'xtashi uchun qancha yuqoriga surilishi kerakligi.
  // Odatda 0; viewport pastining footer bilan overlap'i bo'lganda o'sha piksel qadar.
  const [liftPx, setLiftPx] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setShow(window.scrollY > threshold);
      const footer = document.querySelector("footer");
      if (!footer) {
        setLiftPx(0);
        return;
      }
      const footerTop = footer.getBoundingClientRect().top;
      const overlap = window.innerHeight - footerTop;
      setLiftPx(overlap > 0 ? overlap : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [threshold]);

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          key="back-to-top"
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.9 }}
          transition={{ duration: 0.25, ease: [0.2, 0.6, 0.2, 1] }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Sahifa boshiga"
          title="Sahifa boshiga"
          className="fixed z-40 bottom-6 right-6 md:bottom-8 md:right-8 w-12 h-12 rounded-full bg-[var(--surface)]/90 border border-[var(--border-strong)] backdrop-blur-md text-[var(--text)] hover:text-[var(--accent)] hover:border-[var(--accent)] flex items-center justify-center transition-colors"
          // `marginBottom` ni oshiramiz — `bottom-{6,8}` ustiga qo'shiladi va tugma footer ustidan chiqmaydi.
          style={{ boxShadow: "var(--shadow-modal)", marginBottom: liftPx }}
        >
          <ArrowUp size={18} strokeWidth={1.5} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
