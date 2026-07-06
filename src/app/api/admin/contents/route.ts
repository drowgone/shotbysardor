import { NextRequest } from "next/server";
import { apiError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

const PAGE_SIZE = 60;

export async function GET(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q");
  const status = sp.get("status");
  const page = Math.max(1, Number(sp.get("page") ?? 1));

  const where: import("@prisma/client").Prisma.ContentWhereInput = {};
  if (q) where.title = { contains: q, mode: "insensitive" };
  if (status === "PUBLISHED" || status === "DRAFT") where.status = status;

  const [rows, total, revenueAgg] = await Promise.all([
    prisma.content.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        genres: { orderBy: { name: "asc" } },
        location: true,
        _count: { select: { comments: true, orders: true } },
      },
    }),
    prisma.content.count({ where }),
    // Foyda snapshot: tasdiqlangan buyurtmalar summasi. Order.priceUZS
    // buyurtma yaratilganda saqlanadi — content narxi keyin o'zgarsa ham foyda o'zgarmaydi.
    prisma.order.aggregate({
      _sum: { priceUZS: true },
      where: { status: "APPROVED" },
    }),
  ]);

  const st = storage();
  return ok({
    items: rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      thumbUrl: st.publicUrl(c.thumbKey),
      genres: c.genres.map((g) => ({ id: g.id, name: g.name })),
      location: c.location.name,
      capturedAt: c.capturedAt.toISOString(),
      views: c.viewsCount,
      comments: c._count.comments,
      orders: c._count.orders,
      priceUZS: c.priceUZS,
      description: c.description,
      genreIds: c.genres.map((g) => g.id),
      locationId: c.locationId,
      status: c.status,
      featured: c.featured,
      type: c.type,
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    revenueUZS: revenueAgg._sum.priceUZS ?? 0,
  });
}
