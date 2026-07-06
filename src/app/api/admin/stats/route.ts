import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { apiError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

// Storage papkasi umumiy hajmini rekursiv hisoblash (faqat `local` drayvda).
// R2 uchun `null` — chunki bucket usage ListObjectsV2 orqali qimmat.
async function computeStorageUsage(): Promise<number | null> {
  if (storage().driver !== "local") return null;
  const root = path.join(process.cwd(), "storage");
  let total = 0;
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(p);
      } else if (e.isFile()) {
        const st = await fs.stat(p).catch(() => null);
        if (st) total += st.size;
      }
    }
  }
  await walk(root);
  return total;
}

// Dashboard uchun ma'lumotlar to'plami — KPI, davr seriyasi, top kontent, media mix,
// so'nggi harakatlar (buyurtma+izoh) va referrerlar. Barcha so'rovlar Promise.all bilan
// parallel bajariladi.
//
// Barcha countlar `isAdmin=false` sessiyalarga cheklangan — admin'ning o'z tashriflari sanamaydi.
export async function GET(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");

  const range = Number(req.nextUrl.searchParams.get("range") ?? 7);
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const startCurr = new Date(now.getTime() - range * dayMs);
  const startPrev = new Date(now.getTime() - 2 * range * dayMs);
  const startToday = new Date(now.toISOString().slice(0, 10));
  const start7 = new Date(now.getTime() - 7 * dayMs);
  const start30 = new Date(now.getTime() - 30 * dayMs);

  // === Sana bo'yicha kunlik seriyalar ===
  // Bir necha metrikni birgalikda hisoblash uchun yordamchi.
  async function dailySeries(days: number) {
    const buckets: {
      day: string;
      visits: number;
      uniques: number;
      orders: number;
      revenue: number;
    }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * dayMs);
      const from = new Date(d.toISOString().slice(0, 10));
      const to = new Date(from.getTime() + dayMs);
      const [v, u, oCreated, oApproved] = await Promise.all([
        prisma.pageView.count({
          where: { createdAt: { gte: from, lt: to }, session: { isAdmin: false } },
        }),
        prisma.visitorSession.count({
          where: { firstSeenAt: { gte: from, lt: to }, isAdmin: false },
        }),
        prisma.order.count({ where: { createdAt: { gte: from, lt: to } } }),
        prisma.order.aggregate({
          _sum: { priceUZS: true },
          where: { approvedAt: { gte: from, lt: to }, status: "APPROVED" },
        }),
      ]);
      buckets.push({
        day: from.toISOString().slice(0, 10),
        visits: v,
        uniques: u,
        orders: oCreated,
        revenue: oApproved._sum.priceUZS ?? 0,
      });
    }
    return buckets;
  }

  // === Parallel yig'iladigan asosiy ma'lumotlar ===
  const [
    // KPI
    todayVisits,
    uniques7d,
    viewsAgg,
    ordersPending,
    ordersApproved,
    ordersRejected,
    commentsPending,
    // Delta uchun oldingi davr
    currVisits,
    prevVisits,
    revenueCurrAgg,
    revenuePrevAgg,
    // Buyurtma davr yig'indisi
    ordersInCurr,
    ordersInPrev,
    // Bugungi daromad
    revenueTodayAgg,
    revenueTotalAgg,
    // Top kontent (buyurtma va daromadi bilan)
    topContents,
    // Media mix (30 kun)
    contentTypes,
    // Qurilma (30 kun)
    devices,
    // Referrers (30 kun)
    referrers,
    // So'nggi harakatlar
    recentOrders,
    recentComments,
    // Faol seans (oxirgi 5 daqiqa)
    liveSessions,
    // Kontent umumiy soni
    contentTotal,
  ] = await Promise.all([
    prisma.visitorSession.count({
      where: { lastSeenAt: { gte: startToday }, isAdmin: false },
    }),
    prisma.visitorSession.count({
      where: { lastSeenAt: { gte: start7 }, isAdmin: false },
    }),
    prisma.content.aggregate({ _sum: { viewsCount: true } }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "APPROVED" } }),
    prisma.order.count({ where: { status: "REJECTED" } }),
    prisma.comment.count({ where: { status: "PENDING" } }),
    prisma.pageView.count({
      where: { createdAt: { gte: startCurr }, session: { isAdmin: false } },
    }),
    prisma.pageView.count({
      where: {
        createdAt: { gte: startPrev, lt: startCurr },
        session: { isAdmin: false },
      },
    }),
    prisma.order.aggregate({
      _sum: { priceUZS: true },
      where: { approvedAt: { gte: startCurr }, status: "APPROVED" },
    }),
    prisma.order.aggregate({
      _sum: { priceUZS: true },
      where: {
        approvedAt: { gte: startPrev, lt: startCurr },
        status: "APPROVED",
      },
    }),
    prisma.order.count({ where: { createdAt: { gte: startCurr } } }),
    prisma.order.count({
      where: { createdAt: { gte: startPrev, lt: startCurr } },
    }),
    prisma.order.aggregate({
      _sum: { priceUZS: true },
      where: { approvedAt: { gte: startToday }, status: "APPROVED" },
    }),
    prisma.order.aggregate({
      _sum: { priceUZS: true },
      where: { status: "APPROVED" },
    }),
    prisma.content.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { viewsCount: "desc" },
      take: 10,
      include: {
        genres: { orderBy: { name: "asc" } },
        location: true,
        _count: { select: { orders: { where: { status: "APPROVED" } } } },
      },
    }),
    prisma.content.groupBy({
      by: ["type"],
      _count: { _all: true },
      where: { status: "PUBLISHED" },
    }),
    prisma.visitorSession.groupBy({
      by: ["device"],
      _count: { _all: true },
      where: { lastSeenAt: { gte: start30 }, isAdmin: false },
    }),
    prisma.visitorSession.groupBy({
      by: ["referrer"],
      _count: { _all: true },
      where: {
        referrer: { not: null },
        isAdmin: false,
        lastSeenAt: { gte: start30 },
      },
      orderBy: { _count: { referrer: "desc" } },
      take: 8,
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { content: { select: { title: true, slug: true, thumbKey: true } } },
    }),
    prisma.comment.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { content: { select: { title: true, slug: true, thumbKey: true } } },
    }),
    prisma.visitorSession.count({
      where: {
        lastSeenAt: { gte: new Date(now.getTime() - 5 * 60 * 1000) },
        isAdmin: false,
      },
    }),
    prisma.content.count({ where: { status: "PUBLISHED" } }),
  ]);

  const series = await dailySeries(range);

  // Konversiya — davr ichida buyurtma / o'ziga xos tashrif (uniques).
  const uniquesInCurr = await prisma.visitorSession.count({
    where: { firstSeenAt: { gte: startCurr }, isAdmin: false },
  });
  const conversionRate =
    uniquesInCurr === 0 ? 0 : Math.round((ordersInCurr / uniquesInCurr) * 10000) / 100;
  const uniquesInPrev = await prisma.visitorSession.count({
    where: { firstSeenAt: { gte: startPrev, lt: startCurr }, isAdmin: false },
  });
  const conversionPrev =
    uniquesInPrev === 0
      ? 0
      : Math.round((ordersInPrev / uniquesInPrev) * 10000) / 100;

  const delta = (curr: number, prev: number) =>
    prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

  const st = storage();
  const totalViews = viewsAgg._sum.viewsCount ?? 0;
  const revenueCurr = revenueCurrAgg._sum.priceUZS ?? 0;
  const revenuePrev = revenuePrevAgg._sum.priceUZS ?? 0;
  const revenueToday = revenueTodayAgg._sum.priceUZS ?? 0;
  const revenueTotal = revenueTotalAgg._sum.priceUZS ?? 0;

  const photoCount = contentTypes.find((c) => c.type === "PHOTO")?._count._all ?? 0;
  const videoCount = contentTypes.find((c) => c.type === "VIDEO")?._count._all ?? 0;
  const storageBytes = await computeStorageUsage();

  return ok({
    // Yuqoridagi KPI kartochkalari
    kpi: {
      revenueCurr,
      revenueToday,
      revenueTotal,
      todayVisits,
      uniques7d,
      totalViews,
      ordersPending,
      ordersApproved,
      ordersRejected,
      ordersInCurr,
      commentsPending,
      conversionRate,
      liveSessions,
      contentTotal,
    },
    // Kartochkalar ostidagi trend foizi
    deltas: {
      visits: delta(currVisits, prevVisits),
      revenue: delta(revenueCurr, revenuePrev),
      orders: delta(ordersInCurr, ordersInPrev),
      conversion: delta(
        Math.round(conversionRate * 100),
        Math.round(conversionPrev * 100),
      ),
    },
    // Grafik uchun kunlik seriya (visits, uniques, orders, revenue)
    series,
    // Top-10 kontent, buyurtma soni va tasdiqlangan daromadi bilan
    topContents: topContents.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      thumbUrl: st.publicUrl(c.thumbKey),
      views: c.viewsCount,
      approvedOrders: c._count.orders,
      priceUZS: c.priceUZS,
      // Chindan olingan pul: har bir buyurtma yaratilgan payta priceUZS ni saqlaydi,
      // shu sabab foyda alohida agregat — bu yerda hozircha soddaga: orders × latest price.
    })),
    // Media aralashmasi (foto vs video) — `bytes` faqat local storage'da to'ldiriladi.
    mediaMix: { photo: photoCount, video: videoCount, bytes: storageBytes },
    // Qurilma taqsimoti
    devices: {
      mobile: devices.find((d) => d.device === "mobile")?._count._all ?? 0,
      desktop: devices.find((d) => d.device === "desktop")?._count._all ?? 0,
    },
    // Manba (referrerlar)
    referrers: referrers.map((r) => ({
      host: r.referrer ?? "",
      count: r._count._all,
    })),
    // So'nggi buyurtmalar
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
      priceUZS: o.priceUZS,
      customerName: o.customerName,
      createdAt: o.createdAt.toISOString(),
      contentTitle: o.content?.title ?? null,
      contentSlug: o.content?.slug ?? null,
      contentThumb: o.content?.thumbKey ? st.publicUrl(o.content.thumbKey) : null,
    })),
    // So'nggi izohlar
    recentComments: recentComments.map((c) => ({
      id: c.id,
      status: c.status,
      name: c.name,
      text: c.text.slice(0, 180),
      createdAt: c.createdAt.toISOString(),
      isAdmin: c.isAdmin,
      contentTitle: c.content?.title ?? null,
      contentSlug: c.content?.slug ?? null,
      contentThumb: c.content?.thumbKey ? st.publicUrl(c.content.thumbKey) : null,
    })),
  });
}
