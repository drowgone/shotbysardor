"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Resumable yuklovchi. Fayl bo'yicha:
// 1) Deterministik fileId — name + size + lastModified'dan hash.
// 2) Server sessiyasini yaratamiz (yoki mavjudini olib kelamiz).
// 3) receivedBytes'dan boshlab CHUNK_SIZE'lik qismlarni PATCH bilan yuboramiz.
// 4) To'liq yuborilgach finalize'ni chaqiramiz — server mediani ishlab Content yaratadi.
//
// Progress: har chunkdan keyin `receivedBytes / totalBytes`.
// Xato / uzilishlar: XHR onerror/ontimeout/abort — status "error" bo'ladi. Klient qayta
//   ishga tushirsa (retry), server sessiyasidan qayta yopishib davom etadi. Sahifa reload
//   bo'lsa, klient snapshot'ni localStorage'dan tiklaydi va foydalanuvchidan fayllarni qayta
//   tanlashni so'raydi — File obyektini brauzerda saqlab bo'lmaydi.

export type UploadItemStatus =
  | "queued"
  | "hashing"
  | "uploading"
  | "processing" // finalize'da server media ishlayapti
  | "done"
  | "error"
  | "paused";

export type UploadItemMeta = {
  title: string;
  genreIds: string[];
  locationName: string;
  capturedAt?: string;
  priceUZS: number | null;
  featured: boolean;
  status: "PUBLISHED" | "DRAFT";
};

export type UploadItem = {
  id: string; // klient ichki ID
  fileId: string; // server sessiya ID (deterministic)
  file: File;
  size: number;
  status: UploadItemStatus;
  progress: number; // 0..1
  receivedBytes: number;
  errorMessage?: string;
  contentId?: string;
  attempts: number;
  meta: UploadItemMeta;
};

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_CONCURRENT = 2;
const MAX_ATTEMPTS = 4;

// Deterministik fileId — name+size+lastModified. crypto.subtle faqat "secure context"da
// (HTTPS yoki localhost) mavjud — LAN IP orqali HTTP ochilganda undefined bo'ladi.
// Shu sabab ikki bosqichli: birinchi navbatda SubtleCrypto, u yo'q bo'lsa toza JS FNV-1a fallback.
// Ushbu fileId kriptografik xavfsizlik uchun EMAS — faqat sessiyani identifikatsiyalash.
async function computeFileId(file: File): Promise<string> {
  const input = `${file.name}|${file.size}|${file.lastModified}`;
  const subtle =
    typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined" ? crypto.subtle : null;
  if (subtle) {
    try {
      const enc = new TextEncoder().encode(input);
      const buf = await subtle.digest("SHA-256", enc);
      const hex = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return hex.slice(0, 24);
    } catch {
      // fall through to JS fallback
    }
  }
  return fallbackHash(input);
}

// 96-bit hash — ikki 32-bit FNV-1a to'plami + size/lastModified'ni ustma-ust qo'shish.
// Praktik uniqueness bir foydalanuvchi doirasida yetarli.
function fallbackHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xdeadbeef;
  let h3 = 0x9e3779b1;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca77) >>> 0;
    h3 = Math.imul(h3 ^ c, 0xc2b2ae3d) >>> 0;
  }
  return (
    h1.toString(16).padStart(8, "0") +
    h2.toString(16).padStart(8, "0") +
    h3.toString(16).padStart(8, "0")
  );
}

type SnapshotEntry = {
  fileId: string;
  name: string;
  size: number;
  lastModified: number;
  status: UploadItemStatus;
  contentId?: string;
  errorMessage?: string;
};

function snapshotKey(scope: string) {
  return `upload-snapshot:${scope}`;
}

function loadSnapshot(scope: string): SnapshotEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(snapshotKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SnapshotEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveSnapshot(scope: string, items: UploadItem[]) {
  if (typeof window === "undefined") return;
  const snap: SnapshotEntry[] = items.map((i) => ({
    fileId: i.fileId,
    name: i.file.name,
    size: i.size,
    lastModified: i.file.lastModified,
    status: i.status,
    contentId: i.contentId,
    errorMessage: i.errorMessage,
  }));
  try {
    window.localStorage.setItem(snapshotKey(scope), JSON.stringify(snap));
  } catch {
    // quota — ignore
  }
}

function clearSnapshot(scope: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(snapshotKey(scope));
  } catch {
    // ignore
  }
}

