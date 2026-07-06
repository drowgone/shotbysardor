import { NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Atomar increment + tekshiruv
  const now = new Date();
  type TxResult =
    | { ok: false; err: number; reason: string }
    | { ok: true; originalKey: string; filename: string };
  const updated = await prisma.$transaction(async (tx): Promise<TxResult> => {
    const o = await tx.order.findUnique({ where: { token }, include: { content: true } });
    if (!o) return { ok: false, err: 404, reason: "not_found" };
    if (o.status !== "APPROVED") return { ok: false, err: 403, reason: "not_approved" };
    if (!o.expiresAt || o.expiresAt <= now) return { ok: false, err: 403, reason: "expired" };
    if (o.downloadCount >= o.maxDownloads) return { ok: false, err: 403, reason: "no_downloads_left" };
    await tx.order.update({
      where: { id: o.id },
      data: { downloadCount: { increment: 1 } },
    });
    return { ok: true, originalKey: o.content.originalKey, filename: `${o.code}-${o.content.slug}` };
  });

  if (!updated.ok) return apiError(updated.err, updated.reason, "Ruxsat yo'q yoki muddat tugagan");

  const s = storage();
  const rawExt = updated.originalKey.split(".").pop() ?? "bin";
  const ext = /^[A-Za-z0-9]{1,8}$/.test(rawExt) ? rawExt.toLowerCase() : "bin";
  // Content-Disposition header'da sitatalarni yorishga qarshi — faqat xavfsiz belgilar.
  const safeName = `${updated.filename}.${ext}`.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 128);

  if (s.driver === "r2") {
    // Qisqa TTL — signed URL leak bo'lsa ham ko'p vaqt ishlamaydi.
    // maxDownloads hisoblagichi allaqachon incremented, lekin 60s deraza ichida
    // hujumchi bir necha marta parallel yuklab olishi mumkin edi.
    const signed = await s.signedUrl("private", updated.originalKey, 15, safeName);
    if (!signed) return apiError(500, "signing_failed", "Xatolik");
    return Response.redirect(signed, 302);
  }

  // Local: stream
  const { stream, size } = await s.getStream("private", updated.originalKey);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
      "Accept-Ranges": "bytes",
    },
  });
}
