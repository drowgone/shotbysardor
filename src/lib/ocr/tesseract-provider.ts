import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import type { OcrProvider, OcrRun } from "./types";

// Tesseract.js provider — server tomonda ishlaydi, tashqi API'ga hech nima yubormaydi.
// Til modellari (rus+eng) birinchi ishga tushishda CDN'dan yuklab olinadi va lokal
// keshlanadi. Ishchi bir marta yaratilib, keyingi so'rovlarda qayta ishlatiladi.

type TesseractWorker = {
  recognize: (b: Buffer) => Promise<{ data: { text: string; confidence: number } }>;
  terminate?: () => Promise<void>;
};

let workerPromise: Promise<TesseractWorker> | null = null;

// Webpack `require.resolve` ni shim qilib, kirish satrini o'zgarishsiz qaytaradi.
// Shu sabab createRequire'ni loyiha package.json ga anchor qilamiz — bu haqiqiy Node require.
const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));

function resolveTesseractPaths() {
  let workerPath: string | undefined;
  let corePath: string | undefined;
  try {
    const resolved = nodeRequire.resolve("tesseract.js/src/worker-script/node/index.js");
    if (path.isAbsolute(resolved) && fs.existsSync(resolved)) workerPath = resolved;
  } catch {}
  try {
    const coreDir = path.dirname(nodeRequire.resolve("tesseract.js-core/package.json"));
    if (path.isAbsolute(coreDir) && fs.existsSync(coreDir)) corePath = coreDir;
  } catch {}
  // Fallback — node_modules layout'iga to'g'ridan-to'g'ri havola qilamiz.
  if (!workerPath) {
    const candidate = path.resolve(process.cwd(), "node_modules/tesseract.js/src/worker-script/node/index.js");
    if (fs.existsSync(candidate)) workerPath = candidate;
  }
  if (!corePath) {
    const candidate = path.resolve(process.cwd(), "node_modules/tesseract.js-core");
    if (fs.existsSync(candidate)) corePath = candidate;
  }
  return { workerPath, corePath };
}

async function getWorker(): Promise<TesseractWorker> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    const mod = await import("tesseract.js");
    const { workerPath, corePath } = resolveTesseractPaths();

    // Log — birinchi ishga tushirish sekin (til paketlari CDN'dan yuklanadi ~10MB).
    // eslint-disable-next-line no-console
    console.log("[ocr] initializing tesseract worker (rus+eng)…", { workerPath, corePath });

    // Faqat absolyut yo'llar bo'lsa uzatamiz — aks holda Worker constructor
    // ERR_WORKER_PATH beradi. Yo'l topilmasa — tesseract.js o'zining default'idan foydalanadi.
    const opts: Record<string, unknown> = {
      cachePath: path.join(process.cwd(), ".tesseract-cache"),
    };
    if (workerPath && path.isAbsolute(workerPath)) opts.workerPath = workerPath;
    if (corePath && path.isAbsolute(corePath)) opts.corePath = corePath;

    // langPath berilmasa CDN https://tessdata.projectnaptha.com dan yuklab olinadi
    // va cachePath'ga keshlanadi.
    const worker = await mod.createWorker(["rus", "eng"], 1, {
      ...opts,
      logger: (m: { status?: string; progress?: number }) => {
        if (m.status && m.status !== "recognizing text") {
          // eslint-disable-next-line no-console
          console.log(`[ocr] ${m.status} ${m.progress != null ? Math.round(m.progress * 100) + "%" : ""}`);
        }
      },
      errorHandler: (e: unknown) => {
        // eslint-disable-next-line no-console
        console.error("[ocr] worker error:", e);
      },
    });
    // eslint-disable-next-line no-console
    console.log("[ocr] tesseract worker ready");
    return worker as unknown as TesseractWorker;
  })().catch((e) => {
    // Xato bo'lsa — keyingi so'rov qayta urinib ko'radi
    workerPromise = null;
    throw e;
  });
  return workerPromise;
}

async function preprocess(image: Buffer): Promise<Buffer> {
  // EXIF orientation, kattaligini cheklab — Tesseract aniqligini oshiradi.
  // Rangdan voz kechmaymiz (Payme/Click UI rangli ekran), lekin sharpen bilan matnni ajratib olamiz.
  return sharp(image)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .sharpen()
    .toFormat("png")
    .toBuffer();
}

export const tesseractProvider: OcrProvider = {
  name: "tesseract",
  async run(image: Buffer): Promise<OcrRun> {
    const prepared = await preprocess(image);
    const worker = await getWorker();
    const { data } = await worker.recognize(prepared);
    // eslint-disable-next-line no-console
    console.log(
      "[ocr] result — confidence:",
      data.confidence,
      "textLength:",
      (data.text ?? "").length,
    );
    return { text: data.text ?? "", confidence: data.confidence ?? 0 };
  },
};
