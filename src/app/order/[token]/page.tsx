import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { PublicShell } from "@/components/layout/PublicShell";
import { OrderStatusCard } from "./status-card";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const o = await prisma.order.findUnique({
    where: { token },
    include: { content: true },
  });
  if (!o) return notFound();
  const s = storage();
  const data = {
    code: o.code,
    token: o.token,
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
  };
  return (
    <PublicShell>
      <div className="pt-24 md:pt-32 pb-16 px-4 max-w-2xl mx-auto">
        <OrderStatusCard order={data} />
      </div>
    </PublicShell>
  );
}
