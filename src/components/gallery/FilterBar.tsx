"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  X,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  MapPin,
  Calendar,
  Tag,
  Search,
  Check,
} from "lucide-react";
import { uz } from "@/lib/i18n/uz";
import { cn } from "@/lib/utils";
import type { MetaData } from "./types";

// Hero ostida — gorizontal "header"dek to'liq kenglik bo'ylab cho'zilgan filtr paneli.
// Pin (sticky) EMAS: foydalanuvchi scroll qilib panel viewportdan chiqib ketsa,
// chiroyli "tomchi" animatsiyasi bilan chap chetdagi floating tugmaga aylanadi.
// Yuqoriga scroll qilinsa reverse animatsiya: tugma tomchidan qaytib panelga aylanadi.
// Mobileda pastki-chap floating "Filtrlar" pill orqali chapdan slide-in drawer chaqiriladi.
export function FilterBar({ meta, total }: { meta: MetaData; total: number }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Desktop chap-yon drawer — tomchi tugma bosilganda ochiladi
  const [desktopOpen, setDesktopOpen] = useState(false);
  // Panel ekrandan chiqib ketgan holat — IntersectionObserver aniqlaydi
  const [outOfView, setOutOfView] = useState(false);
  const [mounted, setMounted] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sentinel — bar pastida joylashgan tabiiy chegara. Faqat viewport tepasidan
  // yuqoriga chiqib ketganda outOfView=true bo'ladi (pastda bo'lganda intersecting hisoblanadi).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setOutOfView(!entry.isIntersecting),
      { root: null, threshold: 0, rootMargin: "0px 100000px 100000px 100000px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  // Chap-yon drawer ochiq bo'lganda body scroll qulflansin + Esc bilan yopilsin
  useEffect(() => {
    if (!mobileOpen && !desktopOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setDesktopOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen, desktopOpen]);

  const genre = sp.get("janr");
  const location = sp.get("joy");
  const year = sp.get("yil");

  const set = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const q = next.toString();
      router.push(q ? `/?${q}` : "/", { scroll: false });
    },
    [router, sp],
  );

  const activeCount = [genre, location, year].filter(Boolean).length;
  const isEmpty = activeCount === 0;

  const genreOptions = useMemo(
    () => meta.genres.map((g) => ({ value: g.slug, label: g.name })),
    [meta.genres],
  );
  const locationOptions = useMemo(
    () => meta.locations.map((l) => ({ value: l.slug, label: l.name })),
    [meta.locations],
  );
  const yearOptions = useMemo(
    () => meta.years.map((y) => ({ value: String(y), label: String(y) })),
    [meta.years],
  );

  // Ikki qatorli layout — janrlar qatori har doim to'liq wrap qilinadi (barcha
  // qiymatlar bir qarashda ko'rinsin), dropdown'lar va counter esa alohida pastki qator.
  const barBody = (
    <div className="flex flex-col gap-3">
      {/* 1-qator: barcha janrlar — flex-wrap bilan hech qanday chip yashirin qolmaydi */}
      <div className="flex items-start gap-3">
        <div className="meta shrink-0 inline-flex items-center gap-1.5 pt-2">
          <Tag size={12} strokeWidth={1.75} className="opacity-60" />
          {uz.filters.genre}
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <Chip active={isEmpty} onClick={() => set({ janr: null, joy: null, yil: null })}>
            {uz.filters.all}
          </Chip>
          {meta.genres.map((g) => (
            <Chip
              key={g.slug}
              active={genre === g.slug}
              onClick={() => set({ janr: genre === g.slug ? null : g.slug })}
            >
              {g.name}
            </Chip>
          ))}
        </div>
      </div>

      {/* 2-qator: dropdown'lar, tozalash va counter — chapdan o'ngga */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--border)]">
        <ChipDropdown
          icon={<MapPin size={14} strokeWidth={1.75} />}
          label={uz.filters.location}
          value={location}
          options={locationOptions}
          searchable
          onChange={(v) => set({ joy: v })}
        />
        <ChipDropdown
          icon={<Calendar size={14} strokeWidth={1.75} />}
          label={uz.filters.date}
          value={year}
          options={yearOptions}
          onChange={(v) => set({ yil: v })}
        />
        {activeCount > 0 && (
          <button
            onClick={() => set({ janr: null, joy: null, yil: null })}
            className="h-10 px-3 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
          >
            <X size={14} strokeWidth={1.75} />
            {uz.filters.clear}
          </button>
        )}
        <div className="meta text-[var(--text-muted)] whitespace-nowrap ml-auto">
          {uz.filters.count(total)}
        </div>
      </div>
    </div>
  );

  const panelTransform = outOfView
    ? "translateX(-100%) translateY(24px) scale(0.55)"
    : "translateX(0) translateY(0) scale(1)";
  const panelOpacity = outOfView ? 0 : 1;
  const panelBorderRadius = outOfView ? "50%" : "0px";
  const panelFilter = outOfView ? "blur(6px)" : "blur(0px)";

  const buttonTransform = outOfView
    ? "translateY(-50%) scale(1)"
    : "translateY(calc(-50% - 40px)) scale(0.3)";
  const buttonOpacity = outOfView ? 1 : 0;

  return (
    <>
      {/* Desktop: hero ostida gorizontal "header"dek filtr paneli — pin emas */}
      <div className="hidden md:block relative">
        <div
          aria-label={uz.filters.filtersLabel}
          aria-hidden={mounted ? outOfView : undefined}
          className="w-full border-b border-[var(--border)] bg-[var(--bg)]"
          style={{
            transform: mounted ? panelTransform : undefined,
            opacity: mounted ? panelOpacity : 1,
            borderRadius: mounted ? panelBorderRadius : undefined,
            filter: mounted ? panelFilter : undefined,
            transformOrigin: "left center",
            transition: mounted
              ? "transform 420ms cubic-bezier(0.55, 0.06, 0.68, 0.19), opacity 320ms ease-out, filter 340ms ease-out, border-radius 320ms ease-out"
              : undefined,
            pointerEvents: outOfView ? "none" : "auto",
            willChange: "transform, opacity, filter",
          }}
        >
          <div className="max-w-[1680px] mx-auto px-4 md:px-6 lg:px-8 py-4">
            {barBody}
          </div>
        </div>
        {/* Sentinel — transformdan tashqarida, tabiiy pastki chegarada.
           Bar viewport tepasidan chiqib ketganda IO ishga tushadi. */}
        <div
          ref={sentinelRef}
          aria-hidden
          className="absolute bottom-0 left-0 pointer-events-none"
          style={{ width: 1, height: 1 }}
        />
      </div>

      {/* Desktop: yig'ilgan holatda chap chetda tomchi shaklida "ochish" tugmasi */}
      {mounted && (
        <button
          onClick={() => setDesktopOpen(true)}
          aria-label="Filtrlarni ochish"
          aria-hidden={!outOfView}
          tabIndex={outOfView ? 0 : -1}
          title="Filtrlarni ochish"
          className="hidden md:flex fixed z-30 left-3 top-1/2 w-10 h-10 rounded-full bg-[var(--surface)]/95 border border-[var(--border-strong)] backdrop-blur-md items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
          style={{
            transform: buttonTransform,
            opacity: buttonOpacity,
            pointerEvents: outOfView ? "auto" : "none",
            boxShadow: "var(--shadow-modal)",
            transformOrigin: "center",
            transition:
              "transform 480ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease-out",
            transitionDelay: outOfView ? "140ms, 100ms" : "0ms, 0ms",
            willChange: "transform, opacity",
          }}
        >
          <ChevronRight size={18} strokeWidth={1.5} />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[10px] flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      )}

      {/* Desktop: chap-yon vertikal drawer — tomchi tugma bosilganda chapdan chiqadi */}
      {desktopOpen && (
        <div
          className="hidden md:block fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label={uz.filters.filtersLabel}
          onClick={() => setDesktopOpen(false)}
        >
          <div className="absolute inset-0 bg-[var(--scrim)]" />
          <aside
            className="relative w-[340px] h-full bg-[var(--bg-elevated)] overflow-y-auto border-r border-[var(--border)] animate-[slideInLeft_320ms_cubic-bezier(.2,.6,.2,1)_both]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-5">
              <div className="flex items-center justify-between mb-4">
                <div className="font-display text-lg inline-flex items-center gap-2">
                  <SlidersHorizontal size={16} strokeWidth={1.5} />
                  {uz.filters.filtersLabel}
                  {activeCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs flex items-center justify-center font-body">
                      {activeCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setDesktopOpen(false)}
                  aria-label={uz.common.close}
                  className="w-9 h-9 rounded-[var(--r-control)] hover:bg-[var(--surface-hover)] flex items-center justify-center"
                >
                  <X size={18} strokeWidth={1.5} />
                </button>
              </div>
              <DrawerBody
                meta={meta}
                total={total}
                genre={genre}
                location={location}
                year={year}
                activeCount={activeCount}
                isEmpty={isEmpty}
                set={set}
              />
            </div>
          </aside>
        </div>
      )}

      {/* Mobile: pastki-chapda floating Filtrlar tugmasi */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label={uz.filters.filtersLabel}
        className="md:hidden fixed z-30 left-3 h-11 px-4 rounded-[var(--r-pill)] bg-[var(--surface)]/95 border border-[var(--border-strong)] backdrop-blur-md text-sm inline-flex items-center gap-2 text-[var(--text)] hover:text-[var(--accent)] hover:border-[var(--accent)]"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "var(--shadow-modal)" }}
      >
        <SlidersHorizontal size={16} strokeWidth={1.5} />
        {uz.filters.filtersLabel}
        {activeCount > 0 && (
          <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {/* Mobile: chapdan slide-in drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[60] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={uz.filters.filtersLabel}
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-[var(--scrim)]" />
          <aside
            className="relative w-[88vw] max-w-[340px] h-full bg-[var(--bg-elevated)] overflow-y-auto animate-[slideInLeft_300ms_cubic-bezier(.2,.6,.2,1)_both]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-5">
              <div className="flex items-center justify-between mb-4">
                <div className="font-display text-lg inline-flex items-center gap-2">
                  <SlidersHorizontal size={16} strokeWidth={1.5} />
                  {uz.filters.filtersLabel}
                  {activeCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs flex items-center justify-center font-body">
                      {activeCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label={uz.common.close}
                  className="w-9 h-9 rounded-[var(--r-control)] hover:bg-[var(--surface-hover)] flex items-center justify-center"
                >
                  <X size={18} strokeWidth={1.5} />
                </button>
              </div>
              <DrawerBody
                meta={meta}
                total={total}
                genre={genre}
                location={location}
                year={year}
                activeCount={activeCount}
                isEmpty={isEmpty}
                set={set}
              />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

// Drawer (desktop chap panel + mobile slide-in) uchun to'liq korpus.
// Ichida hamma qiymatlar chip ko'rinishida — hech qanday yashirin select yo'q.
function DrawerBody({
  meta,
  total,
  genre,
  location,
  year,
  activeCount,
  isEmpty,
  set,
}: {
  meta: MetaData;
  total: number;
  genre: string | null;
  location: string | null;
  year: string | null;
  activeCount: number;
  isEmpty: boolean;
  set: (updates: Record<string, string | null>) => void;
}) {
  const [locQuery, setLocQuery] = useState("");
  const filteredLocations = useMemo(() => {
    const q = locQuery.trim().toLowerCase();
    if (!q) return meta.locations;
    return meta.locations.filter((l) => l.name.toLowerCase().includes(q));
  }, [meta.locations, locQuery]);

  return (
    <div className="flex flex-col">
      <FilterSection icon={<Tag size={13} strokeWidth={1.75} />} title={uz.filters.genre} count={genre ? 1 : 0}>
        <div className="flex flex-wrap gap-2">
          <Chip active={isEmpty} onClick={() => set({ janr: null, joy: null, yil: null })}>
            {uz.filters.all}
          </Chip>
          {meta.genres.map((g) => (
            <Chip
              key={g.slug}
              active={genre === g.slug}
              onClick={() => set({ janr: genre === g.slug ? null : g.slug })}
            >
              {g.name}
            </Chip>
          ))}
        </div>
      </FilterSection>

      <hr className="my-5 border-[var(--border)]" />

      <FilterSection icon={<MapPin size={13} strokeWidth={1.75} />} title={uz.filters.location} count={location ? 1 : 0}>
        {meta.locations.length > 8 && (
          <div className="relative mb-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={locQuery}
              onChange={(e) => setLocQuery(e.target.value)}
              placeholder="Joylashuv qidirish…"
              className="w-full h-9 pl-8 pr-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-control)] text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {filteredLocations.map((l) => (
            <Chip
              key={l.slug}
              active={location === l.slug}
              onClick={() => set({ joy: location === l.slug ? null : l.slug })}
            >
              {l.name}
            </Chip>
          ))}
          {filteredLocations.length === 0 && (
            <div className="text-sm text-[var(--text-muted)] py-2">Topilmadi</div>
          )}
        </div>
      </FilterSection>

      <hr className="my-5 border-[var(--border)]" />

      <FilterSection icon={<Calendar size={13} strokeWidth={1.75} />} title={uz.filters.date} count={year ? 1 : 0}>
        <div className="flex flex-wrap gap-2">
          {meta.years.map((y) => (
            <Chip
              key={y}
              active={year === String(y)}
              onClick={() => set({ yil: year === String(y) ? null : String(y) })}
            >
              {y}
            </Chip>
          ))}
        </div>
      </FilterSection>

      {activeCount > 0 && (
        <button
          onClick={() => set({ janr: null, joy: null, yil: null })}
          className="mt-6 h-10 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition-colors inline-flex items-center justify-center gap-1.5"
        >
          <X size={14} strokeWidth={1.75} />
          {uz.filters.clear}
        </button>
      )}
      <div className="mt-6 pt-4 border-t border-[var(--border)] meta text-[var(--text-muted)]">
        {uz.filters.count(total)}
      </div>
    </div>
  );
}

function FilterSection({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="meta inline-flex items-center gap-1.5">
          <span className="opacity-60">{icon}</span>
          {title}
        </div>
        {count > 0 && (
          <span className="text-[10px] uppercase tracking-wider text-[var(--accent)]">
            Faol
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 px-4 rounded-[var(--r-pill)] text-sm border whitespace-nowrap",
        "transition-[color,border-color,background-color,transform] duration-200 ease-out",
        "active:scale-[0.96]",
        active
          ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
          : "border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-faint)]",
      )}
    >
      {children}
    </button>
  );
}

// Zamonaviy chip-dropdown — native <select> o'rniga.
// Trigger tugmasi tanlangan qiymatni ko'rsatadi va faol nuqta chiqadi.
// Popover ochilganda barcha qiymatlar chip ko'rinishida chiqadi + optional qidiruv.
function ChipDropdown({
  icon,
  label,
  value,
  options,
  searchable,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  searchable?: boolean;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = options.find((o) => o.value === value);
  const hasSearch = searchable && options.length > 8;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const MAX_W = 380;
    const width = Math.min(MAX_W, Math.max(rect.width, 260));
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    const top = rect.bottom + 8;
    setPos({ top, left, width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScroll(e: Event) {
      const t = e.target as Node | null;
      if (t && menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const active = !!selected;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "h-10 pl-3 pr-2 rounded-[var(--r-control)] border text-sm transition-colors inline-flex items-center gap-2 whitespace-nowrap",
          active
            ? "border-[var(--accent)] text-[var(--text)] bg-[var(--accent)]/5"
            : "border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-faint)]",
        )}
      >
        <span className={cn("inline-flex items-center gap-1.5", active ? "text-[var(--accent)]" : "opacity-70")}>
          {icon}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {active ? (
            <>
              <span className="text-[var(--text)]">{selected!.label}</span>
              <span
                role="button"
                tabIndex={0}
                aria-label={uz.common.close}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onChange(null);
                  }
                }}
                className="ml-1 w-5 h-5 rounded-full inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--surface-hover)]"
              >
                <X size={12} strokeWidth={2} />
              </span>
            </>
          ) : (
            <>
              {label}
              <ChevronDown
                size={14}
                strokeWidth={1.75}
                className={cn("transition-transform", open && "rotate-180")}
              />
            </>
          )}
        </span>
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label={label}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            boxShadow: "var(--shadow-modal)",
          }}
          className="z-50 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-[var(--r-card)] p-3 flex flex-col gap-3 max-h-[60vh] animate-[fadeInDown_180ms_ease-out_both]"
        >
          <div className="flex items-center justify-between">
            <div className="meta inline-flex items-center gap-1.5">
              <span className="opacity-70">{icon}</span>
              {label}
            </div>
            {active && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--danger)] inline-flex items-center gap-1"
              >
                <X size={11} strokeWidth={2} />
                Tozalash
              </button>
            )}
          </div>

          {hasSearch && (
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`${label} qidirish…`}
                className="w-full h-9 pl-8 pr-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-control)] text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2 overflow-y-auto pr-1 -mr-1">
            {filtered.map((o) => {
              const isActive = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onChange(isActive ? null : o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "h-9 px-3 rounded-[var(--r-pill)] text-sm border transition-colors whitespace-nowrap inline-flex items-center gap-1.5",
                    isActive
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-faint)]",
                  )}
                >
                  {isActive && <Check size={12} strokeWidth={2.5} />}
                  {o.label}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-sm text-[var(--text-muted)] py-2">Topilmadi</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