// XHR bilan chunk yuborish — abort qilinishi va progress uchun.
function sendChunk(
  chunk: Blob,
  fileId: string,
  offset: number,
  csrf: string,
  signal: AbortSignal,
  onUploadProgress: (loaded: number) => void,
): Promise<{ receivedBytes: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PATCH", "/api/admin/upload/session");
    xhr.setRequestHeader("x-csrf-token", csrf);
    xhr.setRequestHeader("x-file-id", fileId);
    xhr.setRequestHeader("x-offset", String(offset));
    xhr.setRequestHeader("content-type", "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onUploadProgress(e.loaded);
    };
    xhr.onerror = () => reject(new Error("network_error"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { receivedBytes: number };
          resolve(data);
        } catch {
          reject(new Error("bad_response"));
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText) as { error?: { code?: string; message?: string } };
          if (data?.error?.code === "offset_mismatch") {
            const err = new Error("offset_mismatch") as Error & { code?: string };
            err.code = "offset_mismatch";
            reject(err);
          } else {
            reject(new Error(data?.error?.message ?? `HTTP ${xhr.status}`));
          }
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      }
    };
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(chunk);
  });
}

async function initSession(fileId: string, name: string, size: number, csrf: string) {
  const res = await fetch("/api/admin/upload/session", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
    body: JSON.stringify({ fileId, name, size }),
  });
  if (!res.ok) throw new Error((await res.json())?.error?.message ?? "session_init_failed");
  return (await res.json()) as { created: boolean; receivedBytes: number; totalBytes: number };
}

