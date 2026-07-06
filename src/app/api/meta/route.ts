import { ok } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  const [genres, locations, years] = await Promise.all([
    prisma.genre.findMany({
      where: { contents: { some: { status: "PUBLISHED" } } },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      where: { contents: { some: { status: "PUBLISHED" } } },
      orderBy: [{ usageCount: "desc" }, { name: "asc" }],
    }),
    prisma.content.findMany({
      where: { status: "PUBLISHED" },
      select: { capturedAt: true },
    }),
  ]);
  const yearSet = new Set<number>();
  for (const c of years) yearSet.add(new Date(c.capturedAt).getFullYear());
  return ok({
    genres: genres.map((g) => ({ name: g.name, slug: g.slug })),
    locations: locations.map((l) => ({ name: l.name, slug: l.slug })),
    years: [...yearSet].sort((a, b) => b - a),
  });
}
