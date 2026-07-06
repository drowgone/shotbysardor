import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { AdminNav } from "./nav";
import { CsrfProvider } from "./csrf-provider";
import { prisma } from "@/lib/db";
import { LiveRefresh } from "@/lib/live/live-refresh";

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const s = await getAdminSession();
  if (!s.loggedIn) redirect("/admin");
  // Sessiya versiyasi eskirgan (parol/login o'zgargan) — cookie'ni o'chirib login'ga yo'naltiramiz.
  const currentVersion = (await getSetting("admin.sessionVersion").catch(() => 1)) as number;
  if ((s.v ?? 0) !== currentVersion) {
    redirect("/api/admin/logout");
  }

  const [pendingOrders, pendingComments] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.comment.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <CsrfProvider token={s.csrf ?? ""}>
      {/* Live: buyurtmalar va izohlar hodisasi kelganda RSC layoutni yangilaydi —
          natijada AdminNav'dagi pending badge'lar avtomatik yangilanadi. */}
      <LiveRefresh topics={["orders", "comments"]} />
      <div className="min-h-screen flex flex-col md:flex-row bg-[var(--bg)]">
        <AdminNav pendingOrders={pendingOrders} pendingComments={pendingComments} />
        <main className="flex-1 md:ml-60 pb-24 md:pb-0">
          <div className="px-4 md:px-6 lg:px-8 py-6 max-w-[1440px] mx-auto">{children}</div>
        </main>
      </div>
    </CsrfProvider>
  );
}
