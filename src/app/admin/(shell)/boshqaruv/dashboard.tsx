"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Wallet,
  ShoppingCart,
  Eye,
  MessageSquare,
  TrendingUp,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Image as ImageIcon,
  PlayCircle,
  Clock,
  Check,
  X,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { uz } from "@/lib/i18n/uz";
import { cn, formatNumber, formatTimeAgo, formatBytes } from "@/lib/utils";
import { useLiveData } from "@/lib/live/use-live";

type Stats = {
  kpi: {
    revenueCurr: number;
    revenueToday: number;
    revenueTotal: number;
    todayVisits: number;
    uniques7d: number;
    totalViews: number;
    ordersPending: number;
    ordersApproved: number;
    ordersRejected: number;
    ordersInCurr: number;
    commentsPending: number;
    conversionRate: number;
    liveSessions: number;
    contentTotal: number;
  };
  deltas: {
    visits: number;
    revenue: number;
    orders: number;
    conversion: number;
  };
  series: {
    day: string;
    visits: number;
    uniques: number;
    orders: number;
    revenue: number;
  }[];
  topContents: {
    id: string;
    slug: string;
    title: string;
    thumbUrl: string;
    views: number;
    approvedOrders: number;
    priceUZS: number | null;
  }[];
  mediaMix: { photo: number; video: number; bytes: number | null };
  devices: { mobile: number; desktop: number };
  referrers: { host: string; count: number }[];
  recentOrders: {
    id: string;
    code: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    priceUZS: number;
    customerName: string;
    createdAt: string;
    contentTitle: string | null;
    contentSlug: string | null;
    contentThumb: string | null;
  }[];
  recentComments: {
    id: string;
    status: "PENDING" | "APPROVED";
    name: string;
    text: string;
    createdAt: string;
    isAdmin: boolean;
    contentTitle: string | null;
    contentSlug: string | null;
    contentThumb: string | null;
  }[];
};

const RANGE_KEY = "sbs-dashboard-range";

export function Dashboard() {
  // Foydalanuvchi tanlagan davrni saqlaymiz — sahifa yopilgach ham eslab qoladi.
  const [range, setRange] = useState<7 | 30 | 90>(7);
  useEffect(() => {
    const saved = Number(localStorage.getItem(RANGE_KEY));
    if (saved === 7 || saved === 30 || saved === 90) setRange(saved);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(RANGE_KEY, String(range));
    } catch {
      // ignore
    }
  }, [range]);

  const query = useLiveData<Stats>(`/api/admin/stats?range=${range}`, [
    "stats",
    "orders",
    "contents",
    "comments",
  ]);
  const data = query.data;

  if (query.loading && !data) return <DashboardSkeleton />;
  if (!data) return <div className="meta">{uz.states.error}</div>;

  return (
    <div className="flex flex-col gap-6">
      <Header liveSessions={data.kpi.liveSessions} />

      <KpiRow data={data} />

      <ChartCard data={data} range={range} onRange={setRange} />

      <div className="grid gap-4 lg:grid-cols-3">
        <ActivityCard
          className="lg:col-span-2"
          orders={data.recentOrders}
          comments={data.recentComments}
        />
        <div className="flex flex-col gap-4">
          <MediaMixCard mix={data.mediaMix} total={data.kpi.contentTotal} />
          <DevicesCard devices={data.devices} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <TopContentsCard
          className="md:col-span-2"
          items={data.topContents}
        />
        <ReferrersCard referrers={data.referrers} />
      </div>
    </div>
  );
}

