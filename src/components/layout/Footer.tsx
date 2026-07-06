import Link from "next/link";
import { Instagram, Send } from "lucide-react";
import { Monogram } from "@/components/brand/Monogram";
import { uz } from "@/lib/i18n/uz";

export function Footer({
  instagram,
  telegram,
}: {
  instagram?: string;
  telegram?: string;
}) {
  return (
    <footer className="border-t border-[var(--border)] mt-24">
      <div className="mx-auto px-3 md:px-4 lg:px-6 py-8 flex flex-col md:flex-row items-center gap-4 md:justify-between">
        <div className="flex items-center gap-3">
          <Monogram size={28} />
          <span className="text-sm text-[var(--text-muted)]">{uz.common.copyright}</span>
        </div>
        <div className="meta text-center">
          {uz.common.allRights} · {uz.protection.footer}
        </div>
        <div className="flex items-center gap-4 text-[var(--text-muted)]">
          {instagram && (
            <a
              href={`https://instagram.com/${instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="hover:text-[var(--accent)]"
            >
              <Instagram size={20} strokeWidth={1.5} />
            </a>
          )}
          {telegram && (
            <a
              href={`https://t.me/${telegram}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="hover:text-[var(--accent)]"
            >
              <Send size={20} strokeWidth={1.5} />
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
