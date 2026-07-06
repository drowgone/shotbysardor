// OCR chek verifikatsiyasi turlari.
// Tizim tasdiqlamaydi/rad etmaydi — faqat administrator uchun ma'lumot yig'adi.

export type FindingKey =
  | "amount"
  | "card"
  | "date"
  | "currency"
  | "paymentSystem"
  | "statusText";

export type Finding = {
  key: FindingKey;
  label: string;
  found: boolean;
  value?: string;
  match?: boolean; // true = kutilgan qiymatga mos (masalan admin kartasining oxirgi 4 raqami)
};

export type AnalyzeInput = {
  imageBuffer: Buffer;
  expectedAmount?: number;
  expectedCardLast4?: string | null;
};

export type OcrLevel = "high" | "medium" | "low";

export type AnalyzeResult = {
  score: number;
  level: OcrLevel;
  findings: Finding[];
  foundCount: number;
  text: string;
  ocrConfidence: number;
};

export type OcrRun = { text: string; confidence: number };

export interface OcrProvider {
  name: string;
  run(image: Buffer): Promise<OcrRun>;
}
