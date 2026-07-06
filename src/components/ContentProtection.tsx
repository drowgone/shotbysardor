"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { uz } from "@/lib/i18n/uz";

// Kontentni himoyalash — foydalanuvchi tomonidan noqonuniy nusxa olish urinishlarini
// zarurat bo'yicha bloklaydi. Har bir imkoniyat admin tomonidan yoqib/o'chirilishi mumkin.
//
// MUHIM: brauzer tomonidagi himoya "mutlaq" emas — bularning barchasi DETERRENT.
// Xavfsizlikning haqiqiy qavati serverda (private storage, signed URL, watermark, va h.k.).
// Bu komponent shunchaki oddiy foydalanuvchini to'xtatadi.

export type ProtectionFlags = {
  rightClick: boolean;
  dragDrop: boolean;
  textSelect: boolean;
  copy: boolean;
  save: boolean;
  devTools: boolean;
  printScreen: boolean;
};

export type ContentProtectionProps = {
  flags: ProtectionFlags;
  screenshotGuard: boolean;
};

export function ContentProtection({ flags, screenshotGuard }: ContentProtectionProps) {
  const [warn, setWarn] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let hideT: ReturnType<typeof setTimeout> | null = null;
    let warnT: ReturnType<typeof setTimeout> | null = null;

    function trigger(reason: string, hideMs = 1500) {
      if (screenshotGuard) setHidden(true);
      setWarn(reason);
      if (hideT) clearTimeout(hideT);
      if (warnT) clearTimeout(warnT);
      hideT = setTimeout(() => setHidden(false), hideMs);
      warnT = setTimeout(() => setWarn(null), 3500);
    }

    function onContextMenu(e: MouseEvent) {
      if (!flags.rightClick) return;
      // Admin panelida bloklash kerak emas — data-allow-context bilan belgilangan zonalar
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-allow-context], input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      trigger("Ushbu sahifada o'ng tugma taqiqlangan");
    }

    function onDragStart(e: DragEvent) {
      if (!flags.dragDrop) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-allow-drag]")) return;
      e.preventDefault();
      trigger("Rasmlarni sudrab olib bo'lmaydi");
    }

    function onSelectStart(e: Event) {
      if (!flags.textSelect) return;
      const t = e.target as HTMLElement | null;
      // Input, textarea, contenteditable — ruxsat
      if (t?.closest("input, textarea, [contenteditable=true], [data-allow-select]")) return;
      e.preventDefault();
    }

    function onCopy(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      // Har doim media ustidan copy — bloklash
      if (t?.closest("img, video, [data-protected]")) {
        e.preventDefault();
        trigger("Rasmlar nusxa qilinishi mumkin emas", 400);
        return;
      }
      if (!flags.copy) return;
      if (t?.closest("input, textarea, [contenteditable=true], [data-allow-copy]")) return;
      e.preventDefault();
      trigger("Nusxa olish taqiqlangan", 400);
    }

    function onKey(e: KeyboardEvent) {
      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+S
      if (flags.save && isCtrl && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        trigger("Saqlash taqiqlangan");
        return;
      }
      // Ctrl+C — form maydonlaridan tashqarida
      if (flags.copy && isCtrl && (e.key === "c" || e.key === "C")) {
        const t = e.target as HTMLElement | null;
        if (!t?.closest("input, textarea, [contenteditable=true], [data-allow-copy]")) {
          e.preventDefault();
          trigger("Nusxa olish taqiqlangan", 400);
          return;
        }
      }
      // Ctrl+A (barchasini tanlash) — matn tanlash yopiq bo'lsa
      if (flags.textSelect && isCtrl && (e.key === "a" || e.key === "A")) {
        const t = e.target as HTMLElement | null;
        if (!t?.closest("input, textarea, [contenteditable=true], [data-allow-select]")) {
          e.preventDefault();
          return;
        }
      }
      // Ctrl+P (print) — screenshot guard tarkibida
      if (flags.printScreen && isCtrl && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        trigger("Chop etish taqiqlangan");
        return;
      }
      // Ctrl+U (view-source)
      if (flags.devTools && isCtrl && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        trigger("Manbani ko'rish taqiqlangan");
        return;
      }
      // DevTools: F12
      if (flags.devTools && e.key === "F12") {
        e.preventDefault();
        trigger("DevTools taqiqlangan");
        return;
      }
      // DevTools: Ctrl+Shift+I / J / C
      if (flags.devTools && isCtrl && e.shiftKey && ["i", "I", "j", "J", "c", "C"].includes(e.key)) {
        e.preventDefault();
        trigger("DevTools taqiqlangan");
        return;
      }
      // PrintScreen
      if (flags.printScreen && e.key === "PrintScreen") {
        trigger("Screenshot aniqlanadi");
        return;
      }
      // macOS: Cmd+Shift+3/4/5
      if (flags.printScreen && e.metaKey && e.shiftKey && ["3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        trigger("Screenshot aniqlanadi");
        return;
      }
    }

    function onVisibility() {
      if (!screenshotGuard) return;
      if (document.visibilityState === "hidden") setHidden(true);
      else setHidden(false);
    }

    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("selectstart", onSelectStart, true);
    document.addEventListener("copy", onCopy, true);
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (hideT) clearTimeout(hideT);
      if (warnT) clearTimeout(warnT);
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("selectstart", onSelectStart, true);
      document.removeEventListener("copy", onCopy, true);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    flags.rightClick,
    flags.dragDrop,
    flags.textSelect,
    flags.copy,
    flags.save,
    flags.devTools,
    flags.printScreen,
    screenshotGuard,
  ]);

  return (
    <>
      {/* Matn tanlashni CSS orqali umuman o'chirish — foydalanuvchi input/textarea
          bo'lmagan joyda kursor ko'rmaydi. Input maydonlariga ruxsat. */}
      {flags.textSelect && (
        <style>{`
          html { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
          input, textarea, [contenteditable=true], [data-allow-select] {
            -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; user-select: text;
          }
        `}</style>
      )}

      {/* Drag & drop — CSS orqali qo'shimcha himoya (draggable=false yordamchi) */}
      {flags.dragDrop && (
        <style>{`
          html img, html video { -webkit-user-drag: none; user-drag: none; pointer-events: auto; }
        `}</style>
      )}

      {/* Screenshot guard: media yashirish qatlami */}
      {screenshotGuard && (
        <style>{`
          html[data-guard="hidden"] img,
          html[data-guard="hidden"] video {
            filter: blur(24px) brightness(0.3);
            transition: filter 200ms var(--ease);
          }
        `}</style>
      )}

      {screenshotGuard && <GuardStateSync hidden={hidden} />}

      {warn && (
        <div
          role="alert"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] max-w-[92vw] flex items-start gap-3 px-4 py-3 bg-[var(--surface)] border border-[var(--accent)]/60 rounded-[var(--r-card)]"
          style={{ boxShadow: "var(--shadow-modal)" }}
        >
          <AlertTriangle size={18} strokeWidth={1.5} className="text-[var(--accent)] shrink-0 mt-0.5" />
          <div className="text-sm leading-snug">
            <div className="font-medium">{warn}</div>
            <div className="text-[var(--text-muted)] mt-0.5">{uz.protection.orderOnly}</div>
          </div>
        </div>
      )}
    </>
  );
}

function GuardStateSync({ hidden }: { hidden: boolean }) {
  useEffect(() => {
    document.documentElement.setAttribute("data-guard", hidden ? "hidden" : "");
    return () => {
      document.documentElement.removeAttribute("data-guard");
    };
  }, [hidden]);
  return null;
}
