import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { apiError, ok } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const jar = await cookies();
  const sid = jar.get("sid")?.value;
  if (!sid) return apiError(400, "no_sid", "Sessiya yo'q");

  const content = await prisma.content.findUnique({ where: { slug }, select: { id: true } });
  if (!content) return apiError(404, "not_found", "Topilmadi");

  // Avval mavjudmi tekshiramiz — @@unique() ni ushlab log yozmaslik uchun.
  const already = await prisma.contentView.findUnique({
    where: { sessionId_contentId: { sessionId: sid, contentId: content.id } },
    select: { id: true },
  });
  if (already) return ok({ ok: true, counted: false });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.contentView.create({
        data: { sessionId: sid, contentId: content.id },
      });
      await tx.content.update({
        where: { id: content.id },
        data: { viewsCount: { increment: 1 } },
      });
    });
  } catch {
    // Bir vaqtda 2 chaqiruv bo'lsa race — jimjimador o'tkazamiz
  }

  return ok({ ok: true, counted: true });
}
