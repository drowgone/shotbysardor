import { apiError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

// Sahifa nomlari — /admin/izohlar da guruh sarlavhalari uchun.
const PAGE_LABELS: Record<string, { title: string; href: string }> = {
  donate: { title: "Qo'llab-quvvatlash sahifasi", href: "/donate" },
};

// Faqat izohi bor kontentlar + sahifalar — guruhlangan.
// Har bir guruh {content} yoki {page} discriminator'iga ega — client shu asosda link chizadi.
export async function GET() {
  const s = await requireAdmin();
  if (!s) return apiError(401, "unauthorized", "Kirish");

  const [grouped, pageComments] = await Promise.all([
    prisma.content.findMany({
      where: { comments: { some: { parentId: null } } },
      include: {
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { replies: { orderBy: { createdAt: "asc" } } },
        },
        _count: {
          select: { comments: { where: { status: "PENDING", parentId: null } } },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.comment.findMany({
      where: { page: { not: null }, parentId: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { replies: { orderBy: { createdAt: "asc" } } },
    }),
  ]);

  const st = storage();
  type CommentRow = {
    id: string;
    name: string;
    text: string;
    imageKey: string | null;
    status: "PENDING" | "APPROVED";
    createdAt: Date;
    isAdmin: boolean;
    likesCount: number;
  };
  const shape = (cm: CommentRow) => ({
    id: cm.id,
    name: cm.name,
    text: cm.text,
    imageUrl: cm.imageKey ? st.publicUrl(cm.imageKey) : null,
    status: cm.status,
    createdAt: cm.createdAt.toISOString(),
    isAdmin: cm.isAdmin,
    likesCount: cm.likesCount,
  });

  // Kontent izohlarini guruhlash
  const contentGroups = grouped.map((c) => ({
    kind: "content" as const,
    content: {
      id: c.id,
      slug: c.slug,
      title: c.title,
      thumbUrl: st.publicUrl(c.thumbKey),
      href: `/p/${c.slug}`,
    },
    comments: c.comments.map((cm) => ({
      ...shape(cm),
      replies: cm.replies.map(shape),
    })),
    pendingCount: c._count.comments,
  }));

  // Sahifa izohlarini page bo'yicha guruhlash.
  const byPage = new Map<string, typeof pageComments>();
  for (const c of pageComments) {
    const p = c.page as string;
    const arr = byPage.get(p) ?? [];
    arr.push(c);
    byPage.set(p, arr);
  }
  const pageGroups = [...byPage.entries()].map(([page, list]) => {
    const meta = PAGE_LABELS[page] ?? { title: page, href: `/${page}` };
    return {
      kind: "page" as const,
      content: {
        id: `page:${page}`,
        slug: page,
        title: meta.title,
        thumbUrl: "",
        href: meta.href,
      },
      comments: list.map((cm) => ({
        ...shape(cm),
        replies: cm.replies.map(shape),
      })),
      pendingCount: list.filter((c) => c.status === "PENDING").length,
    };
  });

  // Ikkalasini birlashtirib, oxirgi yangilangan tepaga.
  const items = [...contentGroups, ...pageGroups].sort((a, b) => {
    const at = a.comments[0]?.createdAt ?? "";
    const bt = b.comments[0]?.createdAt ?? "";
    return bt.localeCompare(at);
  });

  return ok({ items });
}
