import sharp from "sharp";
import { encode as blurhashEncode } from "blurhash";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomId } from "./utils";

export type PhotoProcessed = {
  originalKey: string;
  previewKey: string;
  thumbKey: string;
  blurhash: string;
  width: number;
  height: number;
  capturedAt: Date | null;
};

export type VideoProcessed = {
  originalKey: string;
  previewKey: string;
  posterKey: string;
  thumbKey: string;
  blurhash: string;
  width: number;
  height: number;
  durationSec: number;
};

// MIME turini magic-bytes bilan tekshirish (kengaytmaga ishonilmaydi).
export function detectMime(buf: Buffer): string {
  const b = buf.subarray(0, 12);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return "image/webp";
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    // heic / mp4 / mov — subtype tekshirilmaydi, ftyp mavjud
    const brand = buf.toString("ascii", 8, 12);
    if (["heic", "heix", "mif1", "hevc"].includes(brand.trim())) return "image/heic";
    if (["isom", "iso2", "mp42", "avc1", "qt  "].includes(brand.trim())) return "video/mp4";
    return "video/mp4";
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  return "application/octet-stream";
}

// Ruxsat berilgan MIME turlar — strict allowlist. SVG kabi XSS xavfli turlar chetlashtiriladi.
export const ALLOWED_PHOTO_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

export const ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
]);

export function isPhoto(mime: string) {
  return ALLOWED_PHOTO_MIMES.has(mime);
}

export function isVideo(mime: string) {
  return ALLOWED_VIDEO_MIMES.has(mime);
}

