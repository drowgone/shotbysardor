"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLiveEvent } from "@/lib/live/use-live";
import { createPortal } from "react-dom";
import { X, Plus, GitMerge, Trash2, Search, ArrowRight, Wand2, Image as ImageIcon, PlayCircle, Star, Sparkles, ExternalLink, CreditCard as CreditCardIcon, User, Eye, EyeOff, Monitor, Smartphone, MapPin, Clock, ShieldAlert, ShieldCheck, LogOut, RefreshCw } from "lucide-react";
import { useCsrf } from "../csrf-provider";
import { uz } from "@/lib/i18n/uz";
import { cn, normalizeName } from "@/lib/utils";
import { normalizePhoneRaw, digitsOnly } from "@/lib/format";
import { CardInput, CurrencyInput, NumberInput, PhoneInput } from "@/components/inputs/FormattedInput";
import {
  CARD_BRANDS,
  detectCardBrand,
  getBrandInfo,
  type CardBrand,
  type LegacyPaymentDetails,
  type PaymentCard,
} from "@/lib/cards";

type SafeSettings = Record<string, unknown>;
type Item = { id: string; name: string; usage?: number };
type HeroItem = {
  id: string;
  title: string;
  slug: string;
  type: "PHOTO" | "VIDEO";
  featured: boolean;
  thumbUrl: string;
  capturedAt: string;
  genre: string | null;
  location: string | null;
};

