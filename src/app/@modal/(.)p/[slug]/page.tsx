import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { LightboxOverlay } from "./lightbox-overlay";

export default async function InterceptedContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await prisma.content.findUnique({
    where: { slug },
    include: {
      genres: { orderBy: { name: "asc" } },
      location: true,
      _count: { select: { comments: true } },
    },
  });
  if (!c || c.status !== "PUBLISHED") return notFound();
  const defaultPrice = await getSetting("order.defaultPriceUZS");
  const s = storage();
  const content = {
    id: c.id,
    slug: c.slug,
    type: c.type,
    title: c.title,
    description: c.description,
    thumbUrl: s.publicUrl(c.thumbKey),
    previewUrl: s.publicUrl(c.previewKey),
    posterUrl: c.posterKey ? s.publicUrl(c.posterKey) : null,
    width: c.width,
    height: c.height,
    genres: c.genres.map((g) => ({ name: g.name })),
    location: { name: c.location.name },
    capturedAt: c.capturedAt.toISOString(),
    viewsCount: c.viewsCount,
    commentsCount: c._count.comments,
    priceUZS: c.priceUZS ?? defaultPrice,
    durationSec: c.durationSec,
  };
  return <LightboxOverlay content={content} />;
}
