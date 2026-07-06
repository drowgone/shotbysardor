import { prisma } from "@/lib/db";
import { getAllSettings } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const [settings, genres, locations, heroContents] = await Promise.all([
    getAllSettings(),
    prisma.genre.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { contents: true } } },
    }),
    prisma.location.findMany({
      orderBy: [{ usageCount: "desc" }, { name: "asc" }],
      select: { id: true, name: true, _count: { select: { contents: true } } },
    }),
    prisma.content.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        thumbKey: true,
        capturedAt: true,
        featured: true,
        genres: { select: { name: true }, orderBy: { name: "asc" } },
        location: { select: { name: true } },
      },
    }),
  ]);
  const safe = { ...settings } as Partial<typeof settings>;
  delete safe["admin.passwordHash"];
  const st = storage();
  return (
    <div>
      <header className="mb-6">
        <h1 className="h2">Sozlamalar</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Sayt tashqi ko'rinishi, kontent taksonomiyasi, to'lov, xavfsizlik va boshqa
          konfiguratsiyalar. O'zgarishlar sahifa pastidagi «Saqlash» tugmasi bosilganda kuchga
          kiradi.
        </p>
      </header>
      <SettingsView
        initial={safe}
        initialGenres={genres.map((g) => ({ id: g.id, name: g.name, usage: g._count.contents }))}
        initialLocations={locations.map((l) => ({ id: l.id, name: l.name, usage: l._count.contents }))}
        heroContents={heroContents.map((c) => ({
          id: c.id,
          title: c.title,
          slug: c.slug,
          type: c.type,
          featured: c.featured,
          thumbUrl: st.publicUrl(c.thumbKey),
          capturedAt: c.capturedAt.toISOString(),
          genre: c.genres.map((g) => g.name).join(", ") || null,
          location: c.location?.name ?? null,
        }))}
      />
    </div>
  );
}
