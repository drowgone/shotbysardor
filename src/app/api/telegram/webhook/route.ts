import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import {
  tgAnswerCallback,
  tgEditMessageCaption,
  tgEditMessageText,
  tgSendMessage,
} from "@/lib/telegram";
import { emit } from "@/lib/live/bus";

export const runtime = "nodejs";

// Rad etish sababini kutayotgan buyurtmalar (per admin chat).
// Server qayta ishga tushganda tozalanadi — v1 uchun kifoya.
const pendingRejects = new Map<string, { orderId: string; askMsgId: number }>();

type TgUpdate = {
  update_id: number;
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    data?: string;
    message?: {
      message_id: number;
      chat: { id: number };
      caption?: string;
      text?: string;
    };
  };
  message?: {
    message_id: number;
    from: { id: number };
    chat: { id: number };
    text?: string;
    reply_to_message?: { message_id: number };
  };
};

export async function POST(req: NextRequest) {
  const tg = await getSetting("order.telegram");
  if (!tg.enabled || !tg.botToken) {
    return new Response("disabled", { status: 200 });
  }
  // Xavfsizlik — secret token headerini tekshirish (Telegram yuboradi).
  // MUHIM: agar `webhookSecret` sozlanmagan bo'lsa — webhook'ni butunlay yopamiz,
  // aks holda har kim so'rov yuborib buyurtmalarni tasdiqlashi/rad etishi mumkin.
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!tg.webhookSecret || secret !== tg.webhookSecret) {
    return new Response("bad secret", { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return new Response("bad body", { status: 400 });
  }

  try {
    if (update.callback_query) await handleCallback(tg, update.callback_query);
    else if (update.message) await handleMessage(tg, update.message);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[telegram] webhook handler fail:", e);
  }

  return new Response("ok", { status: 200 });
}

async function handleCallback(
  tg: { botToken: string; chatId: string; webhookSecret: string },
  cq: NonNullable<TgUpdate["callback_query"]>,
) {
  const data = cq.data ?? "";
  const [action, orderId] = data.split(":");
  const chatId = cq.message?.chat.id ?? Number(tg.chatId);

  if (!orderId) {
    await tgAnswerCallback(tg.botToken, cq.id, "Noto'g'ri callback");
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { content: true },
  });
  if (!order) {
    await tgAnswerCallback(tg.botToken, cq.id, "Buyurtma topilmadi");
    return;
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (action === "approve") {
    if (order.status !== "PENDING") {
      await tgAnswerCallback(tg.botToken, cq.id, `Holat: ${order.status}`);
      return;
    }
    const ttl = await getSetting("order.linkTtlHours");
    const max = await getSetting("order.maxDownloads");
    const now = new Date();
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "APPROVED",
        approvedAt: now,
        expiresAt: new Date(now.getTime() + ttl * 60 * 60 * 1000),
        maxDownloads: max,
        rejectReason: null,
      },
    });

    emit("orders", { action: "approve", id: updated.id, token: updated.token });
    emit(`orders:${updated.token}`, { action: "approve", id: updated.id });
    emit("stats", { action: "orders.approve" });

    const url = `${site}/order/${updated.token}`;
    await tgAnswerCallback(tg.botToken, cq.id, "Tasdiqlandi");
    if (cq.message) {
      const newCap = `${cq.message.caption ?? cq.message.text ?? ""}\n\n<b>✓ TASDIQLANDI</b>`;
      if (cq.message.caption !== undefined) {
        await tgEditMessageCaption(tg.botToken, chatId, cq.message.message_id, newCap, { parseMode: "HTML" });
      } else {
        await tgEditMessageText(tg.botToken, chatId, cq.message.message_id, newCap, { parseMode: "HTML" });
      }
    }
    await tgSendMessage(
      tg.botToken,
      String(chatId),
      `Havola (${ttl} soat, ${max} yuklab olish):\n<code>${url}</code>\n\nNusxa olish uchun havolani bosib turing.`,
      { parseMode: "HTML" },
    );
    return;
  }

  if (action === "reject") {
    if (order.status !== "PENDING") {
      await tgAnswerCallback(tg.botToken, cq.id, `Holat: ${order.status}`);
      return;
    }
    await tgAnswerCallback(tg.botToken, cq.id, "Sababni yozing");
    const ask = await tgSendMessage(
      tg.botToken,
      String(chatId),
      `Rad etish sababini yozing (buyurtma #${order.code}):`,
      { keyboard: { force_reply: true, selective: true } },
    );
    const msgId = (ask.result as { message_id?: number } | undefined)?.message_id ?? 0;
    pendingRejects.set(String(cq.from.id), { orderId, askMsgId: msgId });
    return;
  }

  await tgAnswerCallback(tg.botToken, cq.id, "Noma'lum amal");
}

async function handleMessage(
  tg: { botToken: string; chatId: string },
  msg: NonNullable<TgUpdate["message"]>,
) {
  if (!msg.text) return;

  // Rad etish sababi kutilyaptimi?
  const key = String(msg.from.id);
  const pending = pendingRejects.get(key);
  if (!pending) {
    // /start yoki boshqa xabarlar — ignor
    if (msg.text.startsWith("/start")) {
      await tgSendMessage(tg.botToken, String(msg.chat.id), "Bot ulangan. Yangi buyurtmalar bu yerga tushadi.");
    }
    return;
  }

  // Reply to ask message OR direct text — ikkalasini ham qabul qilamiz
  if (msg.reply_to_message && msg.reply_to_message.message_id !== pending.askMsgId) {
    return; // boshqa xabarga javob
  }

  const reason = msg.text.trim().slice(0, 500);
  const updated = await prisma.order.update({
    where: { id: pending.orderId },
    data: { status: "REJECTED", rejectReason: reason },
  });
  pendingRejects.delete(key);

  emit("orders", { action: "reject", id: updated.id, token: updated.token });
  emit(`orders:${updated.token}`, { action: "reject", id: updated.id });
  emit("stats", { action: "orders.reject" });

  await tgSendMessage(
    tg.botToken,
    String(msg.chat.id),
    `Buyurtma rad etildi.\nSabab: ${reason}`,
    { replyTo: msg.message_id },
  );
}
