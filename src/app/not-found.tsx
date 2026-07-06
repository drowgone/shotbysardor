import Link from "next/link";
import { PublicShell } from "@/components/layout/PublicShell";
import { uz } from "@/lib/i18n/uz";

export default function NotFound() {
  return (
    <PublicShell>
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 py-24">
        <div className="w-20 h-20 relative">
          <span className="absolute top-0 left-0 w-5 h-5 border-l-2 border-t-2 border-[var(--text-faint)]" />
          <span className="absolute top-0 right-0 w-5 h-5 border-r-2 border-t-2 border-[var(--text-faint)]" />
          <span className="absolute bottom-0 left-0 w-5 h-5 border-l-2 border-b-2 border-[var(--text-faint)]" />
          <span className="absolute bottom-0 right-0 w-5 h-5 border-r-2 border-b-2 border-[var(--text-faint)]" />
        </div>
        <div className="display-1">404</div>
        <div className="text-[var(--text-muted)]">{uz.states.empty}</div>
        <Link href="/" className="h-11 px-4 rounded-[var(--r-control)] bg-[var(--accent)] text-[var(--on-accent)] font-medium inline-flex items-center">
          Galereyaga qaytish
        </Link>
      </div>
    </PublicShell>
  );
}
