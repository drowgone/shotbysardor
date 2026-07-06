# SHOTBYSARDOR — PROMPT.md
**Texnik topshiriq (build-prompt) · v1.0 · 2026-07**

> Bu fayl — AI-builder (Claude Code, Cursor va h.k.) uchun to'liq texnik topshiriq. U `design.md` bilan **juftlikda** ishlaydi: barcha vizual va UX qarorlar (ranglar, shriftlar, joylashuv, animatsiya, mikromatnlar) `design.md`da yozilgan — ularni so'zma-so'z bajar, "yaxshilashga" urinma. Ushbu fayl esa arxitektura, ma'lumotlar bazasi, API va biznes-logikani belgilaydi. Kod bilan hujjatlar zid kelsa — hujjatlar ustun.
>
> **Ishlatish:** ikkala faylni loyiha ildiziga qo'ying va agentga shunday deng: *"design.md va PROMPT.md fayllarini to'liq o'qib chiq, so'ng loyihani PROMPT.md §12 dagi tartibda qur. Har bosqich oxirida natijani ishga tushirib ko'rsat."*

---

## 0 · Rol va vazifa

Sen — tajribali senior full-stack muhandissan. Fotograf **Sardor** (Instagram: `@shotbysardor`) uchun shaxsiy portfolio-saytni noldan qurasan:

- yuqori sifatli foto/video galereya (himoyalangan preview'lar bilan);
- originalni **buyurtma orqali** yuklab olish: mijoz to'lov qiladi (chek yuklaydi) → admin tasdiqlaydi → muddatli maxsus havola ochiladi;
- **accountsiz izohlar** (faqat ism so'raladi);
- **janr / joylashuv / sana** bo'yicha filtrlash;
- to'liq **admin panel**: kontent yuklash (joylashuv autosuggest bilan), izohlar, buyurtmalar, analitika (trafik, eng ko'p ko'rilganlar), sozlamalar.

Ishlash qoidalari:
1. `design.md` §14 dagi tokenlarni o'zgartirmasdan ulab ol; UI matnlarini `design.md` §13 lug'atidan ol (yagona `uz` lug'at faylida saqla).
2. TypeScript **strict** rejimda. Kod ichidagi identifikatorlar inglizcha (dasturlash standarti), izoh (comment)lar o'zbekcha bo'lishi mumkin.
3. Noaniq joy chiqsa — eng oqilona standart yechimni tanla va uni `README.md`da "Qabul qilingan qarorlar" bo'limida qayd et. To'xtab savol berma.
4. Har bosqichdan keyin loyihani ishga tushirib, ishlashini tekshir (§12).
5. Hech qanday soxta/mock ma'lumot ishlab chiqarishga qurilma — hammasi real DB bilan ishlasin; faqat dev uchun `prisma/seed.ts` da namunaviy kontent bo'lsin.

---

## 1 · Texnologiyalar (stack)

Shu tanlov bilan qur (almashtirma):

| Qatlam | Tanlov | Izoh |
|---|---|---|
| Framework | **Next.js 15+** (App Router, Server Components) + TypeScript | SSR + SEO + intercepting routes (lightbox) |
| Stil | **Tailwind CSS v4** | `design.md` §14 tokenlari CSS variables sifatida ulanadi |
| Ma'lumotlar bazasi | **PostgreSQL + Prisma ORM** | lokal dev uchun `docker-compose.yml` |
| Fayl ombori | **S3-mos ombor (Cloudflare R2 tavsiya)** | `StorageProvider` interfeysi orqali abstraksiya: `r2` va `local` drayverlari. Kalitlar berilmagan bo'lsa `local` (`storage/` papka) bilan ishlasin — keyin R2 ga o'tish faqat `.env` o'zgarishi bo'lsin |
| Rasm ishlovi | **sharp** + **blurhash** | preview, thumb, watermark, blurhash |
| Video ishlovi | **ffmpeg** (fluent-ffmpeg) | poster + preview transkod |
| Auth/sessiya | **iron-session** (httpOnly cookie) + **argon2** | bitta admin |
| Validatsiya | **zod** | barcha input'lar |
| Grafiklar (admin) | **recharts** | chiziqli grafik, donut |
| Ikonlar | **lucide-react** | 1.5px stroke (design.md §4) |
| Animatsiya | **Framer Motion** | FLIP/layout animatsiyalar (`layoutId`) |

Masonry: tartib **chapdan-o'ngga** saqlanishi shart (filtr FLIP uchun) — CSS `columns` ishlatma; grid row-span texnikasi yoki o'z hisob-kitobingdan foydalan (design.md §6.3).

---

## 2 · Marshrutlar

**Ommaviy:**
- `/` — hero + galereya + filtrlar
- `/p/[slug]` — kontent sahifasi. Galereyadan ochilganda **intercepting route** orqali lightbox-overlay; to'g'ridan-to'g'ri kirilganda to'liq SSR sahifa (SEO/OG uchun)
- `/haqida` — bio
- `/aloqa` — kontaktlar + buyurtma holatini kod bo'yicha tekshirish
- `/order/[token]` — buyurtmaning maxfiy sahifasi (holat + yuklab olish)

**Admin (hammasi himoyalangan):**
- `/admin` — login
- `/admin/boshqaruv` · `/admin/kontentlar` · `/admin/yuklash` · `/admin/izohlar` · `/admin/buyurtmalar` · `/admin/sozlamalar`

**Texnik:** `sitemap.xml` (faqat `/`, `/p/*`, `/haqida`, `/aloqa`), `robots.txt` (`/admin`, `/order`, `/api` — disallow).

---

## 3 · Ma'lumotlar bazasi (Prisma sxemasi)

```prisma
// Identifikatorlar inglizcha — kod standarti. Izohlar o'zbekcha.

enum ContentType   { PHOTO VIDEO }
enum ContentStatus { PUBLISHED DRAFT }
enum CommentStatus { PENDING APPROVED }
enum OrderStatus   { PENDING APPROVED REJECTED }

model Content {
  id          String        @id @default(cuid())
  slug        String        @unique            // sarlavhadan translit + qisqa suffiks
  type        ContentType
  title       String
  description String?
  genre       Genre         @relation(fields: [genreId], references: [id])
  genreId     String
  location    Location      @relation(fields: [locationId], references: [id])
  locationId  String
  capturedAt  DateTime                          // rasm olingan sana (EXIF yoki qo'lda)
  priceUZS    Int?                              // null = sozlamalardagi standart narx
  featured    Boolean       @default(false)     // 2 ustun span + hero nomzodi
  watermark   Boolean       @default(true)
  status      ContentStatus @default(PUBLISHED)
  width       Int
  height      Int
  durationSec Int?                              // faqat video
  blurhash    String
  originalKey String                            // FAQAT private omborda. Hech qachon ommaviy URL emas!
  previewKey  String                            // public CDN (watermark shu faylga bosiladi)
  thumbKey    String                            // ~640px
  posterKey   String?                           // video poster
  viewsCount  Int           @default(0)         // denormalizatsiya — tez saralash uchun
  comments    Comment[]
  orders      Order[]
  views       ContentView[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([status, createdAt])
  @@index([genreId])
  @@index([locationId])
  @@index([capturedAt])
}

model Genre {
  id       String    @id @default(cuid())
  name     String    @unique
  slug     String    @unique
  contents Content[]
}

model Location {
  id         String    @id @default(cuid())
  name       String    @unique
  slug       String    @unique
  usageCount Int       @default(0)              // autosuggest tartibi uchun
  lastUsedAt DateTime  @default(now())
  contents   Content[]
}

model Comment {
  id        String        @id @default(cuid())
  content   Content       @relation(fields: [contentId], references: [id], onDelete: Cascade)
  contentId String
  name      String                              // faqat ism — account yo'q
  text      String
  status    CommentStatus @default(APPROVED)    // moderatsiya yoqiq bo'lsa PENDING
  ipHash    String?                             // rate-limit uchun (sha256, xom IP saqlanmaydi)
  createdAt DateTime      @default(now())

  @@index([contentId, createdAt])
  @@index([status])
}

model Order {
  id            String      @id @default(cuid())
  code          String      @unique             // odam o'qiydigan: "SB-1042"
  token         String      @unique @default(uuid()) // /order/{token} maxfiy sahifa
  content       Content     @relation(fields: [contentId], references: [id])
  contentId     String
  customerName  String
  contact       String                          // telefon yoki Telegram
  note          String?
  receiptKey    String?                         // chek skrinshoti — private ombor
  priceUZS      Int
  status        OrderStatus @default(PENDING)
  rejectReason  String?
  downloadCount Int         @default(0)
  maxDownloads  Int         @default(3)
  expiresAt     DateTime?                       // tasdiqda: now + sozlamadagi soat
  approvedAt    DateTime?
  createdAt     DateTime    @default(now())

  @@index([status, createdAt])
}

model VisitorSession {
  id           String        @id                 // anonim sid (cookie, uuid)
  firstSeenAt  DateTime      @default(now())
  lastSeenAt   DateTime      @default(now())
  device       String                            // "mobile" | "desktop"
  referrer     String?                           // faqat tashqi domen
  isAdmin      Boolean       @default(false)     // true bo'lsa analitikadan chiqariladi
  pageViews    PageView[]
  contentViews ContentView[]
}

model PageView {
  id        String         @id @default(cuid())
  session   VisitorSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sessionId String
  path      String
  createdAt DateTime       @default(now())

  @@index([createdAt])
  @@index([sessionId])
}

model ContentView {
  id        String         @id @default(cuid())
  session   VisitorSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sessionId String
  content   Content        @relation(fields: [contentId], references: [id], onDelete: Cascade)
  contentId String
  createdAt DateTime       @default(now())

  @@unique([sessionId, contentId])              // bir sessiyada bir marta!
  @@index([contentId])
  @@index([createdAt])
}

model Setting {
  key   String @id
  value Json
}
```

**`Setting` kalitlari** (seed'da standart qiymatlar bilan yaratilsin, hammasi admin Sozlamalardan boshqariladi):

| Kalit | Standart | Izoh |
|---|---|---|
| `site.title` | `shot by sardor` | |
| `site.tagline` | `""` | hero'dagi bir qatorlik matn |
| `site.bio` | `""` | Haqida sahifasi |
| `site.heroContentId` | `null` | null bo'lsa: eng so'nggi featured |
| `site.socials` | `{instagram:"shotbysardor", telegram:"", phone:"", email:""}` | |
| `content.previewMaxEdge` | `1920` | 1280 / 1600 / 1920 |
| `content.watermark` | `{enabled:true, text:"© shotbysardor", opacity:0.22}` | |
| `order.defaultPriceUZS` | `0` | 0 = narx modal'da "kelishilgan holda" deb ko'rsatiladi |
| `order.paymentDetails` | `{cardNumber:"", cardHolder:"", paymeUrl:"", clickUrl:""}` | |
| `order.linkTtlHours` | `48` | |
| `order.maxDownloads` | `3` | |
| `comments.moderation` | `false` | true → yangi izoh PENDING |
| `comments.bannedWords` | `[]` | |
| `comments.nameMaxLen` | `30` | |
| `analytics.excludeAdmin` | `true` | |
| `analytics.retentionDays` | `365` | |
| `admin.passwordHash` | seed: `ADMIN_INITIAL_PASSWORD` dan argon2 | |

---

## 4 · Media quvuri (upload pipeline)

Yuklashda server tomonda quyidagilar bajariladi (fayl nomlari: `{cuid}.{ext}` — mijoz bergan nom saqlanmaydi):

**Foto:**
1. Original → **private** ombor (`originals/`).
2. `sharp` bilan: **preview** — uzun tomon = `content.previewMaxEdge`, WebP q≈70 (brauzerga qarab AVIF/WebP), **EXIF butunlay olib tashlanadi**; watermark yoqiq bo'lsa matn pastki-o'ng burchakka bosiladi (design.md §7: Space Mono 12px ekvivalenti, oq 22% shaffoflik, 16px ichkari).
3. **Thumb** — uzun tomon 640px.
4. **blurhash**, `width`, `height` hisoblanadi.
5. EXIF'dan `capturedAt` o'qiladi (bo'lsa) — formani oldindan to'ldirish uchun javobda qaytariladi.

**Video:**
1. Original → private ombor.
2. `ffmpeg`: **poster** (1-sekunddagi kadr, jpg) + **preview mp4** — H.264, uzun tomon ≤1080, bitrate ≤4 Mbps, `drawtext` bilan watermark; `durationSec` o'qiladi.
3. Katta fayllar uchun ishlov holati UI'da progress bilan ko'rsatilsin (v1 uchun sinxron qayta ishlash maqbul, lekin timeout'larga chidamli bo'lsin).

**Chek (buyurtma kviti):** faqat rasm (jpg/png/webp/heic), ≤10MB → private ombor (`receipts/`).

**Limitlar:** foto ≤60MB, video ≤2GB (env orqali sozlanadi). MIME turi **magic-bytes** bo'yicha tekshiriladi, kengaytmaga ishonilmaydi.

---

## 5 · API (route handlers)

Barcha javoblar JSON, xatolar yagona formatda: `{error: {code, message}}` (message — o'zbekcha, UI'da ko'rsatiladi).

### Ommaviy

| Metod & yo'l | Vazifa |
|---|---|
| `GET /api/contents?genre=&location=&from=&to=&cursor=&limit=24` | Filtrlangan ro'yxat (faqat `PUBLISHED`), cursor-based. Javob: `{items:[{slug,type,title,thumbUrl,blurhash,width,height,genre,location,capturedAt,viewsCount,featured,durationSec}], nextCursor, total}` |
| `GET /api/contents/[slug]` | Bitta element: + `description`, `previewUrl`, `posterUrl`, `commentsCount`, `priceUZS` (yoki standart) |
| `POST /api/contents/[slug]/view` | Ko'rishni hisoblash — §8 qoidasi bo'yicha |
| `GET /api/contents/[slug]/comments?cursor=` | Faqat `APPROVED`, yangi → eski |
| `POST /api/contents/[slug]/comments` | Body: `{name, text, website}` — `website` = honeypot, **bo'sh bo'lishi shart**. Tekshiruvlar: rate-limit (1 ta / 30s / sid+IP), `bannedWords`, `nameMaxLen`, text ≤ 1000. Moderatsiya yoqiq → `PENDING` + mos javob |
| `GET /api/meta` | Filtrlar uchun: janrlar va joylashuvlar (kamida 1 ta published kontenti borlari) + mavjud yillar |
| `POST /api/orders` | multipart: `{contentId, name, contact, note?, receipt}`. Rate-limit 5 ta/soat/IP. Javob: `{code, token}` |
| `GET /api/orders/[token]` | Holat: `{code, status, title, thumbUrl, priceUZS, expiresAt, downloadsLeft, rejectReason}` |
| `GET /api/orders/[token]/download` | Tekshir: `APPROVED` ∧ `expiresAt > now` ∧ `downloadCount < maxDownloads` → `downloadCount` **atomar** oshiriladi → R2: 302 signed URL (TTL 60s) / local: stream (`Content-Disposition: attachment`, Range qo'llab-quvvatlanadi). Aks holda 403 + sabab |

### Admin (auth middleware + mutatsiyalarda CSRF token)

| Metod & yo'l | Vazifa |
|---|---|
| `POST /api/admin/login` | `{password}` → argon2 verify → sessiya. Rate-limit 5 ta/15min/IP |
| `POST /api/admin/logout` | |
| `GET /api/admin/stats?range=7\|30\|90` | `{kpi:{todayVisits, uniques7d, totalViews, pendingOrders}, deltas, series:[{date, visits, uniques}], topContents:[{id,slug,title,thumbUrl,views}] (10 ta), devices:{mobile,desktop}, referrers:[{host,count}] (10 ta)}` |
| `GET /api/admin/contents?q=&status=&cursor=` | Ro'yxat (qoralamalar ham) |
| `POST /api/admin/upload` | multipart — §4 quvuri; ko'p fayl qo'llab-quvvatlanadi |
| `PATCH /api/admin/contents/[id]` | Istalgan maydon: title, description, genreId, locationId, capturedAt, priceUZS, featured, watermark, status |
| `DELETE /api/admin/contents/[id]` | DB yozuvi + ombor fayllari o'chiriladi |
| `GET /api/admin/locations?q=` | **Autosuggest**: `name ILIKE %q%`, tartib: `usageCount desc, lastUsedAt desc`, 8 ta |
| `POST /api/admin/locations` · `PATCH .../merge` | Yangi qo'shish; merge: `{fromId, toId}` — barcha kontentlar ko'chiriladi, `usageCount` qo'shiladi, eski o'chadi |
| Janrlar: xuddi shu CRUD + merge | |
| `GET /api/admin/comments` | **Faqat izohi bor kontentlar**, guruhlangan: `[{content:{...}, comments:[...], pendingCount}]`, so'nggi faollik bo'yicha |
| `PATCH /api/admin/comments/[id]` (`approve`) · `DELETE` | |
| `GET /api/admin/orders?status=` | |
| `PATCH /api/admin/orders/[id]` | `{action:"approve"}` → `expiresAt = now + linkTtlHours`, `maxDownloads` sozlamadan, `approvedAt=now`; `{action:"reject", reason}` |
| `GET/PUT /api/admin/settings` · `POST /api/admin/password` | |

**Joylashuv/janr avtomatikasi:** kontent saqlanganda `locationId` mavjud nom bilan kelmasa — yangi `Location` yaratiladi (bir marta kiritildi → doim taklifda). Har ishlatilganda `usageCount++`, `lastUsedAt=now`.

---

## 6 · Ommaviy sayt — biznes-logika

`design.md` §6–8 vizual talablarga qo'shimcha:

- **Filtrlar** AND bilan birlashadi va URL query bilan ikki tomonlama sinxron (`/?janr=portret&joy=samarqand&yil=2026`) — birinchi sahifa SSR'da ham xuddi shu filtrlar bilan render bo'ladi.
- **Lightbox** intercepting route; `Esc`/`←`/`→`; qo'shni ±1 preload; ulashish — Web Share API, bo'lmasa havolani nusxalash.
- **Izoh formi:** ism `localStorage`da saqlanadi; optimistik qo'shish; moderatsiya rejimida `design.md` §13 dagi toast.
- **Himoya:** sayt hech qayerda originalga ishora qilmaydi; media elementlarda `contextmenu`/`dragstart`/`selectstart` bloklanadi (faqat media ustida, sahifaning qolgan qismida emas); ogohlantiruvchi alert ko'rsatilmaydi.
- **SEO:** har `/p/[slug]` uchun `title`, `description`, `og:image` (preview), `og:type=article`; JSON-LD (`ImageObject`/`VideoObject`, `creator: Sardor`).

---

## 7 · Admin — biznes-logika

`design.md` §9 asosida. Aniqlashtirishlar:

- **Yuklash formi:** ko'p faylda umumiy maydonlar hammaga, sarlavha har biriga alohida kiritilishi mumkin; EXIF `capturedAt` bo'lsa sana avtomatik to'ladi; joylashuv maydoni ostida so'nggi 5 ta joy chiplari.
- **Izohlar bo'limi** — `GET /api/admin/comments` formatida: izohsiz kontentlar bu sahifada umuman ko'rinmaydi.
- **Buyurtma tasdiqlanganda** kartada `Havolani nusxalash` tugmasi `/order/{token}` URL'ini beradi — Sardor uni mijozga Telegram orqali o'zi yuboradi (email yuborish v1 da yo'q).
- **Sozlamalar** §3 jadvalidagi barcha kalitlarni boshqaradi; saqlashda `dirty state` + sticky `Saqlash` (design.md §9.6).

---

## 8 · Analitika — hisoblash qoidalari

- **sid:** middleware har tashrifda httpOnly `sid` cookie (uuid, 365 kun) o'rnatadi; `VisitorSession` upsert (`lastSeenAt`, `device` User-Agent'dan, `referrer` faqat tashqi domen, birinchi tashrifda).
- **PageView:** har sahifa navigatsiyasida yoziladi. Yozilmaydigan holatlar: `/admin*`, `/api*`, bot User-Agent'lar, hamda `analytics.excludeAdmin=true` bo'lsa admin sessiyasi bor foydalanuvchi (`isAdmin=true` deb belgilanadi — admin login bo'lgan sid).
- **ContentView (ko'rish):** klient lightbox/sahifa ochilib **3 soniya** o'tgach `POST .../view` yuboradi; server `@@unique([sessionId, contentId])` tufayli bir sessiyada bir marta yozadi va shunda `Content.viewsCount++` (atomar, transaction ichida).
- **KPI ta'riflari:** `Bugungi tashriflar` = bugungi distinct sessiyalar; `7 kunlik unikal` = oxirgi 7 kunda distinct sid; `Jami ko'rishlar` = `sum(viewsCount)`; `Kutilayotgan buyurtmalar` = `Order.status=PENDING` soni. Delta = joriy davr vs oldingi teng davr.
- **Tozalash:** kunlik job (yoki chaqiruvda lazy) — `retentionDays` dan eski `PageView`/`ContentView` o'chiriladi (`viewsCount` denormalizatsiya tufayli jami saqlanadi).

---

## 9 · Xavfsizlik talablari

1. **Originallar va cheklar** faqat private omborda; ularga yagona yo'l — §5 dagi download endpoint. To'g'ridan-to'g'ri URL taxmin qilib kirib bo'lmasligi testda tasdiqlansin.
2. **Signed URL** TTL = 60s; local drayverda stream faqat tekshiruvlardan o'tgach.
3. **Sessiya:** iron-session, `httpOnly`, `secure`, `sameSite=lax`, 30 kun. Parol — argon2id.
4. **CSRF:** barcha admin mutatsiyalarida token.
5. **Rate-limit** (in-memory + IP+sid): izoh 1/30s, buyurtma 5/soat, login 5/15min.
6. **Input:** hamma joyda zod; izoh matni faqat plain-text sifatida render (XSS yo'q); fayllar magic-bytes bilan tekshiriladi.
7. **Header'lar:** CSP (self + CDN domenlar), `X-Frame-Options: DENY` (admin), `Referrer-Policy: strict-origin-when-cross-origin`.
8. Xom IP saqlanmaydi — faqat sha256 hash (`ipHash`).

---

## 10 · Muhit o'zgaruvchilari (`.env.example` yaratilsin)

```env
DATABASE_URL="postgresql://..."
SESSION_SECRET="kamida-32-belgi"
ADMIN_INITIAL_PASSWORD="birinchi seed uchun"
NEXT_PUBLIC_SITE_URL="https://shotbysardor.uz"

STORAGE_DRIVER="local"            # "local" | "r2"
R2_ACCOUNT_ID="" R2_ACCESS_KEY_ID="" R2_SECRET_ACCESS_KEY=""
R2_BUCKET_PRIVATE="" R2_BUCKET_PUBLIC="" R2_PUBLIC_CDN_URL=""

MAX_PHOTO_MB="60" MAX_VIDEO_MB="2048" MAX_RECEIPT_MB="10"
```

---

## 11 · Qabul mezonlari (hammasi bajarilishi shart)

- [ ] `design.md` §14 tokenlari 1:1 ulangan; shriftlar (Clash Display / Satoshi / Space Mono) yuklanadi va fallback'lar ishlaydi
- [ ] Masonry tartibi chapdan-o'ngga; aspect-ratio saqlanadi; CLS < 0.02
- [ ] Filtrlar AND + URL sinxron + FLIP animatsiya; bo'sh holat design.md bo'yicha
- [ ] `/p/[slug]` to'g'ridan-to'g'ri ochilganda SSR + to'g'ri OG meta; galereyadan — overlay
- [ ] Ko'rish bir sessiyada bir marta hisoblanadi (3s qoidasi bilan)
- [ ] Izoh accountsiz ishlaydi; ism eslab qolinadi; honeypot va rate-limit spam'ni to'sadi; moderatsiya rejimi ikkala holatda to'g'ri
- [ ] Admin `Izohlar`da faqat izohi bor kontentlar ko'rinadi
- [ ] Joylashuv bir marta kiritilsa keyingi yuklashlarda taklif qilinadi; merge barcha kontentlarni ko'chiradi
- [ ] Buyurtma oqimi to'liq: chek yuklash → pending (`/order/{token}` + kod) → admin approve → yuklab olish; muddat (`linkTtlHours`) va `maxDownloads` qat'iy ishlaydi; reject sababi mijozga ko'rinadi
- [ ] Original faylga ommaviy URL orqali kirib bo'lmaydi (403/404); preview'da EXIF yo'q va watermark bosilgan
- [ ] Analitika: 4 KPI + delta, davr grafigi, top-10, qurilma/referrer; admin tashriflari chiqarib tashlanadi
- [ ] Sozlamalardagi har bir kalit real ta'sir qiladi (masalan, `previewMaxEdge` keyingi yuklashlardan boshlab)
- [ ] Mobil admin: telefon galereyasidan yuklash ishlaydi; jadval → karta ko'rinishi
- [ ] `prefers-reduced-motion` hurmat qilinadi; klaviatura fokusi ko'rinadi; lightbox — focus-trap'li dialog
- [ ] Lighthouse (mobil, galereya sahifasi): Performance ≥ 90, LCP < 2.5s
- [ ] `README.md`: o'rnatish, `.env`, R2'ga o'tish, deploy bo'yicha o'zbekcha qo'llanma

---

## 12 · Qurish tartibi (shu ketma-ketlikda)

1. **Skeleton:** Next + Tailwind + tokenlar + shriftlar + layout (header/footer) + `uz` lug'at fayli.
2. **Poydevor:** Prisma sxema + docker-compose + seed; `StorageProvider` (local/r2); media quvuri (§4); admin login; **Yuklash** sahifasi — shu bosqich oxirida kontent yuklab bo'lsin.
3. **Ommaviy galereya:** hero, masonry, filtrlar (URL sinxron), lightbox (`/p/[slug]` SSR + intercepting), ko'rish hisobi.
4. **Izohlar:** ommaviy drawer + admin bo'limi.
5. **Buyurtma:** modal → `/order/[token]` → admin `Buyurtmalar` → himoyalangan yuklab olish.
6. **Analitika:** middleware yozuvlari + `Boshqaruv` dashboardi.
7. **Sozlamalar:** to'liq forma + janr/joylashuv boshqaruvi (merge bilan).
8. **Sayqal:** motion (design.md §10), a11y, SEO, `Haqida`/`Aloqa`, §11 ro'yxatini birma-bir tekshirish.

---

## 13 · V1 dan tashqarida (qilma)

- Foydalanuvchi accountlari va ro'yxatdan o'tish — izoh/buyurtma accountsiz, bu mahsulot qarori.
- Payme/Click **avtomatik** to'lov tekshiruvi — v2; hozircha chek + qo'lda tasdiq (arxitektura keyin API ulashga tayyor bo'lsin: `Order`ga provider maydonlarini qo'shish oson bo'lsin).
- Email/SMS yuborish — havolani admin o'zi yuboradi.
- Ko'p tillilik va light theme — lug'at va token tizimi tayyor turadi, lekin qurilmaydi.
- Original videolarni onlayn to'liq sifatda ko'rsatish — saytda faqat preview transkod.