async function finalizeSession(fileId: string, meta: UploadItemMeta, csrf: string) {
  const res = await fetch("/api/admin/upload/session/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
    body: JSON.stringify({ fileId, item: meta }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "finalize_failed");
  return data as { item: { id: string; slug: string; title: string } };
}

async function deleteServerSession(fileId: string, csrf: string) {
  await fetch(`/api/admin/upload/session?fileId=${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { "x-csrf-token": csrf },
  }).catch(() => {});
}

export type UploaderOptions = {
  csrf: string;
  scope?: string;
  onComplete?: (item: UploadItem) => void;
};

export function useUploader({ csrf, scope = "default", onComplete }: UploaderOptions) {
  const [items, setItems] = useState<UploadItem[]>([]);
  // Sahifa ochilishida oldingi snapshotni bir marta tiklab olamiz — keyingi saqlashlar
  // uni ustidan yozadi, lekin previousSnapshot() shu boshlang'ich holatni qaytaradi.
  const [initialSnapshot] = useState<SnapshotEntry[]>(() => loadSnapshot(scope));
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const runningRef = useRef<Set<string>>(new Set());
  const itemsRef = useRef<UploadItem[]>([]);
  const savedAtLeastOnce = useRef(false);
  const csrfRef = useRef(csrf);
  csrfRef.current = csrf;

  useEffect(() => {
    itemsRef.current = items;
    // Boshlang'ich bo'sh state bilan snapshotni ustidan yozib yubormaslik uchun:
    // faqat items to'ldirilgandan keyingina saqlashni boshlaymiz.
    if (!savedAtLeastOnce.current && items.length === 0) return;
    savedAtLeastOnce.current = true;
    saveSnapshot(scope, items);
  }, [items, scope]);

  const patch = useCallback((id: string, partial: Partial<UploadItem>) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...partial } : x)));
  }, []);

  // Bitta faylni ishlash — sessiya init, chunk loop, finalize.
  const runOne = useCallback(
    async (id: string) => {
      if (runningRef.current.has(id)) return;
      runningRef.current.add(id);
      const item = itemsRef.current.find((x) => x.id === id);
      if (!item) {
        runningRef.current.delete(id);
        return;
      }
      const ctrl = new AbortController();
      abortControllers.current.set(id, ctrl);
      patch(id, { status: "uploading", errorMessage: undefined, attempts: item.attempts + 1 });

      try {
        // 1) init / resume — server hozirgi receivedBytes'ni qaytaradi
        const init = await initSession(item.fileId, item.file.name, item.size, csrfRef.current);
        let offset = init.receivedBytes;
        patch(id, {
          receivedBytes: offset,
          progress: item.size > 0 ? offset / item.size : 0,
        });

        // 2) chunklarni ketma-ket yuborish
        while (offset < item.size) {
          if (ctrl.signal.aborted) throw new Error("aborted");
          const end = Math.min(offset + CHUNK_SIZE, item.size);
          const slice = item.file.slice(offset, end);
          const startBase = offset;
          try {
            const res = await sendChunk(
              slice,
              item.fileId,
              offset,
              csrfRef.current,
              ctrl.signal,
              (uploadedInThisChunk) => {
                const total = startBase + uploadedInThisChunk;
                patch(id, {
                  receivedBytes: total,
                  progress: item.size > 0 ? total / item.size : 0,
                });
              },
            );
            offset = res.receivedBytes;
            patch(id, {
              receivedBytes: offset,
              progress: item.size > 0 ? offset / item.size : 0,
            });
          } catch (e) {
            const err = e as Error & { code?: string };
            if (err.code === "offset_mismatch") {
              // Servetning hozirgi holatini qayta o'qib davom etamiz
              const status = await initSession(item.fileId, item.file.name, item.size, csrfRef.current);
              offset = status.receivedBytes;
              patch(id, {
                receivedBytes: offset,
                progress: item.size > 0 ? offset / item.size : 0,
              });
              continue;
            }
            throw e;
          }
        }

        // 3) finalize
        patch(id, { status: "processing" });
        const meta = itemsRef.current.find((x) => x.id === id)?.meta ?? item.meta;
        const result = await finalizeSession(item.fileId, meta, csrfRef.current);
        patch(id, {
          status: "done",
          progress: 1,
          receivedBytes: item.size,
          contentId: result.item.id,
        });
        onComplete?.({ ...item, ...result.item, status: "done", progress: 1 });
      } catch (e) {
        if ((e as Error).message === "aborted") {
          patch(id, { status: "paused" });
        } else {
          patch(id, {
            status: "error",
            errorMessage: (e as Error).message,
          });
        }
      } finally {
        abortControllers.current.delete(id);
        runningRef.current.delete(id);
        // Keyingi jarayonni ishga tushirish
        setTimeout(() => pump(), 0);
      }
    },
    [patch, onComplete],
  );

  // Concurrency boshqarish — bir vaqtning o'zida MAX_CONCURRENT ta ishlaydi.
  const pump = useCallback(() => {
    const current = itemsRef.current;
    const running = Array.from(runningRef.current);
    let slots = MAX_CONCURRENT - running.length;
    if (slots <= 0) return;
    for (const it of current) {
      if (slots <= 0) break;
      if (it.status === "queued") {
        void runOne(it.id);
        slots--;
      }
    }
  }, [runOne]);

  const addFiles = useCallback(
    async (files: File[], baseMeta: (file: File) => UploadItemMeta) => {
      const additions: UploadItem[] = [];
      for (const f of files) {
        const fileId = await computeFileId(f);
        // Duplikat — mavjud fayl bilan bir xil fileId bo'lsa, o'tkazib yuboramiz
        if (itemsRef.current.some((x) => x.fileId === fileId)) continue;
        additions.push({
          id: `${fileId}-${Math.random().toString(36).slice(2, 8)}`,
          fileId,
          file: f,
          size: f.size,
          status: "queued",
          progress: 0,
          receivedBytes: 0,
          attempts: 0,
          meta: baseMeta(f),
        });
      }
      if (additions.length === 0) return;
      setItems((prev) => [...prev, ...additions]);
    },
    [],
  );

  const start = useCallback(() => {
    setItems((prev) =>
      prev.map((it) => (it.status === "error" || it.status === "paused" ? { ...it, status: "queued", errorMessage: undefined } : it)),
    );
    setTimeout(() => pump(), 0);
  }, [pump]);

  const pause = useCallback((id: string) => {
    const c = abortControllers.current.get(id);
    if (c) c.abort();
    patch(id, { status: "paused" });
  }, [patch]);

  const retry = useCallback((id: string) => {
    patch(id, { status: "queued", errorMessage: undefined });
    setTimeout(() => pump(), 0);
  }, [patch, pump]);

  const remove = useCallback(async (id: string) => {
    const item = itemsRef.current.find((x) => x.id === id);
    const c = abortControllers.current.get(id);
    if (c) c.abort();
    if (item && item.status !== "done") {
      await deleteServerSession(item.fileId, csrfRef.current);
    }
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const updateMeta = useCallback(
    (id: string, patchMeta: Partial<UploadItemMeta>) => {
      patch(id, { meta: { ...(itemsRef.current.find((x) => x.id === id)?.meta ?? ({} as UploadItemMeta)), ...patchMeta } });
    },
    [patch],
  );

  const updateTitle = useCallback(
    (id: string, title: string) => {
      updateMeta(id, { title });
    },
    [updateMeta],
  );

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((x) => x.status !== "done"));
  }, []);

  const clearAll = useCallback(async () => {
    for (const c of abortControllers.current.values()) c.abort();
    // Serverdagi to'liq bo'lmagan sessiyalarni tozalaymiz
    for (const it of itemsRef.current) {
      if (it.status !== "done") await deleteServerSession(it.fileId, csrfRef.current);
    }
    setItems([]);
    clearSnapshot(scope);
  }, [scope]);

  // Sahifa ochilishida oldingi seansdagi snapshot (bo'lsa) — Restore banner uchun.
  const previousSnapshot = useCallback(() => initialSnapshot, [initialSnapshot]);

  return {
    items,
    addFiles,
    start,
    pause,
    retry,
    remove,
    updateMeta,
    updateTitle,
    clearFinished,
    clearAll,
    previousSnapshot,
  };
}
