import Redis from "ioredis";

// Fallbacks for when REDIS_URL is not provided (in-memory rate limit)
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

type FailBucket = { count: number; firstAt: number; lastAt: number };
const failCounts = new Map<string, FailBucket>();

type Lock = { until: number };
const locks = new Map<string, Lock>();

let redis: Redis | null = null;
if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[rate-limit] Redis connection failed, falling back to in-memory:", err);
  }
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterMs: number }> {
  if (redis) {
    try {
      const now = Date.now();
      const redisKey = `rl:bucket:${key}`;
      const data = await redis.hmget(redisKey, "count", "resetAt");
      const countStr = data[0];
      const resetAtStr = data[1];

      if (!countStr || !resetAtStr || Number(resetAtStr) <= now) {
        const resetAt = now + windowMs;
        await redis.multi()
          .hset(redisKey, "count", "1")
          .hset(redisKey, "resetAt", String(resetAt))
          .pexpire(redisKey, windowMs)
          .exec();
        return { ok: true, retryAfterMs: 0 };
      }

      const count = Number(countStr);
      const resetAt = Number(resetAtStr);
      if (count >= limit) {
        return { ok: false, retryAfterMs: resetAt - now };
      }

      await redis.hincrby(redisKey, "count", 1);
      return { ok: true, retryAfterMs: 0 };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[rate-limit] Redis rateLimit failed, using fallback:", err);
    }
  }

  // Fallback to in-memory
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
export async function isLocked(key: string): Promise<{ locked: boolean; retryAfterMs: number }> {
  if (redis) {
    try {
      const now = Date.now();
      const redisKey = `rl:lock:${key}`;
      const untilStr = await redis.get(redisKey);
      if (!untilStr) return { locked: false, retryAfterMs: 0 };
      const until = Number(untilStr);
      if (until <= now) {
        await redis.del(redisKey);
        return { locked: false, retryAfterMs: 0 };
      }
      return { locked: true, retryAfterMs: until - now };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[rate-limit] Redis isLocked failed, using fallback:", err);
    }
  }

  // Fallback to in-memory
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
export async function lockKey(key: string, durationMs: number): Promise<void> {
  if (redis) {
    try {
      const now = Date.now();
      const redisKey = `rl:lock:${key}`;
      const existing = await redis.get(redisKey);
      const until = Math.max(existing ? Number(existing) : 0, now + durationMs);
      await redis.set(redisKey, String(until), "PX", durationMs);
      return;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[rate-limit] Redis lockKey failed, using fallback:", err);
    }
  }

  // Fallback to in-memory
  const now = Date.now();
  const existing = locks.get(key);
  const until = Math.max(existing?.until ?? 0, now + durationMs);
  locks.set(key, { until });
}

// Muvaffaqiyatsiz urinishlarni kuzatib boradi va progressiv bloklashni qaytaradi.
// - limit'gacha bo'lgan urinishlar OK
// - limitdan oshsa, davomiylik = escalations bo'yicha oshadi
export async function trackFail(
  key: string,
  opts: { limit: number; windowMs: number; escalations: number[] },
): Promise<{ count: number; lockedFor: number }> {
  if (redis) {
    try {
      const now = Date.now();
      const redisKey = `rl:fail:${key}`;
      const data = await redis.hmget(redisKey, "count", "firstAt", "lastAt");
      const countStr = data[0];
      const firstAtStr = data[1];

      if (!countStr || !firstAtStr || (now - Number(firstAtStr) > opts.windowMs)) {
        await redis.multi()
          .hset(redisKey, "count", "1")
          .hset(redisKey, "firstAt", String(now))
          .hset(redisKey, "lastAt", String(now))
          .pexpire(redisKey, opts.windowMs)
          .exec();
        return { count: 1, lockedFor: 0 };
      }

      const count = Number(countStr) + 1;
      await redis.multi()
        .hincrby(redisKey, "count", 1)
        .hset(redisKey, "lastAt", String(now))
        .pexpire(redisKey, opts.windowMs)
        .exec();

      if (count <= opts.limit) return { count, lockedFor: 0 };

      const overshoot = count - opts.limit - 1;
      const idx = Math.min(overshoot, opts.escalations.length - 1);
      const lockedFor = opts.escalations[idx] ?? opts.escalations[opts.escalations.length - 1];
      await lockKey(key, lockedFor);
      return { count, lockedFor };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[rate-limit] Redis trackFail failed, using fallback:", err);
    }
  }

  // Fallback to in-memory
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
  await lockKey(key, lockedFor);
  return { count: fb.count, lockedFor };
}

// Muvaffaqiyatli login/tuzatishdan keyin ma'lum kalit bo'yicha hisoblagichni tozalash.
export async function clearFail(key: string): Promise<void> {
  if (redis) {
    try {
      const redisKey = `rl:fail:${key}`;
      const lockKeyName = `rl:lock:${key}`;
      await redis.del(redisKey, lockKeyName);
      return;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[rate-limit] Redis clearFail failed, using fallback:", err);
    }
  }

  // Fallback to in-memory
  failCounts.delete(key);
  locks.delete(key);
}

// Har 5 daqiqada eski yozuvlarni tozalash (in-memory uchun)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  for (const [k, v] of failCounts) if (now - v.lastAt > 60 * 60 * 1000) failCounts.delete(k);
  for (const [k, v] of locks) if (v.until <= now) locks.delete(k);
}, 5 * 60 * 1000).unref?.();