// ============================================================
// SARLAVHA — salom + jonli soat + LIVE indikator
// ============================================================
function Header({ liveSessions }: { liveSessions: number }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const hour = now?.getHours() ?? 12;
  const greeting =
    hour < 5
      ? uz.admin.analytics.greetingNight
      : hour < 12
        ? uz.admin.analytics.greetingMorning
        : hour < 18
          ? uz.admin.analytics.greetingDay
          : uz.admin.analytics.greetingEvening;
  const timeStr = now
    ? now.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
    : "";
  const dateStr = now
    ? now.toLocaleDateString("uz-UZ", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="h2">{greeting}, Sardor</h1>
        <div className="meta mt-1 flex items-center gap-2">
          <Clock size={11} strokeWidth={1.5} />
          <span suppressHydrationWarning>
            {dateStr}
            {timeStr && ` · ${timeStr}`}
          </span>
        </div>
      </div>
      <div
        className="inline-flex items-center gap-2 px-3 h-9 rounded-[var(--r-pill)] border border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)] text-xs font-medium"
        title={uz.admin.analytics.liveUsers(liveSessions)}
      >
        <span className="relative flex items-center">
          <span className="absolute inline-flex h-2 w-2 rounded-full bg-[var(--success)] opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]" />
        </span>
        <span>{uz.admin.analytics.liveUsers(liveSessions)}</span>
      </div>
    </div>
  );
}