export function SettingsView({
  initial,
  initialGenres,
  initialLocations,
  heroContents,
}: {
  initial: SafeSettings;
  initialGenres: Item[];
  initialLocations: Item[];
  heroContents: HeroItem[];
}) {
  const csrf = useCsrf();
  const [s, setS] = useState<SafeSettings>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [genres, setGenres] = useState<Item[]>(initialGenres);
  const [locations, setLocations] = useState<Item[]>(initialLocations);
  const [newGenre, setNewGenre] = useState("");
  const [newLocation, setNewLocation] = useState("");

  function set<K extends string>(key: K, value: unknown) {
    setS((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(s),
      });
      if (res.ok) {
        setDirty(false);
        setToast(uz.toasts.saved);
        setTimeout(() => setToast(null), 1500);
      } else {
        setToast(uz.toasts.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function addGenre() {
    if (!newGenre.trim()) return;
    const res = await fetch("/api/admin/genres", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ name: newGenre.trim() }),
    });
    if (res.ok) {
      const d = await res.json();
      setGenres((s) => (s.some((x) => x.id === d.item.id) ? s : [...s, { id: d.item.id, name: d.item.name, usage: 0 }]));
      setNewGenre("");
    }
  }

  async function addLocation() {
    if (!newLocation.trim()) return;
    const res = await fetch("/api/admin/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ name: newLocation.trim() }),
    });
    if (res.ok) {
      const d = await res.json();
      setLocations((s) => (s.some((x) => x.id === d.item.id) ? s : [...s, { id: d.item.id, name: d.item.name, usage: 0 }]));
      setNewLocation("");
    }
  }

  async function mergeLocation(fromId: string, toId: string) {
    const from = locations.find((x) => x.id === fromId);
    const to = locations.find((x) => x.id === toId);
    if (!from || !to) return;
    if (!confirm(`«${from.name}» joylashuvini «${to.name}» ga birlashtirasizmi? «${from.name}» o'chib ketadi.`)) return;
    const res = await fetch("/api/admin/locations/merge", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ fromId, toId }),
    });
    if (res.ok) {
      setLocations((s) =>
        s
          .filter((x) => x.id !== fromId)
          .map((x) => (x.id === toId ? { ...x, usage: (x.usage ?? 0) + (from.usage ?? 0) } : x)),
      );
      setToast(uz.toasts.saved);
      setTimeout(() => setToast(null), 1500);
    } else {
      const d = await res.json().catch(() => null);
      setToast(d?.error?.message ?? uz.toasts.error);
      setTimeout(() => setToast(null), 2500);
    }
  }

  async function mergeGenre(fromId: string, toId: string) {
    const from = genres.find((x) => x.id === fromId);
    const to = genres.find((x) => x.id === toId);
    if (!from || !to) return;
    if (!confirm(`«${from.name}» janrini «${to.name}» ga birlashtirasizmi? «${from.name}» o'chib ketadi.`)) return;
    const res = await fetch("/api/admin/genres/merge", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ fromId, toId }),
    });
    if (res.ok) {
      setGenres((s) =>
        s
          .filter((x) => x.id !== fromId)
          .map((x) => (x.id === toId ? { ...x, usage: (x.usage ?? 0) + (from.usage ?? 0) } : x)),
      );
      setToast(uz.toasts.saved);
      setTimeout(() => setToast(null), 1500);
    } else {
      const d = await res.json().catch(() => null);
      setToast(d?.error?.message ?? uz.toasts.error);
      setTimeout(() => setToast(null), 2500);
    }
  }

  async function deleteGenre(id: string) {
    const g = genres.find((x) => x.id === id);
    if (!g) return;
    if ((g.usage ?? 0) > 0) {
      alert(`«${g.name}» janriga ${g.usage} ta kontent bog'langan. Avval birlashtiring.`);
      return;
    }
    if (!confirm(`«${g.name}» janrini o'chirasizmi?`)) return;
    const res = await fetch(`/api/admin/genres/${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrf },
    });
    if (res.ok) {
      setGenres((s) => s.filter((x) => x.id !== id));
      setToast(uz.toasts.saved);
      setTimeout(() => setToast(null), 1500);
    } else {
      const d = await res.json().catch(() => null);
      setToast(d?.error?.message ?? uz.toasts.error);
      setTimeout(() => setToast(null), 2500);
    }
  }

  async function deleteLocation(id: string) {
    const l = locations.find((x) => x.id === id);
    if (!l) return;
    if ((l.usage ?? 0) > 0) {
      alert(`«${l.name}» joylashuviga ${l.usage} ta kontent bog'langan. Avval birlashtiring.`);
      return;
    }
    if (!confirm(`«${l.name}» joylashuvini o'chirasizmi?`)) return;
    const res = await fetch(`/api/admin/locations/${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrf },
    });
    if (res.ok) {
      setLocations((s) => s.filter((x) => x.id !== id));
      setToast(uz.toasts.saved);
      setTimeout(() => setToast(null), 1500);
    } else {
      const d = await res.json().catch(() => null);
      setToast(d?.error?.message ?? uz.toasts.error);
      setTimeout(() => setToast(null), 2500);
    }
  }

  // Xavfsizlik sozlamalari (client-side va server-side) — settings.ts default'lari bilan bir xil
  const defaultProtection = {
    rightClick: true,
    dragDrop: true,
    textSelect: true,
    copy: true,
    save: true,
    devTools: true,
    printScreen: true,
  };
  const defaultServer = {
    hotlink: true,
    publicRateLimit: true,
    signedPreviews: false,
    allowedOrigins: [] as string[],
  };
  const protection = { ...defaultProtection, ...((s["security.protection"] as Partial<typeof defaultProtection>) ?? {}) };
  const serverProtection = { ...defaultServer, ...((s["security.server"] as Partial<typeof defaultServer>) ?? {}) };
  function setProtection(patch: Partial<typeof defaultProtection>) {
    set("security.protection", { ...protection, ...patch });
  }
  function setServerProtection(patch: Partial<typeof defaultServer>) {
    set("security.server", { ...serverProtection, ...patch });
  }

  const [normalizing, setNormalizing] = useState(false);
  const unnormalizedCount = useMemo(
    () => [...genres, ...locations].filter((x) => normalizeName(x.name) !== x.name).length,
    [genres, locations],
  );

  async function normalizeAll() {
    if (unnormalizedCount === 0) return;
    if (!confirm(`${unnormalizedCount} ta nom bosh harf bilan yozilishi uchun o'zgartiriladi. Davom etamizmi?`)) return;
    setNormalizing(true);
    try {
      const res = await fetch("/api/admin/taxonomy/normalize", {
        method: "POST",
        headers: { "x-csrf-token": csrf },
      });
      if (res.ok) {
        const d = await res.json();
        setGenres((prev) =>
          prev.map((g) => ({ ...g, name: normalizeName(g.name) || g.name })),
        );
        setLocations((prev) =>
          prev.map((l) => ({ ...l, name: normalizeName(l.name) || l.name })),
        );
        const st = d.stats ?? {};
        const merged = (st.genreMerged ?? 0) + (st.locMerged ?? 0);
        setToast(
          merged > 0
            ? `Nomlashtirildi. ${merged} ta duplikat birlashtirildi — sahifani yangilang.`
            : "Barcha nomlar bosh harf bilan yozildi",
        );
        setTimeout(() => setToast(null), 2500);
      } else {
        const d = await res.json().catch(() => null);
        setToast(d?.error?.message ?? uz.toasts.error);
        setTimeout(() => setToast(null), 2500);
      }
    } finally {
      setNormalizing(false);
    }
  }

  const socials = (s["site.socials"] ?? {}) as Record<string, string>;
  const pay = (s["order.paymentDetails"] ?? {}) as LegacyPaymentDetails;

  return (
    <div className="flex flex-col gap-6 pb-24">
      <Group
        title={uz.admin.settings.groups.site}
        description="Bosh sahifada va SEO metadata'sida ko'rinadigan asosiy ma'lumotlar."
      >
        <Row label={uz.admin.settings.siteTitle} hint={uz.admin.settings.hints.siteTitle}>
          <Input value={(s["site.title"] as string) ?? ""} onChange={(v) => set("site.title", v)} placeholder="shotbysardor" />
        </Row>
        <Row label={uz.admin.settings.siteTagline} hint={uz.admin.settings.hints.siteTagline}>
          <Input value={(s["site.tagline"] as string) ?? ""} onChange={(v) => set("site.tagline", v)} placeholder="photograph" />
        </Row>
        <Row label={uz.admin.settings.siteBio} hint={uz.admin.settings.hints.siteBio}>
          <Textarea value={(s["site.bio"] as string) ?? ""} onChange={(v) => set("site.bio", v)} placeholder="Some see the world. I photograph it 🌍📸" />
        </Row>
        <Row label={uz.admin.settings.hero} hint={uz.admin.settings.hints.hero}>
          <HeroPicker
            items={heroContents}
            value={(s["site.heroContentId"] as string) ?? null}
            onChange={(id) => set("site.heroContentId", id)}
            csrf={csrf}
            onToast={(msg) => {
              setToast(msg);
              setTimeout(() => setToast(null), 1500);
            }}
          />
        </Row>
        <Row label={uz.admin.settings.aboutPortrait} hint={uz.admin.settings.hints.aboutPortrait}>
          <PortraitUploader
            value={(s["site.aboutPortraitKey"] as string) ?? null}
            onChange={(key) => set("site.aboutPortraitKey", key)}
            csrf={csrf}
            onToast={(msg) => {
              setToast(msg);
              setTimeout(() => setToast(null), 1500);
            }}
          />
        </Row>
        <Row label={uz.admin.settings.instagram} hint={uz.admin.settings.hints.instagram} compact>
          <Input
            value={socials.instagram ?? ""}
            onChange={(v) => set("site.socials", { ...socials, instagram: v.replace(/^@/, "") })}
            prefix="@"
            placeholder="username"
            autoComplete="off"
          />
        </Row>
        <Row label={uz.admin.settings.telegram} hint={uz.admin.settings.hints.telegram} compact>
          <Input
            value={socials.telegram ?? ""}
            onChange={(v) => set("site.socials", { ...socials, telegram: v.replace(/^@/, "") })}
            prefix="@"
            placeholder="username"
            autoComplete="off"
          />
        </Row>
        <Row label={uz.admin.settings.phone} hint={uz.admin.settings.hints.phone} compact>
          <PhoneInput
            value={digitsOnly((socials.phone ?? "").replace(/^\+?998/, "")).slice(0, 9)}
            onValueChange={(raw) =>
              set("site.socials", { ...socials, phone: raw ? normalizePhoneRaw(raw) : "" })
            }
          />
        </Row>
        <Row label={uz.admin.settings.email} hint={uz.admin.settings.hints.email}>
          <Input
            type="email"
            inputMode="email"
            value={socials.email ?? ""}
            onChange={(v) => set("site.socials", { ...socials, email: v })}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Row>
      </Group>

      <Group
        title={uz.admin.settings.groups.content}
        description="Janrlar va joylashuvlar — kontent yuklashda tanlanadi. Preview o'lchami tezlik va sifat balansini belgilaydi."
      >
        {unnormalizedCount > 0 && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-[var(--r-control)] bg-[var(--accent)]/5 border border-[var(--accent)]/30 flex-wrap">
            <div className="text-sm flex items-center gap-2 min-w-0">
              <Wand2 size={14} className="text-[var(--accent)] shrink-0" />
              <span>
                <strong className="tabular-nums">{unnormalizedCount}</strong> ta nom kichik harf bilan yozilgan.
                Bosh harf bilan yozib chiqishni istaysizmi?
              </span>
            </div>
            <button
              onClick={normalizeAll}
              disabled={normalizing}
              className="h-9 px-3 rounded-[var(--r-control)] text-sm bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Wand2 size={13} />
              {normalizing ? uz.states.loading : "Bosh harflashtirish"}
            </button>
          </div>
        )}
        <Row label={uz.admin.settings.genres} hint={uz.admin.settings.hints.genres}>
          <TaxonomyEditor
            kind="genre"
            items={genres}
            newValue={newGenre}
            setNewValue={setNewGenre}
            onAdd={addGenre}
            onMerge={mergeGenre}
            onDelete={deleteGenre}
            placeholder="Yangi janr"
          />
        </Row>
        <Row label={uz.admin.settings.locations} hint={uz.admin.settings.hints.locations}>
          <TaxonomyEditor
            kind="location"
            items={locations}
            newValue={newLocation}
            setNewValue={setNewLocation}
            onAdd={addLocation}
            onMerge={mergeLocation}
            onDelete={deleteLocation}
            placeholder="Yangi joylashuv"
          />
        </Row>
        <Row label={uz.admin.settings.previewSize} hint={uz.admin.settings.hints.previewSize}>
          <div className="flex gap-2 flex-wrap">
            {[1280, 1600, 1920].map((n) => {
              const active = (s["content.previewMaxEdge"] as number) === n;
              return (
                <button
                  key={n}
                  onClick={() => set("content.previewMaxEdge", n)}
                  className={cn(
                    "h-10 px-4 rounded-[var(--r-control)] text-sm border transition-colors",
                    active
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--border)]",
                  )}
                >
                  {n}px
                </button>
              );
            })}
          </div>
        </Row>
        <Row
          label={uz.admin.settings.shufflePerVisit}
          hint={uz.admin.settings.hints.shufflePerVisit}
        >
          <Toggle
            value={s["gallery.shufflePerVisit"] !== false}
            onChange={(v) => set("gallery.shufflePerVisit", v)}
          />
        </Row>
      </Group>

      <Group
        title={uz.admin.settings.groups.order}
        description="Mijozlarga ko'rsatiladigan to'lov usullari va yuklab olish shartlari."
      >
        <Row label={uz.admin.settings.defaultPrice} hint={uz.admin.settings.hints.defaultPrice} compact>
          <CurrencyInput
            value={String(s["order.defaultPriceUZS"] ?? "")}
            onValueChange={(raw) => set("order.defaultPriceUZS", raw ? Number(raw) : 0)}
            placeholder="50 000"
          />
        </Row>
        <Row label="Kartalar" hint="Bir yoki bir nechta karta qo'shishingiz mumkin. Tur (UzCard, Humo, Visa, Mastercard) raqamdan avtomatik aniqlanadi. Bo'sh joysiz, faqat raqamlar.">
          <CardsListEditor
            value={pay}
            onChange={(v) => set("order.paymentDetails", v)}
          />
        </Row>
        <Row label={uz.admin.settings.payme} hint={uz.admin.settings.hints.payme}>
          <Input
            type="url"
            inputMode="url"
            value={pay.paymeUrl ?? ""}
            onChange={(v) => set("order.paymentDetails", { ...pay, paymeUrl: v })}
            placeholder="https://payme.uz/..."
          />
        </Row>
        <Row label={uz.admin.settings.click} hint={uz.admin.settings.hints.click}>
          <Input
            type="url"
            inputMode="url"
            value={pay.clickUrl ?? ""}
            onChange={(v) => set("order.paymentDetails", { ...pay, clickUrl: v })}
            placeholder="https://my.click.uz/..."
          />
        </Row>
        <Row label={uz.admin.settings.linkTtl} hint={uz.admin.settings.hints.linkTtl} compact>
          <NumberInput
            value={String(s["order.linkTtlHours"] ?? 48)}
            onValueChange={(raw) => set("order.linkTtlHours", raw ? Number(raw) : 0)}
          />
        </Row>
        <Row label={uz.admin.settings.maxDownloads} hint={uz.admin.settings.hints.maxDownloads} compact>
          <NumberInput
            value={String(s["order.maxDownloads"] ?? 3)}
            onValueChange={(raw) => set("order.maxDownloads", raw ? Number(raw) : 0)}
          />
        </Row>
      </Group>

      {/* Donate — /donate sahifasi va header link boshqaruvi.
         To'lov ma'lumotlari yuqoridagi «Buyurtma & to'lov» guruhidan olinadi. */}
      {(() => {
        const donateAmounts = (s["donate.suggestedAmounts"] as number[]) ?? [];
        const donateEnabled = !!s["donate.enabled"];
        return (
          <Group
            title={uz.admin.settings.groups.donate}
            description="Foydalanuvchilardan ixtiyoriy yordam olish uchun /donate sahifasi va header'dagi «Qo'llash» tugmasi boshqaruvi. To'lov ma'lumotlari (karta, Payme, Click) yuqoridagi «Buyurtma & to'lov» guruhidan olinadi."
          >
            <Row label="Qo'llash sahifasini yoqish" hint="O'chirilgan bo'lsa /donate sahifasi «yopiq» ko'rinadi.">
              <Toggle value={donateEnabled} onChange={(v) => set("donate.enabled", v)} />
            </Row>
            {donateEnabled && (
              <>
                <Row label="Sarlavha" hint="Sahifadagi katta sarlavha. Qisqa va samimiy tuting.">
                  <Input
                    value={(s["donate.title"] as string) ?? ""}
                    onChange={(v) => set("donate.title", v)}
                    placeholder="Ijodni qo'llab-quvvatlash"
                  />
                </Row>
                <Row label="Tavsif" hint="Sarlavha ostidagi izoh. Nima uchun qo'llab-quvvatlash — 2-3 gap.">
                  <Textarea
                    value={(s["donate.description"] as string) ?? ""}
                    onChange={(v) => set("donate.description", v)}
                    placeholder="Har bir hissa yangi safarga, yangi jihozga aylanadi."
                  />
                </Row>
                <Row label="Rahmat xabari" hint="Pastki minnatdorchilik kartochkasidagi matn.">
                  <Input
                    value={(s["donate.thankYou"] as string) ?? ""}
                    onChange={(v) => set("donate.thankYou", v)}
                    placeholder="Rahmat! Yordamingiz keyingi kadrlarga aylanadi."
                  />
                </Row>
                <Row label="Taxminiy miqdorlar" hint="Foydalanuvchi tanlashi uchun taklif qilinadigan summalar (so'mda). Vergul yoki bo'shliq bilan ajrating.">
                  <Input
                    value={donateAmounts.join(", ")}
                    onChange={(v) => {
                      const nums = v
                        .split(/[,\s]+/)
                        .map((n) => Number(n.replace(/\D/g, "")))
                        .filter((n) => n > 0);
                      set("donate.suggestedAmounts", nums);
                    }}
                    placeholder="20000, 50000, 100000, 250000"
                  />
                </Row>
              </>
            )}
          </Group>
        );
      })()}

      <Group
        title={uz.admin.settings.groups.comments}
        description="Foydalanuvchi izohlarini moderatsiya qilish va cheklash qoidalari."
      >
        <Row label={uz.admin.settings.moderation} hint={uz.admin.settings.hints.moderation}>
          <Toggle value={!!s["comments.moderation"]} onChange={(v) => set("comments.moderation", v)} />
        </Row>
        <Row label={uz.admin.settings.bannedWords} hint={uz.admin.settings.hints.bannedWords}>
          <ChipsInput
            value={(s["comments.bannedWords"] as string[]) ?? []}
            onChange={(v) => set("comments.bannedWords", v)}
          />
        </Row>
        <Row label={uz.admin.settings.nameMaxLen} hint={uz.admin.settings.hints.nameMaxLen} compact>
          <NumberInput
            value={String(s["comments.nameMaxLen"] ?? 30)}
            onValueChange={(raw) => set("comments.nameMaxLen", raw ? Number(raw) : 0)}
          />
        </Row>
      </Group>

      <Group
        title={uz.admin.settings.groups.analytics}
        description="Tashriflar va foydalanuvchi harakatlari statistikasi bilan bog'liq sozlamalar."
      >
        <Row label={uz.admin.settings.excludeAdmin} hint={uz.admin.settings.hints.excludeAdmin}>
          <Toggle value={!!s["analytics.excludeAdmin"]} onChange={(v) => set("analytics.excludeAdmin", v)} />
        </Row>
        <Row label={uz.admin.settings.retentionDays} hint={uz.admin.settings.hints.retentionDays} compact>
          <NumberInput
            value={String(s["analytics.retentionDays"] ?? 365)}
            onValueChange={(raw) => set("analytics.retentionDays", raw ? Number(raw) : 0)}
          />
        </Row>
      </Group>

      <Group
        title={uz.admin.settings.telegramGroup}
        description="Yangi buyurtmalar haqida sizga xabar yuboradigan Telegram bot."
      >
        <TelegramSection csrf={csrf} initial={(s["order.telegram"] as { enabled: boolean; botToken: string; chatId: string }) ?? { enabled: false, botToken: "", chatId: "" }} />
      </Group>

      <Group
        title={uz.admin.settings.groups.security}
        description="Kontent himoyasi va admin akkaunt xavfsizligi. Klient tomoni — foydalanuvchi brauzeridagi bloklar (deterrent). Server tomoni — resurslarga to'g'ridan-to'g'ri kirish va bot/scraper'lardan haqiqiy himoya."
      >
        <Row label={uz.admin.settings.screenshotGuard} hint={uz.admin.settings.screenshotGuardHint}>
          <Toggle value={!!s["security.screenshotGuard"]} onChange={(v) => set("security.screenshotGuard", v)} />
        </Row>

        {/* Klient tomon */}
        <SubSection title={uz.admin.settings.security2.clientTitle} description={uz.admin.settings.security2.clientDesc}>
          <ProtectionToggle
            label={uz.admin.settings.security2.blockRightClick}
            hint={uz.admin.settings.hints.protection.rightClick}
            value={protection.rightClick}
            onChange={(v) => setProtection({ rightClick: v })}
          />
          <ProtectionToggle
            label={uz.admin.settings.security2.blockDrag}
            hint={uz.admin.settings.hints.protection.dragDrop}
            value={protection.dragDrop}
            onChange={(v) => setProtection({ dragDrop: v })}
          />
          <ProtectionToggle
            label={uz.admin.settings.security2.blockSelect}
            hint={uz.admin.settings.hints.protection.textSelect}
            value={protection.textSelect}
            onChange={(v) => setProtection({ textSelect: v })}
          />
          <ProtectionToggle
            label={uz.admin.settings.security2.blockCopy}
            hint={uz.admin.settings.hints.protection.copy}
            value={protection.copy}
            onChange={(v) => setProtection({ copy: v })}
          />
          <ProtectionToggle
            label={uz.admin.settings.security2.blockSave}
            hint={uz.admin.settings.hints.protection.save}
            value={protection.save}
            onChange={(v) => setProtection({ save: v })}
          />
          <ProtectionToggle
            label={uz.admin.settings.security2.blockDevTools}
            hint={uz.admin.settings.hints.protection.devTools}
            value={protection.devTools}
            onChange={(v) => setProtection({ devTools: v })}
          />
          <ProtectionToggle
            label={uz.admin.settings.security2.blockPrintScreen}
            hint={uz.admin.settings.hints.protection.printScreen}
            value={protection.printScreen}
            onChange={(v) => setProtection({ printScreen: v })}
          />
        </SubSection>

        {/* Server tomon */}
        <SubSection title={uz.admin.settings.security2.serverTitle} description={uz.admin.settings.security2.serverDesc}>
          <ProtectionToggle
            label={uz.admin.settings.security2.hotlink}
            hint={uz.admin.settings.hints.server.hotlink}
            value={serverProtection.hotlink}
            onChange={(v) => setServerProtection({ hotlink: v })}
          />
          <ProtectionToggle
            label={uz.admin.settings.security2.rateLimit}
            hint={uz.admin.settings.hints.server.publicRateLimit}
            value={serverProtection.publicRateLimit}
            onChange={(v) => setServerProtection({ publicRateLimit: v })}
          />
          <Row label={uz.admin.settings.security2.allowedOrigins} hint={uz.admin.settings.hints.server.allowedOrigins}>
            <ChipsInput
              value={serverProtection.allowedOrigins}
              onChange={(v) => setServerProtection({ allowedOrigins: v })}
            />
          </Row>
        </SubSection>

        <SubSection
          title="Admin akkaunti"
          description="Kirish uchun login va parol. Har qanday o'zgartirish uchun joriy parolni tasdiqlash shart. Yangi parol kamida 8 belgi bo'lsin."
        >
          <PasswordChange
            csrf={csrf}
            currentUsername={((s["admin.username"] as string) || "admin").trim()}
            updatedAt={(s["admin.credentialsUpdatedAt"] as string) ?? null}
            onSaved={(patch) => {
              if (patch.username) setS((prev) => ({ ...prev, "admin.username": patch.username }));
              if (patch.updatedAt)
                setS((prev) => ({ ...prev, "admin.credentialsUpdatedAt": patch.updatedAt }));
            }}
          />
        </SubSection>

        <SubSection
          title="Seanslar"
          description="Admin panelga kirgan qurilmalar. Yangi qurilma aniqlansa telegram'ga xabar keladi. Boshqa seanslarni chiqarish faqat eng qadimgi (‘master’) seansdan mumkin."
        >
          <SessionsPanel csrf={csrf} />
        </SubSection>
      </Group>

      {/* Sticky save bar */}
      {dirty && (
        <div
          className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-modal)] bg-[var(--surface)] border border-[var(--border-strong)] max-w-[calc(100vw-2rem)]"
          style={{ boxShadow: "var(--shadow-modal)" }}
        >
          <span className="inline-flex items-center gap-2 text-sm pl-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            Saqlanmagan o'zgarishlar
          </span>
          <button
            onClick={() => {
              if (!confirm("O'zgarishlarni bekor qilasizmi?")) return;
              setS(initial);
              setDirty(false);
            }}
            disabled={saving}
            className="h-9 px-3 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm hover:border-[var(--border)] disabled:opacity-50"
          >
            {uz.admin.actions.cancel}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="h-9 px-4 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium text-sm disabled:opacity-50"
          >
            {saving ? uz.states.loading : uz.admin.actions.save}
          </button>
        </div>
      )}
      {toast && (
        <div className="fixed top-6 right-6 z-40 px-4 py-3 bg-[var(--success)]/10 border border-[var(--success)]/40 text-[var(--success)] rounded-[var(--r-control)] text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--surface)] rounded-[var(--r-card)] p-4 md:p-6">
      <header className="mb-5 md:mb-6">
        <h2 className="font-display text-lg">{title}</h2>
        {description && (
          <p className="text-xs text-[var(--text-muted)] mt-1 leading-snug max-w-2xl">
            {description}
          </p>
        )}
      </header>
      <div className="flex flex-col gap-5 md:gap-6 divide-y divide-[var(--border)]/40 [&>*]:pt-5 [&>*]:md:pt-6 [&>*:first-child]:pt-0">
        {children}
      </div>
    </section>
  );
}

