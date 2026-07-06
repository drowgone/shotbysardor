import { NextRequest, NextResponse } from "next/server";
import { clientIp, ok } from "@/lib/api";
import { getAdminSession } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { recordAdminAction } from "@/lib/audit";
import { revokeSessionRecord } from "@/lib/admin-session-record";
import { sha256 } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function logLogout(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (session.loggedIn) {
      const [ipHash, username] = await Promise.all([
        sha256(clientIp(req)).then((h) => h.slice(0, 24)),
        getSetting("admin.username").catch(() => "admin"),
      ]);
      void recordAdminAction({
        actor: (username || "admin").toString(),
        ipHash,
        action: "logout",
        target: session.sid ?? null,
      });
      if (session.sid) {
        void revokeSessionRecord(session.sid, "self");
      }
    }
  } catch {
    // ignore
  }
}

export async function POST(req: NextRequest) {
  await logLogout(req);
  const session = await getAdminSession();
  await session.destroy();
  return ok({ ok: true });
}

// Eskirgan sessiyani tozalash uchun (layout/page cookie yoza olmaydi).
export async function GET(req: NextRequest) {
  await logLogout(req);
  const session = await getAdminSession();
  await session.destroy();
  return NextResponse.redirect(new URL("/admin", req.url));
}
