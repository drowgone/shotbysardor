import { NextRequest } from "next/server";
import { apiError, ok, requireAdmin, checkCsrf } from "@/lib/api";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/live/bus";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");
  const { id } = await params;
  const count = await prisma.content.count({ where: { locationId: id } });
  if (count > 0) return apiError(409, "in_use", `Bu joylashuvga ${count} ta kontent bog'langan. Avval birlashtiring.`);
  await prisma.location.delete({ where: { id } });
  emit("taxonomy", { action: "location.delete", id });
  return ok({ ok: true });
}