// Xavfsizlik guruhida ichki tematik bo'lim — sarlavha + tavsif + toggle qatorlari.
function SubSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {description && (
          <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug max-w-2xl">
            {description}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 rounded-[var(--r-card)] bg-[var(--bg)]/50 border border-[var(--border)] p-3 divide-y divide-[var(--border)]/30 [&>*]:pt-3 [&>*:first-child]:pt-0">
        {children}
      </div>
    </div>
  );
}

// Kompakt toggle qatori — label + hint chapda, switch o'ngda.
function ProtectionToggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm">{label}</div>
        {hint && (
          <div className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5 pr-2">{hint}</div>
        )}
      </div>
      <div className="shrink-0">
        <Toggle value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
  compact,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-2 md:gap-4 items-start">
      <div className="pt-2 flex flex-col gap-1">
        <label className="text-sm text-[var(--text)]">{label}</label>
        {hint && (
          <p className="hidden md:block text-[11px] text-[var(--text-muted)] leading-snug pr-2">
            {hint}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className={compact ? "max-w-xs" : undefined}>{children}</div>
        {hint && (
          <p className="md:hidden text-[11px] text-[var(--text-muted)] leading-snug">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
  autoComplete,
  prefix,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "url" | "email" | "decimal" | "search";
  autoComplete?: string;
  prefix?: string;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 text-sm text-[var(--text-muted)] pointer-events-none select-none">
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete ?? "off"}
        data-lpignore="true"
        data-1p-ignore="true"
        data-form-type="other"
        className={cn(
          "w-full h-11 pr-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)] transition-colors",
          prefix ? "pl-7" : "pl-3",
        )}
      />
    </div>
  );
}

function Textarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      placeholder={placeholder}
      autoComplete="off"
      data-lpignore="true"
      data-1p-ignore="true"
      data-form-type="other"
      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)] transition-colors resize-y min-h-[100px]"
    />
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        "inline-flex items-center gap-2 h-10 pl-1.5 pr-3 rounded-[var(--r-control)] border text-sm transition-colors",
        value
          ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
          : "border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--border)]",
      )}
    >
      <span
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors",
          value ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
            value ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
      {value ? uz.common.yes : uz.common.no}
    </button>
  );
}

