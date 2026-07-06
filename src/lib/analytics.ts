import { prisma } from "./db";
import { isMobileUA, externalReferrerHost } from "./utils";
import { getSetting } from "./settings";

const botRe = /bot|crawler|spider|robot|preview|slack|discord|facebook|twitter|whatsapp/i;

// PageView yozish — sid mavjud bo'lsa, admin bo'lmasa, bot bo'lmasa.
export async function recordPageView(opts: {
  sid: string;
  path: string;
  ua: string;
  referrer: string | null;
  host: string;
  isAdminSession: boolean;
}) {
  if (!opts.sid) return;
  if (botRe.test(opts.ua)) return;
  if (opts.path.startsWith("/admin") || opts.path.startsWith("/api") || opts.path.startsWith("/order")) return;

  const excludeAdmin = await getSetting("analytics.excludeAdmin");
  if (excludeAdmin && opts.isAdminSession) return;

  const device = isMobileUA(opts.ua) ? "mobile" : "desktop";
  const refHost = externalReferrerHost(opts.referrer, opts.host);

  await prisma.visitorSession.upsert({
    where: { id: opts.sid },
    create: {
      id: opts.sid,
      device,
      referrer: refHost,
      isAdmin: opts.isAdminSession,
    },
    update: {
      lastSeenAt: new Date(),
      isAdmin: opts.isAdminSession ? true : undefined,
    },
  });
  await prisma.pageView.create({
    data: { sessionId: opts.sid, path: opts.path },
  });
}

export async function pruneOldAnalytics() {
  const days = await getSetting("analytics.retentionDays");
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  await prisma.pageView.deleteMany({ where: { createdAt: { lt: cutoff } } });
  await prisma.contentView.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
