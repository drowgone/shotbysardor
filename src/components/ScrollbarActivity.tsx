"use client";

import { useEffect } from "react";

// Scroll yoki mouse harakati bo'lganda html.scrollbar-active klassini yoqadi.
// 1500ms tinchlikdan keyin yashiradi. Scrollbarga hover bo'lsa ochilib turadi.
export function ScrollbarActivity({ idleMs = 1500 }: { idleMs?: number }) {
  useEffect(() => {
    const html = document.documentElement;
    let timer: number | null = null;

    const show = () => {
      html.classList.add("scrollbar-active");
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        html.classList.remove("scrollbar-active");
        timer = null;
      }, idleMs);
    };

    // Mouse o'ng cheti yaqinida bo'lsa doim ko'rinsin (foydalanuvchi scrollbarga borayapti)
    const onMove = (e: MouseEvent) => {
      const nearRight = window.innerWidth - e.clientX < 24;
      if (nearRight) {
        html.classList.add("scrollbar-active");
        if (timer) {
          window.clearTimeout(timer);
          timer = null;
        }
      } else {
        show();
      }
    };

    window.addEventListener("scroll", show, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("wheel", show, { passive: true });
    window.addEventListener("touchmove", show, { passive: true });
    window.addEventListener("keydown", show);

    return () => {
      window.removeEventListener("scroll", show);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("wheel", show);
      window.removeEventListener("touchmove", show);
      window.removeEventListener("keydown", show);
      if (timer) window.clearTimeout(timer);
      html.classList.remove("scrollbar-active");
    };
  }, [idleMs]);

  return null;
}
