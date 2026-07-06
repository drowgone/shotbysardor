import { NextRequest } from "next/server";
import { apiError, ok, requireAdmin, checkCsrf } from "@/lib/api";
import { prisma } from "@/lib/db";
import { normalizeName, slugify } from "@/lib/utils";
import { emit } from "@/lib/live/bus";

export async function POST(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");
  if (!checkCsrf(req, s.csrf)) return apiError(403, "csrf", "CSRF");

  const [genres, locations] = await Promise.all([
    prisma.genre.findMany({ select: { id: true, name: true } }),
    prisma.location.findMany({ select: { id: true, name: true, usageCount: true } }),
  ]);

  let genreRenamed = 0;
  let genreMerged = 0;
  let locRenamed = 0;
  let locMerged = 0;

  for (const g of genres) {
    const normalized = normalizeName(g.name);
    if (!normalized || normalized === g.name) continue;
    const existing = genres.find((x) => x.id !== g.id && x.name === normalized);
    if (existing) {
      await prisma.$transaction(async (tx) => {
        // M2M merge: dublikat janrga ulangan kontentlarni "existing"ga o'tkazamiz.
        const linked = await tx.content.findMany({
          where: { genres: { some: { id: g.id } } },
          select: { id: true },
        });
        for (const c of linked) {
          await tx.content.update({
            where: { id: c.id },
            data: { genres: { disconnect: [{ id: g.id }], connect: [{ id: existing.id }] } },
          });
        }
        await tx.genre.delete({ where: { id: g.id } });
      });
      existing.name = existing.name;
      genreMerged++;
    } else {
      await prisma.genre.update({
        where: { id: g.id },
        data: { name: normalized, slug: slugify(normalized) },
      });
      g.name = normalized;
      genreRenamed++;
    }
  }

  for (const l of locations) {
    const normalized = normalizeName(l.name);
    if (!normalized || normalized === l.name) continue;
    const existing = locations.find((x) => x.id !== l.id && x.name === normalized);
    if (existing) {
      await prisma.$transaction(async (tx) => {
        await tx.content.updateMany({ where: { locationId: l.id }, data: { locationId: existing.id } });
        await tx.location.update({
          where: { id: existing.id },
          data: { usageCount: { increment: l.usageCount }, lastUsedAt: new Date() },
        });
        await tx.location.delete({ where: { id: l.id } });
      });
      locMerged++;
    } else {
      await prisma.location.update({
        where: { id: l.id },
        data: { name: normalized, slug: slugify(normalized) },
      });
      l.name = normalized;
      locRenamed++;
    }
  }

  if (genreRenamed + genreMerged + locRenamed + locMerged > 0) {
    emit("taxonomy", { action: "normalize", meta: { genreRenamed, genreMerged, locRenamed, locMerged } });
    emit("contents", { action: "taxonomy.normalize" });
  }

  return ok({
    ok: true,
    stats: { genreRenamed, genreMerged, locRenamed, locMerged },
  });
}
