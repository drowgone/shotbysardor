import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { LoginForm } from "./login-form";
import { Monogram } from "@/components/brand/Monogram";

export default async function AdminIndexPage() {
  const s = await getAdminSession();
  if (s.loggedIn) {
    const currentVersion = (await getSetting("admin.sessionVersion").catch(() => 1)) as number;
    if ((s.v ?? 0) === currentVersion) {
      redirect("/admin/boshqaruv");
    }
    // Eskirgan sessiya — cookie'ni route handler tozalaydi (server component cookie yoza olmaydi).
    redirect("/api/admin/logout");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-8 w-full max-w-sm">
        <Monogram size={64} brass />
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="font-display text-2xl">Admin panel</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Davom etish uchun login va parolingizni kiriting.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