// Fayl nomini xavfsiz tekshirish — path traversal va nozik simvollarni rad etamiz.
// Foydalanuvchi kiritgan title/name uchun ishlatiladi.
export function sanitizeFilename(name: string): string {
  // Fayl kengaytmasini tashqariga chiqarib, faqat ismini olamiz
  const cleaned = name
    .replace(/[/\\]/g, "-") // path separatorlarini olib tashlash
    .replace(/[\x00-\x1f]/g, "") // control chars
    .replace(/[<>:"|?*]/g, "-") // Windows-illegal
    .trim();
  return cleaned.slice(0, 200) || "kontent";
}

async function toBlurhash(png: Buffer): Promise<string> {
  const { data, info } = await sharp(png)
    .resize(32, 32, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return blurhashEncode(new Uint8ClampedArray(data), info.width, info.height, 4, 4);
}

// Foto quvuri: EXIF olib tashlash + preview + thumb + blurhash + clean hero
export async function processPhoto(
  buf: Buffer,
  opts: { previewMaxEdge: number },
): Promise<{
  preview: Buffer;
  hero: Buffer; // yuqori sifatli — faqat hero uchun
  thumb: Buffer;
  original: Buffer;
  meta: {
    width: number;
    height: number;
    origWidth: number;
    origHeight: number;
    capturedAt: Date | null;
    blurhash: string;
  };
}> {
  const raw = await sharp(buf, { failOn: "none" }).metadata();
  const capturedAt = raw.exif ? parseExifDate(raw.exif) : null;
  // EXIF orientation 5-8 da width/height o'zaro almashadi
  const rotated = raw.orientation && raw.orientation >= 5 && raw.orientation <= 8;
  const origWidth = (rotated ? raw.height : raw.width) ?? 0;
  const origHeight = (rotated ? raw.width : raw.height) ?? 0;

  // Image bomb himoyasi — dekompressiya oldidan piksel sonini tekshiramiz. 100MP —
  // Hasselblad H6D-100c uchun ham yetadi, buzuq/qasddan zararli fayllardan himoya.
  const totalPixels = (raw.width ?? 0) * (raw.height ?? 0);
  const MAX_PIXELS = 100_000_000;
  if (totalPixels === 0 || totalPixels > MAX_PIXELS) {
    throw new Error(`Rasm o'lchami cheklovdan katta (${totalPixels.toLocaleString()} piksel)`);
  }

  // ── HERO: asl sifatga eng yaqin ─────────────────────────────────
  // < 10MB → asl o'lchamda (max 4K) WebP q94 — deyarli lossless
  // ≥ 10MB → 4K gacha siqilib, WebP q88 — visually lossless
  const origSizeMB = buf.byteLength / (1024 * 1024);
  const heroBuf = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({
      width: 3840,
      height: 3840,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: origSizeMB > 10 ? 88 : 94, effort: 6, smartSubsample: true })
    .toBuffer();

  // ── PREVIEW (sahifa uchun): sifatga zarar bermasdan siqish ─────
  // WebP q86 + smartSubsample + effort 6 → visually lossless, hajm ~50% dan kam
  const previewBuf = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({
      width: opts.previewMaxEdge,
      height: opts.previewMaxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 86, effort: 6, smartSubsample: true })
    .toBuffer();

  const previewMeta = await sharp(previewBuf).metadata();

  // ── THUMB: yaxshi sifat, kichik hajm ─
  const thumbBuf = await sharp(previewBuf)
    .resize({ width: 640, fit: "inside" })
    .webp({ quality: 82, effort: 6, smartSubsample: true })
    .toBuffer();

  const bh = await toBlurhash(previewBuf);

  return {
    preview: previewBuf,
    hero: heroBuf,
    thumb: thumbBuf,
    original: buf,
    meta: {
      width: previewMeta.width ?? raw.width ?? 0,
      height: previewMeta.height ?? raw.height ?? 0,
      origWidth,
      origHeight,
      capturedAt,
      blurhash: bh,
    },
  };
}

function parseExifDate(exif: Buffer): Date | null {
  try {
    // Sharp'ning exif Buffer'ini o'qish oddiy emas — sharp.metadata().exif — TIFF ma'lumot.
    // Bu yerda oddiy heuristika: matn ichidan `YYYY:MM:DD HH:MM:SS` qidiramiz.
    const s = exif.toString("ascii");
    const m = s.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
  } catch {
    return null;
  }
}

// Video quvuri — ffmpeg orqali poster + preview mp4 (H.264 ≤1080)
export async function processVideo(
  buf: Buffer,
): Promise<{ preview: Buffer; poster: Buffer; original: Buffer; meta: { width: number; height: number; origWidth: number; origHeight: number; durationSec: number; blurhash: string } }> {
  const ffmpeg = (await import("fluent-ffmpeg")).default;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shotby-"));
  const inPath = path.join(tmpDir, `in-${randomId(6)}.bin`);
  const posterPath = path.join(tmpDir, `poster-${randomId(6)}.jpg`);
  const outPath = path.join(tmpDir, `preview-${randomId(6)}.mp4`);
  await fs.writeFile(inPath, buf);

  // Poster (1s kadr)
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inPath)
      .screenshots({ timestamps: ["1"], filename: path.basename(posterPath), folder: tmpDir, size: "?x720" })
      .on("end", () => resolve())
      .on("error", reject);
  });

  const filters: string[] = ["scale='min(1920,iw)':-2:flags=lanczos"];

  const probe: { dur: number; origWidth: number; origHeight: number } = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inPath, (err, data) => {
      if (err) return reject(err);
      const vs = data.streams.find((s) => s.codec_type === "video");
      // Video ba'zan aylantirilgan bo'ladi (rotate/side_data) — o'lchamlarni tekshiramiz
      const rotate = Number((vs?.tags as { rotate?: string } | undefined)?.rotate ?? 0);
      const rotated = rotate === 90 || rotate === 270;
      const rawW = Number(vs?.width ?? 0);
      const rawH = Number(vs?.height ?? 0);
      resolve({
        dur: data.format.duration ?? 0,
        origWidth: rotated ? rawH : rawW,
        origHeight: rotated ? rawW : rawH,
      });
    });
  });
  const dur = probe.dur;

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inPath)
      .videoCodec("libx264")
      .videoBitrate("4000k")
      .audioCodec("aac")
      .audioBitrate("128k")
      .outputOptions(["-vf", filters.join(","), "-preset", "medium", "-movflags", "+faststart"])
      .save(outPath)
      .on("end", () => resolve())
      .on("error", reject);
  });

  const preview = await fs.readFile(outPath);
  const poster = await fs.readFile(posterPath);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

  const posterMeta = await sharp(poster).metadata();
  const bh = await toBlurhash(poster);

  return {
    preview,
    poster,
    original: buf,
    meta: {
      width: posterMeta.width ?? 1280,
      height: posterMeta.height ?? 720,
      origWidth: probe.origWidth || posterMeta.width || 0,
      origHeight: probe.origHeight || posterMeta.height || 0,
      durationSec: Math.round(dur),
      blurhash: bh,
    },
  };
}
