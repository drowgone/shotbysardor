// Umumiy raqamlar / telefon / karta formatlash yordamchi funksiyalari.
// Kiritish (input) va ko'rsatish uchun ishlatiladi. Formatlashda faqat raqamlar (0-9)
// saqlanadi, natijada bo'sh joylar bilan guruhlangan ko'rinishga qaytariladi.

const NBSP = " "; // non-breaking space — chiroyli ko'rinishda satrga bo'linmaydi

export function digitsOnly(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

// "1234567" → "1 234 567" (min-integer grouping, bo'sh joy — thin space o'rniga NBSP)
export function formatDigitsGrouped(input: string, opts?: { keepLeadingZeros?: boolean }): string {
  const d = digitsOnly(input);
  if (!d) return "";
  const trimmed = opts?.keepLeadingZeros ? d : d.replace(/^0+(?=\d)/, "");
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

// So'mda ko'rsatish: "50000" → "50 000 so'm"
export function formatCurrencyUZS(input: number | string): string {
  const digits = typeof input === "number" ? String(Math.max(0, Math.trunc(input))) : digitsOnly(input);
  if (!digits) return "0 so'm";
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} so'm`;
}

// O'zbek telefon raqami formati: "+998 88 618 19 17"
// Kirish: har qanday matn. Raqamlar olinadi, boshida 998 bo'lsa olib tashlanmaydi.
export function formatPhoneUZ(input: string): string {
  let d = digitsOnly(input);
  // Agar boshida 998 bo'lsa, saqlaymiz. Aks holda 998 bosh belgisini qo'shamiz —
  // faqat kirish kamida 9 raqam va boshida 998 yo'q bo'lsa (odatiy ichki formatni qo'llab-quvvatlash).
  if (d.startsWith("998")) {
    d = d.slice(3);
  } else if (d.startsWith("8") && d.length === 9) {
    // "886181917" — 9 raqam operator kodi bilan
  }
  d = d.slice(0, 9);
  if (!d) return "";
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 7);
  const p4 = d.slice(7, 9);
  let out = "+998";
  if (p1) out += " " + p1;
  if (p2) out += " " + p2;
  if (p3) out += " " + p3;
  if (p4) out += " " + p4;
  return out;
}

// Ushbu variant DB uchun: faqat "998XXXXXXXXX" saqlaydi. Bo'sh bo'lsa "".
export function normalizePhoneRaw(input: string): string {
  let d = digitsOnly(input);
  if (d.startsWith("998")) d = d.slice(3);
  d = d.slice(0, 9);
  if (!d) return "";
  return "+998" + d;
}

// Karta raqami: 4-4-4-4 formatida ko'rsatish. Maksimum 19 raqam (Amex — 15, Visa/Mastercard — 16).
export function formatCard(input: string): string {
  const d = digitsOnly(input).slice(0, 19);
  return d.replace(/(.{4})(?=.)/g, "$1 ");
}

// Kursorni saqlab qolgan holda inputni formatlash uchun yordamchi:
// Formatdan oldingi kursor pozitsiyasidagi RAQAMLAR sonini hisoblaymiz,
// formatdan keyin shu miqdordagi raqam o'tgan yerga qaytaramiz.
export function digitCountBefore(str: string, cursor: number): number {
  let n = 0;
  for (let i = 0; i < Math.min(cursor, str.length); i++) {
    if (str[i] >= "0" && str[i] <= "9") n++;
  }
  return n;
}

export function cursorAfterNthDigit(formatted: string, nDigits: number): number {
  if (nDigits <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] >= "0" && formatted[i] <= "9") {
      seen++;
      if (seen === nDigits) return i + 1;
    }
  }
  return formatted.length;
}
