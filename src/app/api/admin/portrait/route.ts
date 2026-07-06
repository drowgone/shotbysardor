import { NextRequest } from "next/server";
import sharp from "sharp";
import { apiError, ok, requireAdmin, checkCsrf } from "@/lib/api";
import { getSetting, setSetting } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { randomId } from "@/lib/utils";
import { emit } from "@/lib/live/bus";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/admin/portrait — About sahifasi uchun portret rasm yuklash.
// Sharp orqali kichraytiriladi, jpg formatga o'giriladi, "site.aboutPortraitKey" ga yoziladi.
// Oldingi portret bo'lsa — o'chiriladi.
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return apiError(401, "unauthorized", "Kirish talab qilinadi");
  if (!checkCsrf(req, session.csrf)) return apiError(403, "csrf", "CSRF token noto'g'ri");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return apiError(400, "no_file", "Fayl yuklanmagan");
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 20 * 1024 * 1024) return apiError(400, "too_large", "20MB dan katta");

  // Image bomb himoyasi — dekompressiya oldidan piksel sonini tekshiramiz.
  // Kichraytirilgan (compressed) fayl kichik bo'lishi mumkin, ammo dekompressiya
  // qilinganda gigabaytlarcha RAM egallashi mumkin (10000×10000 = 400MB RGBA).
  let meta;
  try {
    meta = await sharp(buf, { failOn: "none" }).metadata();
  } catch {
    return apiError(400, "invalid_image", "Rasm noto'g'ri");
  }
  const pixels = (meta.width ?? 0) * (meta.height ?? 0);
  const MAX_PIXELS = 40_000_000; // ~40MP — professional kameralar ham shu chegarada
  if (pixels === 0 || pixels > MAX_PIXELS) {
    return apiError(400, "too_large", "Rasm juda katta yoki noto'g'ri");
  }

  // 1200x1600 max — portret 3:4 aspect uchun etarli
  const processed = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ width: 1200, height: 1600, fit: "cover", position: "attention" })
    .jpeg({ quality: 88, progressive: true, mozjpeg: true })
    .toBuffer();

  const key = `portrait/${randomId(8)}.jpg`;
  await storage().putBuffer("public", key, processed, "image/jpeg");

  // Eski portretni o'chirish
  const oldKey = await getSetting("site.aboutPortraitKey");
  if (oldKey && oldKey !== key) {
    await storage().delete("public", oldKey).catch(() => {});
  }
  await setSetting("site.aboutPortraitKey", key);

  emit("settings", { action: "portrait.set", meta: { key } });
  return ok({ key, url: storage().publicUrl(key) });
}

// DELETE /api/admin/portrait — Portretni o'chirish
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return apiError(401, "unauthorized", "Kirish talab qilinadi");
  if (!checkCsrf(req, session.csrf)) return apiError(403, "csrf", "CSRF token noto'g'ri");

  const key = await getSetting("site.aboutPortraitKey");
  if (key) {
    await storage().delete("public", key).catch(() => {});
    await setSetting("site.aboutPortraitKey", null);
  }
  emit("settings", { action: "portrait.delete" });
  return ok({ ok: true });
}
