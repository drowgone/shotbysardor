#!/bin/sh
# Konteyner ishga tushganda bajariladigan operatsiyalar:
#   1) Prisma migratsiyalarini deploy qilish (idempotent — faqat kutilayotgan migratsiyalarni qo'llaydi)
#   2) Seed ishga tushirish — sozlamalar, boshlang'ich janr/joylashuvlar, admin parol.
#      Seed idempotent (upsert), shuning uchun har safar ishga tushirish xavfsiz.
#   3) Next.js serverini ishga tushirish
set -e

echo "→ Prisma migrate deploy..."
npx prisma migrate deploy

echo "→ Seed (idempotent)..."
npx prisma db seed || echo "  ⚠ Seed xatolik bilan tugadi — ehtimol allaqachon ishga tushgan, davom etamiz."

echo "→ Next.js production server ishga tushmoqda..."
exec npm run start
