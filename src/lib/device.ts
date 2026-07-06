// Qurilma / brauzer aniqlagichi — User-Agent'dan qisqacha yorliq yasaydi.
// Zaruratan sodda: mashhur brauzerlar + OS'lar. Boshqa hollarda "Boshqa qurilma".

type Parsed = { device: string; browser: string; os: string; label: string };

const BROWSERS: Array<{ re: RegExp; name: string }> = [
  { re: /Edg\/[\d.]+/i, name: "Edge" },
  { re: /OPR\/[\d.]+|Opera[\/ ][\d.]+/i, name: "Opera" },
  { re: /YaBrowser\/[\d.]+/i, name: "Yandex" },
  { re: /Chrome\/[\d.]+/i, name: "Chrome" },
  { re: /Firefox\/[\d.]+/i, name: "Firefox" },
  { re: /Safari\/[\d.]+/i, name: "Safari" },
];

const OS: Array<{ re: RegExp; name: string }> = [
  { re: /Windows NT 10\.0/i, name: "Windows 10/11" },
  { re: /Windows NT/i, name: "Windows" },
  { re: /Mac OS X/i, name: "macOS" },
  { re: /Android \d/i, name: "Android" },
  { re: /iPhone|iPad|iOS/i, name: "iOS" },
  { re: /Linux/i, name: "Linux" },
];

const DEVICES: Array<{ re: RegExp; name: string }> = [
  { re: /iPad/i, name: "iPad" },
  { re: /iPhone/i, name: "iPhone" },
  { re: /Android/i, name: "Android telefon" },
  { re: /Mobile/i, name: "Mobil qurilma" },
];

export function parseUserAgent(ua: string | null | undefined): Parsed {
  const raw = (ua ?? "").slice(0, 512);
  if (!raw) return { device: "Noma'lum", browser: "Noma'lum", os: "Noma'lum", label: "Noma'lum qurilma" };

  const browser = BROWSERS.find((b) => b.re.test(raw))?.name ?? "Brauzer";
  const os = OS.find((o) => o.re.test(raw))?.name ?? "Noma'lum OT";
  const deviceMatch = DEVICES.find((d) => d.re.test(raw));
  const device = deviceMatch ? deviceMatch.name : os.startsWith("Windows") || os === "macOS" || os === "Linux" ? "Kompyuter" : "Qurilma";
  const label = `${browser} · ${os}`;
  return { device, browser, os, label };
}

// IP niqoblash — jurnalda oxirgi 2 oktetni yashiramiz. IPv6 uchun oxirgi ikkita segment.
export function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return "•••.•••.•••.•••";
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return "Lokal (127.0.0.1)";
  // Xususiy tarmoq (RFC 1918) — to'liq ko'rsatamiz, xatarli emas.
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return ip;
  // IPv4
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return `${v4[1]}.${v4[2]}.•••.•••`;
  // IPv6 (soddalashgan)
  if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length >= 4) {
      return `${parts[0]}:${parts[1]}:•:•`;
    }
  }
  return "•••.•••.•••.•••";
}

// Ichki/lokal IP — geoIP xizmatiga so'rov jo'natish ma'nosiz.
function isPrivateOrLocal(ip: string): boolean {
  if (!ip || ip === "unknown") return true;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip)) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  return false;
}

// GeoIP cache — 24 soat. Rate limit (ipapi.co bepul 30k/oy)ni saqlash uchun.
type GeoRow = { country: string | null; city: string | null; at: number };
const geoCache = new Map<string, GeoRow>();
const GEO_TTL_MS = 24 * 60 * 60 * 1000;
const GEO_TIMEOUT_MS = 2500;

// Tashqi geoIP fallback — CF/Vercel header'lari yo'q holatlarda ishlatiladi (dev, self-host).
// Xato yoki timeout bo'lsa null qaytaradi — hech qachon asosiy oqimni to'xtatmaydi.
export async function lookupGeoIp(ip: string): Promise<{ country: string | null; city: string | null }> {
  if (isPrivateOrLocal(ip)) return { country: null, city: null };
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.at < GEO_TTL_MS) {
    return { country: cached.country, city: cached.city };
  }
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "user-agent": "shotbysardor/1.0 (+admin)" },
    });
    clearTimeout(t);
    if (!res.ok) {
      geoCache.set(ip, { country: null, city: null, at: Date.now() });
      return { country: null, city: null };
    }
    const j = (await res.json().catch(() => null)) as { country_code?: string; country?: string; city?: string; error?: boolean } | null;
    if (!j || j.error) {
      geoCache.set(ip, { country: null, city: null, at: Date.now() });
      return { country: null, city: null };
    }
    const country = (j.country_code ?? j.country ?? null)?.toString().toUpperCase().slice(0, 8) ?? null;
    const city = j.city ? String(j.city).slice(0, 64) : null;
    const row = { country, city, at: Date.now() };
    geoCache.set(ip, row);
    return { country, city };
  } catch {
    geoCache.set(ip, { country: null, city: null, at: Date.now() });
    return { country: null, city: null };
  }
}

// Reverse proxy header'lardan mamlakat/shahar kodini olish. TRUSTED_PROXY yoqilmagan
// prod'da header'lar spoof qilinishi mumkin — null qaytaramiz. Dev'da xavf yo'q, o'qiymiz.
export function extractLocation(
  headers: Headers,
  trustProxy: boolean,
): { country: string | null; city: string | null } {
  const canRead = trustProxy || process.env.NODE_ENV !== "production";
  if (!canRead) return { country: null, city: null };
  const country =
    headers.get("cf-ipcountry") ??
    headers.get("x-vercel-ip-country") ??
    headers.get("x-country-code") ??
    null;
  const city =
    headers.get("cf-ipcity") ??
    headers.get("x-vercel-ip-city") ??
    headers.get("x-city") ??
    null;
  const cleanCountry = country && country !== "XX" ? country.toUpperCase().slice(0, 8) : null;
  const cleanCity = city ? decodeURIComponent(city).slice(0, 64) : null;
  return { country: cleanCountry, city: cleanCity };
}

// Qurilmaning "barmoq izini" hisoblash — bir xil brauzer + OS + mamlakat kombinatsiyasi
// eslab qolinadi. Bu asosan Telegram bildirishnomasi uchun ("yangi qurilma yoki eski?").
export function deviceFingerprint(ua: string | null, country: string | null): string {
  const parsed = parseUserAgent(ua);
  return `${parsed.browser}|${parsed.os}|${country ?? "?"}`;
}
