"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Server tomonidagi hodisa formati (bus.ts bilan bir xil).
export type LiveEvent = {
  topic: string;
  action?: string;
  id?: string | number;
  slug?: string;
  token?: string;
  meta?: Record<string, unknown>;
  ts: number;
};

type Subscription = {
  filters: string[];
  handler: (ev: LiveEvent) => void;
};

// Tab ichida bitta ulanish. Barcha komponentlar shu managerga obuna bo'ladi.
// Filtr to'plami o'zgarganda ulanish qayta quriladi — kam ehtimoli aksariyat sahifalar
// mount vaqtida obuna bo'lib, unmount'gacha shu holatda qoladi.
class LiveClient {
  private es: EventSource | null = null;
  private currentTopicsKey = "";
  private subs = new Set<Subscription>();
  private reopenTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(filters: string[], handler: (ev: LiveEvent) => void): () => void {
    const sub: Subscription = { filters, handler };
    this.subs.add(sub);
    this.reconcile();
    return () => {
      this.subs.delete(sub);
      this.reconcile();
    };
  }

  private reconcile() {
    const all = new Set<string>();
    for (const s of this.subs) for (const f of s.filters) all.add(f);
    const key = [...all].sort().join(",");
    if (key === this.currentTopicsKey && this.es) return;

    if (this.es) {
      this.es.close();
      this.es = null;
    }
    this.currentTopicsKey = key;
    if (!key) return;

    this.openWithBackoff(key);
  }

  private openWithBackoff(topicsKey: string) {
    if (typeof window === "undefined") return;
    const url = `/api/live?topics=${encodeURIComponent(topicsKey)}`;
    let es: EventSource;
    try {
      es = new EventSource(url, { withCredentials: true });
    } catch {
      // Xato bo'lsa keyinroq qayta urinish.
      this.scheduleReopen(topicsKey);
      return;
    }
    this.es = es;

    es.addEventListener("live", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as LiveEvent;
        for (const sub of this.subs) {
          if (sub.filters.some((f) => this.matches(data.topic, f))) {
            sub.handler(data);
          }
        }
      } catch {
        // ignore — noto'g'ri JSON
      }
    });

    // EventSource o'zi qayta ulanadi, ammo baraza server o'chirilsa readyState=CLOSED bo'lib qoladi.
    // Bunday holda o'zimiz ham qayta urinamiz.
    es.addEventListener("error", () => {
      if (es.readyState === EventSource.CLOSED) {
        this.scheduleReopen(topicsKey);
      }
    });
  }

  private scheduleReopen(topicsKey: string) {
    if (this.reopenTimer) return;
    this.reopenTimer = setTimeout(() => {
      this.reopenTimer = null;
      if (this.currentTopicsKey === topicsKey && !this.es) {
        this.openWithBackoff(topicsKey);
      }
    }, 3000);
  }

  private matches(eventTopic: string, filter: string): boolean {
    if (filter === "*") return true;
    if (filter.endsWith(":*")) {
      const p = filter.slice(0, -2);
      return eventTopic === p || eventTopic.startsWith(p + ":");
    }
    if (eventTopic === filter) return true;
    if (eventTopic.startsWith(filter + ":")) return true;
    return false;
  }
}

let client: LiveClient | null = null;
function getClient(): LiveClient | null {
  if (typeof window === "undefined") return null;
  return (client ??= new LiveClient());
}

function useStableTopics(topics: string[] | string): string[] {
  const arr = Array.isArray(topics) ? topics : [topics];
  const key = arr.slice().sort().join("|");
  return useMemo(() => arr, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Topic'larga obuna bo'lish. Event kelganda `handler` chaqiriladi.
export function useLiveEvent(
  topics: string[] | string,
  handler: (ev: LiveEvent) => void,
): void {
  const filters = useStableTopics(topics);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const c = getClient();
    if (!c) return;
    return c.subscribe(filters, (ev) => handlerRef.current(ev));
  }, [filters]);
}

// Router'ni yangilash uchun — RSC (server-render) sahifalarni topic'ga bog'laydi.
export function useLiveRefresh(topics: string[] | string): void {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLiveEvent(topics, () => {
    // Bir necha event ketma-ket kelsa — bir marta refresh.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 100);
  });
}

// URL'dan ma'lumot olib, topic'larni tinglaydi va event kelganda avtomatik refetch qiladi.
// Mavjud `useEffect(fetch)` naqshini almashtirishga mo'ljallangan.
export function useLiveData<T>(
  url: string | null,
  topics: string[] | string,
  options?: { enabled?: boolean; initial?: T | null },
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<T | null>(options?.initial ?? null);
  const [loading, setLoading] = useState<boolean>(options?.initial == null);
  const [error, setError] = useState<string | null>(null);
  const enabled = (options?.enabled ?? true) && !!url;
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef(url);
  urlRef.current = url;
  // `data` uchun ref — background refetch'da hozirgi holatni sinxron o'qish uchun.
  // `useState` dan olingan qiymat closure ichida "stale" bo'lishi mumkin.
  const dataRef = useRef(data);
  dataRef.current = data;

  const doFetch = useCallback(async () => {
    if (!enabled || !urlRef.current) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    // Faqat birinchi yuklashda `loading` ni true qilamiz (data hali yo'q bo'lsa).
    // Aks holda — bu background refetch (live event yoki url o'zgarishi tufayli):
    // eski ma'lumotni ekranda qoldirib, yangisini "silent" almashtiramiz.
    // Bu jadval/ro'yxatning unmount bo'lib, sahifa balandligi kamayib, scrollY
    // yuqoriga sakrab tushishi kabi UX buglarini oldini oladi.
    if (dataRef.current == null) setLoading(true);
    try {
      const res = await fetch(urlRef.current, {
        signal: ctrl.signal,
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      setData(json);
      setError(null);
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Boshlang'ich yuklash va URL o'zgarishida qayta yuklash.
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void doFetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [url, enabled, doFetch]);

  // Event kelganda — 60ms debounce bilan refetch.
  useLiveEvent(topics, () => {
    if (!enabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void doFetch(), 60);
  });

  // Tab ko'rinuvchan bo'lganda — catch-up refetch (event o'tkazib yuborilgan bo'lsa).
  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.visibilityState === "visible") void doFetch();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled, doFetch]);

  return { data, loading, error, refetch: () => void doFetch() };
}
