import { prisma } from "./db";
import { parseUserAgent, maskIp, extractLocation, lookupGeoIp } from "./device";
import { sha256 } from "./utils";

// TRUSTED_PROXY env — reverse proxy (Vercel/Cloudflare) ishlatilsa "1"/"true".
const TRUST_PROXY = ((): boolean => {
  const v = (process.env.TRUSTED_PROXY ?? "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
})();

// requireAdmin har so'rovda `lastSeenAt` ni yangilamaydi — bir necha soniya cheklovi.
const touchedAt = new Map<string, number>();
const TOUCH_INTERVAL_MS = 60_000;

// Seans "faol" deb hisoblanadigan oyna: `lastSeenAt` shu vaqt ichida yangilangan
// bo'lsa qurilma hali ochiq. Undan uzun bo'lsa — brauzer yopilgan / kompyuter
// o'chirilgan deb hisoblab, seansni avtomatik bekor qilamiz. Bu:
//   1) Ro'yxatda faqat haqiqiy faol qurilmalar ko'rinishini ta'minlaydi.
//   2) Master seans faqat faol qurilmalar orasidan tanlanadi — build/restart
//      yoki uzoq davomsizlikdan keyin joriy qurilma avtomatik master bo'lishi
//      uchun (eski, ishlatilmagan qurilma master maqomini ushlab turmaydi).
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

export async function createAdminSessionRecord(input: {
  username: string;
  ip: string;
  userAgent: string | null;
  headers: Headers;
  sessionVersion: number;
}): Promise<{
  id: string;
  isNewDevice: boolean;
  deviceLabel: string;
  ipDisplay: string;
  country: string | null;
  city: string | null;
}> {
  const parsed = parseUserAgent(input.userAgent);
  let { country, city } = extractLocation(input.headers, TRUST_PROXY);
  // Header'dan joylashuv kelmasa — public IP bo'lsa tashqi geoIP xizmatidan olishga urinamiz.
  if (!country) {
    const geo = await lookupGeoIp(input.ip).catch(() => ({ country: null, city: null }));
    country = geo.country;
    if (!city) city = geo.city;
  }
  const ipHash = (await sha256(input.ip)).slice(0, 32);
  const ipDisplay = maskIp(input.ip);
  const usernameLower = input.username.toLowerCase();

  // "Yangi qurilma" — shu foydalanuvchi uchun oxirgi 180 kunda bu barmoq izi
  // (brauzer + OS + mamlakat) ko'rilganmi? Yo'q bo'lsa — yangi.
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const priorSame = await prisma.adminSessionRecord.findFirst({
    where: {
      username: usernameLower,
      deviceLabel: parsed.label,
      country: country ?? null,
      createdAt: { gt: since },
    },
    select: { id: true },
  });
  const isNewDevice = !priorSame;

  const record = await prisma.adminSessionRecord.create({
    data: {
      username: usernameLower,
      ipHash,
      ipDisplay,
      country,
      city,
      userAgent: (input.userAgent ?? "").slice(0, 512),
      deviceLabel: parsed.label,
      sessionVersion: input.sessionVersion,
    },
    select: { id: true },
  });

  return {
    id: record.id,
    isNewDevice,
    deviceLabel: parsed.label,
    ipDisplay,
    country,
    city,
  };
}

// Sessiyani "faol" holatda ushlab turish — throttled update.
export async function touchSessionRecord(id: string): Promise<void> {
  const now = Date.now();
  const last = touchedAt.get(id) ?? 0;
  if (now - last < TOUCH_INTERVAL_MS) return;
  touchedAt.set(id, now);
  await prisma.adminSessionRecord
    .updateMany({
      where: { id, revokedAt: null },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => {
      // ignore
    });
}

// Sessiyani bekor qilish (revoke).
export async function revokeSessionRecord(
  id: string,
  by: string,
): Promise<{ ok: boolean }> {
  const res = await prisma.adminSessionRecord
    .updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date(), revokedBy: by.slice(0, 64) },
    })
    .catch(() => ({ count: 0 }));
  touchedAt.delete(id);
  return { ok: res.count > 0 };
}

// Eskirgan seansiyalarni bekor qilish — `lastSeenAt` `ACTIVE_WINDOW_MS` dan uzoq
// yangilanmagan bo'lsa avtomatik revoke. Idempotent.
async function sweepStaleSessions(username: string): Promise<void> {
  const threshold = new Date(Date.now() - ACTIVE_WINDOW_MS);
  await prisma.adminSessionRecord
    .updateMany({
      where: {
        username: username.toLowerCase(),
        revokedAt: null,
        lastSeenAt: { lt: threshold },
      },
      data: { revokedAt: new Date(), revokedBy: "stale" },
    })
    .catch(() => {
      // ignore
    });
}

// Foydalanuvchining barcha faol sessiyalarini ro'yxatga olish.
// Chaqirilishidan oldin eskirganlar avtomatik tozalanadi.
export async function listActiveSessions(username: string) {
  await sweepStaleSessions(username);
  return prisma.adminSessionRecord.findMany({
    where: { username: username.toLowerCase(), revokedAt: null },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      deviceLabel: true,
      ipDisplay: true,
      country: true,
      city: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });
}

// "Master" seans — eng qadimgi FAOL sessiya. Eskirganlar chetlab o'tiladi,
// shuning uchun uzoq foydalanilmagan qurilma master maqomini ushlab turmaydi.
export async function getMasterSessionId(username: string): Promise<string | null> {
  await sweepStaleSessions(username);
  const row = await prisma.adminSessionRecord.findFirst({
    where: { username: username.toLowerCase(), revokedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

// Foydalanuvchining barcha faol sessiyalarini bekor qilish (joriy ham). Credentials
// (login/parol) o'zgartirilganda chaqiriladi — hamma qurilma qayta login qilishi majbur.
export async function revokeAllSessions(
  username: string,
  by: string,
): Promise<number> {
  const res = await prisma.adminSessionRecord
    .updateMany({
      where: { username: username.toLowerCase(), revokedAt: null },
      data: { revokedAt: new Date(), revokedBy: by.slice(0, 64) },
    })
    .catch(() => ({ count: 0 }));
  return res.count;
}

// Sessiya versiya mos kelmaganida (parol o'zgargan) — hammasini bir zumda bekor qilamiz.
// `exceptId` — joriy seans yozuvi; u versiya oshirilgach saqlanadi.
export async function revokeAllSessionsForVersionMismatch(
  username: string,
  currentVersion: number,
  exceptId?: string | null,
): Promise<number> {
  const res = await prisma.adminSessionRecord.updateMany({
    where: {
      username: username.toLowerCase(),
      revokedAt: null,
      sessionVersion: { lt: currentVersion },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    data: { revokedAt: new Date(), revokedBy: "credentials" },
  });
  return res.count;
}

export function trustProxy(): boolean {
  return TRUST_PROXY;
}
