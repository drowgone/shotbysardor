import { NextRequest } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { apiError, ok, requireAdmin, checkCsrf, zodErrorMessage } from "@/lib/api";
import { getSetting, setSetting } from "@/lib/settings";
import { getAdminSession } from "@/lib/session";
import { clearFail } from "@/lib/rate-limit";
import { emit } from "@/lib/live/bus";

const schema = z.object({
  current: z.string().min(1),
  next: z.string().min(8, "Yangi parol kamida 8 belgi bo'lsin"),
});

export async function POST(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(400, "validation", zodErrorMessage(parsed.error));
  const cur = await getSetting("admin.passwordHash");
  const valid = await argon2.verify(cur, parsed.data.current).catch(() => false);
  if (!valid) return apiError(401, "invalid_current", "Joriy parol noto'g'ri");
  const nextHash = await argon2.hash(parsed.data.next, { type: argon2.argon2id });
  await setSetting("admin.passwordHash", nextHash);
  await setSetting("admin.credentialsUpdatedAt", new Date().toISOString());

  // Sessiya versiyasini oshiramiz — boshqa cookie'lar yaroqsiz.
  const currentVersion = (await getSetting("admin.sessionVersion").catch(() => 1)) as number;
  const nextVersion = (typeof currentVersion === "number" ? currentVersion : 1) + 1;
  await setSetting("admin.sessionVersion", nextVersion);

  const username = ((await getSetting("admin.username").catch(() => "admin")) || "admin").toLowerCase();
  clearFail(`login:user:${username}`);
  clearFail("login:global");

  const session = await getAdminSession();
  session.v = nextVersion;
  await session.save();

  emit("admin", { action: "password.update" });
  return ok({ ok: true });
}
