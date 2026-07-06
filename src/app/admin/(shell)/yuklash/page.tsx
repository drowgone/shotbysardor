import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { UploadForm } from "./upload-form";

export default async function UploadPage() {
  const [genres, locations, defaultPrice] = await Promise.all([
    prisma.genre.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: [{ usageCount: "desc" }, { lastUsedAt: "desc" }], take: 5 }),
    getSetting("order.defaultPriceUZS"),
  ]);

  return (
    <div>
      <h1 className="h2 mb-6">Yuklash</h1>
      <UploadForm
        initialGenres={genres.map((g) => ({ id: g.id, name: g.name }))}
        recentLocations={locations.map((l) => l.name)}
        defaultPriceUZS={defaultPrice}
      />
    </div>
  );
}
