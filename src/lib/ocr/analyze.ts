import { tesseractProvider } from "./tesseract-provider";
import {
  extractAmounts,
  extractCardLast4,
  extractDates,
  detectCurrency,
  detectPaymentSystem,
  detectStatusText,
} from "./extractors";
import type { AnalyzeInput, AnalyzeResult, Finding, OcrLevel } from "./types";

// Ball taqsimoti (foydalanuvchi speclarida keltirilgan): summa 40 + karta 30 + sana 10 + valyuta 10 + tizim 10 + holat 10 = 110 (max 100 ga cheklaymiz)
const WEIGHTS = {
  amount: 40,
  card: 30,
  date: 10,
  currency: 10,
  paymentSystem: 10,
  statusText: 10,
};

// OCR sinxron chaqiruvi. Timeout — birinchi so'rovda til modellari (rus+eng ~10MB) yuklab
// olinadi, shuning uchun yetarlicha uzun. Keyingi so'rovlar 3–6s.
const OCR_TIMEOUT_MS = 120_000;

// Bir vaqtning o'zida ishlaydigan OCR chaqiruvlar chegarasi. DDoS/resurs charchash'iga
// qarshi eng oddiy va samarali himoya. Har bir OCR call ~200MB RAM + CPU sarflashi mumkin.
// MAX_CONCURRENT_OCR env orqali sozlanadi (standart: 2).
const MAX_CONCURRENT_OCR = Math.max(1, Number(process.env.MAX_CONCURRENT_OCR ?? 2));
// Navbatga qo'yilishi mumkin bo'lgan maksimum. Bu ham to'lganida so'rov darrov rad etiladi
// — buffer holida ushlab qolmaymiz, aks holda RAM to'planadi.
const MAX_OCR_QUEUE = Math.max(2, Number(process.env.MAX_OCR_QUEUE ?? 8));

let ocrInFlight = 0;
const ocrWaiters: Array<() => void> = [];

async function acquireOcrSlot(): Promise<void> {
  if (ocrInFlight < MAX_CONCURRENT_OCR) {
    ocrInFlight++;
    return;
  }
  if (ocrWaiters.length >= MAX_OCR_QUEUE) {
    const err = new Error("ocr_busy") as Error & { code?: string };
    err.code = "ocr_busy";
    throw err;
  }
  await new Promise<void>((resolve) => ocrWaiters.push(resolve));
  ocrInFlight++;
}

function releaseOcrSlot(): void {
  ocrInFlight = Math.max(0, ocrInFlight - 1);
  const next = ocrWaiters.shift();
  if (next) next();
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

export async function analyzeReceipt(input: AnalyzeInput): Promise<AnalyzeResult> {
  await acquireOcrSlot();
  let run;
  try {
    run = await withTimeout(tesseractProvider.run(input.imageBuffer), OCR_TIMEOUT_MS, "ocr");
  } finally {
    releaseOcrSlot();
  }
  const text = run.text ?? "";

  const findings: Finding[] = [];
  let score = 0;

  // 1. Summa
  const amounts = extractAmounts(text);
  const expected = input.expectedAmount;
  let amountMatch: number | null = null;
  if (amounts.length > 0 && expected != null && expected > 0) {
    const tol = Math.max(500, expected * 0.05);
    amountMatch = amounts.find((a) => Math.abs(a - expected) <= tol) ?? null;
  }
  if (amounts.length > 0) {
    findings.push({
      key: "amount",
      label: "Summa",
      found: true,
      value: amountMatch != null ? String(amountMatch) : amounts.slice(0, 3).join(", "),
      match: amountMatch != null,
    });
    // To'liq mos → 40; nomos summa → 20 (yarim ball, kompensatsiya sifatida)
    score += amountMatch != null ? WEIGHTS.amount : WEIGHTS.amount * 0.5;
  } else {
    findings.push({ key: "amount", label: "Summa", found: false });
  }

  // 2. Karta oxirgi 4 raqami
  const cards = extractCardLast4(text);
  const expectedCard = input.expectedCardLast4 || null;
  let cardMatch: string | null = null;
  if (cards.length > 0 && expectedCard) {
    cardMatch = cards.find((c) => c === expectedCard) ?? null;
  }
  if (cards.length > 0) {
    findings.push({
      key: "card",
      label: "Karta",
      found: true,
      value: cardMatch ? `****${cardMatch}` : `****${cards[0]}`,
      match: !!cardMatch,
    });
    score += cardMatch ? WEIGHTS.card : WEIGHTS.card * 0.6;
  } else {
    findings.push({ key: "card", label: "Karta", found: false });
  }

  // 3. Sana
  const dates = extractDates(text);
  const now = Date.now();
  let dateMatch: Date | null = null;
  if (dates.length > 0) {
    for (const d of dates) {
      const diffH = Math.abs(now - d.getTime()) / 3_600_000;
      if (diffH <= 48) {
        dateMatch = d;
        break;
      }
    }
  }
  if (dates.length > 0) {
    const shown = dateMatch ?? dates[0];
    findings.push({
      key: "date",
      label: "Sana",
      found: true,
      value: formatDate(shown),
      match: !!dateMatch,
    });
    score += dateMatch ? WEIGHTS.date : WEIGHTS.date * 0.5;
  } else {
    findings.push({ key: "date", label: "Sana", found: false });
  }

  // 4. Valyuta
  const currency = detectCurrency(text);
  findings.push({
    key: "currency",
    label: "Valyuta",
    found: !!currency,
    value: currency ?? undefined,
    match: currency === "UZS",
  });
  if (currency) score += WEIGHTS.currency;

  // 5. To'lov tizimi
  const paymentSystem = detectPaymentSystem(text);
  findings.push({
    key: "paymentSystem",
    label: "To'lov tizimi",
    found: !!paymentSystem,
    value: paymentSystem ?? undefined,
    match: !!paymentSystem,
  });
  if (paymentSystem) score += WEIGHTS.paymentSystem;

  // 6. Muvaffaqiyat matni
  const statusText = detectStatusText(text);
  findings.push({
    key: "statusText",
    label: "Holat matni",
    found: !!statusText,
    value: statusText ?? undefined,
    match: !!statusText,
  });
  if (statusText) score += WEIGHTS.statusText;

  const foundCount = findings.filter((f) => f.found).length;
  const finalScore = Math.min(100, Math.round(score));
  const level: OcrLevel = finalScore >= 90 ? "high" : finalScore >= 60 ? "medium" : "low";

  return {
    score: finalScore,
    level,
    findings,
    foundCount,
    text,
    ocrConfidence: run.confidence,
  };
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}
