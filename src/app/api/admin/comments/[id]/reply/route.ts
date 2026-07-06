import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, ok, requireAdmin, checkCsrf, zodErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/live/bus";

const schema = z.object({ text: z.string().min(1).max(1000) });

const ADMIN_NAME = "Muallif";

// Admin izohga javob qoldiradi — nested reply, isAdmin=true, avtomatik APPROVED.
// Ota-izoh kontent yoki sahifa izohi bo'lishi mumkin — javob shu hujjatga biriktiriladi.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(400, "validation", zodErrorMessage(parsed.error));

  const parent = await prisma.comment.findUnique({
    where: { id },
    select: {
      id: true,
      contentId: true,
      page: true,
      parentId: true,
      content: { select: { slug: true } },
    },
  });
  if (!parent) return apiError(404, "not_found", "Izoh topilmadi");
  // Ichma-ich replies bo'lmasin — replyga ham reply qilinsa top-level parent'ga biriktiramiz
  const rootParentId = parent.parentId ?? parent.id;

  const created = await prisma.comment.create({
    data: {
      contentId: parent.contentId,
      page: parent.page,
      parentId: rootParentId,
      name: ADMIN_NAME,
      text: parsed.data.text.trim(),
      status: "APPROVED",
      isAdmin: true,
    },
  });

  emit("comments", {
    action: "reply",
    id: created.id,
    slug: parent.content?.slug ?? undefined,
    meta: parent.page ? { page: parent.page } : undefined,
  });
  if (parent.content?.slug) {
    emit(`comments:${parent.content.slug}`, { action: "reply", id: created.id });
  }
  if (parent.page) {
    emit(`comments:page:${parent.page}`, { action: "reply", id: created.id });
  }

  return ok({
    item: {
      id: created.id,
      name: created.name,
      text: created.text,
      createdAt: created.createdAt.toISOString(),
      status: created.status,
      isAdmin: true,
      parentId: rootParentId,
      likesCount: 0,
    },
  });
}
