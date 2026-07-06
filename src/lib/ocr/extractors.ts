// Regex asosidagi extractorlar. Har bir extractor OCR matni ustidan ishlaydi.
// OCR noto'g'ri belgilar berishi mumkin — shuning uchun tolerant patternlar tanlaymiz.

// Sonli qiymat: 20 000, 20.000, 20,000, 20'000, 20000, 20 000.00
const AMOUNT_RE = /(?<![.,\d])(\d{1,3}(?:[\s .,'`]\d{3})+(?:[.,]\d{2})?|\d{4,}(?:[.,]\d{2})?)(?![.,\d])/g;

// Maskirovka bilan yozilgan oxirgi 4 raqam: **** 1663 · •• 1663 · xxxx 1663 · ХХХХ 1663
const CARD_LAST4_MASKED_RE = /(?:[•*·xх×■□▪-]{2,}\s*)(\d{4})\b/g;

// To'liq karta raqami (13-19 raqam), bo'shliq yoki tire bilan
const FULL_CARD_RE = /\b(?:\d[ \-]?){13,19}\d\b/g;

// Sana formatlari
const DATE_DMY_RE = /\b(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})\b/g;
const DATE_ISO_RE = /\b(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})\b/g;
const DATE_MONTH_RE =
  /\b(\d{1,2})\s+(янв|фев|мар|апр|май|мая|июн|июл|авг|сен|окт|ноя|дек|yan|fev|mar|apr|may|iyn|iyl|avg|sen|okt|noy|dek)[а-яa-zʻ']*\s+(20\d{2})\b/gi;

const RU_MONTHS: Record<string, number> = {
  янв: 0, фев: 1, мар: 2, апр: 3, май: 4, мая: 4, июн: 5, июл: 6, авг: 7, сен: 8, окт: 9, ноя: 10, дек: 11,
  yan: 0, fev: 1, mar: 2, apr: 3, may: 4, iyn: 5, iyl: 6, avg: 7, sen: 8, okt: 9, noy: 10, dek: 11,
};

export function extractAmounts(text: string): number[] {
  const out = new Set<number>();
  const matches = text.matchAll(AMOUNT_RE);
  for (const m of matches) {
    let raw = m[1].replace(/[\s '`]/g, "");
    // ".XX" oxirida — kasr; barcha nuqta/vergul separatorlarni normallashtiramiz
    const decimalMatch = raw.match(/[.,](\d{2})$/);
    if (decimalMatch) {
      const decimals = decimalMatch[1];
      raw = raw.slice(0, -3).replace(/[.,]/g, "") + "." + decimals;
    } else {
      raw = raw.replace(/[.,]/g, "");
    }
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 500 && n <= 1_000_000_000) {
      out.add(Math.trunc(n));
    }
  }
  return [...out];
}

export function extractCardLast4(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(CARD_LAST4_MASKED_RE)) out.add(m[1]);
  for (const m of text.matchAll(FULL_CARD_RE)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19) out.add(digits.slice(-4));
  }
  return [...out];
}

export function extractDates(text: string): Date[] {
  const out: Date[] = [];
  for (const m of text.matchAll(DATE_DMY_RE)) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) out.push(new Date(y, mo - 1, d));
  }
  for (const m of text.matchAll(DATE_ISO_RE)) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) out.push(new Date(y, mo - 1, d));
  }
  for (const m of text.matchAll(DATE_MONTH_RE)) {
    const d = Number(m[1]);
    const key = m[2].toLowerCase().slice(0, 3);
    const mo = RU_MONTHS[key];
    const y = Number(m[3]);
    if (mo !== undefined && d >= 1 && d <= 31) out.push(new Date(y, mo, d));
  }
  return out;
}

export function detectCurrency(text: string): "UZS" | null {
  const t = text.toLowerCase();
  if (/\buzs\b/.test(t)) return "UZS";
  if (/so[ʻ'`'']?\s?m\b/.test(t)) return "UZS";
  if (/су[ʻ'`'']?\s?м\b/.test(t)) return "UZS";
  if (/сум\b/.test(t)) return "UZS";
  return null;
}

export function detectPaymentSystem(text: string): string | null {
  const t = text.toLowerCase();
  if (/\bpayme\b/.test(t) || /\bпэйми?е?\b/.test(t) || /\bпейме?\b/.test(t)) return "Payme";
  if (/\bclick\b/.test(t) || /\bклик\b/.test(t)) return "Click";
  if (/uzum\s*bank/.test(t) || /узум\s*банк/.test(t) || /\buzum\b/.test(t)) return "Uzum Bank";
  if (/anor\s*bank/.test(t) || /анор\s*банк/.test(t)) return "Anor Bank";
  return null;
}

export function detectStatusText(text: string): string | null {
  const t = text.toLowerCase();
  if (/оплачен[аоы]?/.test(t)) return "Оплачено";
  if (/успешн[оаы]/.test(t)) return "Успешно";
  if (/перевод\s+выполнен/.test(t)) return "Перевод выполнен";
  if (/\bpaid\b/.test(t)) return "Paid";
  if (/payment\s+success/.test(t)) return "Payment Successful";
  if (/muvaffaqiyatli/.test(t) || /to[ʻ'`']?landi/.test(t)) return "Muvaffaqiyatli";
  return null;
}
