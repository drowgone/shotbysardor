import { NextRequest } from "next/server";
import { apiError, ok, requireAdmin, checkCsrf } from "@/lib/api";
import { getAllSettings, setSetting, defaultSettings, type SettingsMap } from "@/lib/settings";
import { emit } from "@/lib/live/bus";

export async function GET() {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  const all = await getAllSettings();
  // Parol hashini yubormaymiz
  const safe = { ...all } as Partial<typeof all>;
  delete safe["admin.passwordHash"];
  return ok({ settings: safe });
}

export async function PUT(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");
  const body = (await req.json()) as Partial<SettingsMap>;
  // Umumiy settings PUT quyidagi kalitlarga tegmasin. Bu kalitlar tegishli maxsus
  // endpoint'lar orqali (credentials, telegram, portrait) bir yuridagi validatsiya
  // bilan yangilanadi. Umumiy PUT'ga ochib qo'yish arbitrar storage o'chirilishi yoki
  // bot token'ining mass-assignment orqali almashinishiga sabab bo'ladi.
  const protectedKeys = new Set<keyof SettingsMap>([
    "admin.passwordHash",
    "admin.username",
    "admin.credentialsUpdatedAt",
    "admin.sessionVersion",
    "site.aboutPortraitKey",
    "order.telegram",
  ]);
  const changed: string[] = [];
  for (const key of Object.keys(body) as (keyof SettingsMap)[]) {
    if (protectedKeys.has(key)) continue;
    if (!(key in defaultSettings)) continue;
    await setSetting(key, body[key] as never);
    changed.push(key);
  }
  if (changed.length > 0) emit("settings", { action: "update", meta: { keys: changed } });
  return ok({ ok: true });
}
