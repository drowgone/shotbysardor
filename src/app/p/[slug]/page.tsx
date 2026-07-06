import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { PublicShell } from "@/components/layout/PublicShell";
import { LightboxSSR } from "./lightbox-ssr";
import { LiveRefresh } from "@/lib/live/live-refresh";

async function loadContent(slug: string) {
  const c = await prisma.content.findUnique({
    where: { slug },
    include: {
      genres: { orderBy: { name: "asc" } },
      location: true,
      _count: { select: { comments: true } },
    },
  });
  if (!c || c.status !== "PUBLISHED") return null;
  const defaultPrice = await getSetting("order.defaultPriceUZS");
  const s = storage();
  return {
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
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await loadContent(slug);
  if (!c) return { title: "Topilmadi" };
  return {
    title: `${c.title} · shot by sardor`,
    description: c.description ?? `${c.genres.map((g) => g.name).join(" · ")} · ${c.location.name}`,
    openGraph: {
      title: c.title,
      description: c.description ?? undefined,
      images: [{ url: c.previewUrl }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: c.title,
      images: [c.previewUrl],
    },
  };
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await loadContent(slug);
  if (!c) return notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": c.type === "PHOTO" ? "ImageObject" : "VideoObject",
    name: c.title,
    description: c.description ?? undefined,
    contentUrl: c.previewUrl,
    thumbnailUrl: c.thumbUrl,
    creator: { "@type": "Person", name: "Sardor" },
    dateCreated: c.capturedAt,
    ...(c.type === "VIDEO" ? { duration: `PT${c.durationSec ?? 0}S` } : {}),
  };

  return (
    <PublicShell>
      {/* Kontent yoki umumiy sozlamalar o'zgarsa — RSC ni yangilaymiz (narx, tavsif, ko'rish soni). */}
      <LiveRefresh topics={[`contents:${slug}`, "settings"]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LightboxSSR content={c} />
    </PublicShell>
  );
}
