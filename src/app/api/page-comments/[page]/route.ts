import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import sharp from "sharp";
import { z } from "zod";
import { apiError, ok, clientIp, zodErrorMessage, checkCsrf } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";
import { randomId, sha256 } from "@/lib/utils";
import { getAdminSession } from "@/lib/session";
import { storage } from "@/lib/storage";
import { detectMime, isPhoto } from "@/lib/media";
import { emit } from "@/lib/live/bus";

export const runtime = "nodejs";

// Ruxsat berilgan sahifalar. Yangi sahifa qo'shilsa shu ro'yxatga qo'shiladi —
// nomni qat'iy nazorat qilamiz (arbitrar page nomi bilan spam yaratilmasin).
const ALLOWED_PAGES = new Set(["donate"]);

const ADMIN_DISPLAY_NAME = "Muallif";

function pageLabel(page: string): string {
  if (page === "donate") return "Qo'llab-quvvatlash";
  return page;
}

// ============================================================
// GET — sahifa izohlarini olish
// ============================================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page } = await params;
  if (!ALLOWED_PAGES.has(page)) return apiError(404, "not_found", "Sahifa topilmadi");

  const ip = clientIp(req);
  const rl = rateLimit(`pagecomments:get:${ip}`, 60, 60_000);
  if (!rl.ok) return apiError(429, "rate_limit", "Juda ko'p so'rov");

  const cursor = req.nextUrl.searchParams.get("cursor");
  const jar = await cookies();
  const sid = jar.get("sid")?.value ?? "";

  const limit = 20;
  const items = await prisma.comment.findMany({
    where: { page, status: "APPROVED", parentId: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      replies: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  });
  const hasNext = items.length > limit;
  const list = hasNext ? items.slice(0, limit) : items;

  // Foydalanuvchi like bosgan izohlar
  const allIds = list.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)]);
  const likedRows = sid && allIds.length > 0
    ? await prisma.commentLike.findMany({
        where: { sessionId: sid, commentId: { in: allIds } },
        select: { commentId: true },
      })
    : [];
  const likedSet = new Set(likedRows.map((r) => r.commentId));

  const st = storage();
  const shape = (c: {
    id: string;
    name: string;
    text: string;
    imageKey: string | null;
    createdAt: Date;
    isAdmin: boolean;
    likesCount: number;
    donateAmount: number | null;
  }) => ({
    id: c.id,
    name: c.name,
    text: c.text,
    imageUrl: c.imageKey ? st.publicUrl(c.imageKey) : null,
    createdAt: c.createdAt.toISOString(),
    isAdmin: c.isAdmin,
    likesCount: c.likesCount,
    likedByMe: likedSet.has(c.id),
    donateAmount: c.donateAmount ?? null,
  });

  // Admin ekanligini va CSRF token'ni qaytaramiz — admin kirgan bo'lsa client
  // "Muallif" sifatida yozish va o'chirish/reply tugmalarini ko'rsatadi.
  const adminSession = await getAdminSession();
  const isAdmin = !!adminSession.loggedIn;

  return ok({
    items: list.map((c) => ({
      ...shape(c),
      replies: c.replies.map(shape),
    })),
    nextCursor: hasNext ? list[list.length - 1].id : null,
    viewer: {
      isAdmin,
      csrf: isAdmin ? (adminSession.csrf ?? null) : null,
      displayName: isAdmin ? ADMIN_DISPLAY_NAME : null,
    },
    page: { key: page, label: pageLabel(page) },
  });
}

