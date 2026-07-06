import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, ok, requireAdmin, checkCsrf, zodErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { detectMime, isPhoto, isVideo, processPhoto, processVideo } from "@/lib/media";
import { randomId, slugify, shortSuffix, normalizeName } from "@/lib/utils";

// Katta fayllar uchun body limit — Next 15da har route sozlanadi
export const runtime = "nodejs";
export const maxDuration = 300;

// Har bir fayl uchun yakuniy metadata (client tomonida individual + umumiy birlashtirilgan)
const itemSchema = z.object({
  title: z.string().min(1),
  // Janr — union natijasi. Sxema hozircha single-relation, shu sabab birinchi ID primary sifatida saqlanadi.
  genreIds: z.array(z.string().min(1)).min(1),
  locationName: z.string().min(1),
  capturedAt: z.string().optional(),
  priceUZS: z.number().int().min(0).nullable().optional(),
  featured: z.boolean().optional(),
  status: z.enum(["PUBLISHED", "DRAFT"]).optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return apiError(401, "unauthorized", "Kirish talab qilinadi");
  if (!checkCsrf(req, session.csrf)) return apiError(403, "csrf", "CSRF token noto'g'ri");

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return apiError(400, "no_files", "Fayl yuklanmagan");

  const itemsJson = form.get("items");
  if (!itemsJson || typeof itemsJson !== "string") {
    return apiError(400, "no_items", "Metadata yuborilmagan");
  }
  let itemsParsed: unknown;
  try {
    itemsParsed = JSON.parse(itemsJson);
  } catch {
    return apiError(400, "invalid_items", "Metadata JSON noto'g'ri");
  }
  const itemsResult = z.array(itemSchema).safeParse(itemsParsed);
  if (!itemsResult.success) return apiError(400, "validation", zodErrorMessage(itemsResult.error));
  const items = itemsResult.data;

  if (items.length !== files.length) {
    return apiError(400, "items_mismatch", "Fayllar va metadata soni mos kelmadi");
  }

  const previewMax = await getSetting("content.previewMaxEdge");
  const maxPhotoMB = Number(process.env.MAX_PHOTO_MB ?? 60);
  const maxVideoMB = Number(process.env.MAX_VIDEO_MB ?? 2048);

  // Joylashuvlar cache — bir necha fayl bir xil joylashuvni ishlatsa, bir marta upsert qilamiz
  const locationCache = new Map<string, { id: string }>();
  async function getLocation(name: string) {
    const trimmed = name.trim();
    const cached = locationCache.get(trimmed);
    if (cached) return cached;
    const loc = await upsertLocation(trimmed);
    locationCache.set(trimmed, loc);
    return loc;
  }

  const results: { id: string; slug: string; title: string }[] = [];
  const failures: { name: string; message: string }[] = [];
  // Joylashuv → muvaffaqiyatli yuklanish soni
  const locationUsage = new Map<string, number>();

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const meta = items[i];
    const title = meta.title.trim() || f.name.replace(/\.[^.]+$/, "");
    try {
      const buf = Buffer.from(await f.arrayBuffer());
      const mime = detectMime(buf);
      const location = await getLocation(meta.locationName);
      const genresConnect = meta.genreIds.map((id) => ({ id }));
      const capturedAt = meta.capturedAt ? new Date(meta.capturedAt) : null;

      if (isPhoto(mime)) {
        if (buf.byteLength > maxPhotoMB * 1024 * 1024) {
          throw new Error(`${maxPhotoMB}MB dan katta`);
        }
        const p = await processPhoto(buf, { previewMaxEdge: previewMax });
        const id = randomId(12);
        const originalKey = `originals/${id}.${extFromMime(mime)}`;
        const previewKey = `previews/${id}.webp`;
        const heroKey = `hero/${id}.webp`;
        const thumbKey = `thumbs/${id}.webp`;
        await Promise.all([
          storage().putBuffer("private", originalKey, p.original, mime),
          storage().putBuffer("public", previewKey, p.preview, "image/webp"),
          storage().putBuffer("public", heroKey, p.hero, "image/webp"),
          storage().putBuffer("public", thumbKey, p.thumb, "image/webp"),
        ]);
        const created = await prisma.content.create({
          data: {
            slug: `${slugify(title)}-${shortSuffix()}`,
            type: "PHOTO",
            title,
            genres: { connect: genresConnect },
            locationId: location.id,
            capturedAt: capturedAt ?? p.meta.capturedAt ?? new Date(),
            priceUZS: meta.priceUZS ?? null,
            featured: !!meta.featured,
            status: meta.status ?? "PUBLISHED",
            width: p.meta.width,
            height: p.meta.height,
            origWidth: p.meta.origWidth || null,
            origHeight: p.meta.origHeight || null,
            blurhash: p.meta.blurhash,
            originalKey,
            previewKey,
            heroKey,
            thumbKey,
          },
        });
        results.push({ id: created.id, slug: created.slug, title });
        locationUsage.set(location.id, (locationUsage.get(location.id) ?? 0) + 1);
      } else if (isVideo(mime)) {
        if (buf.byteLength > maxVideoMB * 1024 * 1024) {
          throw new Error(`${maxVideoMB}MB dan katta`);
        }
        const p = await processVideo(buf);
        const id = randomId(12);
        const originalKey = `originals/${id}.${extFromMime(mime)}`;
        const previewKey = `previews/${id}.mp4`;
        const posterKey = `posters/${id}.jpg`;
        const thumbKey = `thumbs/${id}.jpg`;
        await Promise.all([
          storage().putBuffer("private", originalKey, p.original, mime),
          storage().putBuffer("public", previewKey, p.preview, "video/mp4"),
          storage().putBuffer("public", posterKey, p.poster, "image/jpeg"),
          storage().putBuffer("public", thumbKey, p.poster, "image/jpeg"),
        ]);
        const created = await prisma.content.create({
          data: {
            slug: `${slugify(title)}-${shortSuffix()}`,
            type: "VIDEO",
            title,
            genres: { connect: genresConnect },
            locationId: location.id,
            capturedAt: capturedAt ?? new Date(),
            priceUZS: meta.priceUZS ?? null,
            featured: !!meta.featured,
            status: meta.status ?? "PUBLISHED",
            width: p.meta.width,
            height: p.meta.height,
            origWidth: p.meta.origWidth || null,
            origHeight: p.meta.origHeight || null,
            durationSec: p.meta.durationSec,
            blurhash: p.meta.blurhash,
            originalKey,
            previewKey,
            thumbKey,
            posterKey,
          },
        });
        results.push({ id: created.id, slug: created.slug, title });
        locationUsage.set(location.id, (locationUsage.get(location.id) ?? 0) + 1);
      } else {
        throw new Error("Fayl turi qo'llab-quvvatlanmaydi");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.error(`[upload] ${f.name} — ${msg}`, e);
      failures.push({ name: f.name, message: msg });
    }
  }

  // Joylashuvlarni ishlatilgan fayllar soniga qarab yangilaymiz
  for (const [locationId, count] of locationUsage) {
    await prisma.location.update({
      where: { id: locationId },
      data: { usageCount: { increment: count }, lastUsedAt: new Date() },
    });
  }

  if (results.length === 0 && failures.length > 0) {
    return apiError(400, "all_failed", `Yuklashda xato: ${failures.map((f) => `${f.name} — ${f.message}`).join("; ")}`);
  }

  return ok({ items: results, failures });
}

async function upsertLocation(name: string) {
  const normalized = normalizeName(name);
  const existing = await prisma.location.findUnique({ where: { name: normalized } });
  if (existing) return existing;
  return prisma.location.create({ data: { name: normalized, slug: slugify(normalized) } });
}

function extFromMime(m: string) {
  switch (m) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/heic": return "heic";
    case "video/mp4": return "mp4";
    case "video/webm": return "webm";
    default: return "bin";
  }
}