// ============================================================
// KPI QATOR
// ============================================================
function KpiRow({ data }: { data: Stats }) {
  const k = data.kpi;
  const d = data.deltas;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        icon={<Wallet size={16} strokeWidth={1.5} />}
        label={uz.admin.analytics.revenue}
        value={compactUZS(k.revenueCurr)}
        subline={`${uz.admin.analytics.revenueToday}: ${compactUZS(k.revenueToday)}`}
        delta={d.revenue}
        accent
      />
      <KpiCard
        icon={<ShoppingCart size={16} strokeWidth={1.5} />}
        label={uz.admin.analytics.orders}
        value={formatNumber(k.ordersInCurr)}
        subline={
          <span className="inline-flex items-center gap-1.5 flex-wrap">
            {k.ordersPending > 0 && (
              <BadgeChip color="accent" label={`${k.ordersPending} ${uz.admin.analytics.pendingBadge}`} />
            )}
            {k.ordersApproved > 0 && (
              <BadgeChip color="success" label={`${k.ordersApproved} ${uz.admin.analytics.approvedBadge}`} />
            )}
            {k.ordersRejected > 0 && (
              <BadgeChip color="danger" label={`${k.ordersRejected} ${uz.admin.analytics.rejectedBadge}`} />
            )}
          </span>
        }
        delta={d.orders}
      />
      <KpiCard
        icon={<Eye size={16} strokeWidth={1.5} />}
        label={uz.admin.analytics.visits}
        value={formatNumber(k.todayVisits)}
        subline={`7 kun: ${formatNumber(k.uniques7d)} · ${uz.admin.analytics.totalViews}: ${compactNum(k.totalViews)}`}
        delta={d.visits}
      />
      <KpiCard
        icon={<TrendingUp size={16} strokeWidth={1.5} />}
        label={uz.admin.analytics.conversion}
        value={`${k.conversionRate.toFixed(2)}%`}
        subline={
          k.commentsPending > 0 ? (
            <Link
              href="/admin/izohlar"
              className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
            >
              <MessageSquare size={11} strokeWidth={1.5} />
              {k.commentsPending} {uz.admin.analytics.newComments}
            </Link>
          ) : (
            uz.admin.analytics.conversionHint
          )
        }
        delta={d.conversion}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  subline,
  delta,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subline?: React.ReactNode;
  delta?: number;
  accent?: boolean;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div
      className={cn(
        "bg-[var(--surface)] rounded-[var(--r-card)] p-4 flex flex-col gap-2 border",
        accent ? "border-[var(--accent)]/30" : "border-transparent",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 meta">
          <span className={cn("opacity-70", accent && "text-[var(--accent)] opacity-100")}>
            {icon}
          </span>
          <span>{label}</span>
        </div>
        {delta !== undefined && (
          <span
            className={cn(
              "meta text-[10px] inline-flex items-center gap-0.5",
              positive ? "text-[var(--success)]" : "text-[var(--danger)]",
            )}
          >
            {positive ? (
              <ArrowUpRight size={11} strokeWidth={2} />
            ) : (
              <ArrowDownRight size={11} strokeWidth={2} />
            )}
            {positive ? "+" : ""}
            {delta}%
          </span>
        )}
      </div>
      <div
        className={cn(
          "font-display text-2xl md:text-3xl leading-none tracking-tight",
          accent && "text-[var(--accent)]",
        )}
      >
        {value}
      </div>
      {subline && (
        <div className="meta text-[10px] text-[var(--text-muted)] leading-tight truncate">
          {subline}
        </div>
      )}
    </div>
  );
}

function BadgeChip({
  label,
  color,
}: {
  label: string;
  color: "accent" | "success" | "danger";
}) {
  const cls = {
    accent: "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10",
    success: "border-[var(--success)]/40 text-[var(--success)] bg-[var(--success)]/10",
    danger: "border-[var(--danger)]/40 text-[var(--danger)] bg-[var(--danger)]/10",
  }[color];
  return (
    <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border", cls)}>
      {label}
    </span>
  );
}

// ============================================================
// GRAFIK KARTA — 3 tab (ko'rishlar / buyurtmalar / daromad) + davr
// ============================================================
type ChartTab = "visits" | "orders" | "revenue";

function ChartCard({
  data,
  range,
  onRange,
}: {
  data: Stats;
  range: 7 | 30 | 90;
  onRange: (r: 7 | 30 | 90) => void;
}) {
  const [tab, setTab] = useState<ChartTab>("visits");

  const series = useMemo(() => {
    // Kunlar uchun mos label — hafta kunini (uz) va sanani chiqaradi.
    return data.series.map((s) => {
      const d = new Date(s.day);
      const label = d.toLocaleDateString("uz-UZ", {
        day: "numeric",
        month: "short",
      });
      return { ...s, label };
    });
  }, [data.series]);

  const tabs: { key: ChartTab; label: string; color: string }[] = [
    { key: "visits", label: uz.admin.analytics.chartVisits, color: "#C99A3F" },
    { key: "orders", label: uz.admin.analytics.chartOrders, color: "#66B37A" },
    { key: "revenue", label: uz.admin.analytics.chartRevenue, color: "#D26F5A" },
  ];
  const active = tabs.find((t) => t.key === tab)!;

  return (
    <div className="bg-[var(--surface)] rounded-[var(--r-card)] p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "h-8 px-3 rounded-[var(--r-pill)] text-xs inline-flex items-center gap-1.5 transition-colors",
                tab === t.key
                  ? "border border-[var(--border-strong)] text-[var(--text)] bg-[var(--bg)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: t.color }}
              />
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {([7, 30, 90] as const).map((r) => (
            <button
              key={r}
              onClick={() => onRange(r)}
              className={cn(
                "h-8 px-3 rounded-[var(--r-pill)] text-xs",
                range === r
                  ? "border border-[var(--accent)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              {r === 7
                ? uz.admin.analytics.range7
                : r === 30
                  ? uz.admin.analytics.range30
                  : uz.admin.analytics.range90}
            </button>
          ))}
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={active.color} stopOpacity="0.35" />
                <stop offset="100%" stopColor={active.color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fill: "#6C6963",
              }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              tick={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fill: "#6C6963",
              }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v) =>
                tab === "revenue" ? compactNum(Number(v)) : formatNumber(Number(v))
              }
            />
            <Tooltip
              contentStyle={{
                background: "#1A1A1D",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 10,
                fontSize: 12,
                padding: "8px 12px",
              }}
              labelStyle={{ color: "#F4F2ED", marginBottom: 4 }}
              formatter={(v: number) => [
                tab === "revenue" ? compactUZS(v) : formatNumber(v),
                active.label,
              ]}
            />
            <Area
              type="monotone"
              dataKey={tab}
              stroke={active.color}
              strokeWidth={2}
              fill="url(#chart-fill)"
              isAnimationActive
              animationDuration={400}
            />
            {tab === "visits" && (
              <Line
                type="monotone"
                dataKey="uniques"
                stroke="#A6A29A"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 4"
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================
// AKTIVLIK FEED — buyurtma + izoh birlashtirilgan
// ============================================================
function ActivityCard({
  orders,
  comments,
  className,
}: {
  orders: Stats["recentOrders"];
  comments: Stats["recentComments"];
  className?: string;
}) {
  const [tab, setTab] = useState<"orders" | "comments">("orders");
  const items = tab === "orders" ? orders : comments;

  return (
    <div
      className={cn(
        "bg-[var(--surface)] rounded-[var(--r-card)] p-4 flex flex-col",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="meta inline-flex items-center gap-2">
          <Sparkles size={11} strokeWidth={1.5} />
          {uz.admin.analytics.activity}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setTab("orders")}
            className={cn(
              "h-7 px-2.5 rounded-[var(--r-pill)] text-[11px] inline-flex items-center gap-1",
              tab === "orders"
                ? "border border-[var(--border-strong)] text-[var(--text)]"
                : "text-[var(--text-muted)]",
            )}
          >
            <ShoppingCart size={11} strokeWidth={1.5} />
            {uz.admin.analytics.chartOrders}
          </button>
          <button
            onClick={() => setTab("comments")}
            className={cn(
              "h-7 px-2.5 rounded-[var(--r-pill)] text-[11px] inline-flex items-center gap-1",
              tab === "comments"
                ? "border border-[var(--border-strong)] text-[var(--text)]"
                : "text-[var(--text-muted)]",
            )}
          >
            <MessageSquare size={11} strokeWidth={1.5} />
            {uz.admin.analytics.recentComments}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-[var(--text-muted)] py-6 text-center">
          {uz.admin.analytics.activityEmpty}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)] -mx-2">
          {tab === "orders"
            ? (items as Stats["recentOrders"]).map((o) => (
                <OrderRow key={o.id} order={o} />
              ))
            : (items as Stats["recentComments"]).map((c) => (
                <CommentRow key={c.id} c={c} />
              ))}
        </ul>
      )}

      <Link
        href={tab === "orders" ? "/admin/buyurtmalar" : "/admin/izohlar"}
        className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] inline-flex items-center gap-1 self-end"
      >
        {uz.admin.analytics.viewAll}
        <ArrowUpRight size={12} strokeWidth={1.5} />
      </Link>
    </div>
  );
}

