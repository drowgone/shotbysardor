import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, ok, requireAdmin, checkCsrf } from "@/lib/api";
import { getSetting, setSetting } from "@/lib/settings";
import { randomId } from "@/lib/utils";
import { tgGetMe, tgSendMessage, tgSetWebhook, tgDeleteWebhook } from "@/lib/telegram";
import { emit } from "@/lib/live/bus";

const connectSchema = z.object({
  botToken: z.string().min(20),
  chatId: z.string().min(1),
});

// POST /api/admin/telegram { action: "connect" | "test" | "disconnect" }
export async function POST(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");

  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  if (!body?.action) return apiError(400, "no_action", "Amal ko'rsatilmagan");

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  if (body.action === "connect") {
    const parsed = connectSchema.safeParse(body);
    if (!parsed.success) return apiError(400, "validation", "Bot token yoki chat ID noto'g'ri");
    const { botToken, chatId } = parsed.data;

    // Bot mavjudligini tekshirish
    const me = await tgGetMe(botToken);
    if (!me.ok) return apiError(400, "bad_token", me.description ?? "Bot token noto'g'ri");

    const webhookSecret = randomId(24);

    // Webhookni o'rnatishga urinamiz (agar sayt HTTPS da bo'lsa)
    let webhookNote = "Webhook o'rnatilmadi — production URL kerak";
    if (/^https:\/\//.test(site)) {
      const wh = await tgSetWebhook(botToken, `${site}/api/telegram/webhook`, webhookSecret);
      if (wh.ok) webhookNote = "Webhook muvaffaqiyatli o'rnatildi";
      else webhookNote = `Webhook xato: ${wh.description ?? "noma'lum"}`;
    }

    await setSetting("order.telegram", { enabled: true, botToken, chatId, webhookSecret });

    // Sinov xabari
    await tgSendMessage(botToken, chatId, `Bot ulandi.\n${webhookNote}`).catch(() => {});

    emit("settings", { action: "telegram.connect" });
    return ok({ ok: true, bot: me.result, note: webhookNote });
  }

  if (body.action === "test") {
    const cur = await getSetting("order.telegram");
    if (!cur.enabled || !cur.botToken || !cur.chatId) return apiError(400, "not_configured", "Bot ulanmagan");
    const r = await tgSendMessage(cur.botToken, cur.chatId, "Sinov xabari — bot ishlayapti.");
    if (!r.ok) return apiError(500, "send_fail", r.description ?? "Xabar yuborilmadi");
    return ok({ ok: true });
  }

  if (body.action === "disconnect") {
    const cur = await getSetting("order.telegram");
    if (cur.botToken) await tgDeleteWebhook(cur.botToken).catch(() => {});
    await setSetting("order.telegram", { enabled: false, botToken: "", chatId: "", webhookSecret: "" });
    emit("settings", { action: "telegram.disconnect" });
    return ok({ ok: true });
  }

  return apiError(400, "bad_action", "Noma'lum amal");
}
