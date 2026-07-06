// Telegram Bot API — buyurtma bildirishnomasi + tasdiqlash/rad etish.
// Faqat sozlamalarda `enabled=true` bo'lsa ishlaydi.

type TgResponse<T = unknown> = { ok: boolean; result?: T; description?: string };

async function tgFetch(botToken: string, method: string, body: unknown): Promise<TgResponse> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as TgResponse;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[telegram] ${method} fail:`, e);
    return { ok: false, description: e instanceof Error ? e.message : String(e) };
  }
}

async function tgMultipart(botToken: string, method: string, form: FormData): Promise<TgResponse> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      body: form,
    });
    return (await res.json()) as TgResponse;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[telegram] ${method} multipart fail:`, e);
    return { ok: false, description: e instanceof Error ? e.message : String(e) };
  }
}

export async function tgGetMe(botToken: string) {
  return tgFetch(botToken, "getMe", {});
}

export async function tgSendMessage(
  botToken: string,
  chatId: string,
  text: string,
  opts?: { parseMode?: "HTML" | "Markdown"; keyboard?: unknown; replyTo?: number },
) {
  return tgFetch(botToken, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: opts?.parseMode,
    reply_markup: opts?.keyboard,
    reply_to_message_id: opts?.replyTo,
  });
}

export async function tgSendPhoto(
  botToken: string,
  chatId: string,
  photo: Buffer | string, // Buffer bo'lsa upload, string bo'lsa URL
  caption: string,
  opts?: { parseMode?: "HTML" | "Markdown"; keyboard?: unknown },
) {
  if (typeof photo === "string") {
    return tgFetch(botToken, "sendPhoto", {
      chat_id: chatId,
      photo,
      caption,
      parse_mode: opts?.parseMode,
      reply_markup: opts?.keyboard,
    });
  }
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("caption", caption);
  if (opts?.parseMode) form.set("parse_mode", opts.parseMode);
  if (opts?.keyboard) form.set("reply_markup", JSON.stringify(opts.keyboard));
  form.set("photo", new Blob([new Uint8Array(photo)], { type: "image/jpeg" }), "receipt.jpg");
  return tgMultipart(botToken, "sendPhoto", form);
}

export async function tgEditMessageCaption(
  botToken: string,
  chatId: string | number,
  messageId: number,
  caption: string,
  opts?: { parseMode?: "HTML" | "Markdown" },
) {
  return tgFetch(botToken, "editMessageCaption", {
    chat_id: chatId,
    message_id: messageId,
    caption,
    parse_mode: opts?.parseMode,
    reply_markup: { inline_keyboard: [] },
  });
}

export async function tgEditMessageText(
  botToken: string,
  chatId: string | number,
  messageId: number,
  text: string,
  opts?: { parseMode?: "HTML" | "Markdown" },
) {
  return tgFetch(botToken, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: opts?.parseMode,
    reply_markup: { inline_keyboard: [] },
  });
}

export async function tgAnswerCallback(botToken: string, callbackId: string, text?: string) {
  return tgFetch(botToken, "answerCallbackQuery", {
    callback_query_id: callbackId,
    text,
    show_alert: false,
  });
}

export async function tgSetWebhook(botToken: string, url: string, secretToken: string) {
  return tgFetch(botToken, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["callback_query", "message"],
    drop_pending_updates: true,
  });
}

export async function tgDeleteWebhook(botToken: string) {
  return tgFetch(botToken, "deleteWebhook", { drop_pending_updates: true });
}

// Order bildirishnomasini yuborish (asosiy foydalanuvchi API)
export async function sendOrderToTelegram(opts: {
  botToken: string;
  chatId: string;
  orderId: string;
  code: string;
  customerName: string;
  contact: string;
  note: string | null;
  priceUZS: number;
  title: string;
  contentPreviewUrl: string; // to'liq URL (siteURL + path)
  receiptBuffer: Buffer | null;
}) {
  const caption = buildOrderCaption(opts);
  // Telegram inline URL tugmalari faqat https:// qabul qiladi.
  // Lokal (localhost, http) bo'lsa URL tugmasini o'tkazib yuboramiz.
  const isPublicHttps = /^https:\/\//i.test(opts.contentPreviewUrl);
  const keyboard: { inline_keyboard: { text: string; callback_data?: string; url?: string }[][] } = {
    inline_keyboard: [
      [
        { text: "✓ Tasdiqlash", callback_data: `approve:${opts.orderId}` },
        { text: "✕ Rad etish", callback_data: `reject:${opts.orderId}` },
      ],
    ],
  };
  if (isPublicHttps) {
    keyboard.inline_keyboard.push([{ text: "Rasm sahifasi", url: opts.contentPreviewUrl }]);
  }

  // Chek bor bo'lsa — sendPhoto (caption bilan), aks holda sendMessage
  const res = opts.receiptBuffer
    ? await tgSendPhoto(opts.botToken, opts.chatId, opts.receiptBuffer, caption, {
        parseMode: "HTML",
        keyboard,
      })
    : await tgSendMessage(opts.botToken, opts.chatId, caption, {
        parseMode: "HTML",
        keyboard,
      });

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error(`[telegram] sendOrder API rad etildi: ${res.description ?? "noma'lum"}`);
  }
  return res;
}

