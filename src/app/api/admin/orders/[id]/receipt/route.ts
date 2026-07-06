import { apiError, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

// Faqat admin uchun chekni ko'rish
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  const { id } = await params;
  const o = await prisma.order.findUnique({ where: { id } });
  if (!o?.receiptKey) return apiError(404, "not_found", "Topilmadi");

  const st = storage();
  if (st.driver === "r2") {
    const url = await st.signedUrl("private", o.receiptKey, 60);
    if (!url) return apiError(500, "sign_failed", "Xatolik");
    return Response.redirect(url, 302);
  }
  const { stream, size } = await st.getStream("private", o.receiptKey);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(size),
      "Cache-Control": "no-store",
    },
  });
}
