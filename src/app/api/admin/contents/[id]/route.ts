import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, ok, requireAdmin, checkCsrf, clientIp, zodErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { recordAdminAction } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import { sha256 } from "@/lib/utils";
import { emit } from "@/lib/live/bus";

const patch = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  // Bir kontent bir nechta janrga ulanadi — array bilan set qilamiz.
  genreIds: z.array(z.string().min(1).max(64)).min(1).max(20).optional(),
  locationId: z.string().min(1).max(64).optional(),
  capturedAt: z.string().max(64).optional(),
  priceUZS: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  featured: z.boolean().optional(),
  status: z.enum(["PUBLISHED", "DRAFT"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patch.safeParse(body);
  if (!parsed.success) return apiError(400, "validation", zodErrorMessage(parsed.error));
  const { genreIds, ...rest } = parsed.data;
  const data = { ...rest } as Record<string, unknown>;
  if (typeof parsed.data.capturedAt === "string") data.capturedAt = new Date(parsed.data.capturedAt);
  // Janrlar — set bilan almashtiramiz (mavjud aloqalarni tashlab yangisini qo'yamiz).
  if (genreIds) {
    data.genres = { set: genreIds.map((gid) => ({ id: gid })) };
  }
  const updated = await prisma.content.update({ where: { id }, data });
  emit("contents", { action: "update", id: updated.id, slug: updated.slug });
  emit(`contents:${updated.slug}`, { action: "update", id: updated.id, slug: updated.slug });
  return ok({ id: updated.id });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");
  const { id } = await params;
  const c = await prisma.content.findUnique({ where: { id } });
  if (!c) return apiError(404, "not_found", "Topilmadi");
  const st = storage();
  await Promise.all([
    st.delete("private", c.originalKey).catch(() => {}),
    st.delete("public", c.previewKey).catch(() => {}),
    st.delete("public", c.thumbKey).catch(() => {}),
    c.heroKey ? st.delete("public", c.heroKey).catch(() => {}) : Promise.resolve(),
    c.posterKey ? st.delete("public", c.posterKey).catch(() => {}) : Promise.resolve(),
  ]);
  try {
    // Orderlarni oldin o'chiramiz (schema cascade bo'lmasa ham ishlashi uchun defensive)
    await prisma.$transaction(async (tx) => {
      await tx.order.deleteMany({ where: { contentId: id } });
      await tx.content.delete({ where: { id } });
    });
  } catch (e) {
    console.error("[admin/contents/delete]", e);
    return apiError(500, "delete_failed", "O'chirishda xatolik — bog'liq yozuvlar bo'lishi mumkin");
  }

  const [actor, ipHash] = await Promise.all([
    getSetting("admin.username").catch(() => "admin"),
    sha256(clientIp(req)).then((h) => h.slice(0, 24)),
  ]);
  void recordAdminAction({
    actor: (actor || "admin").toString(),
    ipHash,
    action: "content.delete",
    target: id,
    meta: { slug: c.slug, title: c.title },
  });

  emit("contents", { action: "delete", id, slug: c.slug });
  emit(`contents:${c.slug}`, { action: "delete", id, slug: c.slug });
  emit("stats", { action: "content.delete" });

  return ok({ ok: true });
}
