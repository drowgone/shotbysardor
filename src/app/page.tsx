import { Suspense } from "react";
import { cookies } from "next/headers";
import { PublicShell } from "@/components/layout/PublicShell";
import { Hero } from "@/components/gallery/Hero";
import { GalleryClient } from "@/components/gallery/GalleryClient";
import { PageTracker } from "@/components/PageTracker";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { WelcomeGuide } from "@/components/welcome/WelcomeGuide";
import type { ContentCard, MetaData } from "@/components/gallery/types";
import { shuffleWithSeed } from "@/lib/utils";
import { LiveRefresh } from "@/lib/live/live-refresh";

export const revalidate = 60;
export const dynamic = "force-dynamic";

async function getHero() {
  const heroId = await getSetting("site.heroContentId");
  const s = storage();

  // 1) Admin qo'lda tanlagan bo'lsa — o'sha
  if (heroId) {
    const c = await prisma.content.findUnique({ where: { id: heroId } });
    if (c) return mapHero(c, s);
  }

  // 2) Featured bor bo'lsa — ular ichidan tasodifiy
  const featuredCount = await prisma.content.count({
    where: { status: "PUBLISHED", featured: true },
  });
  if (featuredCount > 0) {
    const skip = Math.floor(Math.random() * featuredCount);
    const c = await prisma.content.findFirst({
      where: { status: "PUBLISHED", featured: true },
      skip,
      orderBy: { createdAt: "desc" },
    });
    if (c) return mapHero(c, s);
  }

  // 3) Featured yo'q — barcha chop etilgan kontentlardan tasodifiy
  const total = await prisma.content.count({ where: { status: "PUBLISHED" } });
  if (total > 0) {
    const skip = Math.floor(Math.random() * total);
    const c = await prisma.content.findFirst({
      where: { status: "PUBLISHED" },
      skip,
      orderBy: { createdAt: "desc" },
    });
    if (c) return mapHero(c, s);
  }

  return null;
}

function mapHero(c: import("@prisma/client").Content, s: ReturnType<typeof storage>) {
  return {
    // Hero uchun yuqori sifatli preview — yo'q bo'lsa oddiy previewga qaytamiz
    previewUrl: s.publicUrl(c.heroKey ?? c.previewKey),
    posterUrl: c.posterKey ? s.publicUrl(c.posterKey) : null,
    thumbUrl: s.publicUrl(c.thumbKey),
    type: c.type,
    blurhash: c.blurhash,
    width: c.width,
    height: c.height,
    title: c.title,
  };
}

async function getInitialContents(
  searchParams: URLSearchParams,
  seed: string,
): Promise<{ items: ContentCard[]; hasNext: boolean; total: number }> {
  const genre = searchParams.get("janr");
  const location = searchParams.get("joy");
  const year = searchParams.get("yil");
  const where: import("@prisma/client").Prisma.ContentWhereInput = { status: "PUBLISHED" };
  if (genre) where.genres = { some: { slug: genre } };
  if (location) where.location = { slug: location };
  if (year) {
    const y = Number(year);
    where.capturedAt = { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) };
  }
  const limit = 40;
  const allIds = await prisma.content.findMany({
    where,
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const total = allIds.length;
  const shuffled = shuffleWithSeed(allIds.map((r) => r.id), seed);
  const pageIds = shuffled.slice(0, limit);
  const rows = pageIds.length
    ? await prisma.content.findMany({
        where: { id: { in: pageIds } },
        include: { genres: { orderBy: { name: "asc" } }, location: true },
      })
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const list = pageIds.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
  const s = storage();
  return {
    items: list.map((c) => ({
      slug: c.slug,
      type: c.type,
      title: c.title,
      thumbUrl: s.publicUrl(c.thumbKey),
      posterUrl: c.posterKey ? s.publicUrl(c.posterKey) : null,
      previewUrl: c.type === "VIDEO" ? s.publicUrl(c.previewKey) : null,
      blurhash: c.blurhash,
      width: c.width,
      height: c.height,
      origWidth: c.origWidth,
      origHeight: c.origHeight,
      genres: c.genres.map((g) => ({ name: g.name, slug: g.slug })),
      location: { name: c.location.name, slug: c.location.slug },
      capturedAt: c.capturedAt.toISOString(),
      viewsCount: c.viewsCount,
      featured: c.featured,
      durationSec: c.durationSec,
    })),
    hasNext: list.length < total,
    total,
  };
}

async function getMeta(): Promise<MetaData> {
  const [genres, locations, years] = await Promise.all([
    prisma.genre.findMany({ where: { contents: { some: { status: "PUBLISHED" } } }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { contents: { some: { status: "PUBLISHED" } } }, orderBy: [{ usageCount: "desc" }, { name: "asc" }] }),
    prisma.content.findMany({ where: { status: "PUBLISHED" }, select: { capturedAt: true } }),
  ]);
  const y = new Set<number>();
  for (const c of years) y.add(new Date(c.capturedAt).getFullYear());
  return {
    genres: genres.map((g) => ({ name: g.name, slug: g.slug })),
    locations: locations.map((l) => ({ name: l.name, slug: l.slug })),
    years: [...y].sort((a, b) => b - a),
  };
}

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") params.set(k, v);
  // Gallery seed:
  //  - `gallery.shufflePerVisit` yoqilgan bo'lsa — har render'da yangi tasodifiy seed
  //    (foydalanuvchi sahifani ochgan har safar boshqa tartib).
  //  - o'chirilgan bo'lsa — `sid` cookie'ga bog'lab qo'yamiz, sessiya davomida tartib
  //    barqaror qoladi.
  //  - URL'da ?s=... berilgan bo'lsa (masalan «pagination» load-more davomida) — ustun.
  const cookieStore = await cookies();
  const sid = cookieStore.get("sid")?.value;
  const shufflePerVisit = await getSetting("gallery.shufflePerVisit");
  const seed = typeof sp.s === "string" && sp.s
    ? sp.s
    : shufflePerVisit
      ? Math.random().toString(36).slice(2, 10)
      : sid ?? Math.random().toString(36).slice(2, 10);
  const [hero, initial, meta, tagline] = await Promise.all([
    getHero(),
    getInitialContents(params, seed),
    getMeta(),
    getSetting("site.tagline"),
  ]);

  return (
    <PublicShell>
      {/* Hero va tagline server tomonda render qilinadi — settings o'zgarsa RSC ni yangilaymiz. */}
      <LiveRefresh topics={["settings"]} />
      <PageTracker />
      <Hero content={hero} tagline={tagline} />
      <Suspense>
        <GalleryClient initial={initial} meta={meta} seed={seed} />
      </Suspense>
      <WelcomeGuide />
    </PublicShell>
  );
}
