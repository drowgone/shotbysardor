"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Image as ImageIcon, Upload, MessageSquare, ShoppingCart, Settings, ExternalLink, LogOut } from "lucide-react";
import { uz } from "@/lib/i18n/uz";
import { Monogram } from "@/components/brand/Monogram";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin/boshqaruv", label: uz.admin.nav.dashboard, icon: LayoutDashboard },
  { href: "/admin/kontentlar", label: uz.admin.nav.contents, icon: ImageIcon },
  { href: "/admin/yuklash", label: uz.admin.nav.upload, icon: Upload },
  { href: "/admin/izohlar", label: uz.admin.nav.comments, icon: MessageSquare, dotKey: "comments" as const },
  { href: "/admin/buyurtmalar", label: uz.admin.nav.orders, icon: ShoppingCart, dotKey: "orders" as const },
  { href: "/admin/sozlamalar", label: uz.admin.nav.settings, icon: Settings },
];

export function AdminNav({
  pendingOrders,
  pendingComments,
}: {
  pendingOrders: number;
  pendingComments: number;
}) {
  const path = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin");
    router.refresh();
  }

  const dots: Record<string, number> = { orders: pendingOrders, comments: pendingComments };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-60 bg-[var(--bg-elevated)] border-r border-[var(--border)] flex-col z-30">
        <div className="p-6 flex items-center gap-2">
          <Monogram size={32} />
          <span className="text-sm text-[var(--text-muted)] meta">ADMIN</span>
        </div>
        <nav className="flex-1 px-3 flex flex-col gap-1">
          {items.map((it) => {
            const active = path.startsWith(it.href);
            const dot = it.dotKey ? dots[it.dotKey] : 0;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "flex items-center gap-3 px-3 h-11 rounded-[var(--r-control)] text-sm transition-colors relative",
                  active ? "bg-[var(--surface)] text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]",
                )}
              >
                <it.icon size={18} strokeWidth={1.5} />
                <span className="flex-1">{it.label}</span>
                {dot > 0 && <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 flex flex-col gap-1 border-t border-[var(--border)]">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 px-3 h-11 rounded-[var(--r-control)] text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <ExternalLink size={18} strokeWidth={1.5} />
            {uz.nav.openSite}
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 h-11 rounded-[var(--r-control)] text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <LogOut size={18} strokeWidth={1.5} />
            {uz.nav.logout}
          </button>
        </div>
      </aside>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--bg-elevated)] border-t border-[var(--border)] z-30 flex items-stretch">
        {items.slice(0, 5).map((it) => {
          const active = path.startsWith(it.href);
          const dot = it.dotKey ? dots[it.dotKey] : 0;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 relative",
                active ? "text-[var(--accent)]" : "text-[var(--text-muted)]",
              )}
            >
              <it.icon size={20} strokeWidth={1.5} />
              <span className="text-[10px]">{it.label}</span>
              {dot > 0 && <span className="absolute top-3 right-1/4 w-2 h-2 rounded-full bg-[var(--accent)]" />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
