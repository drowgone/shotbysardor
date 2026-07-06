import { NextRequest } from "next/server";
import { apiError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  const status = req.nextUrl.searchParams.get("status") as "PENDING" | "APPROVED" | "REJECTED" | null;

  const orders = await prisma.order.findMany({
    where: status ? { status } : {},
    orderBy: [{ createdAt: "desc" }],
    include: { content: true },
    take: 100,
  });

  const st = storage();
  return ok({
    items: orders.map((o) => ({
      id: o.id,
      code: o.code,
      token: o.token,
      status: o.status,
      title: o.content.title,
      thumbUrl: st.publicUrl(o.content.thumbKey),
      customerName: o.customerName,
      contact: o.contact,
      note: o.note,
      priceUZS: o.priceUZS,
      receiptUrl: o.receiptKey ? `/api/admin/orders/${o.id}/receipt` : null,
      rejectReason: o.rejectReason,
      approvedAt: o.approvedAt?.toISOString() ?? null,
      expiresAt: o.expiresAt?.toISOString() ?? null,
      downloadCount: o.downloadCount,
      maxDownloads: o.maxDownloads,
      createdAt: o.createdAt.toISOString(),
      ocr: o.ocrProcessedAt
        ? {
            score: o.ocrScore,
            level: o.ocrLevel,
            findings: o.ocrFindings,
            processedAt: o.ocrProcessedAt.toISOString(),
          }
        : null,
    })),
  });
}
