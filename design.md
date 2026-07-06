# SHOTBYSARDOR — design.md
**Visual & UX Specification · v1.0 · 2026-07**

> This file is the single source of truth for every visual and interaction decision on the shotbysardor website. Pair it with `PROMPT.md` (technical/build spec) when generating the project. If generated code and this document ever conflict, **this document wins**. Do not "improve" the palette, fonts, or layout rules — implement them exactly.

---

## 0 · Product in one line

A cinematic, dark-gallery portfolio for photographer **Sardor** (Instagram: `@shotbysardor`): high-quality photo/video showcase with protected previews, an order-to-download flow for originals (admin-approved after payment), account-free name-only comments, genre/location/date filtering, and a full admin panel (upload, comments, orders, analytics, settings). Public UI language: **Uzbek (uz-Latn)**.

---

## 1 · Brand

### 1.1 Essence

Keywords: **cinematic · quiet · precise · gallery-grade**.

The design vocabulary is borrowed from the photographer's own world — the darkroom, the viewfinder, the aperture ring, the EXIF readout — not from generic web trends. The interface must feel like a dark exhibition room: walls disappear, light falls only on the work.

Principles (apply to every screen, including admin):
1. **Content-first.** UI chrome may never carry more visual weight than a caption. Photographs are the interface.
2. **One accent, used sparingly.** Brass appears only on primary CTAs, active/focus states, and live data. Max ~2 brass elements per viewport.
3. **Motion is slow and physical** — like a lens breathing, never bouncy or elastic.
4. **Dark always.** No light theme in v1: photographs read best on near-black, and it keeps watermark/scrim math consistent.

### 1.2 Logo & marks — the "viewfinder" system

This is the site's signature identity element. It repeats as logo, cursor, focus state, and empty-state glyph.

