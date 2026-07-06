"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MasonryGrid } from "./MasonryGrid";
import { EmptyState } from "./EmptyState";
import type { ContentCard, MetaData } from "./types";
import { FilterBar } from "./FilterBar";
import { uz } from "@/lib/i18n/uz";
import { useLiveEvent } from "@/lib/live/use-live";

const BATCH = 40;

type CacheEntry = {
  items: ContentCard[];
  hasNext: boolean;
  total: number;
  scrollY: number;
};

function cacheKey(seed: string, filterKey: string) {
  return `gallery:${seed}:${filterKey}`;
}

function readCache(seed: string, filterKey: string): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(seed, filterKey));
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(seed: string, filterKey: string, entry: CacheEntry) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(cacheKey(seed, filterKey), JSON.stringify(entry));
  } catch {
    // quota — jim
  }
}

export function GalleryClient({
  initial,
  meta,
  seed,
}: {
  initial: { items: ContentCard[]; hasNext: boolean; total: number };
  meta: MetaData;
  seed: string;
}) {
  const sp = useSearchParams();
  const [items, setItems] = useState<ContentCard[]>(initial.items);
  const [hasNext, setHasNext] = useState<boolean>(initial.hasNext);
  const [total, setTotal] = useState<number>(initial.total);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const filterKey = `${sp.get("janr") ?? ""}|${sp.get("joy") ?? ""}|${sp.get("yil") ?? ""}`;
  const prevFilterKey = useRef(filterKey);

  const reloadFirstBatch = useCallback(() => {
    let abort = false;
    setLoading(true);
    const q = new URLSearchParams();
    q.set("s", seed);
    q.set("offset", "0");
    q.set("limit", String(BATCH));
    if (sp.get("janr")) q.set("genre", sp.get("janr")!);
    if (sp.get("joy")) q.set("location", sp.get("joy")!);
    if (sp.get("yil")) q.set("year", sp.get("yil")!);
    fetch(`/api/contents?${q.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (abort) return;
        setItems(data.items);
        setHasNext(!!data.hasNext);
        setTotal(data.total);
      })
      .finally(() => !abort && setLoading(false));
    return () => {
      abort = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, seed]);

  // Mount: sessionStorage-da avvalgi holat bor bo'lsa tiklaymiz.
  // (Foydalanuvchi "Yana yuklash" bosib, keyin kontent detailidan qaytganda
  //  yuklangan itemlar va scroll pozitsiyasi yo'qolib ketmasligi uchun.)
  useEffect(() => {
    const c = readCache(seed, filterKey);
    if (c && c.items.length > initial.items.length) {
      setItems(c.items);
      setHasNext(c.hasNext);
      setTotal(c.total);
      if (typeof c.scrollY === "number") {
        // DOM chizilgandan keyin scroll qilamiz.
        requestAnimationFrame(() => {
          window.scrollTo({ top: c.scrollY, behavior: "auto" });
        });
      }
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtr o'zgarganda birinchi 40 tani qayta yuklaymiz.
  // Mount-da chaqirilmaydi — aks holda keshdan tiklangan itemlar yo'qoladi.
  useEffect(() => {
    if (!hydrated) return;
    if (prevFilterKey.current === filterKey) return;
    // Filtr o'zgardi — eski filter keshini tozalaymiz (yangi qiymatni saqlashdan oldin).
    const oldKey = prevFilterKey.current;
    prevFilterKey.current = filterKey;
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(cacheKey(seed, oldKey));
      } catch {
        // jim
      }
    }
    const cleanup = reloadFirstBatch();
    return cleanup;
  }, [hydrated, filterKey, reloadFirstBatch, seed]);

  // Live: kontent yoki janr/joylashuv o'zgarganda avtomatik yangilash.
  // Debounce timeriga o'xshab ketma-ket event'larni yig'ib bir marta yuklaymiz.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLiveEvent(["contents", "taxonomy"], () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => reloadFirstBatch(), 200);
  });

  const loadMore = useCallback(async () => {
    if (!hasNext || loading) return;
    setLoading(true);
    const q = new URLSearchParams();
    q.set("s", seed);
    q.set("offset", String(items.length));
    q.set("limit", String(BATCH));
    if (sp.get("janr")) q.set("genre", sp.get("janr")!);
    if (sp.get("joy")) q.set("location", sp.get("joy")!);
    if (sp.get("yil")) q.set("year", sp.get("yil")!);
    try {
      const res = await fetch(`/api/contents?${q.toString()}`);
      const data = await res.json();
      setItems((prev) => [...prev, ...data.items]);
      setHasNext(!!data.hasNext);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [hasNext, loading, items.length, seed, sp]);

  // Har o'zgarishda keshni yangilaymiz — orqaga qaytganda tiklash uchun.
  useEffect(() => {
    if (!hydrated) return;
    writeCache(seed, filterKey, {
      items,
      hasNext,
      total,
      scrollY: typeof window !== "undefined" ? window.scrollY : 0,
    });
  }, [hydrated, items, hasNext, total, seed, filterKey]);

  // Sahifadan chiqishdan oldin (link click / back) scroll pozitsiyasini saqlaymiz.
  useEffect(() => {
    if (!hydrated) return;
    const save = () => {
      writeCache(seed, filterKey, {
        items,
        hasNext,
        total,
        scrollY: window.scrollY,
      });
    };
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [hydrated, items, hasNext, total, seed, filterKey]);

  return (
    <div className="flex flex-col">
      <FilterBar meta={meta} total={total} />
      <div className="flex-1 min-w-0 px-3 md:px-4 lg:px-6 py-6">
        <AnimatePresence mode="wait">
          {items.length === 0 && !loading ? (
            <EmptyState key="empty" />
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <MasonryGrid items={items} loading={loading} />
              <div className="mt-8 flex flex-col items-center gap-2">
                {hasNext ? (
                  <motion.button
                    onClick={loadMore}
                    disabled={loading}
                    whileTap={{ scale: 0.96 }}
                    className="h-12 px-6 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? uz.states.loading : uz.filters.loadMore}
                  </motion.button>
                ) : items.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="meta"
                  >
                    {uz.states.endCap}
                  </motion.div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