function esc(s: string) {
  // Unicode BiDi/format belgilari mijoz kiritgan matnda xavfli — Telegram xabarini
  // buzib ko'rsatishi mumkin. U+202A..202E, U+2066..2069 (isolates), U+2028/U+2029,
  // U+200B..200D (zero-width), U+FEFF (BOM) — barchasini olib tashlaymiz.
  const stripped = s.replace(/[\u202a-\u202e\u2066-\u2069\u2028\u2029\u200b-\u200d\ufeff]/g, "");
  // HTML mode uchun barcha xavfli belgilar: & < > " '
  return stripped.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]!));
}

function buildOrderCaption(o: {
  code: string;
  customerName: string;
  contact: string;
  note: string | null;
  priceUZS: number;
  title: string;
  contentPreviewUrl: string;
}): string {
  const priceTxt = o.priceUZS > 0 ? `${o.priceUZS.toLocaleString("uz-UZ")} so'm` : "Kelishilgan holda";
  const lines = [
    `<b>Yangi buyurtma</b>  <code>#${esc(o.code)}</code>`,
    ``,
    `<b>Mahsulot:</b> ${esc(o.title)}`,
    `<b>Mijoz:</b> ${esc(o.customerName)}`,
    `<b>Aloqa:</b> <code>${esc(o.contact)}</code>`,
    `<b>Narx:</b> ${esc(priceTxt)}`,
  ];
  if (o.note) lines.push(`<b>Izoh:</b> ${esc(o.note)}`);
  // HTTPS bo'lsa clickable havola, aks holda oddiy matn (Telegram lokal href'ni rad qiladi)
  const isPublicHttps = /^https:\/\//i.test(o.contentPreviewUrl);
  lines.push(``);
  if (isPublicHttps) {
    lines.push(`<a href="${esc(o.contentPreviewUrl)}">Kontent sahifasi</a>`);
  } else {
    lines.push(`Sahifa: <code>${esc(o.contentPreviewUrl)}</code>`);
  }
  return lines.join("\n");
}

// Yangi qurilma bilan admin panelga kirilganida telegram'ga xabar yuborish.
// Bot ulanmagan yoki chatId bo'sh bo'lsa — jimjimador o'tkazamiz.
export async function notifyNewDeviceLogin(input: {
  username: string;
  deviceLabel: string;
  ipDisplay: string;
  country: string | null;
  city: string | null;
  when: Date;
}): Promise<void> {
  try {
    // Dynamic import — telegram.ts ni settings.ts bilan sirkular import qilmaslik uchun.
    const { getSetting } = await import("./settings");
    const tg = await getSetting("order.telegram");
    if (!tg?.enabled || !tg.botToken || !tg.chatId) return;

    const loc = [input.city, input.country].filter(Boolean).join(", ") || "Noma'lum";
    const timeStr = input.when.toLocaleString("uz-UZ", {
      timeZone: "Asia/Tashkent",
      dateStyle: "short",
      timeStyle: "short",
    });
    const text = [
      `<b>⚠️ Yangi qurilma orqali kirish</b>`,
      ``,
      `<b>Foydalanuvchi:</b> <code>${esc(input.username)}</code>`,
      `<b>Qurilma:</b> ${esc(input.deviceLabel)}`,
      `<b>IP:</b> <code>${esc(input.ipDisplay)}</code>`,
      `<b>Joylashuv:</b> ${esc(loc)}`,
      `<b>Vaqt:</b> ${esc(timeStr)}`,
      ``,
      `Agar bu siz bo'lmasangiz — <b>parolni darhol o'zgartiring</b> va admin sozlamalari → Seanslar bo'limidan bu qurilmani chiqarib tashlang.`,
    ].join("\n");

    await tgSendMessage(tg.botToken, tg.chatId, text, { parseMode: "HTML" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[telegram] notifyNewDeviceLogin failed:", err);
  }
}
