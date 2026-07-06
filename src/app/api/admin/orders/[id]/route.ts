import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, ok, requireAdmin, checkCsrf } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { emit } from "@/lib/live/bus";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().min(1).max(500) }),
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(400, "validation", "Ma'lumot noto'g'ri");

  if (parsed.data.action === "approve") {
    const ttl = await getSetting("order.linkTtlHours");
    const max = await getSetting("order.maxDownloads");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 60 * 60 * 1000);
    const o = await prisma.order.update({
      where: { id },
      data: { status: "APPROVED", approvedAt: now, expiresAt, maxDownloads: max, rejectReason: null },
    });
    emit("orders", { action: "approve", id: o.id, token: o.token });
    emit(`orders:${o.token}`, { action: "approve", id: o.id });
    emit("stats", { action: "orders.approve" });
    return ok({ item: { id: o.id, token: o.token } });
  }

  const o = await prisma.order.update({
    where: { id },
    data: { status: "REJECTED", rejectReason: parsed.data.reason },
  });
  emit("orders", { action: "reject", id: o.id, token: o.token });
  emit(`orders:${o.token}`, { action: "reject", id: o.id });
  emit("stats", { action: "orders.reject" });
  return ok({ item: { id: o.id } });
}
