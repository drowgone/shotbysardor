-- Watermark funksiyasini butkul olib tashlash

ALTER TABLE "Content" DROP COLUMN IF EXISTS "watermark";

DELETE FROM "Setting" WHERE "key" = 'content.watermark';