function OrderRow({ order }: { order: Stats["recentOrders"][number] }) {
  const statusIcon =
    order.status === "APPROVED" ? (
      <Check size={12} className="text-[var(--success)]" strokeWidth={2.5} />
    ) : order.status === "REJECTED" ? (
      <X size={12} className="text-[var(--danger)]" strokeWidth={2.5} />
    ) : (
      <Clock size={12} className="text-[var(--accent)]" strokeWidth={2} />
    );
  return (
    <li className="flex items-center gap-3 py-2 px-2">
      {order.contentThumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={order.contentThumb}
          alt=""
          className="w-9 h-9 object-cover rounded-[var(--r-media)] shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-[var(--r-media)] bg-[var(--bg)] shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-mono text-[11px] text-[var(--text-muted)]">
            #{order.code}
          </span>
          <span className="truncate">{order.contentTitle ?? "—"}</span>
        </div>
        <div className="meta text-[10px] truncate">
          {order.customerName} · {compactUZS(order.priceUZS)} ·{" "}
          {formatTimeAgo(order.createdAt)}
        </div>
      </div>
      <div className="shrink-0">{statusIcon}</div>
    </li>
  );
}

function CommentRow({ c }: { c: Stats["recentComments"][number] }) {
  return (
    <li className="flex items-start gap-3 py-2 px-2">
      {c.contentThumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={c.contentThumb}
          alt=""
          className="w-9 h-9 object-cover rounded-[var(--r-media)] shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-[var(--r-media)] bg-[var(--bg)] shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-medium">{c.name}</span>
          {c.isAdmin && (
            <span className="text-[8px] px-1 py-0.5 rounded border border-[var(--accent)]/60 text-[var(--accent)]">
              MUALLIF
            </span>
          )}
          {c.status === "PENDING" && (
            <span className="text-[9px] text-[var(--accent)]">·</span>
          )}
        </div>
        <div className="text-xs text-[var(--text-muted)] truncate">{c.text}</div>
        <div className="meta text-[10px] truncate">
          {c.contentTitle ?? "—"} · {formatTimeAgo(c.createdAt)}
        </div>
      </div>
    </li>
  );
}

// ============================================================
// TOP CONTENTS
// ============================================================
function TopContentsCard({
  items,
  className,
}: {
  items: Stats["topContents"];
  className?: string;
}) {
  const maxViews = items.reduce((m, x) => Math.max(m, x.views), 0);
  return (
    <div
      className={cn(
        "bg-[var(--surface)] rounded-[var(--r-card)] p-4",
        className,
      )}
    >
      <div className="meta mb-3 inline-flex items-center gap-2">
        <TrendingUp size={11} strokeWidth={1.5} />
        {uz.admin.analytics.topContents}
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-[var(--text-muted)]">—</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((c, i) => (
            <Link
              key={c.id}
              href={`/p/${c.slug}`}
              target="_blank"
              className="flex items-center gap-3 group"
            >
              <span className="w-4 text-[10px] font-mono text-[var(--text-muted)] text-right shrink-0">
                {i + 1}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.thumbUrl}
                alt=""
                className="w-10 h-10 object-cover rounded-[var(--r-media)] shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate group-hover:text-[var(--accent)] transition-colors inline-flex items-center gap-1">
                  {c.title}
                  <ExternalLink
                    size={11}
                    strokeWidth={1.5}
                    className="opacity-0 group-hover:opacity-60 transition-opacity"
                  />
                </div>
                <div className="meta text-[10px] inline-flex items-center gap-2">
                  <span>{formatNumber(c.views)} ko&apos;rish</span>
                  {c.approvedOrders > 0 && (
                    <span className="text-[var(--accent)]">
                      · {c.approvedOrders} buyurtma
                    </span>
                  )}
                  {c.priceUZS && c.priceUZS > 0 && (
                    <span>· {compactUZS(c.priceUZS)}</span>
                  )}
                </div>
              </div>
              <div className="w-16 md:w-24 h-1 bg-[var(--border)] rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-[var(--accent)]"
                  style={{
                    width: `${maxViews ? (c.views / maxViews) * 100 : 0}%`,
                  }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MEDIA MIX
// ============================================================
function MediaMixCard({
  mix,
  total,
}: {
  mix: { photo: number; video: number; bytes: number | null };
  total: number;
}) {
  const sum = Math.max(1, mix.photo + mix.video);
  const photoPct = Math.round((mix.photo / sum) * 100);
  const videoPct = 100 - photoPct;
  return (
    <div className="bg-[var(--surface)] rounded-[var(--r-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="meta">{uz.admin.analytics.mediaMix}</div>
        <div className="meta text-[10px] flex items-center gap-2">
          <span>
            {uz.admin.analytics.contentTotal}: {total}
          </span>
          {mix.bytes != null && (
            <>
              <span className="text-[var(--text-muted)]">·</span>
              <span title="Storage disk usage">{formatBytes(mix.bytes)}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-[var(--border)] mb-3">
        <div
          className="bg-[var(--accent)]"
          style={{ width: `${photoPct}%` }}
          title={`${uz.admin.analytics.photos}: ${mix.photo}`}
        />
        <div
          className="bg-[var(--success)]"
          style={{ width: `${videoPct}%` }}
          title={`${uz.admin.analytics.videos}: ${mix.video}`}
        />
      </div>
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
            <ImageIcon size={12} strokeWidth={1.5} />
            {uz.admin.analytics.photos}
          </span>
          <span className="font-mono text-xs">
            {mix.photo} <span className="text-[var(--text-muted)]">· {photoPct}%</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
            <PlayCircle size={12} strokeWidth={1.5} />
            {uz.admin.analytics.videos}
          </span>
          <span className="font-mono text-xs">
            {mix.video} <span className="text-[var(--text-muted)]">· {videoPct}%</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// QURILMA (donut)
// ============================================================
function DevicesCard({
  devices,
}: {
  devices: { mobile: number; desktop: number };
}) {
  const total = Math.max(1, devices.mobile + devices.desktop);
  const mobilePct = Math.round((devices.mobile / total) * 100);
  return (
    <div className="bg-[var(--surface)] rounded-[var(--r-card)] p-4">
      <div className="meta mb-3 inline-flex items-center gap-2">
        <Users size={11} strokeWidth={1.5} />
        {uz.admin.analytics.devices}
      </div>
      <div className="flex items-center gap-4">
        <Donut mobile={devices.mobile} desktop={devices.desktop} />
        <div className="flex flex-col gap-2 text-sm flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-[var(--text-muted)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
              {uz.admin.analytics.mobile}
            </span>
            <span className="font-mono text-xs">{mobilePct}%</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-[var(--text-muted)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)]" />
              {uz.admin.analytics.desktop}
            </span>
            <span className="font-mono text-xs">{100 - mobilePct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Donut({ mobile, desktop }: { mobile: number; desktop: number }) {
  const total = Math.max(1, mobile + desktop);
  const mobilePct = mobile / total;
  const r = 26;
  const c = 2 * Math.PI * r;
  const mobileLen = c * mobilePct;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#3a3733" strokeWidth="8" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="#C99A3F"
        strokeWidth="8"
        strokeDasharray={`${mobileLen} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
    </svg>
  );
}

// ============================================================
// REFERRERLAR
// ============================================================
function ReferrersCard({
  referrers,
}: {
  referrers: Stats["referrers"];
}) {
  const max = referrers.reduce((m, x) => Math.max(m, x.count), 0);
  return (
    <div className="bg-[var(--surface)] rounded-[var(--r-card)] p-4">
      <div className="meta mb-3">{uz.admin.analytics.referrers}</div>
      {referrers.length === 0 ? (
        <div className="text-sm text-[var(--text-muted)]">—</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {referrers.map((r) => (
            <li key={r.host} className="flex items-center gap-2 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(r.host)}`}
                alt=""
                className="w-4 h-4 rounded-sm shrink-0"
                loading="lazy"
              />
              <span className="text-[var(--text-muted)] truncate flex-1">
                {r.host}
              </span>
              <div className="w-10 h-1 bg-[var(--border)] rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-[var(--text-muted)]"
                  style={{
                    width: `${max ? (r.count / max) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="meta font-mono text-[11px] w-8 text-right shrink-0">
                {r.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// SKELETON — birinchi yuklashda
// ============================================================
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-10 w-64 rounded bg-[var(--surface)]" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-[var(--r-card)] bg-[var(--surface)]" />
        ))}
      </div>
      <div className="h-64 rounded-[var(--r-card)] bg-[var(--surface)]" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 h-72 rounded-[var(--r-card)] bg-[var(--surface)]" />
        <div className="flex flex-col gap-4">
          <div className="h-36 rounded-[var(--r-card)] bg-[var(--surface)]" />
          <div className="h-36 rounded-[var(--r-card)] bg-[var(--surface)]" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FORMAT UTILS
// ============================================================
function compactNum(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + "K";
  return (n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0) + "M";
}

function compactUZS(n: number): string {
  if (n === 0) return `0 ${uz.admin.analytics.currency}`;
  if (n < 1000) return `${n} ${uz.admin.analytics.currency}`;
  if (n < 1_000_000) {
    const v = (n / 1000).toFixed(n < 10_000 ? 1 : 0);
    return `${v}K ${uz.admin.analytics.currency}`;
  }
  const v = (n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0);
  return `${v}M ${uz.admin.analytics.currency}`;
}
