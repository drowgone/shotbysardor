// Karta turlari va ular bilan ishlash. Uzcard/Humo — mahalliy, Visa/Mastercard — xalqaro.
// Brand raqamdan avtomatik aniqlanadi ("BIN" — birinchi 4-6 raqam), lekin admin qo'lda ham
// belgilashi mumkin (masalan avtomatik aniqlash ishlamasa).

export type CardBrand = "uzcard" | "humo" | "visa" | "mastercard" | "other";

export const CARD_BRANDS: {
  id: CardBrand;
  name: string;
  color: string;
  bg: string;
}[] = [
  { id: "uzcard", name: "UzCard", color: "#0ea5a4", bg: "rgba(14,165,164,0.12)" },
  { id: "humo", name: "Humo", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  { id: "visa", name: "Visa", color: "#1a1f71", bg: "rgba(76,141,255,0.14)" },
  { id: "mastercard", name: "Mastercard", color: "#eb001b", bg: "rgba(235,0,27,0.10)" },
  { id: "other", name: "Boshqa", color: "#a6a29a", bg: "rgba(166,162,154,0.14)" },
];

export function detectCardBrand(rawNumber: string): CardBrand {
  const n = rawNumber.replace(/\D/g, "");
  if (!n) return "other";
  // UzCard — 8600
  if (n.startsWith("8600")) return "uzcard";
  // Humo — 9860
  if (n.startsWith("9860")) return "humo";
  // Visa — 4
  if (n.startsWith("4")) return "visa";
  // Mastercard — 51-55 va 2221-2720
  if (/^5[1-5]/.test(n)) return "mastercard";
  if (/^2(2[2-9]|[3-6]\d|7[01]|720)/.test(n)) return "mastercard";
  return "other";
}

export function getBrandInfo(brand: CardBrand) {
  return CARD_BRANDS.find((b) => b.id === brand) ?? CARD_BRANDS[CARD_BRANDS.length - 1];
}

// "8600 1234 5678 9012" ko'rinishida — 4-4-4-4 guruhlangan
export function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.match(/.{1,4}/g)?.join(" ") ?? raw;
}

// Oxirgi 4 raqamni ko'rsatish — "•••• 8188"
export function maskedCard(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4) return raw;
  return `•••• ${digits.slice(-4)}`;
}

export type PaymentCard = {
  brand: CardBrand;
  number: string;
  holder: string;
};

// Eski sozlama (bitta karta) → yangi shakl (kartalar ro'yxati). Backward-compat.
export type LegacyPaymentDetails = {
  cardNumber?: string;
  cardHolder?: string;
  cards?: PaymentCard[];
  paymeUrl: string;
  clickUrl: string;
};

export type NormalizedPayment = {
  cards: PaymentCard[];
  paymeUrl: string;
  clickUrl: string;
};

export function normalizePayment(p: LegacyPaymentDetails | undefined | null): NormalizedPayment {
  if (!p) return { cards: [], paymeUrl: "", clickUrl: "" };
  const cards: PaymentCard[] = Array.isArray(p.cards) ? p.cards.filter((c) => c && c.number) : [];
  // Eski shaklda faqat bitta karta bo'lsa — kartalar ro'yxatiga qo'shamiz
  if (cards.length === 0 && p.cardNumber) {
    cards.push({
      number: p.cardNumber,
      holder: p.cardHolder ?? "",
      brand: detectCardBrand(p.cardNumber),
    });
  }
  return {
    cards,
    paymeUrl: p.paymeUrl ?? "",
    clickUrl: p.clickUrl ?? "",
  };
}
