import { NextRequest } from "next/server";
import { apiError, ok, requireAdmin, checkCsrf } from "@/lib/api";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/live/bus";

export async function PATCH(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");
  const { fromId, toId } = (await req.json()) as { fromId: string; toId: string };
  if (!fromId || !toId || fromId === toId) return apiError(400, "invalid", "Noto'g'ri");

  await prisma.$transaction(async (tx) => {
    // M2M: `from` janriga ulangan har bir kontent uchun `from`ni uzib `to`ni ulaymiz.
    // Kontent ikkalasiga ham bog'langan bo'lsa — `connect` dublikatlarni jimgina o'tkazib yuboradi.
    const linked = await tx.content.findMany({
      where: { genres: { some: { id: fromId } } },
      select: { id: true },
    });
    for (const c of linked) {
      await tx.content.update({
        where: { id: c.id },
        data: { genres: { disconnect: [{ id: fromId }], connect: [{ id: toId }] } },
      });
    }
    await tx.genre.delete({ where: { id: fromId } });
  });
  emit("taxonomy", { action: "genre.merge", meta: { fromId, toId } });
  emit("contents", { action: "genre.merge" });
  return ok({ ok: true });
}
