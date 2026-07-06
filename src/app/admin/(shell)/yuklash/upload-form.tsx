"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  UploadCloud,
  X,
  Check,
  ChevronDown,
  RotateCcw,
  Pause,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  FileVideo,
  FileImage,
} from "lucide-react";
import { useCsrf } from "../csrf-provider";
import { uz } from "@/lib/i18n/uz";
import { cn, formatNumber } from "@/lib/utils";
import { CurrencyInput } from "@/components/inputs/FormattedInput";
import { useUploader, type UploadItem, type UploadItemMeta } from "@/lib/use-uploader";

type Status = "PUBLISHED" | "DRAFT";

type Overrides = {
  genreIds?: string[];
  locationName?: string;
  capturedAt?: string;
  priceUZS?: string;
  featured?: boolean;
  status?: Status;
};

type Shared = {
  genreIds: string[];
  locationName: string;
  capturedAt: string;
  priceUZS: string;
  featured: boolean;
  status: Status;
};

function hasAnyOverride(o: Overrides): boolean {
  if (o.genreIds && o.genreIds.length > 0) return true;
  if (o.locationName !== undefined && o.locationName.trim() !== "") return true;
  if (o.capturedAt !== undefined && o.capturedAt !== "") return true;
  if (o.priceUZS !== undefined && o.priceUZS !== "") return true;
  if (o.featured !== undefined) return true;
  if (o.status !== undefined) return true;
  return false;
}

// Yakuniy metadata: individual > shared per-field. Janr = union.
function resolveMeta(o: Overrides, title: string, shared: Shared): UploadItemMeta {
  const genreIds = Array.from(new Set([...shared.genreIds, ...(o.genreIds ?? [])]));
  const locationName =
    o.locationName !== undefined && o.locationName.trim() !== ""
      ? o.locationName.trim()
      : shared.locationName.trim();
  const capturedAt =
    o.capturedAt !== undefined && o.capturedAt !== ""
      ? o.capturedAt
      : shared.capturedAt;
  const priceRaw = o.priceUZS !== undefined && o.priceUZS !== "" ? o.priceUZS : shared.priceUZS;
  const priceUZS = priceRaw === "" ? null : Number(priceRaw);
  const featured = o.featured !== undefined ? o.featured : shared.featured;
  const status = o.status !== undefined ? o.status : shared.status;
  return { title, genreIds, locationName, capturedAt, priceUZS, featured, status };
}

// Local UI state ustki qatlami — har bir upload item uchun individual override
// va title. Aslida override'lar upload boshlanmaguncha o'zgartirish uchun,
// upload boshlangach hookdagi meta yangilanadi.
type Draft = {
  id: string;
  title: string;
  overrides: Overrides;
};

