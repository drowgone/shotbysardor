import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { apiError, ok, clientIp, zodErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";
import { sha256 } from "@/lib/utils";
import { emit } from "@/lib/live/bus";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const ip = clientIp(req);
  const rl = await rateLimit(`comments:get:${ip}`, 60, 60_000);
  if (!rl.ok) return apiError(429, "rate_limit", "Juda ko'p so'rov");
  const { slug } = await params;
  const cursor = req.nextUrl.searchParams.get("cursor");
  const content = await prisma.content.findUnique({ where: { slug }, select: { id: true } });
  if (!content) return apiError(404, "not_found", "Topilmadi");
  const jar = await cookies();
  const sid = jar.get("sid")?.value ?? "";

  const limit = 20;
  // Faqat top-level izohlar (parentId=null), replies alohida include qilinadi.
  // Replies uchun ham chegara (100) — bir thread ostidagi javoblar chegarasiz bo'lsa
  // hujumchi thread'ni to'ldirib katta payload orqali DoS qilishi mumkin.
  const items = await prisma.comment.findMany({
    where: { contentId: content.id, status: "APPROVED", parentId: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      replies: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  });
  const hasNext = items.length > limit;
  const list = hasNext ? items.slice(0, limit) : items;

  // Foydalanuvchi like bosgan izohlar (top-level + replies)
  const allIds = list.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)]);
  const likedRows = sid && allIds.length > 0
    ? await prisma.commentLike.findMany({
        where: { sessionId: sid, commentId: { in: allIds } },
        select: { commentId: true },
      })
    : [];
  const likedSet = new Set(likedRows.map((r) => r.commentId));

  const shape = (c: {
    id: string;
    name: string;
    text: string;
    createdAt: Date;
    isAdmin: boolean;
    likesCount: number;
  }) => ({
    id: c.id,
    name: c.name,
    text: c.text,
    createdAt: c.createdAt.toISOString(),
    isAdmin: c.isAdmin,
    likesCount: c.likesCount,
    likedByMe: likedSet.has(c.id),
  });

  return ok({
    items: list.map((c) => ({
      ...shape(c),
      replies: c.replies.map(shape),
    })),
    nextCursor: hasNext ? list[list.length - 1].id : null,
  });
}

const schema = z.object({
  name: z.string().min(1),
  text: z.string().min(1).max(1000),
  website: z.string().max(0).optional(), // honeypot
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const jar = await cookies();
  const sid = jar.get("sid")?.value ?? "unknown";
  const ip = clientIp(req);
  const key = `comment:${sid}:${ip}`;
  const rl = await rateLimit(key, 1, 30_000);
  if (!rl.ok) return apiError(429, "rate_limit", "Iltimos, biroz kutib turing.");

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(400, "validation", zodErrorMessage(parsed.error));

  // Honeypot
  if (parsed.data.website && parsed.data.website.length > 0) {
    return ok({ ok: true }); // silent success
  }

  const content = await prisma.content.findUnique({ where: { slug }, select: { id: true } });
  if (!content) return apiError(404, "not_found", "Topilmadi");

  const nameMax = await getSetting("comments.nameMaxLen");
  if (parsed.data.name.length > nameMax) return apiError(400, "name_too_long", `Ism ${nameMax} belgidan uzun`);

  const banned = await getSetting("comments.bannedWords");
  const t = parsed.data.text.toLowerCase();
  for (const w of banned) {
    if (w && t.includes(w.toLowerCase())) {
      return apiError(400, "banned_word", "Izohda ruxsat etilmagan so'z bor");
    }
  }

  const moderation = await getSetting("comments.moderation");
  const status = moderation ? "PENDING" : "APPROVED";
  const ipHash = await sha256(ip + ":" + (process.env.SESSION_SECRET ?? ""));

  const created = await prisma.comment.create({
    data: {
      contentId: content.id,
      name: parsed.data.name.trim(),
      text: parsed.data.text.trim(),
      status,
      ipHash,
    },
  });

  // Public tomon — moderatsiya bo'lsa, izoh yashiringan holda kelaydi va shu slug
// tinglovchilariga signal beriladi (tasdiqlanganini tekshirish uchun refetch).
  emit("comments", { action: "create", id: created.id, slug });
  emit(`comments:${slug}`, { action: "create", id: created.id });

  return ok({
    item: {
      id: created.id,
      name: created.name,
      text: created.text,
      createdAt: created.createdAt.toISOString(),
      status,
    },
    pending: moderation,
  });
}
