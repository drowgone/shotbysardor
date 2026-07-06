<div align="center">

# shot by sardor

**Kinematik dark-galereya portfolio-sayti.**
Fotograf Sardor uchun tez, xavfsiz va o'zi boshqariladigan platforma —
fotolarni ko'rsatish, buyurtma qabul qilish va qo'llab-quvvatlash uchun.

Next.js 15 · React 19 · TypeScript strict · Prisma · PostgreSQL · Tailwind v4

</div>

---

## Mundarija

- [Xususiyatlar](#xususiyatlar)
- [Tez ishga tushirish (Docker)](#tez-ishga-tushirish-docker)
- [Serverga deploy — GitHub'dan bir buyruqda](#serverga-deploy--githubdan-bir-buyruqda)
- [Lokal ishlab chiqish](#lokal-ishlab-chiqish)
- [Environment o'zgaruvchilari](#environment-ozgaruvchilari)
- [Fayl saqlash — Local vs Cloudflare R2](#fayl-saqlash--local-vs-cloudflare-r2)
- [Arxitektura](#arxitektura)
- [Skriptlar](#skriptlar)
- [Xavfsizlik](#xavfsizlik)
- [Litsenziya](#litsenziya)

---

## Xususiyatlar

### Foydalanuvchi uchun
- **Kinematik masonry galereya** — CSS emas, JS bilan tuzilgan; FLIP animatsiyasi, featured 2-ustun span.
- **Har tashrifda tasodifiy tartib** (admin panel'idan yoqib/o'chirib qo'yish mumkin).
- **Lightbox** — bir kontent ochilganda intercepting route (URL o'zgaradi, orqaga qaytish tabiiy).
- **Buyurtma tizimi** — kod bilan qidirish (`SB-1042`) yoki maxfiy token orqali holatni ko'rish.
- **Kvitansiya OCR** — Payme/Click chekini avtomatik o'qish, `Content` narxi bilan solishtirish.
- **Donate sahifasi** — Telegram-uslub izohlar, ixtiyoriy summa, "muallif" nomidan javob berish.
- **Filtrlar** — janr (bir kontent bir nechta janrda bo'lishi mumkin), joylashuv, yil.
- **Blurhash** — rasm yuklanguncha yumshoq placeholder.

### Admin uchun
- **Yuklash** — resumable chunked upload, individual metadata (janr, joy, sana, narx per fayl), rasm/video preview cardda.
- **Kontent boshqaruvi** — inline tahrirlash, bulk operatsiyalar (o'chirish, chop etish, janrga o'zgartirish).
- **Buyurtmalar** — kvitansiya ko'rish, OCR natijasi, tasdiqlash/rad etish, imzolangan URL bilan yuklab olish.
- **Statistika** — ko'rishlar, unique tashrifchilar, konversiya, top kontent, qurilma taqsimoti, manba (referrer).
- **Sozlamalar** — sayt sarlavhalari, taksonomiya, hero, to'lov kartalar, xavfsizlik chegaralari.
- **Real-time yangilanish** — SSE (Server-Sent Events) orqali barcha admin sahifalari va donate izohlari.
- **Audit log** — muhim harakatlar (login, credential o'zgarishi, o'chirishlar).

---

## Tez ishga tushirish (Docker)

Eng oson yo'l — hech nima o'rnatmasdan. Kerak: **Docker** va **Docker Compose**.

```bash
git clone https://github.com/drowgone/shotbysardor.git
cd shotbysardor
cp .env.example .env
# .env ni tahrirlang: SESSION_SECRET, ADMIN_INITIAL_PASSWORD, POSTGRES_PASSWORD

docker compose up -d --build
```

Bo'ldi. Ilova avtomatik ravishda:
1. PostgreSQL konteynerini ishga tushiradi
2. Next.js image'ni build qiladi (ffmpeg + sharp bilan)
3. `prisma migrate deploy` — barcha migratsiyalarni qo'llaydi
4. `prisma db seed` — sozlamalar, boshlang'ich janrlar/joylashuvlar, admin parolini ekadi
5. Serverni port `3000` da ochadi

Sayt: **http://localhost:3000**
Admin: **http://localhost:3000/admin** (parol — `.env` dagi `ADMIN_INITIAL_PASSWORD`)

Log ko'rish:
```bash
docker compose logs -f app
```

To'xtatish:
```bash
docker compose down
```

Ma'lumot va storage saqlanadi (volume'lar), qayta `up` qilsangiz shu holatida davom etadi.

---

## Serverga deploy — GitHub'dan bir buyruqda

Ubuntu/Debian VPS uchun to'liq deploy stsenariysi:

**1) Bir marta — server tayyorlash:**

```bash
# Docker o'rnatish
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# Loyihani klonlash
git clone https://github.com/drowgone/shotbysardor.git
cd shotbysardor
cp .env.example .env
```

**2) `.env` ni tahrirlang — production qiymatlar bilan:**

```env
SESSION_SECRET="<openssl rand -hex 32 bilan generatsiya>"
ADMIN_INITIAL_PASSWORD="<kuchli parol>"
POSTGRES_PASSWORD="<kuchli parol>"
NEXT_PUBLIC_SITE_URL="https://shotbysardor.uz"
STORAGE_DRIVER="r2"   # yoki "local"
# R2 kalitlari (agar r2 bo'lsa)
```

**3) Ishga tushirish:**

```bash
docker compose up -d --build
```

**4) Kelgusidagi yangilanishlar — bir buyruq:**

```bash
git pull && docker compose up -d --build
```

Endi loyiha `:3000` portida ishlaydi. Oldiga **nginx** yoki **Caddy** qo'yib TLS bilan proksi qiling:

<details>
<summary>Nginx namuna konfiguratsiya</summary>

```nginx
server {
    listen 443 ssl http2;
    server_name shotbysardor.uz;

    ssl_certificate     /etc/letsencrypt/live/shotbysardor.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shotbysardor.uz/privkey.pem;

    client_max_body_size 2100M;   # Video yuklash uchun
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

</details>

<details>
<summary>Caddy namuna (avtomatik TLS)</summary>

```caddy
shotbysardor.uz {
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Forwarded-For {remote_host}
    }
    request_body {
        max_size 2100MB
    }
}
```

</details>

---

## Lokal ishlab chiqish

Docker'siz, to'g'ridan-to'g'ri Node.js bilan:

**Talablar:**
- Node.js **≥ 20**
- PostgreSQL 14+ (yoki `docker compose up -d db` bilan)
- `ffmpeg` (`sudo apt install ffmpeg` yoki `brew install ffmpeg`)

**Qadamlar:**

```bash
git clone https://github.com/drowgone/shotbysardor.git
cd shotbysardor
cp .env.example .env

# Postgres — Docker orqali (yoki o'z instansiyangizni ishlating)
docker compose up -d db

npm install
npm run db:migrate     # Migratsiyalar
npm run db:seed        # Boshlang'ich ma'lumotlar
npm run dev
```

http://localhost:3000

---

## Environment o'zgaruvchilari

`.env.example` fayldagi barcha o'zgaruvchilar izohlari bilan yozilgan.

| O'zgaruvchi | Kerakligi | Tavsif |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL ulanish satri |
| `POSTGRES_PASSWORD` | ✅ | Docker Compose Postgres paroli |
| `SESSION_SECRET` | ✅ | Iron-session imzosi (≥32 belgi) |
| `ADMIN_INITIAL_PASSWORD` | ✅ | Birinchi login uchun admin parol |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Sayt to'liq URL (meta uchun) |
| `APP_PORT` | ❌ | Tashqi port (default 3000) |
| `STORAGE_DRIVER` | ✅ | `local` yoki `r2` |
| `R2_ACCOUNT_ID` | R2 uchun | Cloudflare R2 akkaunt ID |
| `R2_ACCESS_KEY_ID` | R2 uchun | R2 API kaliti |
| `R2_SECRET_ACCESS_KEY` | R2 uchun | R2 API maxfiy kaliti |
| `R2_BUCKET_PRIVATE` | R2 uchun | Originallar uchun bucket |
| `R2_BUCKET_PUBLIC` | R2 uchun | Preview/thumb uchun bucket |
| `R2_PUBLIC_CDN_URL` | R2 uchun | Public CDN URL |
| `MAX_PHOTO_MB` | ❌ | Foto chegara (default 60) |
| `MAX_VIDEO_MB` | ❌ | Video chegara (default 2048) |
| `MAX_RECEIPT_MB` | ❌ | Kvitansiya chegara (default 10) |

---

## Fayl saqlash — Local vs Cloudflare R2

**Local** (default): Fayllar server diskida `storage/` papkasida. Docker'da bu volume — konteyner o'chsa ham saqlanadi. Kichik loyihalar uchun ideal.

**R2** (production'da tavsiya etiladi):
- Egress bepul (Cloudflare CDN)
- S3-mos API
- Signed URL — original fayllar faqat tasdiqlangan buyurtma uchun 60s TTL bilan chiqadi

O'tish uchun kodni o'zgartirish shart emas — `.env` dagi `STORAGE_DRIVER` ni `r2` qiling va R2 kalitlarini qo'ying.

---

## Arxitektura

```
┌─────────────────────────────────────────────────────────────┐
│  Public shell (Next.js App Router — RSC + Client hybrid)    │
├─────────────────────────────────────────────────────────────┤
│  /              — Masonry galereya (shuffle + filter)       │
│  /p/[slug]      — Kontent (lightbox intercepting route)     │
│  /donate        — Qo'llab-quvvatlash + Telegram-izohlar     │
│  /aloqa         — Aloqa + buyurtma holati (kod orqali)      │
│  /admin         — Login + shell (protected)                 │
├─────────────────────────────────────────────────────────────┤
│  API routes (nodejs runtime, Prisma bilan)                   │
│  /api/contents  · /api/orders  · /api/live (SSE)             │
│  /api/admin/... (CSRF + iron-session bilan himoyalangan)     │
├─────────────────────────────────────────────────────────────┤
│  Prisma ORM  →  PostgreSQL (Content, Genre[], Order, ...)   │
│  Storage layer  →  Local FS  yoki  Cloudflare R2 (S3)       │
│  Media pipeline (sharp + ffmpeg + blurhash)                  │
└─────────────────────────────────────────────────────────────┘
```

**Muhim qarorlar:**
- **Bir kontent — bir nechta janr**: `Content ↔ Genre` implicit M2M (`_ContentGenres` join jadval).
- **Resumable upload**: chunkli PATCH + finalize, server sessiyasi diskda saqlanadi — brauzer yopilsa qayta yopishib davom etadi.
- **Original fayllar hech qachon public URL bilan chiqmaydi** — faqat `APPROVED` buyurtma va limit tugamagan bo'lsa.
- **Analitika denormalizatsiya qilingan**: `Content.viewsCount` retentiondan keyin ham saqlanadi.
- **Real-time**: SSE (Server-Sent Events) — WebSocket emas, kam murakkablik.
- **Bot filtratsiya**: `/api/track` ichida (Edge middleware'da Prisma ishlamaydi).

---

## Skriptlar

```bash
npm run dev         # Dev server (hot reload)
npm run build       # Production build (avval prisma generate)
npm run start       # Production start
npm run lint        # ESLint
npm run typecheck   # TypeScript strict tekshiruv
npm run db:migrate  # Yangi migratsiya yaratish (dev)
npm run db:push     # Migratsiyasiz schema'ni push qilish
npm run db:seed     # Sozlamalar/janrlar seed
npm run db:studio   # Prisma Studio (DB GUI)
```

---

## Xavfsizlik

- **iron-session** — HTTP-only, signed cookie'lar
- **CSRF token** — barcha admin `POST`/`PATCH`/`DELETE`'da majburiy
- **Rate limit** — IP va sessiya bo'yicha (izoh, like, buyurtma yaratish)
- **argon2** — parol hash (parametrlar production-grade)
- **Session versioning** — parol o'zgarganda barcha eski sessiyalar bekor bo'ladi
- **IP hash** — hech qachon xom IP saqlanmaydi, faqat sha256 hash
- **Image bomb himoyasi** — sharp metadatasi dekompressiyagacha tekshiriladi
- **SSRF himoyasi** — `next/image` faqat aniq R2 hostidan fetch qiladi (`remotePatterns` cheklangan)
- **File type sniffing** — MIME faqat magic bytes'dan aniqlanadi, extension'ga ishonilmaydi

---

## v1'dan tashqarida (qilinmagan)

- Payme/Click avtomatik to'lov tekshiruvi
- Email/SMS xabarnomalar
- Ko'p tillilik va light mavzu
- Original videoni to'liq sifatda onlayn ko'rish

---

## Litsenziya

Barcha fotografiyalar va videolar mualliflik huquqi Sardorga tegishli.
Kod bazasi shaxsiy foydalanish uchun.

---

<div align="center">

Made with ❤️ by [drowgone](https://github.com/drowgone)

</div>
