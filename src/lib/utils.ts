import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatUZS(n: number): string {
  return formatNumber(n) + " so'm";
}

// Server va brauzerda bir xil natija — hydration mismatch bo'lmasligi uchun
export function formatNumber(n: number): string {
  const s = Math.trunc(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return n < 0 ? "-" + s : s;
}

// Sana → o'zbekcha format (12.05.2026)
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function formatYear(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return String(d.getFullYear());
}

export function formatTimeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `hozir`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} DAQIQA OLDIN`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} SOAT OLDIN`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return `${dd} KUN OLDIN`;
  const mo = Math.floor(dd / 30);
  if (mo < 12) return `${mo} OY OLDIN`;
  const y = Math.floor(mo / 12);
  return `${y} YIL OLDIN`;
}

// Janr/joylashuv nomini normallashtirish: kesish, bir bo'shliqqa keltirish, birinchi harfni katta qilish.
// Har bir so'zning birinchi harfi bosh harfga aylanadi ("kok cha" → "Kok Cha"), foydalanuvchi kiritgan
// katta-kichik harflar boshqa joylarda saqlanadi ("iPhone" ni "IPhone" ga aylantirmaslik uchun faqat
// oldingi harf bo'sh joy yoki qator boshi bo'lsagina kapitalizatsiya qilamiz).
export function normalizeName(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed
    .split(" ")
    .map((word) => (word ? word[0].toLocaleUpperCase("uz-UZ") + word.slice(1) : word))
    .join(" ");
}

// EXIF matnini olib tashlash: transliteratsiya + slug uchun
export function slugify(input: string): string {
  const map: Record<string, string> = {
    "ʻ": "",
    "‘": "",
    "’": "",
    "'": "",
    "ў": "u", "ғ": "g", "қ": "q", "ҳ": "h",
    "Ў": "u", "Ғ": "g", "Қ": "q", "Ҳ": "h",
    "ә": "a", "ө": "o",
  };
  const s = input
    .toLowerCase()
    .split("")
    .map((c) => (c in map ? map[c] : c))
    .join("")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "kontent";
}

export function shortSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

// Sha256 hash — IP saqlashsiz rate-limit uchun
export async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomId(len = 16): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Seedlangan Fisher–Yates aralashish — server va clientda bir xil natija.
// Kontent tartibini sessiya davomida barqaror qilish uchun.
export function shuffleWithSeed<T>(arr: T[], seed: string): T[] {
  const s = fnv1a(seed);
  const rand = mulberry32(s);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function fnv1a(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f7);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Order kodi: SB-1042
export function nextOrderCode(seq: number): string {
  return `SB-${1000 + seq}`;
}

export function isMobileUA(ua: string): boolean {
  return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua);
}

// Asl fayl o'lchamiga qarab sifat rozetkasi: 8K / 4K / 2K / FHD / HD / SD
export function qualityLabel(
  origWidth: number | null | undefined,
  origHeight: number | null | undefined,
): string | null {
  if (!origWidth || !origHeight) return null;
  const longEdge = Math.max(origWidth, origHeight);
  if (longEdge >= 7680) return "8K";
  if (longEdge >= 3840) return "4K";
  if (longEdge >= 2560) return "2K";
  if (longEdge >= 1920) return "FHD";
  if (longEdge >= 1280) return "HD";
  return "SD";
}

export function externalReferrerHost(ref: string | null, currentHost: string): string | null {
  if (!ref) return null;
  try {
    const url = new URL(ref);
    if (url.hostname === currentHost) return null;
    return url.hostname;
  } catch {
    return null;
  }
}
