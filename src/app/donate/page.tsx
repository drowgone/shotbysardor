import { PublicShell } from "@/components/layout/PublicShell";
import { PageTracker } from "@/components/PageTracker";
import { getSetting } from "@/lib/settings";
import { DonateContent } from "./donate-content";
import { LiveRefresh } from "@/lib/live/live-refresh";

export const revalidate = 300;
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Qo'llab-quvvatlash",
  description: "Sardor ijodini qo'llab-quvvatlang — Karta, Payme yoki Click orqali.",
};

export default async function DonatePage() {
  const [enabled, title, description, thankYou, payment, suggestedAmounts] = await Promise.all([
    getSetting("donate.enabled"),
    getSetting("donate.title"),
    getSetting("donate.description"),
    getSetting("donate.thankYou"),
    // Donate ham buyurtma bilan bir xil to'lov ma'lumotlaridan foydalanadi
    getSetting("order.paymentDetails"),
    getSetting("donate.suggestedAmounts"),
  ]);
  return (
    <PublicShell>
      <LiveRefresh topics={["settings"]} />
      <PageTracker />
      <DonateContent
        enabled={enabled}
        title={title}
        description={description}
        thankYou={thankYou}
        payment={payment}
        suggestedAmounts={suggestedAmounts}
      />
    </PublicShell>
  );
}