- **Primary wordmark:** lowercase `shot by sardor`, Clash Display Medium, letter-spacing `-0.01em`, wrapped in a **focus frame**: four corner brackets (like a camera's AF frame) drawn as 2px SVG strokes in bone (`--text`). Bracket arm length = 0.6× cap height; brackets sit outside the text with padding = cap height × 0.5.
- **Monogram** (favicon, admin sidebar, avatar): `S.` inside the same corner brackets, 1:1 ratio. Export as inline SVG + 32/180/512px favicons.
- **Animated variant** (site loader + hero): the four brackets draw in clockwise (400ms), then the wordmark fades up 8px (300ms, 80ms delay).
- **Clear space:** ≥ height of the letter "s" on all sides. Never place over busy image regions without a scrim behind it.
- **Color rules:** bone on dark only. A brass version exists for exactly one place: the admin login screen.
- **Watermark mark:** `© shotbysardor` — spec in §7.

---

## 2 · Color system

Dark-only. Never pure `#000000` or `#FFFFFF`. Background is a **warm charcoal** (darkroom, not OLED-void); the accent is **aperture-ring brass** (the gold engraving on vintage lens barrels) — warm, premium, and photography-native rather than a neon default.

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#0C0C0D` | Page background |
| `--bg-elevated` | `#131315` | Sticky header, admin sidebar, bottom sheets |
| `--surface` | `#1A1A1D` | Cards, inputs, drawers, modals |
| `--surface-hover` | `#202024` | Hover state of surfaces / table rows |
| `--border` | `rgba(255,255,255,.08)` | Hairlines, dividers |
| `--border-strong` | `rgba(255,255,255,.16)` | Input borders at rest |
| `--text` | `#F4F2ED` | Primary text (bone) |
| `--text-muted` | `#A6A29A` | Secondary text, descriptions |
| `--text-faint` | `#6C6963` | Placeholders, timestamps, meta |
| `--accent` | `#C99A3F` | Brass — primary buttons, links, active filters, chart line, focus ring |
| `--accent-hover` | `#E3B75C` | Hover |
| `--accent-pressed` | `#A87F2F` | Pressed |
| `--on-accent` | `#0C0C0D` | Text/icons on brass fills |
| `--success` | `#3FBF7F` | Approved states, positive deltas |
| `--danger` | `#E5484D` | Delete, rejected, negative deltas |
| `--info` | `#4C8DFF` | Informational badges only |
| `--scrim` | `rgba(8,8,9,.72)` | Lightbox/menu backdrop |
| `--scrim-grad` | `linear-gradient(180deg, transparent, rgba(8,8,9,.82))` | Bottom gradient over images for captions |
| `--placeholder` | `#17171A` | Image loading blocks |

Rules:
- Gradients are allowed **only** as scrims over photographs — never on UI surfaces or buttons.
- Charts: primary series = `--accent` line with 12%-opacity fill; secondary = `--text-muted`.
- Contrast: `--text` on `--bg` ≈ 15.8:1; `--accent` on `--bg` ≈ 7.3:1 (fine for buttons/labels/large text — do **not** set body paragraphs in brass).

---

## 3 · Typography

| Role | Typeface | Weights | Used for |
|---|---|---|---|
| Display | **Clash Display** (Fontshare, free) | 500 / 600 | Wordmark, page titles, lightbox titles, big analytics numbers |
| Body / UI | **Satoshi** (Fontshare, free) | 400 / 500 / 700 | Everything else: paragraphs, buttons, forms, tables |
| Meta / data | **Space Mono** (Google Fonts) | 400 | EXIF-style meta lines, view counters, order codes, timestamps, chips' counts — always UPPERCASE with `letter-spacing: .08em` |

Fallback stacks: `"Clash Display","Archivo",sans-serif` · `"Satoshi","Inter",system-ui,sans-serif` · `"Space Mono",ui-monospace,monospace`.

Fluid scale (`clamp()`):

| Token | Size | Line | Notes |
|---|---|---|---|
| `display-1` | `clamp(2.75rem, 6vw, 4.5rem)` | 1.04 | Hero only, tracking `-0.02em` |
| `h2` | `clamp(1.75rem, 3vw, 2.25rem)` | 1.15 | Section titles |
| `h3` | `1.375rem` | 1.3 | Lightbox title, modal titles |
| `body` | `1rem` | 1.65 | Default |
| `small` | `.875rem` | 1.5 | Card captions, table cells |
| `meta` | `.75rem` | 1.4 | Mono, uppercase |

The **mono EXIF treatment is a brand behavior**: any factual data (genre · location · date · views · order code) is rendered in Space Mono uppercase, e.g. `PORTRET · SAMARQAND · 2026 · 1 284 KO'RISH`. This one rule does most of the "photography site" storytelling.

Uzbek Latin note: verify glyph coverage for **oʻ / gʻ (U+02BB)** and the `'` apostrophe in all three faces; if U+02BB renders poorly, normalize copy to U+2019. Keep all UI strings in a single dictionary file (`uz` default) so `en`/`ru` can be added later without refactoring.

---

## 4 · Iconography, radius, elevation, imagery

- **Icons:** Lucide, 1.5px stroke, 20px (18px in admin tables). Outline only, never filled. No emoji anywhere in the UI.
- **Radius:** media tiles `2px` · buttons & inputs `10px` · cards `14px` · modals & drawers `18px` · chips `999px`. Photographs stay nearly sharp-cornered — gallery convention.
- **Elevation:** prefer hairline borders over shadows. Only modals/drawers get `0 24px 64px rgba(0,0,0,.55)`. No glows, no colored shadows.
- **Photograph treatment:** never crop for layout (preserve true aspect ratio via CSS `aspect-ratio` boxes), never apply CSS filters, never upscale. Loading = solid `--placeholder` block → blur-up (blurhash/LQIP) → 250ms fade to full image.
- **Video tiles:** poster frame + duration chip (mono, top-right, `--scrim` pill). Play glyph appears on hover (desktop) / always small (mobile).

---

## 5 · Spacing, grid, breakpoints

- Spacing scale (px): `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`.
- Page gutters: 24px ≥lg · 16px md · 12px <md. Text content max-width `1440px`; the gallery may run full-bleed minus gutters.
- Breakpoints: `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`.
- Gallery columns (masonry): **4** ≥2xl · **3** lg–xl · **2** sm–md · **1** <sm. Gap 16px (10px <sm).
- All touch targets ≥ 44×44px.

---

## 6 · Public pages & layout

Site map (public): `/` gallery+hero · `/p/{slug}` content lightbox route · `/haqida` about · `/aloqa` contact + order-status lookup · `/order/{token}` private order page.

### 6.1 Header
- Transparent over the hero; after 80px scroll it becomes `--bg-elevated` with a bottom hairline and `backdrop-filter: blur(12px)`.
- Left: wordmark (collapses to monogram <sm). Right: `Galereya · Haqida · Aloqa` + Instagram icon → `instagram.com/shotbysardor`.
- Mobile menu: hamburger → full-screen overlay, links in display type, staggered fade-up (60ms).

### 6.2 Hero
- Full-viewport featured photo or muted looping reel (chosen by the admin `Featured` flag / settings). Slow Ken Burns 1.00 → 1.06 over 14s, direction alternates per visit.
- Bottom-left on `--scrim-grad`: animated wordmark → tagline from settings (mono, one line) → scroll cue: a 32px thin vertical line pulsing softly.
- LCP note: hero image is the LCP element — preload it, serve ≤1920px AVIF/WebP.

### 6.3 Gallery grid — the signature section
- **True masonry** preserving aspect ratios (JS masonry or grid row-span technique — plain CSS `columns` is not acceptable because item order must stay left-to-right for filtering/FLIP).
- **Editorial rhythm:** items flagged `Featured` span 2 columns (≥lg). After every ~10–12 items, insert a **full-width break**: one photograph edge-to-edge with its title set large in display type over the scrim — this gives the page pacing, like spreads in a photo book.
- **Card anatomy:** image only at rest. Desktop hover: image scales `1.03` (700ms, `cubic-bezier(.2,.6,.2,1)`), bottom scrim rises, revealing title (Satoshi 500) + mono meta line (`JANR · JOY · YIL`) + eye icon with view count. Mobile: no hover — title + meta always visible beneath the image at 12px.
- **Custom cursor** (desktop, `pointer:fine` only): an 8px bone dot; over media it morphs into the four corner brackets with the mono label `OCHISH`. Disabled under `prefers-reduced-motion`.
- **Infinite scroll** via IntersectionObserver; skeletons are placeholder blocks at correct aspect ratios; end-cap: mono `BARCHASI KO'RILDI`.
- Entrance: fade + `translateY(16px)`, 450ms, 40ms stagger, first appearance only.

### 6.4 Filters
- **Persistent left sidebar** (Pinterest/Behance-style), sticky under the header. Desktop width `240px`, hairline right border, `--bg` fill, header-height offset (`top: var(--header-h)`).
- Sidebar sections stacked vertically: `Janr` (chip cluster wrapping in the 240px column — `Barchasi` first, then admin-fed genres) → hairline → `Joylashuv` combobox → `Sana` combobox → optional `Filtrlarni tozalash` button (only when filters are active) → mono result counter at the bottom (`128 TA ISH`).
- Sidebar can be **fully hidden** by the user via a chevron button in its header; a floating chevron tab (`left: 12px; top: 50%`) reappears to reopen. State persisted in `localStorage["sbs-filter-hidden"]`.
- Active chip style: brass **border + text**, transparent fill (never solid brass chips — too loud at row scale).
- Filters combine with AND; state is reflected in the URL (`/?janr=portret&joy=samarqand&yil=2026`) so filtered views are shareable.
- On change: FLIP re-layout 350ms; leaving items fade out 200ms.
- Empty state: bracket glyph + `Hech narsa topilmadi` + ghost button `Filtrlarni tozalash`.

### 6.5 Lightbox / content detail (`/p/{slug}`)
- Route-driven so every work is shareable/deep-linkable; opens as an overlay with a FLIP scale-up from the clicked tile; page behind fades to 92% `--bg`.
- Media centered, max `88vh × 92vw`. Bottom bar over `--scrim-grad`: **title** (h3, display) · **mono meta line** `PORTRET · BUXORO · 12.05.2026 · 1 284 KO'RISH` · `i` toggle that expands the description (max 60ch, `--text-muted`).
- Action cluster (right rail on desktop, bottom row on mobile): comments icon with count badge, share (native Web Share API), and the primary brass button **`Originalni buyurtma qilish`**.
- Navigation: `←/→` keys, hover chevrons (desktop), horizontal swipe (mobile); swipe-down or `Esc` closes. Preload ±1 neighbors.
- Video: custom minimal player — brass progress bar, mono timecode, volume; `controlsList="nodownload"`, no PiP, no context menu.
- A view is counted once per session per item, fired after the item has been open ≥3s.

### 6.6 Comments drawer (account-free)
- Desktop: 400px drawer sliding from the right over the lightbox (`--surface`, 18px left radii). Mobile: bottom sheet, 75vh, drag handle.
- Comment row: 32px circle avatar (brass fill, `--on-accent` initial letter), name (500), time-ago in mono `--text-faint`, then the text.
- Form (sticky bottom): `Ismingiz` input (persisted to localStorage so it's one-time) + `Izoh yozing…` textarea + brass `Yuborish`. **No account, no email, no captcha wall** — anti-spam is a hidden honeypot field + 30s client-side throttle + server rate limit.
- Optimistic insert with a brief brass-tinted highlight. If moderation is ON (settings): toast `Izohingiz tasdiqlangach ko'rinadi`.

### 6.7 About & Contact
- `Haqida`: split layout — sticky portrait left, bio prose right, gear list in mono, Instagram CTA. Content editable from settings.
- `Aloqa`: minimal — Telegram / phone / email buttons (from settings) + **order-status lookup**: an input for the order code (`#SB-1042`) that renders the status card from §8.

### 6.8 Footer
- Hairline top. Left: monogram + `© 2026 shotbysardor`. Right: Instagram, Telegram icons. Center, mono faint: `Barcha huquqlar himoyalangan · Rasmlarni ruxsatsiz yuklab olish taqiqlanadi`.

---

## 7 · Content protection (design layer)

Honest baseline for the builder: **nothing rendered on a screen is 100% uncopyable** (screenshots exist). The real protection is architectural: *the site only ever serves compressed previews; originals live behind the order flow and are never publicly addressable.* The UI's job is deterrence + communicating ownership.

- **Previews:** long edge ≤ 1920px (configurable 1280/1600/1920 in settings), AVIF/WebP quality ≈ 70, EXIF stripped. Original files must never have a guessable/public URL — downloads only via short-lived signed URLs after approval (see §8).
- **Watermark:** `© shotbysardor`, Space Mono 12px, bone at 22% opacity, bottom-right, 16px inset. Baked into preview files server-side at upload when the setting is on (preferred); a CSS overlay is only a fallback.
- **In-page deterrents** (applied to media elements only, silently — never show a scolding alert): `contextmenu` disabled, `draggable=false`, `user-select:none`, a transparent overlay div above `<img>`, keyboard save shortcuts intercepted where possible.
- Copy near the CTA reinforces the legitimate path: `Yuqori sifatli original faqat buyurtma orqali beriladi`.

---

## 8 · Order → download flow (visual states)

Entry point: the brass CTA in the lightbox.

1. **Order modal — `Buyurtma`** (18px radius, 520px, mobile: full-height sheet). Contents top-to-bottom: item thumbnail + title; price line in mono (per-item override, else default from settings, in UZS); fields `Ismingiz*`, `Telefon yoki Telegram*`, `Izoh (ixtiyoriy)`; payment block showing the card number / Payme / Click details from settings with a copy button; `Chek (skrinshot) yuklash` dropzone; brass submit `Buyurtma yuborish`.
2. **Pending:** success card with the order code huge in mono-display (`#SB-1042`) + copy button, text `Buyurtma qabul qilindi. To'lov tasdiqlangach shu sahifada yuklab olish tugmasi paydo bo'ladi.` The order gets a **private tokened URL** `/order/{token}` (shown + copyable immediately; also findable later via the code lookup on `Aloqa`).
3. **Approved:** the same page flips to a brass `Yuklab olish (JPEG · 48 MB)` button + mono note `Havola 48 soat amal qiladi · 3 martagacha` (expiry & max downloads from settings).
4. **Rejected:** danger-toned card + admin's reason + contact button.

All four states share one card anatomy: status chip (`Kutilmoqda` amber-outline / `Tasdiqlandi` success / `Rad etildi` danger) + a 3-dot progress timeline (Yuborildi → Tasdiqlandi → Yuklab olindi).

---

## 9 · Admin panel (`/admin`)

Same token system, but a **denser working instrument**: body 14px, tables 13px, row height 56px, hairline dividers, no decorative motion.

### 9.0 Access & shell
- Login: centered brass monogram, password field (single admin), `Kirish`. Error: 4px horizontal shake + danger text. Session ~30 days.
- Shell: left sidebar 240px on `--bg-elevated` — monogram, nav: `Boshqaruv · Kontentlar · Yuklash · Izohlar · Buyurtmalar · Sozlamalar`, bottom: `Saytni ochish`, `Chiqish`. Topbar: page title + primary `+ Yangi kontent`.
- Unread indicators: small brass dots on `Izohlar` / `Buyurtmalar` nav items when new activity exists.
- **Mobile admin is first-class** (Sardor will upload from his phone): sidebar becomes a 5-icon bottom tab bar; tables become stacked cards; upload works from the camera roll.

### 9.1 Boshqaruv — analytics dashboard
- **KPI cards ×4:** `Bugungi tashriflar` · `7 kunlik unikal` · `Jami ko'rishlar` · `Kutilayotgan buyurtmalar`. Value in Clash Display 32px + delta chip vs previous period (`+12%` success / `−8%` danger).
- **Traffic line chart** (range toggle 7/30/90 kun): 2px brass line, 12% gradient fill under it, hover tooltip on `--surface` (date, tashriflar, unikal).
- **`Eng ko'p ko'rilganlar` top-10 list:** 48px thumb, title, mono view count, thin brass bar scaled to the max value.
- Secondary row: device split donut (`Mobil / Desktop`), referrer list, `So'nggi izohlar`, `So'nggi buyurtmalar` — each item deep-links into its section.
- Data rules for the builder: views counted per content (per session, ≥3s); visitors via an anonymous cookie/localStorage id; admin's own sessions excluded when the setting is on.

### 9.2 Kontentlar
- Table/grid toggle; columns: thumb · `Sarlavha` · `Janr` · `Joylashuv` · `Sana` · `Ko'rishlar` (mono) · `Izohlar` count · status (`Chop etilgan` / `Qoralama`) · featured ★ toggle · `⋯` menu (Tahrirlash, Yashirish, O'chirish → confirm modal).
- Bulk select → change genre / delete. Search by title.

### 9.3 Yuklash — the upload form (key admin UX)
Two columns (stacked on mobile):
- **Left — dropzone:** drag & drop, multi-file, per-file preview with progress ring; reads EXIF capture date (and GPS if present) to prefill fields.
- **Right — form:**
  - `Sarlavha*`
  - `Tavsif` (auto-growing textarea)
  - `Janr*` — select from the managed list + inline `+ Yangi janr`
  - **`Joylashuv*` — combobox with type-ahead over all previously used locations. Typing a new value and saving automatically adds it to the suggestion list — enter once, suggested forever.** Below the field: the 5 most recent locations as one-tap chips.
  - `Sana` — defaults to EXIF capture date, else today
  - `Narx (ixtiyoriy)` — per-item price override; placeholder shows the default from settings
  - Toggles: `Featured` · `Watermark` · publish state (`Chop etish` / `Qoralama sifatida saqlash`)
- Multi-upload: shared fields apply to all, with a per-item title override list.
- On save: toast `Joylandi` + `Ko'rish` link. Server generates preview sizes + blurhash at this step.

### 9.4 Izohlar
- **Only contents with ≥1 comment appear here**, sorted by latest activity. Row: thumb + title + count badge → expands to the comment list with `O'chirish` (and `Tasdiqlash` when moderation is on).

### 9.5 Buyurtmalar
- Tabs: `Kutilmoqda · Tasdiqlangan · Rad etilgan`.
- Order card: code, item thumb + title, customer name, phone/Telegram (tap-to-copy), note, receipt image (click → full view), created time in mono; buttons: brass `Tasdiqlash`, ghost `Rad etish` (opens a reason field).
- On approve: the system generates the expiring signed download link automatically and shows `Havolani nusxalash` so Sardor can also send it manually via Telegram.

### 9.6 Sozlamalar
Grouped cards with a sticky `Saqlash` bar that appears on dirty state; success toast `Saqlandi`.
- **Sayt:** sarlavha, tagline, bio, portret, hero uchun featured tanlovi, Instagram/Telegram/telefon/email.
- **Kontent:** janrlar CRUD (rename/merge), joylashuvlar CRUD (rename/**merge** — merging re-tags all items), watermark (on/off, matn, opacity slider), preview max size (1280/1600/1920).
- **Buyurtma & to'lov:** standart narx + valyuta (UZS), karta raqami / Payme / Click havolasi, havola amal qilish muddati (soat), maksimal yuklab olishlar soni.
- **Izohlar:** moderatsiya (on/off), taqiqlangan so'zlar (chips), ism uzunligi limiti.
- **Analitika:** `O'z tashriflarimni hisoblama` (toggle), ma'lumot saqlash muddati.
- **Xavfsizlik:** parolni almashtirish, faol sessiyalar ro'yxati.

---

## 10 · Motion

| Token | Value | Used for |
|---|---|---|
| `--t-fast` | 150ms | Hovers, presses, toggles |
| `--t-base` | 300ms | Fades, drawers, sheets |
| `--t-slow` | 600–700ms | Image scale, page transitions, Ken Burns ramps |
| `--ease` | `cubic-bezier(.2,.6,.2,1)` | Everything; entrances may use ease-out |

Signature moments (and the only orchestrated ones): bracket-draw logo on load · tile→lightbox FLIP · filter FLIP re-layout · hero Ken Burns · blur-up image reveals · optimistic comment pulse. Nothing bounces, nothing loops for attention.

`prefers-reduced-motion`: kill Ken Burns and cursor morphing, FLIP becomes instant, keep only opacity fades ≤150ms.

---

## 11 · Responsive & mobile specifics

Mobile is an art direction of its own, not a shrink-to-fit:
- 1-column gallery = every photo becomes a full "moment"; caption + mono meta sit under the image.
- The left filter sidebar is hidden by default off-canvas; a floating `Filtrlar` pill (with active-count badge, bottom-left, respects safe-area-inset) reveals it as a **left slide-in drawer** (85vw, max 320px) with a scrim tap-to-close. Slide animation 300ms `cubic-bezier(.2,.6,.2,1)`.
- Lightbox gestures: horizontal swipe to navigate, swipe-down to close, double-tap to zoom (max 2× — previews only, so zoom is bounded).
- Header hides on scroll-down, returns on scroll-up.
- Respect `env(safe-area-inset-*)` on sheets, tab bars, and the lightbox action row.

---

## 12 · Accessibility & performance budget

- WCAG AA contrast everywhere; visible brass focus ring (`2px`, offset `2px`) on all interactives; chips are `<button aria-pressed>`.
- Lightbox is a proper `role="dialog"` with focus trap; `alt` = title (+ description when present).
- Budgets: LCP < 2.5s on 4G · CLS < 0.02 (aspect-ratio boxes are mandatory) · public-page JS < 180KB gzipped.
- Images: AVIF with WebP fallback, `srcset` per column width, lazy below the fold, blurhash placeholders inlined, preconnect to font CDNs, hero preloaded.

---

## 13 · Microcopy — Uzbek source of truth

| Context | String |
|---|---|
| Nav | `Galereya` · `Haqida` · `Aloqa` |
| Filters | `Barchasi` · `Janr` · `Joylashuv` · `Sana` · `Oxirgi 30 kun` · `Filtrlarni tozalash` · `128 TA ISH` |
| Card / cursor | `OCHISH` |
| Lightbox | `KO'RISH` (counter) · `Ulashish` · `Izohlar` · `Originalni buyurtma qilish` |
| Comments | `Izoh qoldirish` · `Ismingiz` · `Izoh yozing…` · `Yuborish` · `Izohingiz tasdiqlangach ko'rinadi` |
| Order | `Buyurtma` · `Chek (skrinshot) yuklash` · `Buyurtma yuborish` · `Buyurtma qabul qilindi. To'lov tasdiqlangach shu sahifada yuklab olish tugmasi paydo bo'ladi.` · `Yuklab olish` · `Havola 48 soat amal qiladi · 3 martagacha` · `Kutilmoqda` · `Tasdiqlandi` · `Rad etildi` |
| States | `Yuklanmoqda…` · `Hech narsa topilmadi` · `BARCHASI KO'RILDI` |
| Toasts | `Nusxalandi` · `Joylandi` · `Saqlandi` · `Xatolik yuz berdi. Qayta urinib ko'ring.` |
| Protection | `Yuqori sifatli original faqat buyurtma orqali beriladi` · `Rasmlarni ruxsatsiz yuklab olish taqiqlanadi` |
| Admin nav | `Boshqaruv` · `Kontentlar` · `Yuklash` · `Izohlar` · `Buyurtmalar` · `Sozlamalar` · `Saytni ochish` · `Chiqish` |
| Admin actions | `+ Yangi kontent` · `Tahrirlash` · `O'chirish` · `Yashirish` · `Tasdiqlash` · `Rad etish` · `Saqlash` · `Kirish` |
| Analytics | `Bugungi tashriflar` · `7 kunlik unikal` · `Jami ko'rishlar` · `Kutilayotgan buyurtmalar` · `Eng ko'p ko'rilganlar` · `So'nggi izohlar` · `So'nggi buyurtmalar` |

Copy voice: minimal, confident, sentence case (mono strings uppercase). Buttons name the exact action (`Buyurtma yuborish`, not `OK`). Errors say what happened and what to do next — never apologize vaguely. No exclamation marks, no emoji.

---

## 14 · Design tokens (drop-in CSS)

```css
:root{
  /* color */
  --bg:#0C0C0D; --bg-elevated:#131315; --surface:#1A1A1D; --surface-hover:#202024;
  --border:rgba(255,255,255,.08); --border-strong:rgba(255,255,255,.16);
  --text:#F4F2ED; --text-muted:#A6A29A; --text-faint:#6C6963;
  --accent:#C99A3F; --accent-hover:#E3B75C; --accent-pressed:#A87F2F; --on-accent:#0C0C0D;
  --success:#3FBF7F; --danger:#E5484D; --info:#4C8DFF;
  --scrim:rgba(8,8,9,.72);
  --scrim-grad:linear-gradient(180deg, transparent, rgba(8,8,9,.82));
  --placeholder:#17171A;

  /* type */
  --font-display:"Clash Display","Archivo",sans-serif;
  --font-body:"Satoshi","Inter",system-ui,sans-serif;
  --font-mono:"Space Mono",ui-monospace,monospace;

  /* radius */
  --r-media:2px; --r-control:10px; --r-card:14px; --r-modal:18px; --r-pill:999px;

  /* spacing */
  --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:24px;
  --s-6:32px; --s-7:48px; --s-8:64px; --s-9:96px;

  /* motion */
  --t-fast:150ms; --t-base:300ms; --t-slow:600ms;
  --ease:cubic-bezier(.2,.6,.2,1);

  /* elevation */
  --shadow-modal:0 24px 64px rgba(0,0,0,.55);
}
```

---

## 15 · Don'ts

- No light theme, no theme switcher (v1).
- No second accent color; no gradients on UI surfaces or buttons (scrims over photos only).
- No borders, frames, drop shadows, or CSS filters on photographs. Never crop, stretch, or upscale them.
- No emoji in UI, no exclamation-heavy copy, no "welcome!" fluff.
- No hover-only functionality — everything reachable by touch and keyboard.
- No aggressive anti-copy alerts or popups; deterrents act silently.
- No autoplaying audio; hero video is always muted.
- No numbered section markers, badges, or decorative stats that don't encode real information.
