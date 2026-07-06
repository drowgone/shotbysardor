import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, ok, clientIp } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { nextOrderCode, randomId } from "@/lib/utils";
import { detectMime } from "@/lib/media";
import { sendOrderToTelegram } from "@/lib/telegram";
import { analyzeReceipt } from "@/lib/ocr";
import type { AnalyzeResult } from "@/lib/ocr";
import { emit } from "@/lib/live/bus";

export const runtime = "nodejs";

const schema = z.object({
  contentId: z.string().min(1),
  name: z.string().min(1).max(100),
  contact: z.string().min(1).max(120),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit(`order:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.ok) return apiError(429, "rate_limit", "Iltimos, keyinroq urinib ko'ring");
  // Global to'siq — botnet hujumida OCR CPU'ni charchashdan asraydi.
  const globalRl = rateLimit("order:global", 60, 5 * 60 * 1000);
  if (!globalRl.ok) return apiError(429, "rate_limit", "Serverda ko'p buyurtma. Bir necha daqiqadan so'ng qayta urining.");

  const form = await req.formData();
  const parsed = schema.safeParse({
    contentId: form.get("contentId"),
    name: form.get("name"),
    contact: form.get("contact"),
    note: (form.get("note") as string) || undefined,
  });
  if (!parsed.success) return apiError(400, "validation", "Ma'lumot noto'g'ri");

  const content = await prisma.content.findUnique({ where: { id: parsed.data.contentId } });
  if (!content) return apiError(404, "not_found", "Kontent topilmadi");

  const defaultPrice = await getSetting("order.defaultPriceUZS");
  const priceUZS = content.priceUZS ?? defaultPrice;
  const payment = await getSetting("order.paymentDetails");

  const receipt = form.get("receipt") as File | null;
  let receiptKey: string | undefined;
  let ocr: AnalyzeResult | null = null;
  if (receipt) {
    // OCR resurs sig'imini boshqarish — chek 5 MB dan katta bo'lmasin.
    const maxMB = Number(process.env.MAX_RECEIPT_MB ?? 5);
    if (receipt.size > maxMB * 1024 * 1024) return apiError(413, "too_large", `Chek ${maxMB}MB dan katta`);
    const buf = Buffer.from(await receipt.arrayBuffer());
    const mime = detectMime(buf);
    if (!mime.startsWith("image/")) return apiError(415, "unsupported", "Chek rasm bo'lishi kerak");

    // OCR tahlili — administratorga yordamchi. Xatolik bo'lsa buyurtmani rad etmaymiz,
    // faqat OCR yo'q holatida saqlaymiz.
    // OCR: birinchi karta oxirgi 4 raqami bilan solishtiriladi (bir nechta karta bo'lsa asosiy — birinchisi).
    const cards = Array.isArray(payment.cards) ? payment.cards : [];
    const primaryCardNumber = cards[0]?.number || payment.cardNumber || "";
    const cardLast4 =
      primaryCardNumber.replace(/\D/g, "").slice(-4) || null;
    try {
      ocr = await analyzeReceipt({
        imageBuffer: buf,
        expectedAmount: priceUZS,
        expectedCardLast4: cardLast4,
      });
    } catch (e) {
      const code = (e as Error & { code?: string })?.code;
      if (code === "ocr_busy") {
        return apiError(503, "ocr_busy", "Server band. Bir necha daqiqadan so'ng qayta urining.");
      }
      // eslint-disable-next-line no-console
      console.error("[ocr] analyze failed:", e);
      ocr = null;
    }

    // Spec bo'yicha: hech qanday element aniqlanmasa (foundCount === 0) — foydalanuvchidan
    // haqiqiy chek qayta so'raladi. Boshqa barcha holatlarda buyurtma admin tekshiruviga
    // yuboriladi (hattoki bitta element topilgan bo'lsa ham).
    if (ocr && ocr.foundCount === 0) {
      return apiError(
        422,
        "receipt_invalid",
        "Haqiqiy to'lov chekini (skrinshotini) qayta yuklang.",
      );
    }

    const id = randomId(12);
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    receiptKey = `receipts/${id}.${ext}`;
    await storage().putBuffer("private", receiptKey, buf, mime);
  }

  const seq = await prisma.orderCounter.upsert({
    where: { id: 1 },
    create: { id: 1, seq: 43 },
    update: { seq: { increment: 1 } },
  });
  const code = nextOrderCode(seq.seq);
  const token = crypto.randomUUID();

  const order = await prisma.order.create({
    data: {
      code,
      token,
      contentId: content.id,
      customerName: parsed.data.name.trim(),
      contact: parsed.data.contact.trim(),
      note: parsed.data.note?.trim(),
      priceUZS,
      receiptKey,
      ...(ocr
        ? {
            ocrScore: ocr.score,
            ocrLevel: ocr.level,
            ocrFindings: ocr.findings as unknown as object,
            ocrText: ocr.text.slice(0, 4000),
            ocrProcessedAt: new Date(),
          }
        : {}),
    },
  });

  // Telegram xabari — sozlangan bo'lsa (yig'ilgan xatolarni yashiramiz, buyurtma DB'da baribir bor)
  const tg = await getSetting("order.telegram");
  if (tg.enabled && tg.botToken && tg.chatId) {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const previewUrl = `${site}/p/${content.slug}`;
    const receiptBuf = receiptKey ? await storage().getBuffer("private", receiptKey).catch(() => null) : null;
    // await qilamiz — natijani tekshirib, xatolikni serverga log qilamiz.
    try {
      const tgRes = await sendOrderToTelegram({
        botToken: tg.botToken,
        chatId: tg.chatId,
        orderId: order.id,
        code: order.code,
        customerName: order.customerName,
        contact: order.contact,
        note: order.note,
        priceUZS: order.priceUZS,
        title: content.title,
        contentPreviewUrl: previewUrl,
        receiptBuffer: receiptBuf,
      });
      if (!tgRes.ok) {
        // eslint-disable-next-line no-console
        console.error(`[telegram] Buyurtma xabari yuborilmadi: ${tgRes.description}`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[telegram] sendOrder throw:", e);
    }
  }

  // Live: admin ro'yxati (yangi PENDING) + dashboard KPI + shu tokenli kartaga signal.
  emit("orders", { action: "create", id: order.id, token: order.token });
  emit(`orders:${order.token}`, { action: "create", id: order.id, token: order.token });
  emit("stats", { action: "orders.create" });

  return ok({ code: order.code, token: order.token });
}
