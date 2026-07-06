import { prisma } from "./db";
import type { PaymentCard } from "./cards";

// Sozlamalarning turlari — PROMPT.md §3 jadvali
export type SettingsMap = {
  "site.title": string;
  "site.tagline": string;
  "site.bio": string;
  "site.heroContentId": string | null;
  "site.aboutPortraitKey": string | null;
  "site.socials": { instagram: string; telegram: string; phone: string; email: string };
  "donate.enabled": boolean;
  "donate.title": string;
  "donate.description": string;
  "donate.thankYou": string;
  "donate.suggestedAmounts": number[];
  "content.previewMaxEdge": 1280 | 1600 | 1920;
  // Yoqilgan bo'lsa — foydalanuvchi bosh sahifani har safar ochganda kontentlar tartibi
  // yangi tasodifiy seed bilan qayta aralashadi. O'chirilgan bo'lsa — tartib sessiya
  // (`sid` cookie) davomida barqaror qoladi va faqat Hero yangilanadi.
  "gallery.shufflePerVisit": boolean;
  "order.defaultPriceUZS": number;
  "order.paymentDetails": {
    // Eski maydonlar — backward-compat (`normalizePayment` da o'qib olinadi)
    cardNumber?: string;
    cardHolder?: string;
    // Yangi shakl — kartalar ro'yxati (birinchisi asosiy)
    cards?: PaymentCard[];
    paymeUrl: string;
    clickUrl: string;
  };
  "order.linkTtlHours": number;
  "order.maxDownloads": number;
  "order.telegram": { enabled: boolean; botToken: string; chatId: string; webhookSecret: string };
  "comments.moderation": boolean;
  "comments.bannedWords": string[];
  "comments.nameMaxLen": number;
  "analytics.excludeAdmin": boolean;
  "analytics.retentionDays": number;
  "security.screenshotGuard": boolean;
  // Klient tomondan bloklashlar. Har biri alohida yoqib/o'chirilishi mumkin.
  "security.protection": {
    rightClick: boolean;
    dragDrop: boolean;
    textSelect: boolean;
    copy: boolean;
    save: boolean;
    devTools: boolean;
    printScreen: boolean;
  };
  // Server tomonidan resurslarni himoyalash sozlamalari.
  "security.server": {
    hotlink: boolean; // Referer tekshiruvi — faqat o'z domen
    publicRateLimit: boolean; // /api/storage/public rate-limit
    signedPreviews: boolean; // preview URL uchun signed token (kelajakda uzaytiriladi)
    allowedOrigins: string[]; // Hotlink ruxsat berilgan domenlar (bo'sh — faqat request host)
  };
  "admin.username": string;
  "admin.passwordHash": string;
  "admin.credentialsUpdatedAt": string | null;
  // Har safar login/parol o'zgarganda oshiriladi. Sessiya cookie'sidagi `v` bilan solishtiriladi
  // — moslik bo'lmasa, cookie yaroqsiz. Shu bilan barcha eski sessiyalar o'chadi.
  "admin.sessionVersion": number;
};

export const defaultSettings: SettingsMap = {
  "site.title": "shot by sardor",
  "site.tagline": "",
  "site.bio": "",
  "site.heroContentId": null,
  "site.aboutPortraitKey": null,
  "site.socials": { instagram: "shotbysardor", telegram: "", phone: "", email: "" },
  "donate.enabled": true,
  "donate.title": "Ijodni qo'llab-quvvatlash",
  "donate.description":
    "Har bir hissa yangi safarga, yangi jihozga va yangi kadrlarga aylanadi. Ko'p yoki oz — muhim emas, minnatdorman.",
  "donate.thankYou": "Rahmat! Sizning yordamingiz keyingi kadrlarga aylanadi.",
  "donate.suggestedAmounts": [20000, 50000, 100000, 250000],
  "content.previewMaxEdge": 1920,
  "gallery.shufflePerVisit": true,
  "order.defaultPriceUZS": 0,
  "order.paymentDetails": { cards: [], paymeUrl: "", clickUrl: "" },
  "order.linkTtlHours": 48,
  "order.maxDownloads": 3,
  "order.telegram": { enabled: false, botToken: "", chatId: "", webhookSecret: "" },
  "comments.moderation": false,
  "comments.bannedWords": [],
  "comments.nameMaxLen": 30,
  "analytics.excludeAdmin": true,
  "analytics.retentionDays": 365,
  "security.screenshotGuard": true,
  "security.protection": {
    rightClick: true,
    dragDrop: true,
    textSelect: true,
    copy: true,
    save: true,
    devTools: true,
    printScreen: true,
  },
  "security.server": {
    hotlink: true,
    publicRateLimit: true,
    signedPreviews: false,
    allowedOrigins: [],
  },
  "admin.username": "admin",
  "admin.passwordHash": "",
  "admin.credentialsUpdatedAt": null,
  "admin.sessionVersion": 1,
};

export async function getSetting<K extends keyof SettingsMap>(
  key: K,
  fallback?: SettingsMap[K],
): Promise<SettingsMap[K]> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    if (row) return row.value as SettingsMap[K];
  } catch {
    // DB tayyor bo'lmasa — standart
  }
  return (fallback ?? defaultSettings[key]) as SettingsMap[K];
}

export async function getAllSettings(): Promise<SettingsMap> {
  const rows = await prisma.setting.findMany();
  const out: Record<string, unknown> = { ...defaultSettings };
  for (const r of rows) out[r.key] = r.value;
  return out as SettingsMap;
}

export async function setSetting<K extends keyof SettingsMap>(
  key: K,
  value: SettingsMap[K],
): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}
