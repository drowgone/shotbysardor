import { NextRequest } from "next/server";
import { apiError, ok, requireAdmin, checkCsrf } from "@/lib/api";
import { prisma } from "@/lib/db";
import { slugify, normalizeName } from "@/lib/utils";
import { emit } from "@/lib/live/bus";

export async function GET() {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  const items = await prisma.genre.findMany({ orderBy: { name: "asc" } });
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");
  const { name } = (await req.json()) as { name: string };
  const normalized = normalizeName(name ?? "");
  if (!normalized) return apiError(400, "empty", "Nom bo'sh");
  const created = await prisma.genre.upsert({
    where: { name: normalized },
    create: { name: normalized, slug: slugify(normalized) },
    update: {},
  });
  emit("taxonomy", { action: "genre.create", id: created.id });
  return ok({ item: created });
}
