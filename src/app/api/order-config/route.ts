import { ok } from "@/lib/api";
import { getSetting } from "@/lib/settings";

export async function GET() {
  const payment = await getSetting("order.paymentDetails");
  const ttl = await getSetting("order.linkTtlHours");
  const max = await getSetting("order.maxDownloads");
  const defaultPrice = await getSetting("order.defaultPriceUZS");
  return ok({ payment, ttl, max, defaultPrice });
}
