import { PublicShell } from "@/components/layout/PublicShell";
import { PageTracker } from "@/components/PageTracker";
import { getSetting } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { AboutContent } from "./about-content";
import { LiveRefresh } from "@/lib/live/live-refresh";

export const revalidate = 300;
export const dynamic = "force-dynamic";

async function getStats(): Promise<{
  photos: number;
  locations: number;
  genres: number;
  sinceYear: number | null;
}> {
  try {
    const [photos, locations, genres, earliest] = await Promise.all([
      prisma.content.count({ where: { status: "PUBLISHED" } }),
      prisma.location.count({ where: { contents: { some: { status: "PUBLISHED" } } } }),
      prisma.genre.count({ where: { contents: { some: { status: "PUBLISHED" } } } }),
      prisma.content.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { capturedAt: "asc" },
        select: { capturedAt: true },
      }),
    ]);
    return {
      photos,
      locations,
      genres,
      sinceYear: earliest ? new Date(earliest.capturedAt).getFullYear() : null,
    };
  } catch {
    return { photos: 0, locations: 0, genres: 0, sinceYear: null };
  }
}

export default async function AboutPage() {
  const [bio, tagline, socials, portraitKey, stats] = await Promise.all([
    getSetting("site.bio"),
    getSetting("site.tagline"),
    getSetting("site.socials"),
    getSetting("site.aboutPortraitKey"),
    getStats(),
  ]);
  const portraitUrl = portraitKey ? storage().publicUrl(portraitKey) : null;
  return (
    <PublicShell>
      <LiveRefresh topics={["settings", "contents", "taxonomy"]} />
      <PageTracker />
      <AboutContent
        bio={bio}
        tagline={tagline}
        socials={socials}
        stats={stats}
        portraitUrl={portraitUrl}
      />
    </PublicShell>
  );
}
