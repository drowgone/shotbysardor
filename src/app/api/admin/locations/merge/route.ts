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
    const from = await tx.location.findUnique({ where: { id: fromId } });
    if (!from) throw new Error("not_found");
    await tx.content.updateMany({ where: { locationId: fromId }, data: { locationId: toId } });
    await tx.location.update({
      where: { id: toId },
      data: { usageCount: { increment: from.usageCount }, lastUsedAt: new Date() },
    });
    await tx.location.delete({ where: { id: fromId } });
  });

  emit("taxonomy", { action: "location.merge", meta: { fromId, toId } });
  emit("contents", { action: "location.merge" });
  return ok({ ok: true });
}
