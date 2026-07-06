"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Star, Trash2, EyeOff, Eye, Search, ChevronLeft, ChevronRight, X, Check, Pencil, Wallet } from "lucide-react";
import { useCsrf } from "../csrf-provider";
import { uz } from "@/lib/i18n/uz";
import { formatDate, cn, formatNumber } from "@/lib/utils";
import { CurrencyInput } from "@/components/inputs/FormattedInput";
import { useLiveData } from "@/lib/live/use-live";

// Jadval sarlavha qatorini yopishtirish. Sahifa scroll qilinganda thead viewport
// tepasida qotib turadi. Har bir th uchun alohida qo'llanadi (thead/tr'ga sticky
// ishonchli emas). `shadow` — sticky paytda border-b qatorda ba'zi brauzerlarda
// yo'qolib ketmasligi uchun ishonchli pastki chegara.
const stickyTh = "sticky top-0 z-10 bg-[var(--bg)] shadow-[inset_0_-1px_0_var(--border)]";

type Row = {
  id: string;
  slug: string;
  title: string;
  thumbUrl: string;
  // Bir kontent bir nechta janrga tegishli bo'lishi mumkin.
  genres: { id: string; name: string }[];
  location: string;
  capturedAt: string;
  views: number;
  comments: number;
  orders: number;
  priceUZS: number | null;
  description: string | null;
  genreIds: string[];
  locationId: string;
  status: "PUBLISHED" | "DRAFT";
  featured: boolean;
  type: "PHOTO" | "VIDEO";
};

type Genre = { id: string; name: string };

