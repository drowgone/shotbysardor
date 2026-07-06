import { Header } from "./Header";
import { Footer } from "./Footer";
import { ContentProtection } from "@/components/ContentProtection";
import { NotificationPoller } from "@/components/notifications/NotificationPoller";
import { CookieConsent } from "@/components/consent/CookieConsent";
import { getSetting } from "@/lib/settings";

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const [socials, screenshotGuard, protection] = await Promise.all([
    getSetting("site.socials", { instagram: "shotbysardor", telegram: "", phone: "", email: "" }),
    getSetting("security.screenshotGuard", true),
    getSetting("security.protection", {
      rightClick: true,
      dragDrop: true,
      textSelect: true,
      copy: true,
      save: true,
      devTools: true,
      printScreen: true,
    }),
  ]);
  return (
    <div className="min-h-screen flex flex-col">
      <ContentProtection flags={protection} screenshotGuard={screenshotGuard} />
      <NotificationPoller />
      <Header instagramHandle={socials.instagram} />
      <main className="flex-1">{children}</main>
      <Footer instagram={socials.instagram} telegram={socials.telegram || undefined} />
      <CookieConsent />
    </div>
  );
}