function HeroPicker({
  items,
  value,
  onChange,
  csrf,
  onToast,
}: {
  items: HeroItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  csrf: string;
  onToast: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "featured" | "image" | "video">("all");
  const [localItems, setLocalItems] = useState<HeroItem[]>(items);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setLocalItems(items), [items]);

  const selected = useMemo(() => localItems.find((c) => c.id === value) ?? null, [localItems, value]);
  const autoPick = useMemo(
    () => localItems.filter((c) => c.featured).sort((a, b) => (a.capturedAt > b.capturedAt ? -1 : 1))[0] ?? null,
    [localItems],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return localItems
      .filter((c) => {
        if (tab === "featured" && !c.featured) return false;
        if (tab === "image" && c.type !== "PHOTO") return false;
        if (tab === "video" && c.type !== "VIDEO") return false;
        if (q) {
          const hay = `${c.title} ${c.slug} ${c.genre ?? ""} ${c.location ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [localItems, query, tab]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const MAX_W = 640;
    const width = Math.min(MAX_W, Math.max(rect.width, 380));
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    const top = rect.bottom + 6;
    setPos({ top, left, width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScroll(e: Event) {
      // Popover ichidagi scroll — o'zi bilan qoladi. Faqat tashqi (sahifa) scroll yopadi.
      const t = e.target as Node | null;
      if (t && menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  async function toggleFeatured(item: HeroItem) {
    setBusyId(item.id);
    const next = !item.featured;
    try {
      const res = await fetch(`/api/admin/contents/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ featured: next }),
      });
      if (res.ok) {
        setLocalItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, featured: next } : x)));
        onToast(next ? "Featured qo'shildi" : "Featured olib tashlandi");
      } else {
        const d = await res.json().catch(() => null);
        onToast(d?.error?.message ?? uz.toasts.error);
      }
    } finally {
      setBusyId(null);
    }
  }

  const preview = selected ?? autoPick;

  const menu = open && pos && (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        boxShadow: "var(--shadow-modal)",
      }}
      className="z-50 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--r-card)] p-3 flex flex-col gap-3 max-h-[70vh]"
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sarlavha, slug, janr…"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            className="w-full h-9 pl-8 pr-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--r-control)] text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-9 w-9 inline-flex items-center justify-center rounded-[var(--r-control)] border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {(
          [
            { k: "all", label: `Barchasi (${localItems.length})` },
            { k: "featured", label: `Featured (${localItems.filter((x) => x.featured).length})` },
            { k: "image", label: "Rasmlar" },
            { k: "video", label: "Videolar" },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={cn(
              "h-7 px-2.5 rounded-[var(--r-pill)] text-xs border transition-colors",
              tab === t.k
                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto flex-1 -mr-1 pr-1 overscroll-contain">
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
          className={cn(
            "w-full text-left px-3 py-2.5 rounded-[var(--r-control)] flex items-center gap-3 mb-2 border transition-colors",
            value === null
              ? "border-[var(--accent)] bg-[var(--accent)]/5"
              : "border-[var(--border)] hover:border-[var(--border-strong)]",
          )}
        >
          <span className="w-10 h-10 rounded-[var(--r-media)] bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)]">
            <Sparkles size={16} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm">Avtomatik</span>
            <span className="block text-[11px] text-[var(--text-muted)] truncate">
              {autoPick ? `Hozir: ${autoPick.title}` : "Featured kontent yo'q"}
            </span>
          </span>
          {value === null && <span className="text-[10px] text-[var(--accent)]">TANLANGAN</span>}
        </button>

        {filtered.length === 0 && (
          <div className="text-center text-sm text-[var(--text-muted)] py-8">Topilmadi</div>
        )}

        <div className="grid grid-cols-1 gap-1.5">
          {filtered.map((c) => {
            const active = c.id === value;
            return (
              <div
                key={c.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-[var(--r-control)] border transition-colors",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/5"
                    : "border-[var(--border)] hover:border-[var(--border-strong)]",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <span className="relative w-12 h-12 rounded-[var(--r-media)] bg-[var(--bg)] overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    {c.type === "VIDEO" && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                        <PlayCircle size={16} />
                      </span>
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{c.title}</span>
                    <span className="block text-[10px] text-[var(--text-muted)] truncate">
                      {c.genre && <span>{c.genre}</span>}
                      {c.location && <span> · {c.location}</span>}
                      {c.capturedAt && (
                        <span> · {new Date(c.capturedAt).getFullYear()}</span>
                      )}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleFeatured(c)}
                  disabled={busyId === c.id}
                  title={c.featured ? "Featured'dan olib tashlash" : "Featured qilib qo'shish"}
                  className={cn(
                    "w-8 h-8 inline-flex items-center justify-center rounded-full transition-colors",
                    c.featured
                      ? "text-[var(--accent)] hover:bg-[var(--accent)]/10"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg)]",
                    busyId === c.id && "opacity-50",
                  )}
                >
                  <Star size={14} fill={c.featured ? "currentColor" : "none"} />
                </button>
                {active && (
                  <span className="text-[10px] text-[var(--accent)] shrink-0 pr-1">TANLANGAN</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="text-[10px] text-[var(--text-muted)] px-1 pt-1 border-t border-[var(--border)]">
        Yulduzcha tugmasi orqali «Featured» ni tez o'zgartirishingiz mumkin. To'liq tahrirlash uchun «Kontentlar» bo'limiga o'ting.
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-3 p-2 pr-3 bg-[var(--bg)] border rounded-[var(--r-control)] text-left transition-colors",
          open
            ? "border-[var(--accent)]"
            : "border-[var(--border-strong)] hover:border-[var(--border)]",
        )}
      >
        {preview ? (
          <span className="relative w-14 h-14 rounded-[var(--r-media)] bg-[var(--surface)] overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.thumbUrl} alt="" className="w-full h-full object-cover" />
            {preview.type === "VIDEO" && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                <PlayCircle size={18} />
              </span>
            )}
          </span>
        ) : (
          <span className="w-14 h-14 rounded-[var(--r-media)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
            <ImageIcon size={18} />
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-sm truncate">
              {selected ? selected.title : "Avtomatik"}
            </span>
            {selected?.featured && <Star size={12} className="text-[var(--accent)] shrink-0" fill="currentColor" />}
          </span>
          <span className="block text-[11px] text-[var(--text-muted)] truncate mt-0.5">
            {selected
              ? `${selected.type === "VIDEO" ? "Video" : "Rasm"}${selected.genre ? ` · ${selected.genre}` : ""}${selected.capturedAt ? ` · ${new Date(selected.capturedAt).getFullYear()}` : ""}`
              : autoPick
              ? `Hozir: ${autoPick.title}`
              : "Featured kontent yo'q — hech narsa ko'rsatilmaydi"}
          </span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && (
            <a
              href={`/p/${selected.slug}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Saytda ko'rish"
              className="w-8 h-8 inline-flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface)]"
            >
              <ExternalLink size={13} />
            </a>
          )}
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              title="Avtomatik holatga qaytarish"
              className="w-8 h-8 inline-flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--danger)]"
            >
              <X size={13} />
            </button>
          )}
          <span className="text-[11px] text-[var(--accent)] pl-1">O'zgartirish</span>
        </span>
      </button>
      {menu && typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  );
}

function ChipsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [txt, setTxt] = useState("");
  function add() {
    const t = txt.trim();
    if (!t) return;
    if (value.includes(t)) {
      setTxt("");
      return;
    }
    onChange([...value, t]);
    setTxt("");
  }
  return (
    <div className="flex flex-wrap gap-2 items-center min-h-[44px] p-1.5 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] focus-within:border-[var(--accent)] transition-colors">
      {value.map((w) => (
        <span
          key={w}
          className="h-7 pl-2.5 pr-1 rounded-[var(--r-pill)] bg-[var(--surface)] border border-[var(--border)] text-sm inline-flex items-center gap-1"
        >
          {w}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== w))}
            aria-label={`«${w}» ni o'chirish`}
            className="w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] text-[var(--text-muted)]"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !txt && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={value.length === 0 ? "So'z yozib Enter bosing" : "…"}
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore="true"
        data-form-type="other"
        name="chip-input"
        className="flex-1 min-w-[100px] h-7 px-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

function TaxonomyEditor({
  kind,
  items,
  newValue,
  setNewValue,
  onAdd,
  onMerge,
  onDelete,
  placeholder,
}: {
  kind: "genre" | "location";
  items: Item[];
  newValue: string;
  setNewValue: (v: string) => void;
  onAdd: () => void;
  onMerge: (fromId: string, toId: string) => void;
  onDelete: (id: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...items].sort(
      (a, b) => (b.usage ?? 0) - (a.usage ?? 0) || a.name.localeCompare(b.name),
    );
    if (!q) return sorted;
    return sorted.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="flex flex-col gap-2">
      {items.length > 6 && (
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Qidirish"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            className="w-full h-9 pl-8 pr-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--r-control)] text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="text-xs text-[var(--text-muted)] px-1 py-2">Topilmadi</div>
        )}
        {filtered.map((item) => (
          <ChipMenu
            key={item.id}
            item={item}
            others={items.filter((x) => x.id !== item.id)}
            kind={kind}
            onMerge={(toId) => onMerge(item.id, toId)}
            onDelete={() => onDelete(item.id)}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          className="flex-1 h-11 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={onAdd}
          className="h-11 px-4 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm inline-flex items-center gap-1 hover:bg-[var(--surface-2,var(--surface))]"
        >
          <Plus size={16} /> Qo'shish
        </button>
      </div>
    </div>
  );
}

function ChipMenu({
  item,
  others,
  kind,
  onMerge,
  onDelete,
}: {
  item: Item;
  others: Item[];
  kind: "genre" | "location";
  onMerge: (toId: string) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mergeQuery, setMergeQuery] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; placement: "bottom" | "top" } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const usage = item.usage ?? 0;
  const canDelete = usage === 0;

  const MENU_WIDTH = 288;
  const MENU_HEIGHT_ESTIMATE = 340;
  const MARGIN = 8;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: "bottom" | "top" =
      spaceBelow < MENU_HEIGHT_ESTIMATE + MARGIN && rect.top > spaceBelow ? "top" : "bottom";
    const top = placement === "bottom" ? rect.bottom + 4 : rect.top - 4;
    let left = rect.left;
    if (left + MENU_WIDTH > window.innerWidth - MARGIN) {
      left = Math.max(MARGIN, window.innerWidth - MENU_WIDTH - MARGIN);
    }
    setPos({ top, left, placement });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (
        !triggerRef.current?.contains(t) &&
        !menuRef.current?.contains(t)
      )
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScroll(e: Event) {
      const t = e.target as Node | null;
      if (t && menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const mergeChoices = useMemo(() => {
    const q = mergeQuery.trim().toLowerCase();
    const sorted = [...others].sort(
      (a, b) => (b.usage ?? 0) - (a.usage ?? 0) || a.name.localeCompare(b.name),
    );
    if (!q) return sorted;
    return sorted.filter((x) => x.name.toLowerCase().includes(q));
  }, [others, mergeQuery]);

  const menu = open && pos && (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: pos.placement === "bottom" ? pos.top : undefined,
        bottom: pos.placement === "top" ? window.innerHeight - pos.top : undefined,
        left: pos.left,
        width: MENU_WIDTH,
        boxShadow: "var(--shadow-modal)",
      }}
      className="z-50 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--r-card)] p-2 flex flex-col gap-2"
    >
      <div className="text-[11px] text-[var(--text-muted)] px-2 pt-1 leading-snug">
        «{item.name}» ni boshqasiga birlashtirish. Bu chip o'chib, kontentlari tanlagan
        {kind === "genre" ? " janrga" : " joylashuvga"} o'tadi.
      </div>
      <div className="relative">
        <Search
          size={12}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          autoFocus
          value={mergeQuery}
          onChange={(e) => setMergeQuery(e.target.value)}
          placeholder="Qaysi biriga?"
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          className="w-full h-8 pl-7 pr-2 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--r-control)] text-xs outline-none focus:border-[var(--accent)]"
        />
      </div>
      <div className="max-h-52 overflow-y-auto flex flex-col overscroll-contain">
        {mergeChoices.length === 0 && (
          <div className="text-xs text-[var(--text-muted)] px-2 py-2">Topilmadi</div>
        )}
        {mergeChoices.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setOpen(false);
              onMerge(c.id);
            }}
            className="text-left px-2 py-1.5 rounded-[var(--r-control)] text-sm hover:bg-[var(--bg)] inline-flex items-center gap-2 justify-between"
          >
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <ArrowRight size={12} className="text-[var(--text-muted)] shrink-0" />
              <span className="truncate">{c.name}</span>
            </span>
            <span className="text-[10px] tabular-nums text-[var(--text-muted)] shrink-0">
              {c.usage ?? 0}
            </span>
          </button>
        ))}
      </div>
      <div className="border-t border-[var(--border)] pt-2 mt-1">
        <button
          type="button"
          disabled={!canDelete}
          onClick={() => {
            setOpen(false);
            onDelete();
          }}
          className={cn(
            "w-full text-left px-2 py-1.5 rounded-[var(--r-control)] text-sm inline-flex items-center gap-2",
            canDelete
              ? "text-[var(--danger)] hover:bg-[var(--danger)]/10"
              : "text-[var(--text-muted)] cursor-not-allowed",
          )}
          title={canDelete ? "O'chirish" : "Avval birlashtiring — kontent bog'langan"}
        >
          <Trash2 size={13} />
          O'chirish
          {!canDelete && (
            <span className="ml-auto text-[10px]">({usage} ta kontent)</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <span
        className={cn(
          "h-9 pl-3 pr-1 rounded-[var(--r-pill)] bg-[var(--bg)] border text-sm inline-flex items-center gap-2",
          usage > 0 ? "border-[var(--border)]" : "border-dashed border-[var(--border)] text-[var(--text-muted)]",
        )}
      >
        <span className="whitespace-nowrap">{item.name}</span>
        <span
          className={cn(
            "text-[10px] tabular-nums px-1.5 py-0.5 rounded-full",
            usage > 0 ? "bg-[var(--surface)] text-[var(--text-muted)]" : "text-[var(--text-muted)]",
          )}
          title="Bog'langan kontentlar"
        >
          {usage}
        </span>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Amallar"
          title="Amallar"
          className={cn(
            "h-7 w-7 -mr-0.5 inline-flex items-center justify-center rounded-full transition-colors",
            open ? "bg-[var(--surface)] text-[var(--accent)]" : "hover:bg-[var(--surface)] text-[var(--text-muted)]",
          )}
        >
          <GitMerge size={13} />
        </button>
      </span>
      {menu && typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </>
  );
}

function TelegramSection({
  csrf,
  initial,
}: {
  csrf: string;
  initial: { enabled: boolean; botToken: string; chatId: string };
}) {
  const [token, setToken] = useState(initial.botToken);
  const [chatId, setChatId] = useState(initial.chatId);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function connect() {
    if (!token.trim() || !chatId.trim()) {
      setMsg("Token va Chat ID majburiy");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ action: "connect", botToken: token.trim(), chatId: chatId.trim() }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(d?.error?.message ?? uz.toasts.error);
    } else {
      setEnabled(true);
      setMsg(`${uz.admin.settings.botConnected} — @${d.bot?.username ?? "bot"} · ${d.note ?? ""}`);
    }
  }

  async function test() {
    setBusy(true);
    const res = await fetch("/api/admin/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ action: "test" }),
    });
    const d = await res.json();
    setBusy(false);
    setMsg(res.ok ? "Sinov xabari yuborildi" : d?.error?.message ?? uz.toasts.error);
  }

  async function disconnect() {
    if (!confirm("Bot uzilsinmi?")) return;
    setBusy(true);
    const res = await fetch("/api/admin/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ action: "disconnect" }),
    });
    setBusy(false);
    if (res.ok) {
      setEnabled(false);
      setToken("");
      setChatId("");
      setMsg("Uzildi");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Row label={uz.admin.settings.botToken} hint={uz.admin.settings.hints.botToken}>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="1234567890:AAE..."
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          name="bot-token"
          className="w-full h-11 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)] font-mono text-sm transition-colors"
        />
      </Row>
      <Row label={uz.admin.settings.chatId} hint={uz.admin.settings.chatIdHint} compact>
        <input
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="123456789"
          inputMode="numeric"
          autoComplete="off"
          className="w-full h-11 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)] font-mono text-sm transition-colors"
        />
      </Row>
      <Row label="Amallar">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={connect}
            disabled={busy}
            className="h-10 px-4 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium text-sm disabled:opacity-50"
          >
            {enabled ? "Qayta ulash" : uz.admin.settings.connectBot}
          </button>
          {enabled && (
            <>
              <button
                onClick={test}
                disabled={busy}
                className="h-10 px-4 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm disabled:opacity-50"
              >
                {uz.admin.settings.testBot}
              </button>
              <button
                onClick={disconnect}
                disabled={busy}
                className="h-10 px-4 rounded-[var(--r-control)] border border-[var(--danger)]/40 text-[var(--danger)] text-sm disabled:opacity-50"
              >
                {uz.admin.settings.disconnectBot}
              </button>
            </>
          )}
          <span
            className={cn(
              "meta text-[10px]",
              enabled ? "text-[var(--success)]" : "text-[var(--text-muted)]",
            )}
          >
            {enabled ? uz.admin.settings.botConnected : uz.admin.settings.botDisconnected}
          </span>
        </div>
      </Row>
      {msg && <div className="text-sm text-[var(--text-muted)] leading-snug pl-2">{msg}</div>}
    </div>
  );
}

function PasswordChange({
  csrf,
  currentUsername,
  updatedAt,
  onSaved,
}: {
  csrf: string;
  currentUsername: string;
  updatedAt: string | null;
  onSaved?: (patch: { username?: string; updatedAt?: string }) => void;
}) {
  const [current, setCurrent] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [changePw, setChangePw] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const usernameChanged =
    newUsername.trim().length > 0 && newUsername.trim().toLowerCase() !== currentUsername.toLowerCase();
  const passwordOK = !changePw || (newPassword.length >= 8 && newPassword === confirmPassword);
  const passwordChanged = changePw && passwordOK && newPassword.length > 0;
  const canSubmit = current.length > 0 && (usernameChanged || passwordChanged) && passwordOK && !busy;

  const strength = calcPasswordStrength(newPassword);

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, string> = { currentPassword: current };
      if (usernameChanged) body.newUsername = newUsername.trim().toLowerCase();
      if (passwordChanged) body.newPassword = newPassword;
      const res = await fetch("/api/admin/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (res.ok) {
        const parts: string[] = [];
        if (usernameChanged) parts.push("login");
        if (passwordChanged) parts.push("parol");
        // Yangi loginni localStorage'ga saqlaymiz — login formasi mount'da uni
        // avtomatik prefill qiladi. Foydalanuvchi eski loginni yozib xato olmaydi.
        const finalUsername = typeof d?.username === "string"
          ? d.username
          : usernameChanged ? newUsername.trim().toLowerCase() : currentUsername;
        try {
          if (usernameChanged) {
            localStorage.setItem("admin.lastUsername", finalUsername);
          }
        } catch {
          // localStorage o'chirilgan bo'lsa — jim
        }
        setMsg({
          kind: "ok",
          text: usernameChanged
            ? `${parts.join(" va ")} yangilandi. Yangi login: ${finalUsername}. Qayta kirish kerak.`
            : `${parts.join(" va ")} yangilandi — qayta kirishingiz kerak.`,
        });
        // Server barcha seansiyalarni bekor qildi (joriy ham) va cookie'ni yo'q qildi.
        // Foydalanuvchini login formasiga o'tkazamiz — u yangi credentials bilan kirsin.
        const target = typeof d?.redirect === "string" ? d.redirect : "/admin";
        // Login o'zgargan bo'lsa uzunroq kutamiz — foydalanuvchi yangi loginni o'qib olsin.
        setTimeout(() => {
          window.location.href = target;
        }, usernameChanged ? 2500 : 1000);
      } else {
        setMsg({ kind: "err", text: d?.error?.message ?? uz.toasts.error });
      }
    } catch {
      setMsg({ kind: "err", text: "Tarmoq xatosi" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      // name — parol menejerlariga formni identifikatsiya qilishga yordam beradi.
      name="admin-credentials"
      autoComplete="on"
      className="flex flex-col gap-4"
    >
      {/*
        Parol menejerini shu forma ichidagi username bilan bog'laymiz.
        Sahifadagi boshqa text input'lar (ChipsInput va h.k.) tarkibiga login
        yozilib ketmasligi uchun bu shart. `readOnly` — foydalanuvchi tegmaydi,
        lekin brauzerlar ushbu maydonni "username" sifatida taniydi.
      */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        value={currentUsername}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      />

      {/* Joriy holat */}
      <div className="rounded-[var(--r-card)] bg-[var(--bg)] border border-[var(--border)] p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
          <UserIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="meta text-[10px] leading-none mb-0.5">Joriy login</div>
          <div className="font-mono text-sm text-[var(--text)] truncate">{currentUsername}</div>
        </div>
        {updatedAt && (
          <div className="text-[10px] text-[var(--text-faint)] whitespace-nowrap">
            Yangilangan: {new Date(updatedAt).toLocaleDateString("uz-UZ")}
          </div>
        )}
      </div>

      {/* Joriy parolni tasdiqlash */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[var(--text)] font-medium" htmlFor="admin-current-password">
          Joriy parol
        </label>
        <p className="text-[11px] text-[var(--text-muted)] leading-snug">
          Har qanday o&apos;zgartirish uchun xavfsizlik nuqtai nazaridan joriy parolni tasdiqlang.
        </p>
        <div className="relative max-w-md">
          <input
            id="admin-current-password"
            name="current-password"
            type={showCurrent ? "text" : "password"}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full h-11 pl-3 pr-11 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)] transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
            aria-label={showCurrent ? "Yashirish" : "Ko'rsatish"}
            tabIndex={-1}
          >
            {showCurrent ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      <div className="h-px bg-[var(--border)]" />

      {/* Yangi login */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[var(--text)] font-medium">Yangi login</label>
        <p className="text-[11px] text-[var(--text-muted)] leading-snug">
          Bo&apos;sh qoldiring — login o&apos;zgarmaydi. 3-32 belgi, lotin harflari va{" "}
          <span className="font-mono">_ . -</span> raqamlar.
        </p>
        <div className="max-w-md">
          <input
            type="text"
            name="new-username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value.replace(/\s+/g, ""))}
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            placeholder={currentUsername}
            className="w-full h-11 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)] transition-colors font-mono"
          />
        </div>
      </div>

      <div className="h-px bg-[var(--border)]" />

      {/* Parolni almashtirish (accordion) */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setChangePw((v) => !v)}
          className={cn(
            "flex items-center gap-2 text-sm w-fit",
            changePw ? "text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]",
          )}
        >
          <span
            className={cn(
              "w-4 h-4 rounded border flex items-center justify-center",
              changePw
                ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--on-accent)]"
                : "border-[var(--border-strong)]",
            )}
          >
            {changePw && <span className="text-[10px] leading-none">✓</span>}
          </span>
          Parolni ham almashtirish
        </button>

        {changePw && (
          <div className="flex flex-col gap-3 pt-2 pl-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[var(--text)]">Yangi parol</label>
              <div className="relative max-w-md">
                <input
                  name="new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="Kamida 8 belgi"
                  className="w-full h-11 pl-3 pr-11 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
                  tabIndex={-1}
                  aria-label={showNew ? "Yashirish" : "Ko'rsatish"}
                >
                  {showNew ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {newPassword.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                    <div
                      className="h-full transition-all duration-300 rounded-full"
                      style={{
                        width: `${(strength.score / 4) * 100}%`,
                        background: strength.color,
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap"
                    style={{ color: strength.color }}
                  >
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[var(--text)]">Yangi parolni tasdiqlang</label>
              <div className="max-w-md">
                <input
                  name="new-password-confirm"
                  type={showNew ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Yana bir marta kiriting"
                  className={cn(
                    "w-full h-11 px-3 bg-[var(--bg)] border rounded-[var(--r-control)] outline-none transition-colors",
                    confirmPassword.length > 0 && confirmPassword !== newPassword
                      ? "border-[var(--danger)]/60 focus:border-[var(--danger)]"
                      : "border-[var(--border-strong)] focus:border-[var(--accent)]",
                  )}
                />
              </div>
              {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                <div className="text-[11px] text-[var(--danger)] leading-snug">
                  Parollar mos kelmadi
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Xabar va yuborish */}
      <div className="flex items-center gap-3 flex-wrap pt-1">
        <button
          type="submit"
          disabled={!canSubmit}
          className="h-11 px-5 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium disabled:opacity-40 disabled:cursor-not-allowed text-sm inline-flex items-center gap-2"
        >
          {busy ? "Saqlanmoqda…" : "O'zgarishlarni saqlash"}
        </button>
        {msg && (
          <div
            className={cn(
              "text-sm inline-flex items-center gap-1.5",
              msg.kind === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]",
            )}
          >
            <span
              className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center text-[10px]",
                msg.kind === "ok"
                  ? "bg-[var(--success)]/15 text-[var(--success)]"
                  : "bg-[var(--danger)]/15 text-[var(--danger)]",
              )}
            >
              {msg.kind === "ok" ? "✓" : "!"}
            </span>
            {msg.text}
          </div>
        )}
      </div>
    </form>
  );
}

type SessionRow = {
  id: string;
  deviceLabel: string;
  ipDisplay: string;
  country: string | null;
  city: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
  isMaster: boolean;
};

function SessionsPanel({ csrf }: { csrf: string }) {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [canRevoke, setCanRevoke] = useState(false);
  const [currentSid, setCurrentSid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/sessions", { credentials: "same-origin" });
      // 500/HTML javoblari uchun ehtiyot: json() da'vosini try qilamiz.
      const text = await res.text();
      let d: {
        currentSid?: string | null;
        canRevoke?: boolean;
        sessions?: SessionRow[];
        error?: { message?: string };
      } | null = null;
      try {
        d = text ? JSON.parse(text) : null;
      } catch {
        // Server 500 sifatida HTML/plain tekst qaytardi.
      }
      if (!res.ok) {
        throw new Error(d?.error?.message ?? `Server xatosi (HTTP ${res.status})`);
      }
      setRows((d?.sessions ?? []) as SessionRow[]);
      setCanRevoke(!!d?.canRevoke);
      setCurrentSid(d?.currentSid ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setLoading(false);
    }
  }, []);

  // Boshlang'ich yuklash + "admin" event'iga obuna (revoke, credentials.update).
  useEffect(() => {
    void load();
  }, [load]);
  useLiveEvent("admin", () => {
    void load();
  });

  async function revoke(id: string, label: string) {
    if (!confirm(`«${label}» seansini chiqarish? Ushbu qurilma darhol tizimdan chiqadi.`)) return;
    setBusyId(id);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrf },
        credentials: "same-origin",
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message ?? "Chiqarib bo'lmadi");
      setMsg("Seans chiqarildi");
      setTimeout(() => setMsg(null), 2500);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 justify-between">
        <div className="text-[11px] text-[var(--text-muted)] leading-snug max-w-xl">
          {canRevoke ? (
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-[var(--success)]" />
              Joriy seans <b>master</b> — boshqa qurilmalarni chiqarib tashlashingiz mumkin.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <ShieldAlert size={12} className="text-[var(--warning,#C99A3F)]" />
              Boshqalarni chiqarish uchun eng qadimgi (master) seansdan kiring. Bu qoida hujumchi
              yangi kirib eskilaringizni chiqara olmasligi uchun.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-[var(--r-control)] border border-[var(--border-strong)] text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
        >
          <RefreshCw size={12} className={cn(loading && "animate-spin")} />
          Yangilash
        </button>
      </div>

      {err && (
        <div className="text-xs text-[var(--danger)] p-2 rounded-[var(--r-control)] bg-[var(--danger)]/8 border border-[var(--danger)]/30">
          {err}
        </div>
      )}
      {msg && (
        <div className="text-xs text-[var(--success)] p-2 rounded-[var(--r-control)] bg-[var(--success)]/8 border border-[var(--success)]/30">
          {msg}
        </div>
      )}

      {loading && !rows && (
        <div className="text-xs text-[var(--text-muted)] py-3">Yuklanmoqda…</div>
      )}

      {rows && rows.length === 0 && !currentSid && (
        <div className="text-xs text-[var(--text-muted)] p-3 rounded-[var(--r-control)] border border-[var(--border)] bg-[var(--bg)] flex flex-col gap-2">
          <div className="inline-flex items-center gap-1.5 text-[var(--warning,#C99A3F)]">
            <ShieldAlert size={12} />
            Joriy seansingiz ushbu funksiya qo&apos;shilishidan oldin ochilgan.
          </div>
          <div>
            Seans ro&apos;yxatini ko&apos;rish uchun bir marta chiqib, qayta login qiling —
            keyingi loginda qurilma yozuvi avtomatik yaratiladi.
          </div>
          <a
            href="/api/admin/logout"
            className="inline-flex items-center gap-1.5 self-start h-8 px-3 rounded-[var(--r-control)] border border-[var(--border-strong)] text-xs text-[var(--text)] hover:border-[var(--accent)]"
          >
            <LogOut size={12} /> Chiqib, qayta login qilish
          </a>
        </div>
      )}
      {rows && rows.length === 0 && currentSid && (
        <div className="text-xs text-[var(--text-muted)] py-3">Faol seanslar yo&apos;q</div>
      )}

      <div className="flex flex-col gap-2">
        {rows?.map((r) => (
          <SessionRowCard
            key={r.id}
            row={r}
            canRevoke={canRevoke && !r.isCurrent}
            busy={busyId === r.id}
            onRevoke={() => revoke(r.id, r.deviceLabel)}
          />
        ))}
      </div>
    </div>
  );
}

function SessionRowCard({
  row,
  canRevoke,
  busy,
  onRevoke,
}: {
  row: SessionRow;
  canRevoke: boolean;
  busy: boolean;
  onRevoke: () => void;
}) {
  const isMobile = /Mobil|iPhone|Android|iPad/i.test(row.deviceLabel);
  const Icon = isMobile ? Smartphone : Monitor;
  const location = [row.city, row.country].filter(Boolean).join(", ") || "Noma'lum";
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-[var(--r-card)] border transition-colors",
        row.isCurrent
          ? "border-[var(--accent)]/50 bg-[var(--accent)]/5"
          : "border-[var(--border)] bg-[var(--bg)]",
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-[var(--r-control)] flex items-center justify-center border shrink-0",
          row.isCurrent
            ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]"
            : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]",
        )}
      >
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{row.deviceLabel}</span>
          {row.isCurrent && (
            <span className="meta text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30">
              JORIY
            </span>
          )}
          {row.isMaster && (
            <span className="meta text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/30">
              MASTER
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap text-[11px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1 font-mono">
            <span className="opacity-50">IP</span>
            {row.ipDisplay}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin size={11} />
            {location}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={11} />
            {relativeTime(row.lastSeenAt)}
          </span>
        </div>
        <div className="text-[10px] text-[var(--text-faint)]">
          Boshlangan: {new Date(row.createdAt).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" })}
        </div>
      </div>
      {canRevoke && (
        <button
          type="button"
          onClick={onRevoke}
          disabled={busy}
          className="h-9 px-3 rounded-[var(--r-control)] border border-[var(--border-strong)] text-xs text-[var(--danger)] hover:border-[var(--danger)] hover:bg-[var(--danger)]/8 disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
        >
          <LogOut size={12} />
          {busy ? "…" : "Chiqarish"}
        </button>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.floor((now - d) / 1000));
  if (s < 60) return "hozir";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} soat oldin`;
  const dd = Math.floor(h / 24);
  return `${dd} kun oldin`;
}

function calcPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (pw.length === 0) return { score: 0, label: "", color: "transparent" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) score++;
  const labels = ["Zaif", "Zaif", "O'rtacha", "Yaxshi", "Kuchli"];
  const colors = ["#E5484D", "#E5484D", "#C99A3F", "#3FBF7F", "#3FBF7F"];
  return { score, label: labels[score], color: colors[score] };
}

// Kichik ikonalar — SVG (import qilishning o'rniga inline, chunki UserIcon lucide-reactda `User` deb allaqachon boshqa joyda ishlatilgan bo'lishi mumkin)
function UserIcon() {
  return <User size={16} strokeWidth={1.75} />;
}
function EyeIcon() {
  return <Eye size={15} strokeWidth={1.75} />;
}
function EyeOffIcon() {
  return <EyeOff size={15} strokeWidth={1.75} />;
}

// About sahifasi portret rasm yuklovchi. Sozlamalar bilan alohida — o'zi
// darhol /api/admin/portrait ga yuboradi va setting'ni yangilaydi.
function PortraitUploader({
  value,
  onChange,
  csrf,
  onToast,
}: {
  value: string | null;
  onChange: (key: string | null) => void;
  csrf: string;
  onToast: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const previewUrl = value ? `/api/storage/public/${value}` : null;

  async function pickFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onToast("Faqat rasm fayl");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      onToast("20MB dan katta");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/portrait", {
        method: "POST",
        headers: { "x-csrf-token": csrf },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data?.error?.message ?? "Yuklashda xatolik");
        return;
      }
      onChange(data.key);
      onToast("Portret yangilandi");
    } catch {
      onToast("Tarmoq xatosi");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!confirm("Portretni o'chirasizmi?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/portrait", {
        method: "DELETE",
        headers: { "x-csrf-token": csrf },
      });
      if (!res.ok) {
        onToast("Xatolik");
        return;
      }
      onChange(null);
      onToast("O'chirildi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-4">
      <div className="relative w-24 h-32 shrink-0 rounded-[var(--r-card)] overflow-hidden border border-[var(--border-strong)] bg-[var(--surface)]">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Portret" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center meta text-[var(--text-faint)]">
            <ImageIcon size={22} strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="h-10 px-4 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm hover:border-[var(--accent)] disabled:opacity-50"
          >
            {busy ? "Yuklanmoqda…" : previewUrl ? "Almashtirish" : "Portret yuklash"}
          </button>
          {previewUrl && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="h-10 px-4 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Trash2 size={14} strokeWidth={1.5} />
              O&apos;chirish
            </button>
          )}
        </div>
        <div className="meta text-[var(--text-faint)]">
          Tavsiya: 3:4 vertical, kamida 900×1200px. Max 20MB. JPG/PNG/WebP.
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}

// Kartalar ro'yxati boshqaruvi — bir yoki bir necha kartani sozlash.
// Har bir karta uchun: raqamdan avtomatik aniqlanuvchi brand + qo'lda o'zgartirish, raqam, egasi.
function CardsListEditor({
  value,
  onChange,
}: {
  value: LegacyPaymentDetails;
  onChange: (v: LegacyPaymentDetails) => void;
}) {
  // Editor'da BARCHA kartalar (bo'sh raqamli kiritilayotganlar ham) ko'rinsin.
  // `normalizePayment` ni ishlatib bo'lmaydi — u bo'sh raqamli kartalarni filtrlaydi.
  // Backward-compat: eski shaklda faqat cardNumber/cardHolder bo'lsa — kartalar ro'yxatiga qo'shamiz.
  let cards: PaymentCard[] = Array.isArray(value?.cards) ? value.cards : [];
  if (cards.length === 0 && value?.cardNumber) {
    cards = [
      {
        number: value.cardNumber,
        holder: value.cardHolder ?? "",
        brand: detectCardBrand(value.cardNumber),
      },
    ];
  }

  function updateCards(next: PaymentCard[]) {
    // Yangi shakl (`cards`) bilan yozamiz, eski `cardNumber/cardHolder`ni tozalab qo'yamiz
    const clean = { ...value };
    delete clean.cardNumber;
    delete clean.cardHolder;
    onChange({ ...clean, cards: next });
  }

  function addCard() {
    updateCards([...cards, { brand: "other", number: "", holder: "" }]);
  }

  function updateCard(idx: number, patch: Partial<PaymentCard>) {
    updateCards(cards.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function removeCard(idx: number) {
    updateCards(cards.filter((_, i) => i !== idx));
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = cards.slice();
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    updateCards(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.length === 0 && (
        <div className="p-4 rounded-[var(--r-control)] bg-[var(--bg)] border border-dashed border-[var(--border-strong)] text-sm text-[var(--text-muted)] text-center">
          Hali karta qo&apos;shilmagan.
        </div>
      )}

      {cards.map((card, idx) => {
        const detected = detectCardBrand(card.number);
        const effective = (card.brand as CardBrand) || detected;
        const brandInfo = getBrandInfo(effective);
        return (
          <div
            key={idx}
            className="rounded-[var(--r-control)] border border-[var(--border-strong)] bg-[var(--bg)] p-3 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 h-6 px-2 rounded-[var(--r-pill)] text-[10px] font-medium uppercase tracking-wide"
                  style={{ background: brandInfo.bg, color: brandInfo.color }}
                >
                  <CreditCardIcon size={10} strokeWidth={2} />
                  {brandInfo.name}
                </span>
                {idx === 0 && (
                  <span className="meta text-[9px] text-[var(--text-faint)]">Asosiy</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => moveUp(idx)}
                    aria-label="Yuqoriga"
                    className="w-7 h-7 rounded-[var(--r-control)] border border-[var(--border)] hover:border-[var(--border-strong)] inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]"
                    title="Yuqoriga ko'chirish"
                  >
                    ↑
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeCard(idx)}
                  aria-label="O'chirish"
                  className="w-7 h-7 rounded-[var(--r-control)] border border-[var(--border)] hover:border-[var(--danger)] hover:text-[var(--danger)] inline-flex items-center justify-center text-[var(--text-muted)]"
                >
                  <Trash2 size={12} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-1">
                <label className="meta text-[10px]">Karta raqami</label>
                <CardInput
                  value={card.number}
                  onValueChange={(raw) =>
                    updateCard(idx, { number: raw, brand: detectCardBrand(raw) })
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="meta text-[10px]">Karta egasi</label>
                <input
                  value={card.holder}
                  onChange={(e) => updateCard(idx, { holder: e.target.value })}
                  placeholder="ISM FAMILIYA"
                  autoComplete="cc-name"
                  className="w-full h-10 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-control)] text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <span className="meta text-[10px] mr-1">Tur:</span>
              {CARD_BRANDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => updateCard(idx, { brand: b.id })}
                  className={cn(
                    "h-6 px-2 rounded-[var(--r-pill)] text-[10px] font-medium uppercase tracking-wide border transition-colors",
                    effective === b.id
                      ? "text-[var(--text)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]",
                  )}
                  style={
                    effective === b.id
                      ? { background: b.bg, color: b.color, borderColor: b.color }
                      : undefined
                  }
                >
                  {b.name}
                </button>
              ))}
              {card.number && detected !== effective && (
                <span className="meta text-[9px] text-[var(--text-faint)] ml-2">
                  (aniqlangan: {getBrandInfo(detected).name})
                </span>
              )}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addCard}
        className="h-10 px-4 rounded-[var(--r-control)] border border-dashed border-[var(--border-strong)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-sm inline-flex items-center justify-center gap-2 self-start"
      >
        <Plus size={14} strokeWidth={1.75} />
        Karta qo&apos;shish
      </button>
    </div>
  );
}
