import { NextRequest } from "next/server";
import { apiError, ok, requireAdmin, checkCsrf } from "@/lib/api";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { emit } from "@/lib/live/bus";

// Izoh qaysi kontent/sahifaga tegishli ekanini aniqlaymiz — ikkalasi ham bo'lishi mumkin
// bo'lmagan hollar uchun tayyor emit'lar chiqaramiz.
async function getContext(
  commentId: string,
): Promise<{ slug: string | null; page: string | null; imageKey: string | null }> {
  const row = await prisma.comment
    .findUnique({
      where: { id: commentId },
      select: {
        page: true,
        imageKey: true,
        content: { select: { slug: true } },
      },
    })
    .catch(() => null);
  return {
    slug: row?.content?.slug ?? null,
    page: row?.page ?? null,
    imageKey: row?.imageKey ?? null,
  };
}

function emitAll(action: string, id: string, ctx: { slug: string | null; page: string | null }) {
  emit("comments", {
    action,
    id,
    slug: ctx.slug ?? undefined,
    meta: ctx.page ? { page: ctx.page } : undefined,
  });
  if (ctx.slug) emit(`comments:${ctx.slug}`, { action, id });
  if (ctx.page) emit(`comments:page:${ctx.page}`, { action, id });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");
  const { id } = await params;
  const body = (await req.json()) as { action?: "approve" };
  if (body.action !== "approve") return apiError(400, "invalid", "Noto'g'ri");
  const ctx = await getContext(id);
  await prisma.comment.update({ where: { id }, data: { status: "APPROVED" } });
  emitAll("approve", id, ctx);
  return ok({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");
  const { id } = await params;
  const ctx = await getContext(id);
  // Izoh bilan birga rasm ham o'chiriladi (storage'da yetim qolmasin).
  if (ctx.imageKey) {
    await storage().delete("public", ctx.imageKey).catch(() => {});
  }
  await prisma.comment.delete({ where: { id } });
  emitAll("delete", id, ctx);
  return ok({ ok: true });
}
