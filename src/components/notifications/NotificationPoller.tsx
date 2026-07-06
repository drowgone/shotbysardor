"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveEvent } from "@/lib/live/use-live";

const STORAGE_KEY = "sbs-notif-pending-v1";

type Pending = {
  token: string;
  code: string;
  title: string;
  addedAt: number;
};

// Foydalanuvchi tasdiqlashi kutilayotgan buyurtmalar ro'yxati.
// SuccessCard va OrderStatusCard shu funktsiyalar orqali qo'shadi/o'chiradi.
export function addPendingOrder(order: { token: string; code: string; title: string }) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: Pending[] = raw ? JSON.parse(raw) : [];
    if (list.find((x) => x.token === order.token)) return;
    list.push({ ...order, addedAt: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function removePendingOrder(token: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const list: Pending[] = JSON.parse(raw);
    const next = list.filter((x) => x.token !== token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function getPending(): Pending[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Pending[]) : [];
  } catch {
    return [];
  }
}

// Sayt bo'yicha bir marta o'rnatiladigan komponent. Foydalanuvchi saytda ochiq turgan har qanday
// sahifada localStorage'dagi kutilayotgan buyurtmalar bo'yicha `orders:<token>` SSE topic'ini
// tinglaydi. Server APPROVED/REJECTED event chiqargani bilan darhol tekshirib, bildirishnoma yuboradi.
// Polling emas — event-driven.
export function NotificationPoller() {
  const [pending, setPending] = useState<Pending[]>([]);
  const inFlight = useRef<Set<string>>(new Set());

  // localStorage'ni kuzatamiz: mount, storage event (boshqa tab), va focus.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => {
      const now = Date.now();
      const list = getPending().filter((x) => now - x.addedAt < 7 * 24 * 60 * 60 * 1000);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch {
        // ignore
      }
      setPending(list);
    };
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    const onFocus = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    // Boshqa fayllar addPendingOrder chaqirsa (bir tab ichida storage event ishlamaydi)
    // — bir necha soniyada bir refresh qilib turamiz. Bu polling emas, faqat localStorage read.
    const id = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
    };
  }, []);

  // Har bir pending buyurtma uchun alohida topic — masalan "orders:abc123".
  // useLiveEvent yagona sotib olishga birlashtiradi (barcha topiclarni bitta EventSource'ga).
  const topics = useMemo(() => pending.map((p) => `orders:${p.token}`), [pending]);
  useLiveEvent(topics, async (ev) => {
    const token = ev.token ?? ev.topic.split(":")[1];
    if (!token) return;
    if (inFlight.current.has(token)) return;
    inFlight.current.add(token);
    try {
      const p = pending.find((x) => x.token === token);
      if (!p) return;
      const res = await fetch(`/api/orders/${token}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "APPROVED") {
        fireNotification(p);
        removePendingOrder(p.token);
        setPending((s) => s.filter((x) => x.token !== p.token));
      } else if (data.status === "REJECTED") {
        fireNotification({ ...p, rejected: true });
        removePendingOrder(p.token);
        setPending((s) => s.filter((x) => x.token !== p.token));
      }
    } finally {
      inFlight.current.delete(token);
    }
  });

  return null;
}

function fireNotification(p: Pending & { rejected?: boolean }) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const title = p.rejected
      ? "Buyurtma qabul qilinmadi"
      : "Buyurtma tasdiqlandi";
    const body = p.rejected
      ? `#${p.code} — sabab uchun buyurtma sahifasiga o'ting`
      : `#${p.code} — ${p.title} tayyor. Yuklab olish uchun bosing.`;
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: `order-${p.token}`,
      requireInteraction: !p.rejected,
    });
    n.onclick = () => {
      window.focus();
      window.location.href = `/order/${p.token}`;
      n.close();
    };
  } catch {
    // ignore
  }
}
