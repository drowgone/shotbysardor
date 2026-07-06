import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { apiError, ok, clientIp } from "@/lib/api";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { emit } from "@/lib/live/bus";

// Like toggle — bitta sessiya bitta izohga bir marta. Ikkinchi so'rov unlike qiladi.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const jar = await cookies();
  const sid = jar.get("sid")?.value;
  if (!sid) return apiError(400, "no_session", "Sessiya topilmadi");

  const ip = clientIp(req);
  const rl = rateLimit(`like:${sid}:${ip}`, 20, 60_000);
  if (!rl.ok) return apiError(429, "rate_limit", "Iltimos, biroz kutib turing.");

  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!comment || comment.status !== "APPROVED") return apiError(404, "not_found", "Izoh topilmadi");

  const existing = await prisma.commentLike.findUnique({
    where: { commentId_sessionId: { commentId: id, sessionId: sid } },
    select: { id: true },
  });

  if (existing) {
    // Unlike
    const updated = await prisma.$transaction(async (tx) => {
      await tx.commentLike.delete({ where: { id: existing.id } });
      return tx.comment.update({
        where: { id },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });
    });
    emit(`comments:${slug}`, { action: "unlike", id });
    return ok({ liked: false, likesCount: Math.max(0, updated.likesCount) });
  }

  // Like
  const updated = await prisma.$transaction(async (tx) => {
    await tx.commentLike.create({ data: { commentId: id, sessionId: sid } });
    return tx.comment.update({
      where: { id },
      data: { likesCount: { increment: 1 } },
      select: { likesCount: true },
    });
  });
  emit(`comments:${slug}`, { action: "like", id });
  return ok({ liked: true, likesCount: updated.likesCount });
}
