import { promises as fs } from "node:fs";
import path from "node:path";

// Chunked upload sessiyasi uchun disk-based scratch.
// Har bir sessiya = ikkita fayl:
//   - {fileId}.part — hozirgacha kelgan bayt oqimi (append-only)
//   - {fileId}.json — meta (originalName, size, mime hint, createdAt)
// Sessiya papkasi butun loyihada bir joyda saqlanadi.

export const SESSION_ROOT = path.join(process.cwd(), "storage", "tmp", "uploads");

export type SessionMeta = {
  fileId: string;
  originalName: string;
  totalSize: number;
  createdAt: number;
  updatedAt: number;
};

// Foydalanuvchi kiritgan fileId'ni tozalab, path traversal xavfini oldini olamiz.
// Faqat a-z, 0-9, -, _ ga ruxsat beramiz. Uzunlik 8..64.
export function isValidFileId(id: unknown): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}

async function ensureRoot() {
  await fs.mkdir(SESSION_ROOT, { recursive: true });
}

export function partPath(fileId: string) {
  return path.join(SESSION_ROOT, `${fileId}.part`);
}

export function metaPath(fileId: string) {
  return path.join(SESSION_ROOT, `${fileId}.json`);
}

export async function getSession(fileId: string): Promise<{ meta: SessionMeta; receivedBytes: number } | null> {
  try {
    const raw = await fs.readFile(metaPath(fileId), "utf-8");
    const meta = JSON.parse(raw) as SessionMeta;
    let receivedBytes = 0;
    try {
      const st = await fs.stat(partPath(fileId));
      receivedBytes = st.size;
    } catch {
      // .part yo'q — 0
    }
    return { meta, receivedBytes };
  } catch {
    return null;
  }
}

export async function createSession(fileId: string, originalName: string, totalSize: number) {
  await ensureRoot();
  const now = Date.now();
  const meta: SessionMeta = {
    fileId,
    originalName,
    totalSize,
    createdAt: now,
    updatedAt: now,
  };
  await fs.writeFile(metaPath(fileId), JSON.stringify(meta));
  // Bo'sh part fayl yaratamiz (mavjud bo'lsa qayta ochish uchun)
  const handle = await fs.open(partPath(fileId), "a");
  await handle.close();
  return meta;
}

export async function appendChunk(fileId: string, offset: number, chunk: Buffer): Promise<number> {
  const p = partPath(fileId);
  // Faqat sequential yozamiz: hozirgi size = offset bo'lishi kerak. Aks holda xato.
  const st = await fs.stat(p);
  if (st.size !== offset) {
    const err = new Error(`offset_mismatch: expected ${st.size}, got ${offset}`);
    (err as Error & { code?: string }).code = "offset_mismatch";
    throw err;
  }
  await fs.appendFile(p, chunk);
  await touchMeta(fileId);
  const newSt = await fs.stat(p);
  return newSt.size;
}

async function touchMeta(fileId: string) {
  try {
    const raw = await fs.readFile(metaPath(fileId), "utf-8");
    const meta = JSON.parse(raw) as SessionMeta;
    meta.updatedAt = Date.now();
    await fs.writeFile(metaPath(fileId), JSON.stringify(meta));
  } catch {
    // ignore
  }
}

export async function readAssembled(fileId: string): Promise<Buffer> {
  return fs.readFile(partPath(fileId));
}

export async function deleteSession(fileId: string) {
  await fs.rm(partPath(fileId), { force: true });
  await fs.rm(metaPath(fileId), { force: true });
}

// 24 soatdan eski sessiyalarni tozalash — ehtiyot chorasi.
export async function cleanupStaleSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const now = Date.now();
    const files = await fs.readdir(SESSION_ROOT);
    for (const name of files) {
      if (!name.endsWith(".json")) continue;
      try {
        const p = path.join(SESSION_ROOT, name);
        const raw = await fs.readFile(p, "utf-8");
        const meta = JSON.parse(raw) as SessionMeta;
        if (now - meta.updatedAt > maxAgeMs) {
          await deleteSession(meta.fileId);
        }
      } catch {
        // ignore per-file errors
      }
    }
  } catch {
    // ignore
  }
}
