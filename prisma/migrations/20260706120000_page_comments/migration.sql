-- Comment jadvaliga sahifa izohlari uchun maydonlar
-- - `contentId` optional bo'ladi (sahifa izohi bo'lsa null)
-- - `page`      qanday sahifa (masalan "donate") — kontent izohi bo'lsa null
-- - `imageKey`  ixtiyoriy ilova rasm

ALTER TABLE "Comment" DROP CONSTRAINT "Comment_contentId_fkey";

ALTER TABLE "Comment" ALTER COLUMN "contentId" DROP NOT NULL;
ALTER TABLE "Comment" ADD COLUMN "page" TEXT;
ALTER TABLE "Comment" ADD COLUMN "imageKey" TEXT;

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "Content"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Comment_page_createdAt_idx" ON "Comment"("page", "createdAt");
