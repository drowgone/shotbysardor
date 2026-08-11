import { NextRequest } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { apiError, ok, clientIp, zodErrorMessage } from "@/lib/api";
import { getAdminSession } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { isLocked, rateLimit, trackFail, clearFail } from "@/lib/rate-limit";
import { randomId, sha256 } from "@/lib/utils";
import { recordLoginAttempt } from "@/lib/audit";
import { createAdminSessionRecord } from "@/lib/admin-session-record";
import { notifyNewDeviceLogin } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Konstant vaqt uchun ishlatiladigan "aldov" hash. Argon2 verify har doim ishga tushishi
// kerak — foydalanuvchi topilmasa ham. Server startida bir marta hisoblanadi.
let dummyHashPromise: Promise<string> | null = null;
async function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash("__nonexistent__" + randomId(8), { type: argon2.argon2id });
  }
  return dummyHashPromise;
}

const schema = z.object({
  username: z.string().min(1, "Login bo'sh bo'lmasin").max(64),
  password: z.string().min(1, "Parol bo'sh bo'lmasin").max(256),
  // Bot uchun tuzoq — foydalanuvchi bunga hech qachon tegmaydi.
  hp: z.string().optional(),
  // Formani ochilgan vaqt (Date.now()). Juda tez yuborilgan so'rov bot ehtimoli yuqori.
  ts: z.number().optional(),
});

