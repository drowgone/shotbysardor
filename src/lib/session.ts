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

// `next build` "Collecting page data" bosqichida route modullari yuklanadi va
// `.env` haqli ravishda mavjud emas. Shuning uchun SESSION_SECRET tekshiruvini
// modul yuklanish paytida qilmaymiz — aks holda build har safar crash beradi.
// Buning o'rniga sessionni birinchi bor RUNTIME'da so'raganda tekshiramiz.
function getSessionOptions(): SessionOptions {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      // Prodda ishga tushirilgan payt: sekret bo'lmasa hujumchi soxta cookie
      // yasashi mumkin — shu sababli xato tashlaymiz.
      throw new Error(
        "[session] SESSION_SECRET kamida 32 belgili random qator bo'lishi shart (env: SESSION_SECRET)",
      );
    }
    // Dev'da ogohlantirish yetarli.
    // eslint-disable-next-line no-console
    console.warn(
      "[session] SESSION_SECRET kamida 32 belgi bo'lishi kerak — dev fallback ishlatilyapti",
    );
  }
  return {
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
}

// Boshqa modullar `sessionOptions.cookieName` kabi metadata olishi mumkin.
// Getter — module import paytida qiymat baholanmaydi.
export const sessionOptions: SessionOptions = new Proxy({} as SessionOptions, {
  get(_target, prop) {
    return getSessionOptions()[prop as keyof SessionOptions];
  },
});

export async function getAdminSession(): Promise<IronSession<AdminSession>> {
  return getIronSession<AdminSession>(await cookies(), getSessionOptions());
}
