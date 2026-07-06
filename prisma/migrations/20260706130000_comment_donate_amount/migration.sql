-- /donate sahifasidagi izohlar uchun ixtiyoriy qo'llash summasi.
-- Foydalanuvchi izoh bilan birga kiritgan miqdor (UZS). Boshqa sahifalarda null qoladi.
ALTER TABLE "Comment" ADD COLUMN "donateAmount" INTEGER;
