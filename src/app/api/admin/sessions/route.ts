import { apiError, ok, requireAdmin } from "@/lib/api";
import { getSetting } from "@/lib/settings";
import { listActiveSessions, getMasterSessionId } from "@/lib/admin-session-record";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ISO 3166-1 alpha-2 kodini o'zbekcha davlat nomiga aylantiradi. Aylantirib bo'lmasa —
// kodning o'zi qaytadi (masalan, kod noto'g'ri bo'lsa yoki Intl ma'lumoti yo'q bo'lsa).
const countryNames = (() => {
  try {
    return new Intl.DisplayNames(["uz"], { type: "region" });
  } catch {
    return null;
  }
})();
function countryLabel(code: string | null): string | null {
  if (!code) return null;
  const c = code.toUpperCase().slice(0, 2);
  if (!/^[A-Z]{2}$/.test(c)) return code;
  try {
    return countryNames?.of(c) ?? code;
  } catch {
    return code;
  }
}

// GET /api/admin/sessions — joriy admin'ning barcha faol seans'lari.
export async function GET() {
  try {
    const s = await requireAdmin();
    if (!s) return apiError(401, "unauthorized", "Kirish");

    const username = ((await getSetting("admin.username").catch(() => "admin")) || "admin").toLowerCase();
    const [rows, masterId] = await Promise.all([
      listActiveSessions(username),
      getMasterSessionId(username),
    ]);

    return ok({
      currentSid: s.sid ?? null,
      masterId,
      // Faqat joriy seans master bo'lsa boshqalarni chiqara oladi.
      canRevoke: !!s.sid && s.sid === masterId,
      sessions: rows.map((r) => ({
        id: r.id,
        deviceLabel: r.deviceLabel,
        ipDisplay: r.ipDisplay,
        country: countryLabel(r.country),
        city: r.city,
        createdAt: r.createdAt.toISOString(),
        lastSeenAt: r.lastSeenAt.toISOString(),
        isCurrent: r.id === s.sid,
        isMaster: r.id === masterId,
      })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[api/admin/sessions] GET failed:", err);
    const msg = err instanceof Error ? err.message : "Ichki xato";
    return apiError(500, "internal", msg);
  }
}
