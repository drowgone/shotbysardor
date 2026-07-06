import { apiError, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { storage } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await prisma.content.findUnique({
    where: { slug },
    include: {
      genres: { orderBy: { name: "asc" } },
      location: true,
      _count: { select: { comments: true } },
    },
  });
  if (!c || c.status !== "PUBLISHED") return apiError(404, "not_found", "Topilmadi");
  const defaultPrice = await getSetting("order.defaultPriceUZS");
  const s = storage();
  return ok({
    id: c.id,
    slug: c.slug,
    type: c.type,
    title: c.title,
    description: c.description,
    thumbUrl: s.publicUrl(c.thumbKey),
    previewUrl: s.publicUrl(c.previewKey),
    posterUrl: c.posterKey ? s.publicUrl(c.posterKey) : null,
    blurhash: c.blurhash,
    width: c.width,
    height: c.height,
    genres: c.genres,
    location: c.location,
    capturedAt: c.capturedAt.toISOString(),
    viewsCount: c.viewsCount,
    commentsCount: c._count.comments,
    priceUZS: c.priceUZS ?? defaultPrice,
    durationSec: c.durationSec,
  });
}
