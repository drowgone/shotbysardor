import { NextRequest } from "next/server";
import { apiError, clientIp, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { sha256 } from "@/lib/utils";
import { digitsOnly } from "@/lib/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Kod bo'yicha buyurtmani ochish (aloqa sahifasidagi qidiruv).
//
// Xavfsizlik qatlamlari:
//   1. Kod formatini qat'iy tekshirish — enumeration'ga qarshi to'siq.
//   2. Per-IP rate limit (10/daqiqa) + global rate limit (300/daqiqa) — kod
//      raqamlari ketma-ket bo'lgani sabab hujumchi barcha kodlarni topib chiqishga
//      urinishi mumkin. Rate-limit bu jarayonni amalda imkonsiz qiladi.
//   3. Yuklab olish `token` faqat mijoz aloqa raqamining oxirgi 4 raqamini
//      isbotlaganida qaytariladi (`?verify=1234`). Statusni ko'rish uchun
//      bu shart emas.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const ip = clientIp(req);
  const ipHash = (await sha256(ip)).slice(0, 24);

  const rl = rateLimit(`ordercode:ip:${ipHash}`, 10, 60_000);
  if (!rl.ok) return apiError(429, "rate_limit", "Juda ko'p urinish. Bir necha daqiqadan so'ng qayta urining.");

  const globalRl = rateLimit("ordercode:global", 300, 60_000);
  if (!globalRl.ok) return apiError(429, "rate_limit", "Serverda ko'p urinish");

  const { code } = await params;
  const trimmed = (code ?? "").trim().toUpperCase();
  // Faqat "SB-<raqam>" formatiga ruxsat — random urinishlar tezda 404 oladi.
  if (!/^SB-\d{3,10}$/.test(trimmed)) {
    return apiError(404, "not_found", "Bunday buyurtma topilmadi");
  }

  const o = await prisma.order.findUnique({
    where: { code: trimmed },
    include: { content: true },
  });
  if (!o) return apiError(404, "not_found", "Bunday buyurtma topilmadi");

  // Ixtiyoriy contact tasdiqlash — oxirgi 4 raqam.
  //
  // XAVFSIZLIK: Javobda hech qachon haqiqiy raqamlarni yubormaymiz. Aks holda kod
  // bilan URL'ni ochgan har kim tekshiruvni chetlab o'ta oladi. Faqat quyidagini beramiz:
  //   - `contactType`  — telefonmi yoki elektron pochtami (UI ko'rsatma uchun)
  //   - `verifyRequired` — 4 raqamli tekshiruv talab qilinishi
  //   - `verifyFailed`   — noto'g'ri qiymat yuborilgan holatda (client alohida xato ko'rsatadi)
  const url = new URL(req.url);
  const providedVerify = digitsOnly(url.searchParams.get("verify") ?? "");
  const contactDigits = digitsOnly(o.contact);
  const contactLast4 = contactDigits.slice(-4);
  const contactType: "phone" | "email" | "other" =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.contact.trim())
      ? "email"
      : contactDigits.length >= 4
        ? "phone"
        : "other";
  const verifyProvided = providedVerify.length === 4;
  const contactVerified =
    verifyProvided && contactLast4.length === 4 && providedVerify === contactLast4;
  const verifyFailed = verifyProvided && !contactVerified;

  const s = storage();
  return ok({
    code: o.code,
    // Token faqat mijoz oxirgi 4 raqamni to'g'ri kiritganida ochiladi.
    token: contactVerified ? o.token : null,
    contactVerified,
    verifyRequired: contactLast4.length === 4 && !contactVerified,
    verifyFailed,
    contactType,
    status: o.status,
    title: o.content.title,
    thumbUrl: s.publicUrl(o.content.thumbKey),
    priceUZS: o.priceUZS,
    expiresAt: o.expiresAt?.toISOString() ?? null,
    downloadsLeft: Math.max(0, o.maxDownloads - o.downloadCount),
    maxDownloads: o.maxDownloads,
    rejectReason: o.rejectReason,
    createdAt: o.createdAt.toISOString(),
    approvedAt: o.approvedAt?.toISOString() ?? null,
  });
}
