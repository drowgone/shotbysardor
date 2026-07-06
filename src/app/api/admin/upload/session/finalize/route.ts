import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, ok, requireAdmin, checkCsrf, zodErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { detectMime, isPhoto, isVideo, processPhoto, processVideo } from "@/lib/media";
import { randomId, slugify, shortSuffix, normalizeName } from "@/lib/utils";
import { deleteSession, getSession, isValidFileId, readAssembled } from "@/lib/upload-session";
import { emit } from "@/lib/live/bus";

export const runtime = "nodejs";
export const maxDuration = 300;

const itemSchema = z.object({
  title: z.string().min(1),
  genreIds: z.array(z.string().min(1)).min(1),
  locationName: z.string().min(1),
  capturedAt: z.string().optional(),
  priceUZS: z.number().int().min(0).nullable().optional(),
  featured: z.boolean().optional(),
  status: z.enum(["PUBLISHED", "DRAFT"]).optional(),
});

// POST /api/admin/upload/session/finalize
// Body: { fileId, item: <itemSchema> }
// Yig'ilgan chunklarni buferga o'qib, media pipeline'ni ishga tushiradi
// va Content yozuvini yaratadi. Muvaffaqiyatli tugagach sessiya faylini o'chiradi.
export async function POST(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");

  const body = (await req.json().catch(() => null)) as { fileId?: string; item?: unknown } | null;
  if (!body || !isValidFileId(body.fileId)) return apiError(400, "invalid_id", "Noto'g'ri fileId");
  const parsed = itemSchema.safeParse(body.item);
  if (!parsed.success) return apiError(400, "validation", zodErrorMessage(parsed.error));
  const meta = parsed.data;

  const sess = await getSession(body.fileId);
  if (!sess) return apiError(404, "no_session", "Sessiya topilmadi");
  if (sess.receivedBytes !== sess.meta.totalSize) {
    return apiError(400, "incomplete", `Fayl to'liq yuklanmagan: ${sess.receivedBytes}/${sess.meta.totalSize}`);
  }

  const buf = await readAssembled(body.fileId);
  const mime = detectMime(buf);
  const title = meta.title.trim() || sess.meta.originalName.replace(/\.[^.]+$/, "");
  const capturedAt = meta.capturedAt ? new Date(meta.capturedAt) : null;

  const previewMax = await getSetting("content.previewMaxEdge");
  const maxPhotoMB = Number(process.env.MAX_PHOTO_MB ?? 60);
  const maxVideoMB = Number(process.env.MAX_VIDEO_MB ?? 2048);

  try {
    const location = await upsertLocation(meta.locationName);
    // Bir kontent bir nechta janrga ulanadi — implicit M2M orqali connect.
    const genresConnect = meta.genreIds.map((id) => ({ id }));

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
      await prisma.location.update({
        where: { id: location.id },
        data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
      });
      await deleteSession(body.fileId);
      emit("contents", { action: "create", id: created.id, slug: created.slug });
      emit("taxonomy", { action: "location.usage" });
      emit("stats", { action: "content.create" });
      return ok({ item: { id: created.id, slug: created.slug, title } });
    }

    if (isVideo(mime)) {
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
      await prisma.location.update({
        where: { id: location.id },
        data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
      });
      await deleteSession(body.fileId);
      emit("contents", { action: "create", id: created.id, slug: created.slug });
      emit("taxonomy", { action: "location.usage" });
      emit("stats", { action: "content.create" });
      return ok({ item: { id: created.id, slug: created.slug, title } });
    }

    throw new Error("Fayl turi qo'llab-quvvatlanmaydi");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return apiError(400, "process_failed", msg);
  }
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
