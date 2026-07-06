import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, ok, requireAdmin, checkCsrf } from "@/lib/api";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { emit } from "@/lib/live/bus";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), ids: z.array(z.string().min(1).max(64)).min(1).max(500) }),
  z.object({ action: z.literal("setStatus"), ids: z.array(z.string().min(1).max(64)).min(1).max(500), status: z.enum(["PUBLISHED", "DRAFT"]) }),
  // setGenres — belgilangan janrlar ro'yxatini kontentlarning janr to'plamiga
  // to'liq almashtiradi (eski aloqalar o'chib, yangisi qo'yiladi).
  z.object({
    action: z.literal("setGenres"),
    ids: z.array(z.string().min(1).max(64)).min(1).max(500),
    genreIds: z.array(z.string().min(1).max(64)).min(1).max(20),
  }),
]);

export async function POST(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(400, "validation", "Ma'lumot noto'g'ri");

  if (parsed.data.action === "delete") {
    const contents = await prisma.content.findMany({
      where: { id: { in: parsed.data.ids } },
      select: { id: true, originalKey: true, previewKey: true, heroKey: true, thumbKey: true, posterKey: true },
    });
    const st = storage();
    // Fayllarni o'chirish (parallel)
    await Promise.all(
      contents.flatMap((c) => [
        st.delete("private", c.originalKey).catch(() => {}),
        st.delete("public", c.previewKey).catch(() => {}),
        st.delete("public", c.thumbKey).catch(() => {}),
        c.heroKey ? st.delete("public", c.heroKey).catch(() => {}) : Promise.resolve(),
        c.posterKey ? st.delete("public", c.posterKey).catch(() => {}) : Promise.resolve(),
      ]),
    );
    try {
      // Orderlarni oldin o'chiramiz (schema cascade bo'lmasa ham ishlashi uchun defensive)
      const result = await prisma.$transaction(async (tx) => {
        await tx.order.deleteMany({ where: { contentId: { in: parsed.data.ids } } });
        return tx.content.deleteMany({ where: { id: { in: parsed.data.ids } } });
      });
      emit("contents", { action: "bulk.delete", meta: { count: result.count } });
      emit("stats", { action: "content.delete" });
      return ok({ deleted: result.count });
    } catch (e) {
      console.error("[admin/contents/bulk delete]", e);
      return apiError(500, "delete_failed", "O'chirishda xatolik — bog'liq yozuvlar bo'lishi mumkin");
    }
  }

  if (parsed.data.action === "setStatus") {
    const result = await prisma.content.updateMany({
      where: { id: { in: parsed.data.ids } },
      data: { status: parsed.data.status },
    });
    emit("contents", { action: "bulk.setStatus", meta: { count: result.count, status: parsed.data.status } });
    return ok({ updated: result.count });
  }

  if (parsed.data.action === "setGenres") {
    // M2M — `updateMany` nested relation'ni qo'llab-quvvatlamaydi.
    // Har bir content'ni alohida update qilamiz (transaction ichida).
    const connect = parsed.data.genreIds.map((id) => ({ id }));
    await prisma.$transaction(
      parsed.data.ids.map((id) =>
        prisma.content.update({
          where: { id },
          data: { genres: { set: connect } },
        }),
      ),
    );
    emit("contents", { action: "bulk.setGenres", meta: { count: parsed.data.ids.length } });
    return ok({ updated: parsed.data.ids.length });
  }

  return apiError(400, "bad_action", "Noma'lum amal");
}
