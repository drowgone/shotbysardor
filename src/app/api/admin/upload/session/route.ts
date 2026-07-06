import { NextRequest } from "next/server";
import { apiError, ok, requireAdmin, checkCsrf } from "@/lib/api";
import {
  appendChunk,
  createSession,
  deleteSession,
  getSession,
  isValidFileId,
} from "@/lib/upload-session";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/admin/upload/session?fileId=xxx
// Sessiya holatini tekshirish (resume uchun).
export async function GET(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!isValidFileId(fileId)) return apiError(400, "invalid_id", "Noto'g'ri fileId");
  const sess = await getSession(fileId);
  if (!sess) return ok({ exists: false });
  return ok({
    exists: true,
    receivedBytes: sess.receivedBytes,
    totalBytes: sess.meta.totalSize,
    originalName: sess.meta.originalName,
  });
}

// POST /api/admin/upload/session
// Yangi sessiya yaratish. Agar mavjud bo'lsa, hozirgi holatini qaytaradi.
// Body: JSON { fileId, name, size }
export async function POST(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");
  const body = (await req.json().catch(() => null)) as { fileId?: string; name?: string; size?: number } | null;
  if (!body || !isValidFileId(body.fileId) || typeof body.name !== "string" || typeof body.size !== "number") {
    return apiError(400, "invalid", "fileId/name/size majburiy");
  }
  if (body.size <= 0 || body.size > 8 * 1024 * 1024 * 1024) {
    return apiError(400, "size_limit", "Fayl o'lchami noto'g'ri (max 8GB)");
  }
  const existing = await getSession(body.fileId);
  if (existing) {
    // Fayl nomi mos kelmasa, xatolik (turli fayl, bir xil ID).
    if (existing.meta.originalName !== body.name || existing.meta.totalSize !== body.size) {
      return apiError(409, "conflict", "Fayl identifikatori boshqa fayl uchun band");
    }
    return ok({
      created: false,
      receivedBytes: existing.receivedBytes,
      totalBytes: existing.meta.totalSize,
    });
  }
  await createSession(body.fileId, body.name, body.size);
  return ok({ created: true, receivedBytes: 0, totalBytes: body.size });
}

// PATCH /api/admin/upload/session
// Binary chunk qabul qilish. Body — raw bytes. Headers:
//   x-file-id, x-offset, x-csrf-token
export async function PATCH(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");
  const fileId = req.headers.get("x-file-id");
  const offsetHeader = req.headers.get("x-offset");
  if (!isValidFileId(fileId)) return apiError(400, "invalid_id", "Noto'g'ri fileId");
  const offset = Number(offsetHeader);
  if (!Number.isFinite(offset) || offset < 0) return apiError(400, "invalid_offset", "Noto'g'ri offset");

  const sess = await getSession(fileId);
  if (!sess) return apiError(404, "no_session", "Sessiya topilmadi — avval POST bilan yarating");

  const ab = await req.arrayBuffer();
  const chunk = Buffer.from(ab);
  if (chunk.length === 0) return apiError(400, "empty_chunk", "Bo'sh chunk");
  if (sess.receivedBytes + chunk.length > sess.meta.totalSize) {
    return apiError(400, "over_size", "Chunk umumiy o'lchamdan chiqib ketdi");
  }

  try {
    const receivedBytes = await appendChunk(fileId, offset, chunk);
    return ok({ receivedBytes, totalBytes: sess.meta.totalSize });
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.code === "offset_mismatch") {
      // Klientga hozirgi holatni qaytaramiz — u shunday davom ettiradi
      const current = await getSession(fileId);
      return apiError(409, "offset_mismatch", `Offset mos kelmadi. Hozirgi: ${current?.receivedBytes ?? 0}`);
    }
    throw e;
  }
}

// DELETE /api/admin/upload/session?fileId=xxx
export async function DELETE(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");
  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!isValidFileId(fileId)) return apiError(400, "invalid_id", "Noto'g'ri fileId");
  await deleteSession(fileId);
  return ok({ ok: true });
}