export function UploadForm({
  initialGenres,
  recentLocations,
  defaultPriceUZS,
}: {
  initialGenres: { id: string; name: string }[];
  recentLocations: string[];
  defaultPriceUZS: number;
}) {
  const csrf = useCsrf();
  const [genres, setGenres] = useState(initialGenres);
  const [newGenreOpen, setNewGenreOpen] = useState(false);
  const [newGenreName, setNewGenreName] = useState("");

  const [sharedGenreIds, setSharedGenreIds] = useState<string[]>(
    initialGenres[0] ? [initialGenres[0].id] : [],
  );
  const [sharedLocation, setSharedLocation] = useState("");
  const [sharedLocationSuggest, setSharedLocationSuggest] = useState<string[]>([]);
  const [sharedCapturedAt, setSharedCapturedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [sharedPrice, setSharedPrice] = useState<string>("");
  const [sharedFeatured, setSharedFeatured] = useState(false);
  const [sharedStatus, setSharedStatus] = useState<Status>("PUBLISHED");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgKind, setMsgKind] = useState<"ok" | "err" | null>(null);
  const [errors, setErrors] = useState<{ genre?: boolean; location?: boolean; files?: boolean }>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  const shared: Shared = {
    genreIds: sharedGenreIds,
    locationName: sharedLocation,
    capturedAt: sharedCapturedAt,
    priceUZS: sharedPrice,
    featured: sharedFeatured,
    status: sharedStatus,
  };

  const uploader = useUploader({
    csrf,
    scope: "yuklash",
    onComplete: () => {
      // ok — snapshot va state hookda yangilanadi
    },
  });

  const items = uploader.items;
  const activeCount = items.filter((i) => i.status === "uploading" || i.status === "processing").length;
  const queuedCount = items.filter((i) => i.status === "queued").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const totalCount = items.length;
  const overallProgress = useMemo(() => {
    if (items.length === 0) return 0;
    const totalBytes = items.reduce((a, i) => a + i.size, 0);
    if (totalBytes === 0) return 0;
    const done = items.reduce((a, i) => a + i.receivedBytes, 0);
    return done / totalBytes;
  }, [items]);

  const missing = {
    genre: sharedGenreIds.length === 0,
    location: !sharedLocation.trim(),
    files: totalCount === 0,
  };
  // "busy" — foydalanuvchi Saqlash bosgan va aynan hozir upload/finalize ishlayapti degani.
  // Faqat qo'shilib navbatda turgan fayllar (queued) — busy emas, aksincha
  // Saqlash bosilishini kutmoqda. Aks holda tugma darhol o'chib qoladi.
  const busy = activeCount > 0;
  const canStart =
    !missing.genre &&
    !missing.location &&
    !missing.files &&
    !busy &&
    items.some((i) => i.status !== "done");

  // Location suggest
  useEffect(() => {
    if (!sharedLocation) {
      setSharedLocationSuggest([]);
      return;
    }
    const c = new AbortController();
    fetch(`/api/admin/locations?q=${encodeURIComponent(sharedLocation)}`, { signal: c.signal })
      .then((r) => r.json())
      .then((d) => setSharedLocationSuggest((d.items ?? []).map((x: { name: string }) => x.name)))
      .catch(() => {});
    return () => c.abort();
  }, [sharedLocation]);

  // Reload paytida snapshot bor bo'lsa, foydalanuvchini xabardor qilamiz
  useEffect(() => {
    const snap = uploader.previousSnapshot();
    if (snap.length > 0) {
      const pending = snap.filter((s) => s.status !== "done").length;
      const done = snap.filter((s) => s.status === "done").length;
      if (pending > 0) {
        setRestoreNotice(
          `Oldingi seansda ${snap.length} ta fayl bor edi (${done} muvaffaqiyatli, ${pending} tugallanmagan). Server sessiyalari saqlangan — o'sha fayllarni qayta tanlaganingizda kelgan joydan davom etadi.`,
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Yangi fayl qo'shilganda draft'ni sync qilish
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const it of items) {
        if (!next[it.id]) {
          next[it.id] = {
            id: it.id,
            title: it.file.name.replace(/\.[^.]+$/, ""),
            overrides: {},
          };
          changed = true;
        }
      }
      // olib tashlangan itemsni tozalash
      for (const k of Object.keys(next)) {
        if (!items.some((i) => i.id === k)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  async function addFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    if (arr.length === 0) return;
    await uploader.addFiles(arr, (f) => ({
      title: f.name.replace(/\.[^.]+$/, ""),
      genreIds: sharedGenreIds,
      locationName: sharedLocation.trim(),
      capturedAt: sharedCapturedAt,
      priceUZS: sharedPrice === "" ? null : Number(sharedPrice),
      featured: sharedFeatured,
      status: sharedStatus,
    }));
    setErrors((s) => ({ ...s, files: false }));
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
  }
  function updateOverride(id: string, patch: Overrides) {
    setDrafts((prev) =>
      prev[id]
        ? { ...prev, [id]: { ...prev[id], overrides: { ...prev[id].overrides, ...patch } } }
        : prev,
    );
  }
  function resetOverrides(id: string) {
    setDrafts((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], overrides: {} } } : prev));
  }

  async function addGenre() {
    const name = newGenreName.trim();
    if (!name) return;
    const res = await fetch("/api/admin/genres", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (res.ok) {
      setGenres((s) => (s.some((x) => x.id === data.item.id) ? s : [...s, data.item]));
      setSharedGenreIds((s) => [...s, data.item.id]);
      setNewGenreName("");
      setNewGenreOpen(false);
    } else {
      setMsg(data?.error?.message ?? uz.toasts.error);
      setMsgKind("err");
    }
  }

  function submit() {
    const missingNow = {
      genre: sharedGenreIds.length === 0,
      location: !sharedLocation.trim(),
      files: totalCount === 0,
    };
    if (missingNow.genre || missingNow.location || missingNow.files) {
      setErrors(missingNow);
      const parts: string[] = [];
      if (missingNow.genre) parts.push("Janr");
      if (missingNow.location) parts.push("Joylashuv");
      if (missingNow.files) parts.push("Fayl");
      setMsg(`Majburiy maydonlar to'ldirilmagan: ${parts.join(", ")}`);
      setMsgKind("err");
      return;
    }
    setErrors({});
    setMsg(null);
    setMsgKind(null);

    // Har bir upload item uchun metani hisoblab, hookga yangilaymiz
    for (const it of items) {
      if (it.status === "done") continue;
      const d = drafts[it.id];
      const meta = resolveMeta(d?.overrides ?? {}, d?.title ?? it.file.name.replace(/\.[^.]+$/, ""), shared);
      uploader.updateMeta(it.id, meta);
    }
    uploader.start();
  }

  const genresById = useMemo(() => new Map(genres.map((g) => [g.id, g.name])), [genres]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Dropzone + fayllar ro'yxati */}
      <div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "border-2 border-dashed rounded-[var(--r-card)] p-8 text-center cursor-pointer transition-colors",
            dragOver
              ? "border-[var(--accent)] bg-[var(--surface)]"
              : errors.files
                ? "border-[var(--danger)] hover:border-[var(--accent)]"
                : "border-[var(--border-strong)] hover:border-[var(--accent)]",
          )}
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud size={32} strokeWidth={1.5} className="mx-auto mb-2 text-[var(--text-muted)]" />
          <div className="text-[var(--text-muted)]">{uz.admin.upload.dropzone}</div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {restoreNotice && (
          <div className="mt-3 p-3 rounded-[var(--r-control)] bg-[var(--accent)]/5 border border-[var(--accent)]/30 text-xs text-[var(--text)] flex items-start gap-2">
            <RotateCcw size={13} className="text-[var(--accent)] shrink-0 mt-0.5" />
            <span className="flex-1">{restoreNotice}</span>
            <button
              type="button"
              onClick={() => setRestoreNotice(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text)]"
              aria-label="Yopish"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {items.length > 0 && (
          <>
            {/* Umumiy progress */}
            <div className="mt-4 flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <div className="flex-1 h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all"
                  style={{ width: `${Math.round(overallProgress * 100)}%` }}
                />
              </div>
              <div className="tabular-nums">
                {doneCount}/{totalCount} · {Math.round(overallProgress * 100)}%
              </div>
              {(doneCount > 0 || errorCount > 0) && (
                <button
              type="button"
                  onClick={uploader.clearFinished}
                  className="text-[var(--text-muted)] hover:text-[var(--text)]"
                  title="Tugaganlarni ro'yxatdan olib tashlash"
                >
                  Tozalash
                </button>
              )}
            </div>

            <ul className="mt-3 flex flex-col gap-2">
              {items.map((it, i) => {
                const draft = drafts[it.id];
                const expanded = expandedId === it.id;
                const overridden = draft ? hasAnyOverride(draft.overrides) : false;
                return (
                  <li
                    key={it.id}
                    className={cn(
                      "bg-[var(--surface)] rounded-[var(--r-card)] transition-colors overflow-hidden",
                      overridden && "ring-1 ring-[var(--accent)]/40",
                    )}
                  >
                    <UploadCard
                      index={i + 1}
                      item={it}
                      title={draft?.title ?? ""}
                      onTitleChange={(t) => updateDraft(it.id, { title: t })}
                      expanded={expanded}
                      overridden={overridden}
                      onToggleExpand={() => setExpandedId(expanded ? null : it.id)}
                      onRemove={() => uploader.remove(it.id)}
                      onPause={() => uploader.pause(it.id)}
                      onRetry={() => uploader.retry(it.id)}
                    />
                    {expanded && draft && (
                      <IndividualPanel
                        item={it}
                        draft={draft}
                        shared={shared}
                        genres={genres}
                        genresById={genresById}
                        csrf={csrf}
                        onOverride={(patch) => updateOverride(it.id, patch)}
                        onReset={() => resetOverrides(it.id)}
                        onGenreCreated={(g) => {
                          setGenres((s) =>
                            s.some((x) => x.id === g.id) ? s : [...s, g],
                          );
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Umumiy metadata paneli */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="font-display text-lg">Umumiy metadata</div>
          <div className="meta text-xs">Individual belgilanmagan fayllarga qo'llaniladi</div>
        </div>

        <div>
          <label className="meta block mb-2">{uz.admin.upload.genre}*</label>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => {
              const active = sharedGenreIds.includes(g.id);
              return (
                <button
              type="button"
                  key={g.id}
                  onClick={() => {
                    setSharedGenreIds((s) =>
                      s.includes(g.id) ? s.filter((x) => x !== g.id) : [...s, g.id],
                    );
                    setErrors((s) => ({ ...s, genre: false }));
                  }}
                  className={cn(
                    "h-8 px-3 rounded-[var(--r-pill)] text-sm border transition-colors",
                    active
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--accent)]",
                  )}
                >
                  {g.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setNewGenreOpen((v) => !v)}
              className="h-8 px-3 rounded-[var(--r-pill)] text-sm border border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--accent)]"
            >
              {uz.admin.upload.newGenre}
            </button>
          </div>
          {errors.genre && (
            <div className="text-xs text-[var(--danger)] mt-2">Kamida bitta janr tanlang</div>
          )}
          {newGenreOpen && (
            <div className="flex gap-2 mt-2">
              <input
                value={newGenreName}
                onChange={(e) => setNewGenreName(e.target.value)}
                placeholder="Nomi"
                className="flex-1 h-11 px-3 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)]"
              />
              <button
              type="button"
                onClick={addGenre}
                className="h-11 px-4 bg-[var(--accent)] text-[var(--on-accent)] rounded-[var(--r-control)] font-medium"
              >
                <Check size={18} />
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="meta block mb-2">{uz.admin.upload.location}*</label>
          <input
            value={sharedLocation}
            onChange={(e) => {
              setSharedLocation(e.target.value);
              if (e.target.value.trim()) setErrors((s) => ({ ...s, location: false }));
            }}
            placeholder={uz.admin.upload.searchLocation}
            className={cn(
              "w-full h-11 px-3 bg-[var(--surface)] border rounded-[var(--r-control)] outline-none focus:border-[var(--accent)]",
              errors.location ? "border-[var(--danger)]" : "border-[var(--border-strong)]",
            )}
          />
          {sharedLocationSuggest.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {sharedLocationSuggest.map((n) => (
                <button
              type="button"
                  key={n}
                  onClick={() => setSharedLocation(n)}
                  className="h-8 px-3 rounded-[var(--r-pill)] bg-[var(--surface)] border border-[var(--border)] text-sm hover:border-[var(--accent)]"
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {recentLocations.length > 0 && (
            <div className="mt-3">
              <div className="meta mb-1">{uz.admin.upload.recentLocations}</div>
              <div className="flex flex-wrap gap-2">
                {recentLocations.map((n) => (
                  <button
              type="button"
                    key={n}
                    onClick={() => setSharedLocation(n)}
                    className="h-8 px-3 rounded-[var(--r-pill)] bg-[var(--surface)] border border-[var(--border)] text-sm hover:border-[var(--accent)]"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="meta block mb-2">{uz.admin.upload.capturedAt}</label>
          <input
            type="date"
            value={sharedCapturedAt}
            onChange={(e) => setSharedCapturedAt(e.target.value)}
            className="w-full h-11 px-3 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label className="meta block mb-2">{uz.admin.upload.price}</label>
          <CurrencyInput
            value={sharedPrice}
            onValueChange={(raw) => setSharedPrice(raw)}
            placeholder={defaultPriceUZS > 0 ? `Standart: ${formatNumber(defaultPriceUZS)}` : uz.order.priceNegotiable}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Toggle label="Featured" value={sharedFeatured} onChange={setSharedFeatured} />
        </div>

        <div>
          <label className="meta block mb-2">Status</label>
          <div className="flex gap-2">
            {(["PUBLISHED", "DRAFT"] as const).map((s) => (
              <button
              type="button"
                key={s}
                onClick={() => setSharedStatus(s)}
                className={cn(
                  "h-10 px-4 rounded-[var(--r-control)] text-sm border",
                  sharedStatus === s
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-[var(--border-strong)] text-[var(--text-muted)]",
                )}
              >
                {s === "PUBLISHED" ? uz.admin.upload.publish : uz.admin.upload.draft}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <button
              type="button"
            onClick={submit}
            disabled={!canStart}
            title={
              missing.genre
                ? "Janr tanlang"
                : missing.location
                  ? "Joylashuv kiriting"
                  : missing.files
                    ? "Kamida bitta fayl tanlang"
                    : busy
                      ? "Yuklash davom etmoqda…"
                      : undefined
            }
            className="flex-1 h-12 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {activeCount + queuedCount} ta yuklanmoqda…
              </>
            ) : errorCount > 0 ? (
              <>
                <RefreshCw size={16} />
                {errorCount} ta xatoni qayta urinish
              </>
            ) : (
              uz.admin.actions.save
            )}
          </button>
          {items.length > 0 && !busy && (
            <button
              type="button"
              onClick={uploader.clearAll}
              className="h-12 px-4 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm hover:border-[var(--danger)]/40 hover:text-[var(--danger)]"
              title="Ro'yxatni tozalash"
            >
              Tozalash
            </button>
          )}
        </div>
        {msg && (
          <div
            className={cn(
              "text-sm",
              msgKind === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]",
            )}
          >
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

// Faylning brauzerdagi preview URL'ini yaratadi (rasm yoki video birinchi kadri
// uchun). Unmount vaqtida URL revoke qilinadi — xotira sizib ketmasin.
function useFilePreview(file: File): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

// Cardning chap tomonida ko'rinadigan kichik preview. Rasm bo'lsa <img>, video
// bo'lsa <video> (birinchi kadr metadata bilan yuklanadi), aks holda ikonka.
function FilePreview({ file }: { file: File }) {
  const url = useFilePreview(file);
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  return (
    <div className="w-11 h-11 rounded-[var(--r-media)] bg-[var(--bg)] border border-[var(--border)] overflow-hidden shrink-0 flex items-center justify-center relative">
      {url && isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      )}
      {url && isVideo && (
        <>
          <video
            src={url}
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
          <span className="absolute bottom-0 right-0 bg-[var(--bg)]/80 text-[var(--text)] p-0.5 rounded-tl">
            <FileVideo size={9} strokeWidth={2} />
          </span>
        </>
      )}
      {!url && (
        <FileImage size={16} strokeWidth={1.5} className="text-[var(--text-muted)]" />
      )}
    </div>
  );
}

function UploadCard({
  index,
  item,
  title,
  onTitleChange,
  expanded,
  overridden,
  onToggleExpand,
  onRemove,
  onPause,
  onRetry,
}: {
  index: number;
  item: UploadItem;
  title: string;
  onTitleChange: (v: string) => void;
  expanded: boolean;
  overridden: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onPause: () => void;
  onRetry: () => void;
}) {
  const pct = Math.round(item.progress * 100);
  const sizeMB = Math.max(1, Math.round(item.size / 1024 / 1024));
  const receivedMB = (item.receivedBytes / 1024 / 1024).toFixed(item.receivedBytes < 10 * 1024 * 1024 ? 1 : 0);
  const showBar =
    item.status === "uploading" ||
    item.status === "processing" ||
    (item.status === "paused" && item.progress > 0) ||
    (item.status === "error" && item.progress > 0);
  const editable = item.status === "queued" || item.status === "error" || item.status === "paused";

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        className={cn(
          "flex items-center gap-3 p-3 cursor-pointer rounded-[var(--r-card)]",
          "hover:bg-[var(--surface-hover)]",
        )}
      >
        <div className="text-xs meta w-6 text-center shrink-0">{index}</div>
        <FilePreview file={item.file} />
        <StatusBadge status={item.status} />
        <input
          value={title}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onTitleChange(e.target.value)}
          disabled={!editable}
          className={cn(
            "flex-1 h-10 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)] min-w-0",
            !editable && "opacity-70 cursor-not-allowed",
          )}
        />
        <span className="meta text-xs whitespace-nowrap tabular-nums">
          {item.status === "uploading" || item.status === "paused"
            ? `${receivedMB}/${sizeMB}MB`
            : `${sizeMB}MB`}
        </span>
        {overridden && (
          <span
            className="h-2 w-2 rounded-full bg-[var(--accent)] shrink-0"
            title="Individual metadata belgilangan"
          />
        )}
        <ChevronDown
          size={18}
          strokeWidth={1.5}
          className={cn("text-[var(--text-muted)] transition-transform shrink-0", expanded && "rotate-180")}
        />
        {/* Ish tugmalari */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {item.status === "uploading" && (
            <button
              type="button"
              onClick={onPause}
              className="w-8 h-8 inline-flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg)]"
              aria-label="To'xtatish"
              title="To'xtatish"
            >
              <Pause size={14} />
            </button>
          )}
          {(item.status === "paused" || item.status === "error") && (
            <button
              type="button"
              onClick={onRetry}
              className="w-8 h-8 inline-flex items-center justify-center rounded-full text-[var(--accent)] hover:bg-[var(--bg)]"
              aria-label="Davom ettirish"
              title="Davom ettirish"
            >
              {item.status === "error" ? <RefreshCw size={14} /> : <Play size={14} />}
            </button>
          )}
          <button
              type="button"
            onClick={onRemove}
            className="w-8 h-8 inline-flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg)]"
            aria-label="O'chirish"
            title="O'chirish"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {showBar && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <div className="flex-1 h-1 bg-[var(--bg)] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                item.status === "error"
                  ? "bg-[var(--danger)]"
                  : item.status === "paused"
                    ? "bg-[var(--text-muted)]"
                    : "bg-[var(--accent)]",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums w-10 text-right">{pct}%</span>
        </div>
      )}
      {item.status === "processing" && (
        <div className="px-3 pb-2 text-[10px] text-[var(--text-muted)] inline-flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin" />
          Server media ishlab chiqmoqda…
        </div>
      )}
      {item.status === "error" && item.errorMessage && (
        <div className="px-3 pb-2 text-[11px] text-[var(--danger)]">
          Xato: {item.errorMessage}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: UploadItem["status"] }) {
  if (status === "queued")
    return (
      <span
        className="w-5 h-5 rounded-full border border-[var(--border-strong)] shrink-0"
        title="Navbatda"
      />
    );
  if (status === "uploading")
    return (
      <Loader2
        size={16}
        className="text-[var(--accent)] animate-spin shrink-0"
      />
    );
  if (status === "processing")
    return (
      <Loader2
        size={16}
        className="text-[var(--accent)] animate-spin shrink-0"
      />
    );
  if (status === "paused")
    return <Pause size={14} className="text-[var(--text-muted)] shrink-0" />;
  if (status === "done")
    return <CheckCircle2 size={16} className="text-[var(--success)] shrink-0" />;
  if (status === "error")
    return <AlertTriangle size={16} className="text-[var(--danger)] shrink-0" />;
  return null;
}

function IndividualPanel({
  item,
  draft,
  shared,
  genres,
  genresById,
  csrf,
  onOverride,
  onReset,
  onGenreCreated,
}: {
  item: UploadItem;
  draft: Draft;
  shared: Shared;
  genres: { id: string; name: string }[];
  genresById: Map<string, string>;
  csrf: string;
  onOverride: (patch: Overrides) => void;
  onReset: () => void;
  onGenreCreated: (g: { id: string; name: string }) => void;
}) {
  const [suggest, setSuggest] = useState<string[]>([]);
  const [newGenreOpen, setNewGenreOpen] = useState(false);
  const [newGenreName, setNewGenreName] = useState("");
  const [addingGenre, setAddingGenre] = useState(false);
  const q = draft.overrides.locationName;
  const disabled = item.status !== "queued" && item.status !== "error" && item.status !== "paused";

  async function addGenre() {
    const name = newGenreName.trim();
    if (!name || addingGenre) return;
    setAddingGenre(true);
    try {
      const res = await fetch("/api/admin/genres", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok && data?.item) {
        onGenreCreated(data.item);
        // Yaratilgandan keyin darhol shu draft'ning individual janrlariga qo'shamiz.
        const nextIds = Array.from(
          new Set([...(draft.overrides.genreIds ?? []), data.item.id]),
        );
        onOverride({ genreIds: nextIds });
        setNewGenreName("");
        setNewGenreOpen(false);
      }
    } finally {
      setAddingGenre(false);
    }
  }

  useEffect(() => {
    if (!q) {
      setSuggest([]);
      return;
    }
    const c = new AbortController();
    fetch(`/api/admin/locations?q=${encodeURIComponent(q)}`, { signal: c.signal })
      .then((r) => r.json())
      .then((d) => setSuggest((d.items ?? []).map((x: { name: string }) => x.name)))
      .catch(() => {});
    return () => c.abort();
  }, [q]);

  const resolved = resolveMeta(draft.overrides, draft.title, shared);
  const individualGenres = draft.overrides.genreIds ?? [];
  const sharedGenreSet = new Set(shared.genreIds);

  return (
    <fieldset
      disabled={disabled}
      className={cn(
        "px-4 pb-4 pt-1 border-t border-[var(--border)] flex flex-col gap-4",
        disabled && "opacity-70",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="meta text-xs">
          {disabled
            ? "Yuklash boshlangan — meta o'zgartirib bo'lmaydi"
            : "Individual metadata — faqat shu faylga qo'llaniladi"}
        </div>
        {hasAnyOverride(draft.overrides) && !disabled && (
          <button
              type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent)]"
            title="Umumiy metadata qiymatlariga qaytarish"
          >
            <RotateCcw size={14} strokeWidth={1.5} />
            Umumiyga qaytarish
          </button>
        )}
      </div>

      <div>
        <label className="meta block mb-2">
          Janr <span className="text-[var(--text-muted)]">(umumiy + individual = birlashtiriladi)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => {
            const fromShared = sharedGenreSet.has(g.id);
            const fromIndividual = individualGenres.includes(g.id);
            const active = fromShared || fromIndividual;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  if (fromShared) return;
                  const next = fromIndividual
                    ? individualGenres.filter((x) => x !== g.id)
                    : [...individualGenres, g.id];
                  onOverride({ genreIds: next });
                }}
                disabled={fromShared}
                className={cn(
                  "h-8 px-3 rounded-[var(--r-pill)] text-sm border transition-colors",
                  active
                    ? fromShared
                      ? "border-[var(--border-strong)] text-[var(--text-muted)] bg-[var(--surface-hover)] cursor-not-allowed"
                      : "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--accent)]",
                )}
                title={fromShared ? "Umumiy metadatadan qo'llanilgan" : undefined}
              >
                {g.name}
                {fromShared && <span className="ml-1 text-[10px] opacity-70">·umumiy</span>}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setNewGenreOpen((v) => !v)}
            className="h-8 px-3 rounded-[var(--r-pill)] text-sm border border-dashed border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] inline-flex items-center gap-1"
          >
            <Plus size={13} strokeWidth={1.75} />
            {uz.admin.upload.newGenre}
          </button>
        </div>
        {newGenreOpen && (
          <div className="flex gap-2 mt-2">
            <input
              value={newGenreName}
              onChange={(e) => setNewGenreName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addGenre();
                }
              }}
              placeholder="Nomi"
              className="flex-1 h-10 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)]"
              autoFocus
            />
            <button
              type="button"
              onClick={addGenre}
              disabled={addingGenre || !newGenreName.trim()}
              className="h-10 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] rounded-[var(--r-control)] font-medium disabled:opacity-50 inline-flex items-center"
            >
              <Check size={16} />
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="meta block mb-2">
          Joylashuv
          <span className="ml-2 text-[var(--text-muted)] text-xs">
            Umumiy: {shared.locationName || "—"}
          </span>
        </label>
        <input
          value={draft.overrides.locationName ?? ""}
          onChange={(e) => onOverride({ locationName: e.target.value })}
          placeholder={shared.locationName || uz.admin.upload.searchLocation}
          className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)]"
        />
        {suggest.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggest.map((n) => (
              <button
              type="button"
                key={n}
                onClick={() => onOverride({ locationName: n })}
                className="h-8 px-3 rounded-[var(--r-pill)] bg-[var(--surface)] border border-[var(--border)] text-sm hover:border-[var(--accent)]"
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="meta block mb-2">
            Sana
            <span className="ml-2 text-[var(--text-muted)] text-xs">Umumiy: {shared.capturedAt || "—"}</span>
          </label>
          <input
            type="date"
            value={draft.overrides.capturedAt ?? ""}
            onChange={(e) => onOverride({ capturedAt: e.target.value })}
            className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label className="meta block mb-2">
            Narx
            <span className="ml-2 text-[var(--text-muted)] text-xs">
              Umumiy: {shared.priceUZS ? formatNumber(Number(shared.priceUZS)) : "—"}
            </span>
          </label>
          <CurrencyInput
            value={String(draft.overrides.priceUZS ?? "")}
            onValueChange={(raw) => onOverride({ priceUZS: raw })}
            placeholder={shared.priceUZS || uz.order.priceNegotiable}
            className="h-10"
          />
        </div>
      </div>

      <div>
        <label className="meta block mb-2">
          Featured
          <span className="ml-2 text-[var(--text-muted)] text-xs">
            Umumiy: {shared.featured ? uz.common.yes : uz.common.no}
          </span>
        </label>
        <TriState
          value={draft.overrides.featured}
          onChange={(v) => onOverride({ featured: v })}
          options={[
            { key: undefined, label: "Umumiy" },
            { key: true, label: uz.common.yes },
            { key: false, label: uz.common.no },
          ]}
        />
      </div>

      <div>
        <label className="meta block mb-2">
          Status
          <span className="ml-2 text-[var(--text-muted)] text-xs">
            Umumiy: {shared.status === "PUBLISHED" ? uz.admin.upload.publish : uz.admin.upload.draft}
          </span>
        </label>
        <TriState
          value={draft.overrides.status}
          onChange={(v) => onOverride({ status: v })}
          options={[
            { key: undefined, label: "Umumiy" },
            { key: "PUBLISHED", label: uz.admin.upload.publish },
            { key: "DRAFT", label: uz.admin.upload.draft },
          ]}
        />
      </div>

      <div className="rounded-[var(--r-control)] border border-[var(--border)] bg-[var(--bg)] p-3">
        <div className="meta text-xs mb-2">Saqlanadigan yakuniy qiymatlar</div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-[var(--text-muted)]">Janr</dt>
          <dd>
            {resolved.genreIds.length > 0
              ? resolved.genreIds.map((id) => genresById.get(id) ?? id).join(", ")
              : "—"}
          </dd>
          <dt className="text-[var(--text-muted)]">Joylashuv</dt>
          <dd>{resolved.locationName || "—"}</dd>
          <dt className="text-[var(--text-muted)]">Sana</dt>
          <dd>{resolved.capturedAt || "—"}</dd>
          <dt className="text-[var(--text-muted)]">Narx</dt>
          <dd>{resolved.priceUZS != null ? formatNumber(resolved.priceUZS) : uz.order.priceNegotiable}</dd>
          <dt className="text-[var(--text-muted)]">Featured</dt>
          <dd>{resolved.featured ? uz.common.yes : uz.common.no}</dd>
          <dt className="text-[var(--text-muted)]">Status</dt>
          <dd>{resolved.status === "PUBLISHED" ? uz.admin.upload.publish : uz.admin.upload.draft}</dd>
        </dl>
      </div>
    </fieldset>
  );
}

function TriState<T extends string | boolean | undefined>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
              type="button"
            key={String(opt.key)}
            onClick={() => onChange(opt.key)}
            className={cn(
              "h-9 px-3 rounded-[var(--r-control)] text-sm border transition-colors",
              active
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--accent)]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
              type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "h-10 px-4 rounded-[var(--r-control)] text-sm border transition-colors",
        value ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--text-muted)]",
      )}
    >
      {label}: {value ? uz.common.yes : uz.common.no}
    </button>
  );
}
