import { apiError, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const o = await prisma.order.findUnique({
    where: { token },
    include: { content: true },
  });
  if (!o) return apiError(404, "not_found", "Buyurtma topilmadi");
  const s = storage();
  const downloadsLeft = Math.max(0, o.maxDownloads - o.downloadCount);
  return ok({
    code: o.code,
    status: o.status,
    title: o.content.title,
    thumbUrl: s.publicUrl(o.content.thumbKey),
    contentSlug: o.content.slug,
    priceUZS: o.priceUZS,
    expiresAt: o.expiresAt?.toISOString() ?? null,
    downloadsLeft,
    maxDownloads: o.maxDownloads,
    rejectReason: o.rejectReason,
    createdAt: o.createdAt.toISOString(),
    approvedAt: o.approvedAt?.toISOString() ?? null,
  });
}
