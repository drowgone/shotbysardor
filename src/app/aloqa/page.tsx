import { PublicShell } from "@/components/layout/PublicShell";
import { PageTracker } from "@/components/PageTracker";
import { getSetting } from "@/lib/settings";
import { ContactContent } from "./contact-content";
import { LiveRefresh } from "@/lib/live/live-refresh";

export const revalidate = 300;
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const socials = await getSetting("site.socials");
  return (
    <PublicShell>
      <LiveRefresh topics={["settings"]} />
      <PageTracker />
      <ContactContent socials={socials} />
    </PublicShell>
  );
}