// ============================================================
// POST — yangi izoh yozish (matn + ixtiyoriy rasm)
// ============================================================
const textSchema = z.string().min(1).max(1000);
const nameSchema = z.string().min(1).max(80);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page } = await params;
  if (!ALLOWED_PAGES.has(page)) return apiError(404, "not_found", "Sahifa topilmadi");

  const adminSession = await getAdminSession();
  const isAdminPost = !!adminSession.loggedIn;
  if (isAdminPost && !checkCsrf(req, adminSession.csrf)) {
    return apiError(403, "csrf", "CSRF");
  }

  const jar = await cookies();
  const sid = jar.get("sid")?.value ?? "unknown";
  const ip = clientIp(req);

  // Rate limit — admin uchun yumshoqroq (spam qilmasligi taxmin qilinadi).
  if (!isAdminPost) {
    const key = `pagecomment:${sid}:${ip}`;
    const rl = rateLimit(key, 1, 30_000);
    if (!rl.ok) return apiError(429, "rate_limit", "Iltimos, biroz kutib turing.");
  } else {
    const rl = rateLimit(`pagecomment:admin:${sid}`, 30, 60_000);
    if (!rl.ok) return apiError(429, "rate_limit", "Juda tez yozyapsiz");
  }

  // Formani multipart yoki JSON qabul qilamiz — rasmni yuklash uchun multipart kerak.
  const contentType = req.headers.get("content-type") ?? "";
  let name = "";
  let text = "";
  let website = ""; // honeypot
  let imageFile: File | null = null;
  let donateAmountRaw = "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    name = String(form.get("name") ?? "").trim();
    text = String(form.get("text") ?? "").trim();
    website = String(form.get("website") ?? "");
    donateAmountRaw = String(form.get("donateAmount") ?? "").trim();
    const f = form.get("image");
    if (f instanceof File && f.size > 0) imageFile = f;
  } else {
    const body = await req.json().catch(() => null);
    name = String(body?.name ?? "").trim();
    text = String(body?.text ?? "").trim();
    website = String(body?.website ?? "");
    donateAmountRaw = String(body?.donateAmount ?? "").trim();
  }

  // Qo'llash summasi — faqat /donate sahifasida saqlanadi. Boshqa sahifalarda tashlanadi.
  // Musbat butun son bo'lishi kerak (UZS). Katta chegara — g'ayrioddiy sonlarni blokda saqlash.
  let donateAmount: number | null = null;
  if (page === "donate" && donateAmountRaw) {
    const n = Number(donateAmountRaw.replace(/\D/g, ""));
    if (Number.isInteger(n) && n > 0 && n <= 1_000_000_000) donateAmount = n;
  }

  // Honeypot — bo't to'ldiradi, real foydalanuvchi bo'sh qoldiradi.
  if (website.length > 0) return ok({ ok: true }); // silent success

  // Admin bo'lsa nomni majburiy "Muallif" qilamiz — kim bo'lishidan qat'i nazar.
  if (isAdminPost) name = ADMIN_DISPLAY_NAME;

  const parsedName = nameSchema.safeParse(name);
  if (!parsedName.success) return apiError(400, "validation", zodErrorMessage(parsedName.error));
  const parsedText = textSchema.safeParse(text);
  if (!parsedText.success) return apiError(400, "validation", zodErrorMessage(parsedText.error));

  // Nom uzunligini sozlamalardan olib ham cheklaymiz.
  if (!isAdminPost) {
    const nameMax = await getSetting("comments.nameMaxLen");
    if (name.length > nameMax) return apiError(400, "name_too_long", `Ism ${nameMax} belgidan uzun`);

    const banned = await getSetting("comments.bannedWords");
    const t = text.toLowerCase();
    for (const w of banned) {
      if (w && t.includes(w.toLowerCase())) {
        return apiError(400, "banned_word", "Izohda ruxsat etilmagan so'z bor");
      }
    }
  }

  // Rasm bo'lsa — kichraytiramiz, webp'ga o'giramiz, public storage'ga yuklaymiz.
  let imageKey: string | null = null;
  if (imageFile) {
    const MAX_MB = 5;
    if (imageFile.size > MAX_MB * 1024 * 1024) {
      return apiError(413, "too_large", `Rasm ${MAX_MB}MB dan katta`);
    }
    const buf = Buffer.from(await imageFile.arrayBuffer());
    const mime = detectMime(buf);
    if (!isPhoto(mime)) return apiError(415, "unsupported", "Rasm formati qo'llab-quvvatlanmaydi");

    // Image bomb himoyasi — dekompressiyadan avval o'lchov tekshirish.
    let meta;
    try {
      meta = await sharp(buf, { failOn: "none" }).metadata();
    } catch {
      return apiError(400, "invalid_image", "Rasm noto'g'ri");
    }
    const pixels = (meta.width ?? 0) * (meta.height ?? 0);
    if (pixels === 0 || pixels > 40_000_000) {
      return apiError(400, "too_large", "Rasm juda katta yoki noto'g'ri");
    }

    const processed = await sharp(buf, { failOn: "none" })
      .rotate()
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();

    imageKey = `comment-images/${randomId(12)}.webp`;
    await storage().putBuffer("public", imageKey, processed, "image/webp");
  }

  // Admin izohlari darhol APPROVED, oddiy foydalanuvchi izohi moderatsiyaga bog'liq.
  const moderation = await getSetting("comments.moderation");
  const status = isAdminPost || !moderation ? "APPROVED" : "PENDING";
  const ipHash = await sha256(ip + ":" + (process.env.SESSION_SECRET ?? ""));

  const created = await prisma.comment.create({
    data: {
      page,
      name,
      text,
      imageKey,
      status,
      isAdmin: isAdminPost,
      ipHash,
      donateAmount,
    },
  });

  // Live — admin ro'yxati va donate sahifasi tinglovchilariga.
  emit("comments", { action: "create", id: created.id, meta: { page } });
  emit(`comments:page:${page}`, { action: "create", id: created.id });

  const st = storage();
  return ok({
    item: {
      id: created.id,
      name: created.name,
      text: created.text,
      imageUrl: created.imageKey ? st.publicUrl(created.imageKey) : null,
      createdAt: created.createdAt.toISOString(),
      status: created.status,
      isAdmin: created.isAdmin,
      likesCount: 0,
      likedByMe: false,
      donateAmount: created.donateAmount ?? null,
    },
    pending: status === "PENDING",
  });
}
