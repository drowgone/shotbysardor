-- Content ↔ Genre: bir-birga → M2M (implicit).
-- Muhim: mavjud `Content.genreId` qiymatlari yo'qolib ketmasin — join jadval'ga ko'chirilgach ustun tashlanadi.

-- 1) Yangi implicit M2M jadvalini yaratamiz (nomi: `_ContentGenres` — schema'dagi @relation("ContentGenres") ga mos).
CREATE TABLE "_ContentGenres" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ContentGenres_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_ContentGenres_B_index" ON "_ContentGenres"("B");

-- 2) Mavjud munosabatlarni ko'chiramiz. "A" = Content.id, "B" = Genre.id
--    (Prisma implicit M2M konvensiyasi: kichik model nomi 1-argumentda).
INSERT INTO "_ContentGenres" ("A", "B")
SELECT "id", "genreId" FROM "Content"
WHERE "genreId" IS NOT NULL;

-- 3) FK va indexlarni tashlaymiz.
ALTER TABLE "Content" DROP CONSTRAINT "Content_genreId_fkey";
DROP INDEX IF EXISTS "Content_genreId_idx";

-- 4) Endi ustunni ham tashlaymiz.
ALTER TABLE "Content" DROP COLUMN "genreId";

-- 5) Yangi join jadvalining FK'larini qo'shamiz — cascade delete.
ALTER TABLE "_ContentGenres" ADD CONSTRAINT "_ContentGenres_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ContentGenres" ADD CONSTRAINT "_ContentGenres_B_fkey"
    FOREIGN KEY ("B") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