function timingSafeEqualStr(a: string, b: string): boolean {
  const la = a.length;
  const lb = b.length;
  const n = Math.max(la, lb);
  let diff = la ^ lb;
  for (let i = 0; i < n; i++) {
    const ca = i < la ? a.charCodeAt(i) : 0;
    const cb = i < lb ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

async function jitter() {
  const ms = 90 + Math.floor(Math.random() * 170);
  await new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const ipHash = (await sha256(ip)).slice(0, 24);
  const ipKey = `login:ip:${ipHash}`;
  const userAgent = req.headers.get("user-agent") ?? null;

  // Global qattiq limit — barcha IP'lar bo'yicha. Botnet hujumiga qarshi so'nggi to'siq.
  const globalRl = await rateLimit("login:global:hard", 60, 15 * 60 * 1000);
  if (!globalRl.ok) {
    return apiError(429, "rate_limit", "Serverda ko'p urinish. Bir necha daqiqadan so'ng qayta urining.");
  }

  // IP darajasidagi qattiq limit.
  const ipRl = await rateLimit(ipKey, 8, 15 * 60 * 1000);
  if (!ipRl.ok) {
    void recordLoginAttempt({ username: "", ipHash, userAgent, success: false, reason: "rate_limit" });
    return apiError(429, "rate_limit", "Juda ko'p urinish. Keyinroq qayting.");
  }

  // Progressiv IP lockout.
  const ipLock = await isLocked(ipKey);
  if (ipLock.locked) {
    void recordLoginAttempt({ username: "", ipHash, userAgent, success: false, reason: "locked" });
    await jitter();
    return apiError(
      429,
      "locked",
      `Qurilma vaqtinchalik bloklangan. Taxminan ${Math.ceil(ipLock.retryAfterMs / 60000)} daqiqadan so'ng qayta urining.`,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "bad_request", "So'rov noto'g'ri");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(400, "validation", zodErrorMessage(parsed.error));

  // Honeypot — foydalanuvchi bunga tegmaydi. Bot deb hisoblaymiz.
  if (parsed.data.hp && parsed.data.hp.trim().length > 0) {
    void recordLoginAttempt({
      username: parsed.data.username.trim().toLowerCase(),
      ipHash,
      userAgent,
      success: false,
      reason: "honeypot",
    });
    await jitter();
    return apiError(401, "invalid_credentials", "Login yoki parol noto'g'ri");
  }

  // Formaning ochilgan vaqti tekshiruvi.
  if (typeof parsed.data.ts === "number") {
    const dwell = Date.now() - parsed.data.ts;
    if (dwell >= 0 && dwell < 400) {
      await trackFail(ipKey, {
        limit: 3,
        windowMs: 30 * 60 * 1000,
        escalations: [60_000, 5 * 60_000, 15 * 60_000],
      });
      void recordLoginAttempt({
        username: parsed.data.username.trim().toLowerCase(),
        ipHash,
        userAgent,
        success: false,
        reason: "dwell",
      });
      await jitter();
      return apiError(401, "invalid_credentials", "Login yoki parol noto'g'ri");
    }
  }

  const submittedUser = parsed.data.username.trim().toLowerCase();
  const userKey = `login:user:${submittedUser}`;

  // Foydalanuvchi darajasidagi bloklash.
  const userLock = await isLocked(userKey);
  if (userLock.locked) {
    void recordLoginAttempt({
      username: submittedUser,
      ipHash,
      userAgent,
      success: false,
      reason: "locked",
    });
    await jitter();
    return apiError(
      429,
      "locked",
      `Ushbu akkaunt vaqtinchalik bloklangan. Taxminan ${Math.ceil(userLock.retryAfterMs / 60000)} daqiqadan so'ng qayta urining.`,
    );
  }

  const [savedUsername, hash] = await Promise.all([
    getSetting("admin.username"),
    getSetting("admin.passwordHash"),
  ]);
  if (!hash) return apiError(500, "not_configured", "Admin parol o'rnatilmagan");

  const savedLower = (savedUsername || "admin").trim().toLowerCase();
  const usernameMatch = timingSafeEqualStr(submittedUser, savedLower);

  // Har doim argon2 verify chaqiramiz — javob vaqti username to'g'riligini oshkor qilmasligi uchun.
  const hashToUse = usernameMatch ? hash : await getDummyHash();
  const passwordValid = await argon2.verify(hashToUse, parsed.data.password).catch(() => false);

  const success = usernameMatch && passwordValid;

  if (!success) {
    // IP: 5 urinishdan keyin 1 → 5 → 15 daqiqa lockout
    await trackFail(ipKey, {
      limit: 5,
      windowMs: 30 * 60 * 1000,
      escalations: [60_000, 5 * 60_000, 15 * 60_000],
    });
    // Username: 6 urinishdan keyin 5 → 15 → 60 daqiqa lockout
    const userLoc = await trackFail(userKey, {
      limit: 6,
      windowMs: 30 * 60 * 1000,
      escalations: [5 * 60_000, 15 * 60_000, 60 * 60_000],
    });
    // Global: 30 urinishdan keyin 3 → 15 daqiqa
    await trackFail("login:global", {
      limit: 30,
      windowMs: 15 * 60 * 1000,
      escalations: [3 * 60_000, 15 * 60_000],
    });

    void recordLoginAttempt({
      username: submittedUser,
      ipHash,
      userAgent,
      success: false,
      reason: "invalid_credentials",
    });

    // eslint-disable-next-line no-console
    console.warn(
      `[login] fail ipHash=${ipHash} user=${submittedUser} userFails=${userLoc.count}`,
    );

    await jitter();
    return apiError(401, "invalid_credentials", "Login yoki parol noto'g'ri");
  }

  // Muvaffaqiyatli login — hisoblagichlarni tozalaymiz.
  await clearFail(ipKey);
  await clearFail(userKey);

  const sessionVersion =
    ((await getSetting("admin.sessionVersion").catch(() => 1)) as number) ?? 1;

  // DB seans yozuvi — qurilma / IP / joylashuv audit uchun. Yozuv ID'si cookie'ga
  // qo'yiladi va requireAdmin har so'rovda yozuv "revokedAt" ga tekshiradi.
  let record: Awaited<ReturnType<typeof createAdminSessionRecord>> | null = null;
  try {
    record = await createAdminSessionRecord({
      username: submittedUser,
      ip,
      userAgent,
      headers: req.headers,
      sessionVersion,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[login] session record create failed:", err);
  }

  // Session-fixation'ga qarshi eski cookie'ni yo'q qilib, yangi cookie yozamiz.
  const session = await getAdminSession();
  await session.destroy();
  session.loggedIn = true;
  session.loggedInAt = Date.now();
  session.csrf = randomId(24);
  session.v = sessionVersion;
  if (record) session.sid = record.id;
  await session.save();

  void recordLoginAttempt({
    username: submittedUser,
    ipHash,
    userAgent,
    success: true,
    reason: "ok",
  });

  // Yangi qurilma bo'lsa — telegram'ga xabar yuboramiz.
  if (record?.isNewDevice) {
    void notifyNewDeviceLogin({
      username: submittedUser,
      deviceLabel: record.deviceLabel,
      ipDisplay: record.ipDisplay,
      country: record.country,
      city: record.city,
      when: new Date(),
    });
  }

  // eslint-disable-next-line no-console
  console.info(
    `[login] ok ipHash=${ipHash} user=${submittedUser} newDevice=${record?.isNewDevice ?? "?"}`,
  );

  return ok({ ok: true, csrf: session.csrf });
}
