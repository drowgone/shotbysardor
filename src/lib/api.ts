import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "./session";
import { getSetting } from "./settings";
import { prisma } from "./db";
import { touchSessionRecord } from "./admin-session-record";
import { ZodError } from "zod";

export type ApiErr = { code: string; message: string };

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } as ApiErr }, { status });
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function requireAdmin() {
  const s = await getAdminSession();
  if (!s.loggedIn) return null;
  // Sessiya versiyasini joriy admin.sessionVersion bilan solishtiramiz. Parol/login
  // o'zgargandan keyin barcha oldingi cookie'lar bekor bo'ladi.
  const current = (await getSetting("admin.sessionVersion").catch(() => 1)) as number;
  if ((s.v ?? 0) !== current) {
    await s.destroy();
    return null;
  }
  // Server tomonidagi seans yozuvi tekshiruvi — cookie yaroqli, ammo yozuv bekor
  // qilingan bo'lsa (boshqa seansdan revoke qilingan) — cookie ham yaroqsiz.
  if (s.sid) {
    const rec = await prisma.adminSessionRecord
      .findUnique({
        where: { id: s.sid },
        select: { revokedAt: true },
      })
      .catch(() => null);
    if (!rec || rec.revokedAt) {
      await s.destroy();
      return null;
    }
    // Fon rejimida faol vaqtni yangilaymiz (60s da bir marta throttled).
    void touchSessionRecord(s.sid);
  }
  return s;
}

export function checkCsrf(req: NextRequest, expected: string | undefined): boolean {
  const provided = req.headers.get("x-csrf-token");
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function zodErrorMessage(err: ZodError): string {
  return err.issues.map((i) => i.message).join("; ") || "Ma'lumot noto'g'ri";
}

// TRUSTED_PROXY env — reverse proxy (Vercel/Nginx/Cloudflare) ishlatilsa "1"/"true".
// Aks holda `x-forwarded-for` va `x-real-ip` header'lari hujumchi tomonidan spoof qilinishi
// mumkin va rate-limit'ni butunlay chetlab o'tish uchun ishlatiladi.
const TRUST_PROXY = ((): boolean => {
  const v = (process.env.TRUSTED_PROXY ?? "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
})();

export function clientIp(req: NextRequest): string {
  const readHeaders = (): string | null => {
    const cf = req.headers.get("cf-connecting-ip");
    if (cf) return cf.trim();
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    const real = req.headers.get("x-real-ip");
    if (real) return real.trim();
    return null;
  };
  if (TRUST_PROXY) {
    const ip = readHeaders();
    if (ip) return ip;
  }
  // Dev muhitida header'lar bo'lmasa lokal IP'ni qaytaramiz — rate-limit bir bucket'ga tushadi,
  // ammo IP va joylashuv UI da ma'noli ko'rinadi. Prod'da TRUSTED_PROXY=1 bo'lishi shart.
  if (process.env.NODE_ENV !== "production") {
    const ip = readHeaders();
    if (ip) return ip;
    return "127.0.0.1";
  }
  return "unknown";
}
