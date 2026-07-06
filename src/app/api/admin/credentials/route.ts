import { NextRequest } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { apiError, ok, requireAdmin, checkCsrf, clientIp, zodErrorMessage } from "@/lib/api";
import { getSetting, setSetting } from "@/lib/settings";
import { getAdminSession } from "@/lib/session";
import { clearFail } from "@/lib/rate-limit";
import { recordAdminAction } from "@/lib/audit";
import { revokeAllSessions } from "@/lib/admin-session-record";
import { sha256 } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/live/bus";

// Login va/yoki parolni almashtirish uchun yagona endpoint.
// Ikkalasidan biri (yoki ikkalasi) o'zgartirilishi mumkin, lekin joriy parolni tasdiqlash shart.
const schema = z
  .object({
    currentPassword: z.string().min(1, "Joriy parolni kiriting"),
    newUsername: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9._-]{3,32}$/i, "Login 3-32 belgi, faqat lotin harflari va _ . - raqamlar")
      .optional(),
    newPassword: z.string().min(8, "Yangi parol kamida 8 belgi").optional(),
  })
  .refine((v) => v.newUsername !== undefined || v.newPassword !== undefined, {
    message: "Yangi login yoki parolni kiriting",
    path: ["newUsername"],
  });

export async function POST(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(400, "validation", zodErrorMessage(parsed.error));

  const cur = await getSetting("admin.passwordHash");
  const valid = await argon2.verify(cur, parsed.data.currentPassword).catch(() => false);
  if (!valid) return apiError(401, "invalid_current", "Joriy parol noto'g'ri");

  // Eski loginni setSetting'dan oldin o'qib qo'yamiz — hisoblagichni to'g'ri tozalash uchun.
  const oldUsername = ((await getSetting("admin.username").catch(() => "admin")) || "admin").toLowerCase();
  const changes: string[] = [];

  if (parsed.data.newUsername) {
    await setSetting("admin.username", parsed.data.newUsername.trim().toLowerCase());
    changes.push("username");
  }

  if (parsed.data.newPassword) {
    const nextHash = await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id });
    await setSetting("admin.passwordHash", nextHash);
    changes.push("password");
  }

  const updatedAt = new Date().toISOString();
  await setSetting("admin.credentialsUpdatedAt", updatedAt);

  // Sessiya versiyasini oshiramiz — barcha boshqa cookie'lar avtomatik yaroqsiz.
  const currentVersion = (await getSetting("admin.sessionVersion").catch(() => 1)) as number;
  const nextVersion = (typeof currentVersion === "number" ? currentVersion : 1) + 1;
  await setSetting("admin.sessionVersion", nextVersion);

  // Yangi lockout hisoblagichlarini tozalaymiz (parolni almashtirish — kompromisni bartaraf etish yo'li).
  const newUsername = parsed.data.newUsername ? parsed.data.newUsername.trim().toLowerCase() : null;
  clearFail(`login:user:${oldUsername}`);
  if (newUsername) clearFail(`login:user:${newUsername}`);
  clearFail("login:global");

  // Login/parol o'zgardi — hamma qurilmani majburiy qayta login qilishga
  // yuboramiz (joriy admin ham). Sabab: yangi credentials'ni ishlatib kirish
  // orqali "men haqiqatan ham egasiman" isbotini talab qilamiz.
  // MUHIM: seans yozuvlari `oldUsername` bilan yozilgan — login o'zgarsa ham
  // ular hali eski username bilan indekslangan. Shu sabab revoke `oldUsername`
  // bilan chaqiriladi. Yangi loginda hech qanday yozuv bo'lmaydi.
  const revokedCount = await revokeAllSessions(
    oldUsername,
    "credentials",
  ).catch(() => 0);

  // Joriy cookie'ni yo'q qilamiz — client keyingi so'rovda 401 oladi va /admin ga
  // qaytadi. Response'da ham `redirect: "/admin"` maydonini qaytaramiz.
  const session = await getAdminSession();
  await session.destroy();

  const ipHash = (await sha256(clientIp(req))).slice(0, 24);
  void recordAdminAction({
    actor: newUsername ?? oldUsername,
    ipHash,
    action: "credentials.update",
    meta: { changes, sessionVersion: nextVersion, revokedSessions: revokedCount },
  });

  emit("admin", { action: "credentials.update", meta: { changed: changes } });

  return ok({
    ok: true,
    changed: changes,
    updatedAt,
    username: newUsername ?? undefined,
    redirect: "/admin",
  });
}
