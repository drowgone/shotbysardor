import { EventEmitter } from "node:events";

// Server tomonidagi hodisa formati. `topic` obligator, boshqalari ixtiyoriy —
// client ko'p hollarda faqat "biror narsa o'zgardi" signalini oladi va o'zi refetch qiladi.
export type LiveEvent = {
  topic: string;
  action?: string; // "create" | "update" | "delete" | "approve" | "reject" | ...
  id?: string | number;
  slug?: string;
  token?: string;
  meta?: Record<string, unknown>;
  ts: number;
};

// Bitta process ichida yagona bus. Next.js dev rejimida HMR modulni qayta yuklaydi,
// shuning uchun `globalThis` orqali singleton saqlaymiz — bu tinglovchilarni yo'qotmaslikka yordam.
const g = globalThis as unknown as { __sbs_liveBus?: EventEmitter };
export const bus: EventEmitter = (() => {
  if (g.__sbs_liveBus) return g.__sbs_liveBus;
  const e = new EventEmitter();
  // Bir vaqtda ko'p tab ochilishi mumkin — default 10 limitni oshiramiz.
  e.setMaxListeners(0);
  g.__sbs_liveBus = e;
  return e;
})();

// Ichki event nomi — barcha topic'lar shu bitta yagona 'live' nomi ostida yuboriladi.
// Sabab: EventSource client-side'da wildcard yo'q. Server barcha xabarlarni 'event: live'
// nomi bilan jo'natadi, `data.topic` esa filtrlash uchun ishlatiladi.
export const BUS_EVENT = "live";

// Server tomondan chaqiriladi — hodisani yagona `live` kanaliga chiqaradi.
// Xato bo'lsa ham hech qachon exception qaytarmaydi — asosiy oqim to'xtamasin.
export function emit(
  topic: string,
  extra?: Omit<LiveEvent, "topic" | "ts">,
): void {
  try {
    const ev: LiveEvent = { ts: Date.now(), topic, ...(extra ?? {}) };
    bus.emit(BUS_EVENT, ev);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[live] emit failed:", e);
  }
}
