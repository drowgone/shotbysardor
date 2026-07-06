import { NextRequest } from "next/server";
import { apiError, ok, requireAdmin, checkCsrf } from "@/lib/api";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/live/bus";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");
  const { id } = await params;
  // M2M: shu janrga ulangan kontentlar borligini tekshiramiz.
  const count = await prisma.content.count({ where: { genres: { some: { id } } } });
  if (count > 0) return apiError(409, "in_use", `Bu janrga ${count} ta kontent bog'langan. Avval birlashtiring.`);
  await prisma.genre.delete({ where: { id } });
  emit("taxonomy", { action: "genre.delete", id });
  return ok({ ok: true });
}
