import { prisma } from "./db";

// Login urinishini yozib qo'yish. DB xatosi asosiy jarayonni to'xtatmasin —
// audit muvaffaqiyatsizligi login javobini rad etmaydi.
export async function recordLoginAttempt(input: {
  username: string;
  ipHash: string;
  userAgent: string | null;
  success: boolean;
  reason: string;
}): Promise<void> {
  try {
    await prisma.adminLoginAttempt.create({
      data: {
        username: input.username.slice(0, 64),
        ipHash: input.ipHash.slice(0, 64),
        userAgent: input.userAgent ? input.userAgent.slice(0, 256) : null,
        success: input.success,
        reason: input.reason.slice(0, 32),
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] recordLoginAttempt failed:", err);
  }
}

// Admin harakatini audit log'ga yozish. Xato bo'lsa ham asosiy oqim davom etadi.
export async function recordAdminAction(input: {
  actor: string;
  ipHash?: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actor: input.actor.slice(0, 64),
        ipHash: input.ipHash ? input.ipHash.slice(0, 64) : null,
        action: input.action.slice(0, 64),
        target: input.target ? input.target.slice(0, 128) : null,
        meta: (input.meta ?? undefined) as never,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] recordAdminAction failed:", err);
  }
}

// Eski yozuvlarni tozalash — cron/planlangan vazifa uchun. Standart 90 kun.
export async function pruneAuditLogs(retentionDays = 90): Promise<{
  deletedAttempts: number;
  deletedActions: number;
  deletedSessions: number;
}> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const [a, b, c] = await Promise.all([
    prisma.adminLoginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.adminAuditLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    // Bekor qilingan seanslarni ham tozalaymiz (faollari qolaveradi).
    prisma.adminSessionRecord.deleteMany({
      where: { revokedAt: { lt: cutoff, not: null } },
    }),
  ]);
  return { deletedAttempts: a.count, deletedActions: b.count, deletedSessions: c.count };
}
