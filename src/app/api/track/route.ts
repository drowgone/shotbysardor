import { NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { apiError, clientIp, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { recordPageView } from "@/lib/analytics";
import { getAdminSession } from "@/lib/session";

// Klient tomonidan chaqiriladi (SPA nav) — page viewni yozadi.
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const jar = await cookies();
  const sid = jar.get("sid")?.value;
  if (!sid) return ok({ ok: false });

  // Per-sid + per-IP rate limit — hujumchi bir sessiyada ko'p pageview yozib DB'ni to'ldirmasin.
  const rl = await rateLimit(`track:${sid}:${ip}`, 60, 60_000);
  if (!rl.ok) return apiError(429, "rate_limit", "Juda ko'p so'rov");

  const { path } = (await req.json().catch(() => ({}))) as { path?: string };
  if (typeof path !== "string" || path.length === 0) return ok({ ok: false });
  // Path uzunligi cheklovi — DB'ga cheksiz uzun stringlar tushmasin.
  if (path.length > 512) return ok({ ok: false });

  const h = await headers();
  const admin = await getAdminSession();
  await recordPageView({
    sid,
    path,
    ua: (h.get("user-agent") ?? "").slice(0, 256),
    referrer: (h.get("referer") ?? "").slice(0, 512) || null,
    host: new URL(req.url).host,
    isAdminSession: !!admin.loggedIn,
  }).catch(() => {});
  return ok({ ok: true });
}
