import { NextRequest } from "next/server";
import { apiError, clientIp, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { shuffleWithSeed } from "@/lib/utils";

// Umumiy scan chegarasi — hujumchi tasodifiy `?s=<seed>` bilan har safar to'liq ID
// ro'yxatini talab qilib DB'ni charchashi mumkin. Cap 5000 — bu galereyada odatiy
// filtrlangan natijalar sonidan ancha katta, ammo cheklashsiz emas.
const MAX_TOTAL_IDS = 5000;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimit(`contents:get:${ip}`, 120, 60_000);
  if (!rl.ok) return apiError(429, "rate_limit", "Juda ko'p so'rov");

  const sp = req.nextUrl.searchParams;
  const genre = sp.get("genre");
  const location = sp.get("location");
  const from = sp.get("from");
  const to = sp.get("to");
  const year = sp.get("year");
  const rawSeed = sp.get("s") ?? "";
  // Seedni ham cheklamasak, hujumchi juda uzun qatorlarni yuborishi mumkin.
  const seed = rawSeed.slice(0, 64);
  const offset = Math.max(0, Math.min(10_000, Number(sp.get("offset") ?? 0)));
  const limit = Math.min(80, Math.max(1, Number(sp.get("limit") ?? 40)));

  // Sanalarni tekshiramiz — noto'g'ri bo'lsa filter'ni bekor qilamiz (Invalid Date bermaslik).
  const parseDate = (v: string | null): Date | undefined => {
    if (!v) return undefined;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : undefined;
  };

  const where: import("@prisma/client").Prisma.ContentWhereInput = { status: "PUBLISHED" };
  if (genre && genre.length <= 64) where.genres = { some: { slug: genre } };
  if (location && location.length <= 64) where.location = { slug: location };
  if (year) {
    const y = Number(year);
    if (Number.isInteger(y) && y >= 1900 && y <= 3000) {
      where.capturedAt = { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) };
    }
  }
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    const gte = parseDate(from);
    const lte = parseDate(to);
    if (gte) range.gte = gte;
    if (lte) range.lte = lte;
    if (range.gte || range.lte) where.capturedAt = range;
  }

  // Barcha mos ID'larni olib, sessiya seedi bilan aralashtiramiz — offset+limit orqali sahifalash barqaror.
  const allIds = await prisma.content.findMany({
    where,
    select: { id: true },
    orderBy: { id: "asc" },
    take: MAX_TOTAL_IDS,
  });
  const total = allIds.length;
  const shuffled = seed ? shuffleWithSeed(allIds.map((r) => r.id), seed) : allIds.map((r) => r.id);
  const pageIds = shuffled.slice(offset, offset + limit);

  const rows = pageIds.length
    ? await prisma.content.findMany({
        where: { id: { in: pageIds } },
        include: { genres: { orderBy: { name: "asc" } }, location: true },
      })
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const list = pageIds.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r);

  const s = storage();
  return ok({
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
    hasNext: offset + list.length < total,
    total,
  });
}
