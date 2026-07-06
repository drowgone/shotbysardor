import { NextRequest, NextResponse } from "next/server";

// UUID formatidagi sid cookie'ni tekshirish — hujumchi sid'ga xohlagan qiymatini
// yozib rate-limit yoki like/view mantiqini chalg'ita olmasligi uchun.
const SID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Middleware — sid cookie o'rnatish. PageView yozuvi keyingi bosqichda API orqali.
export function middleware(req: NextRequest) {
  const existing = req.cookies.get("sid")?.value;
  const isValid = existing && SID_RE.test(existing);
  let sid = isValid ? existing : "";
  const isNew = !sid;
  if (!sid) {
    sid = crypto.randomUUID();
    // Joriy so'rovga ham qo'shamiz — page.tsx cookies() orqali darrov ko'radi.
    req.cookies.set("sid", sid);
  }
  const res = NextResponse.next({ request: { headers: req.headers } });
  if (isNew) {
    res.cookies.set("sid", sid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  // HSTS — HTTPS majburiy (prodda). Reverse proxy ham xuddi shu header qo'shishi tavsiya etiladi.
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return res;
}

export const config = {
  // API va statik yo'llardan chiqamiz — middleware faqat sahifalar uchun (sid cookie).
  // Katta upload'lar api routega to'g'ridan-to'g'ri tushishi kerak — middleware body limitini aylanib o'tish.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|favicon.svg|robots.txt|sitemap.xml).*)",
  ],
};