export function ContentsView() {
  const csrf = useCsrf();
  const [q, setQ] = useState("");
  // Qidiruv 250ms debounce — foydalanuvchi yozayotganda har harfda serverga bormasin.
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<"" | "PUBLISHED" | "DRAFT">("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);

  function showToast(kind: "ok" | "err", text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const listUrl = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ) sp.set("q", debouncedQ);
    if (status) sp.set("status", status);
    sp.set("page", String(page));
    return `/api/admin/contents?${sp.toString()}`;
  }, [debouncedQ, status, page]);

  // Kontent va taxonomiya event'lariga obuna — istalgan CRUD bo'lsa avtomatik yangilanadi.
  const listQuery = useLiveData<{
    items: Row[];
    page: number;
    totalPages: number;
    total: number;
    revenueUZS: number;
  }>(listUrl, ["contents", "taxonomy"]);
  const items = listQuery.data?.items ?? [];
  const totalPages = listQuery.data?.totalPages ?? 1;
  const total = listQuery.data?.total ?? 0;
  const revenueUZS = listQuery.data?.revenueUZS ?? 0;
  const loading = listQuery.loading;

  // Janrlar — taxonomy event'iga bog'lanadi (yaratildi/o'chirildi/merge).
  const genresQuery = useLiveData<{ items: Genre[] }>("/api/admin/genres", ["taxonomy"]);
  const genres = genresQuery.data?.items ?? [];

  async function patch(id: string, data: Record<string, unknown>) {
    return fetch(`/api/admin/contents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify(data),
    });
  }

  async function toggleFeatured(id: string, v: boolean) {
    await patch(id, { featured: v });
    // Refetch bus event orqali avtomatik.
  }

  async function toggleHide(id: string, cur: "PUBLISHED" | "DRAFT") {
    const next = cur === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    await patch(id, { status: next });
  }

  async function del(id: string) {
    if (!confirm("O'chirilsinmi?")) return;
    const res = await fetch(`/api/admin/contents/${id}`, { method: "DELETE", headers: { "x-csrf-token": csrf } });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      showToast("err", d?.error?.message ?? uz.toasts.error);
      return;
    }
    setSelected((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    showToast("ok", uz.toasts.saved);
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const currentPageIds = useMemo(() => items.map((i) => i.id), [items]);
  const allOnPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selected.has(id));
  function toggleSelectPage() {
    setSelected((s) => {
      const n = new Set(s);
      if (allOnPageSelected) currentPageIds.forEach((id) => n.delete(id));
      else currentPageIds.forEach((id) => n.add(id));
      return n;
    });
  }

  const selectedCount = selected.size;
  const selectedOnPageCount = currentPageIds.filter((id) => selected.has(id)).length;
  const selectedNotOnPage = selectedCount - selectedOnPageCount;

  async function bulk(action: "delete" | "publish" | "draft" | "setGenre", genreId?: string) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (action === "delete" && !confirm(`${ids.length} ta kontent o'chirilsinmi? Bu qaytarilmaydi.`)) return;
    setBulkBusy(true);
    try {
      const body =
        action === "delete"
          ? { action: "delete", ids }
          : action === "setGenre"
          ? { action: "setGenres", ids, genreIds: [genreId!] }
          : { action: "setStatus", ids, status: action === "publish" ? "PUBLISHED" : "DRAFT" };
      const res = await fetch("/api/admin/contents/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        showToast("err", d?.error?.message ?? uz.toasts.error);
        return;
      }
      if (action === "delete") {
        setSelected(new Set());
        const nextTotal = Math.max(0, total - ids.length);
        const nextTotalPages = Math.max(1, Math.ceil(nextTotal / 60));
        if (page > nextTotalPages) setPage(nextTotalPages);
        showToast("ok", `${ids.length} ta o'chirildi`);
      } else if (action === "publish" || action === "draft") {
        showToast("ok", uz.toasts.saved);
      } else if (action === "setGenre") {
        showToast("ok", uz.toasts.saved);
      }
    } catch (e) {
      showToast("err", e instanceof Error ? e.message : uz.toasts.error);
    } finally {
      setBulkBusy(false);
    }
  }

  function onEditSaved(_updated: Row) {
    // Refetch bus event orqali avtomatik.
    setEditing(null);
    showToast("ok", uz.toasts.saved);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header — sarlavha · daromat · yangi kontent tugmasi */}
      <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
        <h1 className="h2">Kontentlar</h1>
        <div
          className="flex items-center gap-2 px-4 h-11 rounded-[var(--r-control)] bg-[var(--surface)] border border-[var(--border)]"
          title={uz.admin.contents.revenueHint}
        >
          <Wallet size={16} strokeWidth={1.5} className="text-[var(--accent)]" />
          <span className="meta text-[10px] text-[var(--text-muted)]">
            {uz.admin.contents.revenue.toUpperCase()}
          </span>
          <span className="font-mono text-sm font-medium">
            {formatNumber(revenueUZS)} <span className="text-[var(--text-muted)]">so'm</span>
          </span>
        </div>
        <Link
          href="/admin/yuklash"
          className="h-11 px-4 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-medium inline-flex items-center"
        >
          + Yangi kontent
        </Link>
      </div>

      {selectedCount > 0 && (
        <div className="sticky top-4 z-20 bg-[var(--bg-elevated)]/95 backdrop-blur-md border border-[var(--accent)]/40 rounded-[var(--r-card)] p-3 flex flex-wrap items-center gap-2" style={{ boxShadow: "var(--shadow-modal)" }}>
          <span className="text-sm font-medium">
            {selectedCount} ta tanlangan
            {selectedNotOnPage > 0 && (
              <span className="meta text-[10px] text-[var(--text-muted)] ml-2">
                (bu sahifada {selectedOnPageCount})
              </span>
            )}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  bulk("setGenre", e.target.value);
                  e.target.value = "";
                }
              }}
              className="h-9 px-3 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--r-control)] text-sm"
              disabled={bulkBusy}
              defaultValue=""
            >
              <option value="">Janrga o'zgartirish</option>
              {genres.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => bulk("publish")}
              disabled={bulkBusy}
              className="h-9 px-3 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm"
            >
              Chop etish
            </button>
            <button
              onClick={() => bulk("draft")}
              disabled={bulkBusy}
              className="h-9 px-3 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm"
            >
              Qoralama
            </button>
            <button
              onClick={() => bulk("delete")}
              disabled={bulkBusy}
              className="h-9 px-3 rounded-[var(--r-control)] border border-[var(--danger)]/50 text-[var(--danger)] text-sm"
            >
              O'chirish
            </button>
            <button
              onClick={() => setSelected(new Set())}
              disabled={bulkBusy}
              className="h-9 w-9 rounded-[var(--r-control)] hover:bg-[var(--surface-hover)]"
              aria-label="Tanlovni tozalash"
              title="Tozalash"
            >
              <X size={16} className="mx-auto" />
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={uz.admin.contents.search}
            className="w-full h-11 pl-10 pr-3 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | "PUBLISHED" | "DRAFT")}
          className="h-11 px-3 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[var(--r-control)]"
        >
          <option value="">Barchasi</option>
          <option value="PUBLISHED">{uz.admin.contents.published}</option>
          <option value="DRAFT">{uz.admin.contents.draft}</option>
        </select>
      </div>

      <div className="meta">
        Jami {total} ta · sahifa {page}/{totalPages}
      </div>

      {loading ? (
        <div className="meta">{uz.states.loading}</div>
      ) : items.length === 0 ? (
        <div className="meta">{uz.states.empty}</div>
      ) : (
        <>
          <div className="hidden md:block">
            <table className="w-full text-[13px]">
              <thead className="text-[var(--text-muted)]">
                <tr>
                  <th className={cn(stickyTh, "p-2 w-10")}>
                    <Checkbox checked={allOnPageSelected} onChange={toggleSelectPage} />
                  </th>
                  <th className={cn(stickyTh, "text-left p-2 w-16")}></th>
                  <th className={cn(stickyTh, "text-left p-2")}>{uz.admin.contents.title}</th>
                  <th className={cn(stickyTh, "text-left p-2")}>{uz.admin.contents.genre}</th>
                  <th className={cn(stickyTh, "text-left p-2")}>{uz.admin.contents.location}</th>
                  <th className={cn(stickyTh, "text-left p-2")}>{uz.admin.contents.date}</th>
                  <th className={cn(stickyTh, "text-right p-2")}>{uz.admin.contents.views}</th>
                  <th className={cn(stickyTh, "text-right p-2")}>{uz.admin.contents.comments}</th>
                  <th className={cn(stickyTh, "text-right p-2")}>{uz.admin.contents.orders}</th>
                  <th className={cn(stickyTh, "text-center p-2")}>{uz.admin.contents.status}</th>
                  <th className={cn(stickyTh, "text-center p-2")}>★</th>
                  <th className={cn(stickyTh, "text-right p-2")}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr
                    key={r.id}
                    className={cn(
                      "border-b border-[var(--border)] hover:bg-[var(--surface-hover)]",
                      selected.has(r.id) && "bg-[var(--accent)]/5",
                    )}
                    style={{ height: 56 }}
                  >
                    <td className="p-2">
                      <Checkbox checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                    </td>
                    <td className="p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.thumbUrl} alt="" className="w-10 h-10 object-cover rounded-[var(--r-media)]" />
                    </td>
                    <td className="p-2">
                      <Link href={`/p/${r.slug}`} target="_blank" className="hover:text-[var(--accent)]">
                        {r.title}
                      </Link>
                    </td>
                    <td className="p-2 text-[var(--text-muted)]">{r.genres.map((g) => g.name).join(", ")}</td>
                    <td className="p-2 text-[var(--text-muted)]">{r.location}</td>
                    <td className="p-2 meta">{formatDate(r.capturedAt)}</td>
                    <td className="p-2 meta text-right">{r.views}</td>
                    <td className="p-2 meta text-right">{r.comments}</td>
                    <td className="p-2 meta text-right">
                      {r.orders > 0 ? (
                        <span className="text-[var(--accent)] font-medium">{r.orders}</span>
                      ) : (
                        r.orders
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <span className={cn("meta px-2 py-1 rounded", r.status === "PUBLISHED" ? "text-[var(--success)]" : "text-[var(--text-muted)]")}>
                        {r.status === "PUBLISHED" ? uz.admin.contents.published : uz.admin.contents.draft}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <button onClick={() => toggleFeatured(r.id, !r.featured)} aria-label="featured">
                        <Star size={16} strokeWidth={1.5} className={r.featured ? "text-[var(--accent)] fill-[var(--accent)]" : "text-[var(--text-muted)]"} />
                      </button>
                    </td>
                    <td className="p-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setEditing(r)}
                          className="w-8 h-8 rounded hover:bg-[var(--surface)]"
                          title={uz.admin.actions.edit}
                          aria-label={uz.admin.actions.edit}
                        >
                          <Pencil size={16} strokeWidth={1.5} className="mx-auto" />
                        </button>
                        <button onClick={() => toggleHide(r.id, r.status)} className="w-8 h-8 rounded hover:bg-[var(--surface)]" title={uz.admin.actions.hide}>
                          {r.status === "PUBLISHED" ? <EyeOff size={16} strokeWidth={1.5} className="mx-auto" /> : <Eye size={16} strokeWidth={1.5} className="mx-auto" />}
                        </button>
                        <button onClick={() => del(r.id)} className="w-8 h-8 rounded hover:bg-[var(--surface)]" title={uz.admin.actions.delete}>
                          <Trash2 size={16} strokeWidth={1.5} className="mx-auto text-[var(--danger)]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden flex flex-col gap-3">
            {items.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "p-3 bg-[var(--surface)] rounded-[var(--r-card)] flex gap-3",
                  selected.has(r.id) && "ring-1 ring-[var(--accent)]",
                )}
              >
                <div className="pt-1">
                  <Checkbox checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.thumbUrl} alt="" className="w-16 h-16 object-cover rounded-[var(--r-media)]" />
                <div className="flex-1 min-w-0">
                  <Link href={`/p/${r.slug}`} target="_blank" className="text-sm font-medium">
                    {r.title}
                  </Link>
                  <div className="meta text-[10px]">
                    {r.genres.map((g) => g.name.toUpperCase()).join(" · ")} · {r.location.toUpperCase()} · {r.views} KO'RISH · {r.orders} BUYURTMA
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => toggleFeatured(r.id, !r.featured)}>
                      <Star size={16} strokeWidth={1.5} className={r.featured ? "text-[var(--accent)] fill-[var(--accent)]" : "text-[var(--text-muted)]"} />
                    </button>
                    <button onClick={() => setEditing(r)} title={uz.admin.actions.edit}>
                      <Pencil size={16} strokeWidth={1.5} />
                    </button>
                    <button onClick={() => toggleHide(r.id, r.status)}>
                      {r.status === "PUBLISHED" ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button onClick={() => del(r.id)} className="ml-auto">
                      <Trash2 size={16} strokeWidth={1.5} className="text-[var(--danger)]" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          )}
        </>
      )}

      {editing && (
        <EditModal
          row={editing}
          genres={genres}
          onClose={() => setEditing(null)}
          onSaved={onEditSaved}
          csrf={csrf}
        />
      )}

      {toast && (
        <div
          className={cn(
            "fixed top-6 right-6 z-40 px-4 py-3 rounded-[var(--r-control)] text-sm border max-w-[80vw]",
            toast.kind === "ok"
              ? "bg-[var(--success)]/10 border-[var(--success)]/40 text-[var(--success)]"
              : "bg-[var(--danger)]/10 border-[var(--danger)]/40 text-[var(--danger)]",
          )}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function EditModal({
  row,
  genres,
  onClose,
  onSaved,
  csrf,
}: {
  row: Row;
  genres: Genre[];
  onClose: () => void;
  onSaved: (r: Row) => void;
  csrf: string;
}) {
  const [title, setTitle] = useState(row.title);
  const [description, setDescription] = useState(row.description ?? "");
  const [genreIds, setGenreIds] = useState<string[]>(row.genreIds);
  const [locationName, setLocationName] = useState(row.location);
  const [locationSuggest, setLocationSuggest] = useState<{ id: string; name: string }[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [capturedAt, setCapturedAt] = useState(row.capturedAt.slice(0, 10));
  const [price, setPrice] = useState<string>(row.priceUZS != null ? String(row.priceUZS) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!locationName || locationName === row.location) {
      setLocationSuggest([]);
      return;
    }
    const c = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/admin/locations?q=${encodeURIComponent(locationName)}`, { signal: c.signal })
        .then((r) => r.json())
        .then((d) => setLocationSuggest(d.items ?? []))
        .catch(() => {});
    }, 200);
    return () => {
      c.abort();
      clearTimeout(t);
    };
  }, [locationName, row.location]);

  async function resolveLocationId(): Promise<string> {
    const trimmed = locationName.trim();
    if (trimmed === row.location) return row.locationId;
    const match = locationSuggest.find((l) => l.name.toLowerCase() === trimmed.toLowerCase());
    if (match) return match.id;
    // Yangi joylashuv yaratish
    const res = await fetch("/api/admin/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ name: trimmed }),
    });
    const d = await res.json();
    return d.item.id as string;
  }

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const locationId = await resolveLocationId();
      const parsedPrice = price.trim() === "" ? null : Number(price);
      if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
        setErr("Narx noto'g'ri");
        setBusy(false);
        return;
      }
      if (genreIds.length === 0) {
        setErr("Kamida bitta janr tanlang");
        setBusy(false);
        return;
      }
      const res = await fetch(`/api/admin/contents/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          genreIds,
          locationId,
          capturedAt: new Date(capturedAt).toISOString(),
          priceUZS: parsedPrice,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setErr(d?.error?.message ?? uz.toasts.error);
        return;
      }
      const selectedGenres = genres.filter((g) => genreIds.includes(g.id));
      onSaved({
        ...row,
        title: title.trim(),
        description: description.trim() || null,
        genreIds,
        genres: selectedGenres.map((g) => ({ id: g.id, name: g.name })),
        locationId,
        location: locationName.trim(),
        capturedAt: new Date(capturedAt).toISOString(),
        priceUZS: parsedPrice,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : uz.toasts.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={uz.admin.actions.edit}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-[var(--scrim)]" onClick={onClose} />
      <div
        className="relative w-full max-w-lg bg-[var(--surface)] rounded-[var(--r-modal)] border border-[var(--border)] flex flex-col max-h-[90vh]"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="font-display text-lg">{uz.admin.actions.edit}</div>
          <button
            onClick={onClose}
            aria-label={uz.common.close}
            className="w-9 h-9 rounded-[var(--r-control)] hover:bg-[var(--surface-hover)] flex items-center justify-center"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <Field label={uz.admin.contents.title}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] text-sm outline-none focus:border-[var(--accent)]"
              maxLength={200}
            />
          </Field>
          <Field label={uz.admin.contents.description}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] text-sm outline-none focus:border-[var(--accent)] resize-none"
              maxLength={2000}
            />
          </Field>
          <Field label={`${uz.admin.contents.genre} (bir nechta tanlash mumkin)`}>
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => {
                const active = genreIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      setGenreIds((s) =>
                        s.includes(g.id) ? s.filter((x) => x !== g.id) : [...s, g.id],
                      )
                    }
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
            </div>
          </Field>
          <Field label={uz.admin.contents.date}>
            <input
              type="date"
              value={capturedAt}
              onChange={(e) => setCapturedAt(e.target.value)}
              className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] text-sm outline-none focus:border-[var(--accent)]"
            />
          </Field>
          <Field label={uz.admin.contents.location}>
            <div className="relative">
              <input
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
                className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] text-sm outline-none focus:border-[var(--accent)]"
                maxLength={100}
              />
              {suggestOpen && locationSuggest.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-[var(--r-control)] py-1 max-h-40 overflow-y-auto" style={{ boxShadow: "var(--shadow-modal)" }}>
                  {locationSuggest.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onMouseDown={() => setLocationName(l.name)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
          <Field label={uz.admin.contents.price}>
            <CurrencyInput
              value={price}
              onValueChange={(raw) => setPrice(raw)}
              placeholder="0"
              className="h-10 text-sm"
            />
          </Field>
          {err && (
            <div className="text-sm text-[var(--danger)]">{err}</div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-[var(--r-control)] border border-[var(--border-strong)] text-sm"
            disabled={busy}
          >
            {uz.admin.actions.cancel}
          </button>
          <button
            onClick={save}
            disabled={busy || !title.trim() || !locationName.trim()}
            className="h-10 px-4 rounded-[var(--r-control)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-sm font-medium disabled:opacity-50"
          >
            {uz.admin.actions.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="meta text-[10px] text-[var(--text-muted)]">{label.toUpperCase()}</span>
      {children}
    </label>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      role="checkbox"
      aria-checked={checked}
      className={cn(
        "w-5 h-5 rounded border flex items-center justify-center transition-colors",
        checked
          ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--on-accent)]"
          : "border-[var(--border-strong)] hover:border-[var(--accent)]",
      )}
    >
      {checked && <Check size={12} strokeWidth={3} />}
    </button>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (n: number) => void;
}) {
  const pages = useMemo(() => {
    const set = new Set<number>([1, totalPages]);
    for (let i = -2; i <= 2; i++) {
      const p = page + i;
      if (p >= 1 && p <= totalPages) set.add(p);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [page, totalPages]);

  return (
    <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
      <button
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page === 1}
        className="w-9 h-9 rounded-[var(--r-control)] border border-[var(--border-strong)] flex items-center justify-center disabled:opacity-30"
        aria-label="Oldingi"
      >
        <ChevronLeft size={16} />
      </button>
      {pages.map((p, i) => {
        const prev = pages[i - 1];
        const gap = prev !== undefined && p - prev > 1;
        return (
          <span key={p} className="flex items-center gap-1">
            {gap && <span className="meta text-[var(--text-faint)] px-1">…</span>}
            <button
              onClick={() => onPage(p)}
              className={cn(
                "min-w-9 h-9 px-3 rounded-[var(--r-control)] border text-sm",
                p === page
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              {p}
            </button>
          </span>
        );
      })}
      <button
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="w-9 h-9 rounded-[var(--r-control)] border border-[var(--border-strong)] flex items-center justify-center disabled:opacity-30"
        aria-label="Keyingi"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
