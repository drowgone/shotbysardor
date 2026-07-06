import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type AdminSession = {
  loggedIn: boolean;
  loggedInAt?: number;
  csrf?: string;
  // Sozlamalardagi `admin.sessionVersion` bilan taqqoslanadi. Parol/login o'zgarganda
  // versiya oshiriladi va shu bilan barcha eski cookie'lar avtomatik yaroqsizga chiqadi.
  v?: number;
  // AdminSessionRecord.id — cookie va DB yozuvini bog'lab turadi. Yozuv `revokedAt` ga
  // ega bo'lsa, keyingi so'rovda `requireAdmin` cookie'ni yo'q qiladi.
  sid?: string;
};

const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) {
  // Prodda oldindan taxmin qilinadigan sekret ishlatilishi — hujumchi soxta admin
  // cookie yaratishi mumkin. Shu sabab prodda module load'da fatal xato beramiz.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[session] SESSION_SECRET kamida 32 belgili random qator bo'lishi shart (env: SESSION_SECRET)",
    );
  }
  // eslint-disable-next-line no-console
  console.warn("[session] SESSION_SECRET kamida 32 belgi bo'lishi kerak — dev fallback ishlatilyapti");
}

export const sessionOptions: SessionOptions = {
  cookieName: "sbs_admin",
  password: (secret ?? "development-only-secret-please-change-me-123").padEnd(32, "x"),
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Admin cookie'si tashqi saytdan hech qachon jo'natilmasligi kerak — CSRF/click-jacking'ga qarshi.
    sameSite: "strict",
    // 30 kun juda uzoq. Adminni 7 kunda qayta login qilishga majbur qilamiz.
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  },
};

export async function getAdminSession(): Promise<IronSession<AdminSession>> {
  return getIronSession<AdminSession>(await cookies(), sessionOptions);
}
