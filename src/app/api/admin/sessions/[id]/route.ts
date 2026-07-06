import { NextRequest } from "next/server";
import { apiError, checkCsrf, clientIp, ok, requireAdmin } from "@/lib/api";
import { getSetting } from "@/lib/settings";
import {
  getMasterSessionId,
  revokeSessionRecord,
} from "@/lib/admin-session-record";
import { recordAdminAction } from "@/lib/audit";
import { sha256 } from "@/lib/utils";
import { emit } from "@/lib/live/bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// DELETE /api/admin/sessions/[id] — boshqa seansni bekor qilish.
// Xavfsizlik qoidasi: faqat "master" seansdan (eng qadimgi faol seans) ruxsat.
// Master seansning o'zini ushbu endpoint orqali bekor qilib bo'lmaydi — u faqat
// logout tugmasi orqali chiqadi. Bu qoida hujumchi bir yangi seans yaratib
// darhol master'ni chiqara olmasligi uchun.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");

  const { id } = await params;
  if (!id || id.length > 64) return apiError(400, "bad_id", "Noto'g'ri ID");

  const username = ((await getSetting("admin.username").catch(() => "admin")) || "admin").toLowerCase();
  const masterId = await getMasterSessionId(username);

  // Faqat master seansdan ushbu endpoint ishlashi mumkin.
  if (!s.sid || s.sid !== masterId) {
    return apiError(
      403,
      "not_master",
      "Faqat eng qadimgi faol seansdan boshqa seanslarni chiqarish mumkin",
    );
  }
  // Master o'zini o'zi bu yerda chiqara olmaydi.
  if (id === s.sid) {
    return apiError(
      400,
      "cannot_revoke_self",
      "Joriy seansdan chiqish uchun \"Chiqish\" tugmasidan foydalaning",
    );
  }

  const result = await revokeSessionRecord(id, s.sid);
  if (!result.ok) return apiError(404, "not_found", "Seans topilmadi yoki allaqachon bekor qilingan");

  const ipHash = (await sha256(clientIp(req))).slice(0, 24);
  void recordAdminAction({
    actor: username,
    ipHash,
    action: "session.revoke",
    target: id,
    meta: { revokedBy: s.sid },
  });

  emit("admin", { action: "session.revoke", id });
  return ok({ ok: true });
}
