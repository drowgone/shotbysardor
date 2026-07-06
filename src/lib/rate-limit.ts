// In-memory rate-limit — v1 uchun kifoya. Redis kelajakda oson ulanadi.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Kalitni kuzatib boruvchi, lekin faqat sanaydigan hisoblagichlar.
// Login harakati muvaffaqiyatsiz bo'lganida ishlatiladi (ok/fail alohida hisoblanadi).
type FailBucket = { count: number; firstAt: number; lastAt: number };
const failCounts = new Map<string, FailBucket>();

// Vaqtinchalik bloklash (lockout). Ma'lum kalit uchun urinishlarni butunlay to'xtatadi.
type Lock = { until: number };
const locks = new Map<string, Lock>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterMs: b.resetAt - now };
  }
  b.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

// Bloklangan kalitni tekshirish (o'qish). Bloklashni yaratmaydi.
export function isLocked(key: string): { locked: boolean; retryAfterMs: number } {
  const now = Date.now();
  const l = locks.get(key);
  if (!l) return { locked: false, retryAfterMs: 0 };
  if (l.until <= now) {
    locks.delete(key);
    return { locked: false, retryAfterMs: 0 };
  }
  return { locked: true, retryAfterMs: l.until - now };
}

// Ma'lum kalitni belgilangan davomiylikka bloklash.
export function lockKey(key: string, durationMs: number): void {
  const now = Date.now();
  const existing = locks.get(key);
  const until = Math.max(existing?.until ?? 0, now + durationMs);
  locks.set(key, { until });
}

// Muvaffaqiyatsiz urinishlarni kuzatib boradi va progressiv bloklashni qaytaradi.
// - limit'gacha bo'lgan urinishlar OK
// - limitdan oshsa, davomiylik = escalations bo'yicha oshadi
export function trackFail(
  key: string,
  opts: { limit: number; windowMs: number; escalations: number[] },
): { count: number; lockedFor: number } {
  const now = Date.now();
  const fb = failCounts.get(key);
  if (!fb || now - fb.firstAt > opts.windowMs) {
    failCounts.set(key, { count: 1, firstAt: now, lastAt: now });
    return { count: 1, lockedFor: 0 };
  }
  fb.count += 1;
  fb.lastAt = now;
  if (fb.count <= opts.limit) return { count: fb.count, lockedFor: 0 };
  // Har limit'dan ortiq har bir urinish uchun eskalatsiya bosqichini oshiramiz.
  const overshoot = fb.count - opts.limit - 1;
  const idx = Math.min(overshoot, opts.escalations.length - 1);
  const lockedFor = opts.escalations[idx] ?? opts.escalations[opts.escalations.length - 1];
  lockKey(key, lockedFor);
  return { count: fb.count, lockedFor };
}

// Muvaffaqiyatli login/tuzatishdan keyin ma'lum kalit bo'yicha hisoblagichni tozalash.
export function clearFail(key: string): void {
  failCounts.delete(key);
  locks.delete(key);
}

// Har 5 daqiqada eski yozuvlarni tozalash
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  for (const [k, v] of failCounts) if (now - v.lastAt > 60 * 60 * 1000) failCounts.delete(k);
  for (const [k, v] of locks) if (v.until <= now) locks.delete(k);
}, 5 * 60 * 1000).unref?.();
