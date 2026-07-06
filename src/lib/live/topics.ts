// Topic'lar — server hodisalari uchun kanal nomlari. Har bir mutation kamida bitta
// topic'ga xabar chiqaradi. Client tomonda `useLive*` topic ro'yxatiga obuna bo'ladi.
//
// Nomlash konvensiyasi:
//   - "orders"        — barcha buyurtmalar (admin ro'yxati)
//   - "orders:<token>"— aniq buyurtma (public status kartasi)
//   - "contents"      — barcha kontent (galereya, admin ro'yxati)
//   - "contents:<slug>" — bitta kontent (izohlar, ko'rish soni)
//   - "comments"      — barcha izohlar (admin moderatsiya)
//   - "comments:<slug>" — bitta kontent'ning izohlari
//   - "settings"      — global sozlamalar
//   - "taxonomy"      — janrlar/joylashuvlar
//   - "stats"         — dashboard KPI (admin)
//   - "admin"         — admin panelining o'z holati (sessiyalar, credentials)

// Ochiq (public) topic'lar — obunachi kim bo'lishidan qat'i nazar tinglashi mumkin.
export const PUBLIC_TOPICS = [
  "contents",
  "taxonomy",
  "settings",
  "comments",
  "orders", // faqat "orders:<token>" pattern'i — token bilsang o'sha buyurtmani ko'rasan
] as const;

// Faqat admin sessiyada tinglash mumkin bo'lgan topic'lar (list-darajasidagi).
// Diqqat: "orders" umumiy list-darajasi ham admin-only. "orders:<token>" — public
// (token o'zi maxfiy). Farqni `isAdminOnlyFilter` aniqlaydi.
const ADMIN_ONLY_LIST_TOPICS = new Set<string>(["orders", "stats", "admin", "comments"]);

// Filtr — public tomonidan so'raladigan pattern (masalan "orders:abc123" yoki "contents").
// Faqat aniq resurs uchun bo'lgan filtrlar public'ga ochiq; umumiy list-topic'lar admin-only.
export function isAdminOnlyFilter(filter: string): boolean {
  const [base, tail] = filter.split(":", 2);
  if (!ADMIN_ONLY_LIST_TOPICS.has(base)) return false;
  // "orders:<token>" — token public identifikator sifatida ishlaydi, ruxsat.
  // "comments:<slug>" — public sahifadagi izohlar, ruxsat.
  if (base === "orders" && tail) return false;
  if (base === "comments" && tail) return false;
  return true;
}

// Server chiqargan hodisa topic'i tinglovchining filtriga mos keladimi.
// - Aniq mos: "contents" == "contents"
// - Prefiks: "contents" filtri "contents:<slug>" hodisasini ushlaydi
// - Wildcard: "contents:*" — bu ham prefiksga aylanadi
export function matchesFilter(eventTopic: string, filter: string): boolean {
  if (filter === "*") return true;
  if (filter.endsWith(":*")) {
    const prefix = filter.slice(0, -2);
    return eventTopic === prefix || eventTopic.startsWith(prefix + ":");
  }
  if (eventTopic === filter) return true;
  if (eventTopic.startsWith(filter + ":")) return true;
  return false;
}
