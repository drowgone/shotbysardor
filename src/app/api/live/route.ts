import type { NextRequest } from "next/server";
import { bus, BUS_EVENT, type LiveEvent } from "@/lib/live/bus";
import { isAdminOnlyFilter, matchesFilter } from "@/lib/live/topics";
import { getAdminSession } from "@/lib/session";

// SSE (Server-Sent Events) — bir tomonlama server → client kanal. HTTP orqali ishlaydi,
// alohida socket server kerak emas. Cookie'lar avtomatik jo'natiladi.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bitta ulanish uchun cheklovlar — himoya sifatida.
const MAX_TOPICS_PER_CONN = 32;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("topics") ?? "";
  const requested = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_TOPICS_PER_CONN);

  const session = await getAdminSession();
  const isAdmin = !!session.loggedIn;

  // Admin bo'lmagan tinglovchi admin-only filtrlarni so'rasa — o'sha filtrni tashlab yuboramiz,
  // ulanishni buzmaymiz. UI hech qachon kutilmaganda buzilmaydi.
  const filters = requested.filter((f) => isAdmin || !isAdminOnlyFilter(f));

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // Client uchun default retry — tarmoq uzilsa 3 soniyada qayta ulanish.
      write(`retry: 3000\n\n`);
      // Salom xabari — client ulanganini bilishi va topiclar ro'yxatini tekshirishi uchun.
      write(
        `event: hello\ndata: ${JSON.stringify({
          ts: Date.now(),
          topics: filters,
          role: isAdmin ? "admin" : "public",
        })}\n\n`,
      );

      const handler = (ev: LiveEvent) => {
        if (!filters.some((f) => matchesFilter(ev.topic, f))) return;
        // Barcha xabarlar bitta 'live' nomi ostida — client filtrni data.topic bo'yicha qiladi.
        write(`event: live\ndata: ${JSON.stringify(ev)}\n\n`);
      };
      bus.on(BUS_EVENT, handler);

      // Proxy'lar (Nginx, Cloudflare) uzoq bo'sh ulanishlarni yopadi. 15s'da bir ping —
      // hech kim hech nima bilmaydi, ping SSE-comment sifatida yuboriladi.
      const ping = setInterval(() => {
        write(`: ping ${Date.now()}\n\n`);
      }, 15_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        bus.off(BUS_EVENT, handler);
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      // Client tab yopilganda / navigatsiya qilganda — abort keladi.
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Nginx'ni buffering'dan ushlab turadi.
      "X-Accel-Buffering": "no",
    },
  });
}
