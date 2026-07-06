import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { defaultSettings } from "../src/lib/settings";
import { slugify } from "../src/lib/utils";

const prisma = new PrismaClient();

async function main() {
  const initialPass = process.env.ADMIN_INITIAL_PASSWORD || "changeme123";
  const hash = await argon2.hash(initialPass, { type: argon2.argon2id });

  // Sozlamalar — barcha kalitlar bo'yicha standart qiymatlar
  for (const [key, value] of Object.entries(defaultSettings)) {
    const finalValue = key === "admin.passwordHash" ? hash : value;
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: finalValue as never },
      update: {},
    });
  }

  // Namunaviy janrlar
  const genres = ["Portret", "Manzara", "To'y", "Reportaj", "Ko'cha"];
  for (const name of genres) {
    await prisma.genre.upsert({
      where: { name },
      create: { name, slug: slugify(name) },
      update: {},
    });
  }

  // Namunaviy joylashuvlar
  const locations = ["Samarqand", "Buxoro", "Toshkent", "Xiva", "Farg'ona"];
  for (const name of locations) {
    await prisma.location.upsert({
      where: { name },
      create: { name, slug: slugify(name) },
      update: {},
    });
  }

  // Buyurtma kodi hisoblagichi
  await prisma.orderCounter.upsert({
    where: { id: 1 },
    create: { id: 1, seq: 42 },
    update: {},
  });

  // eslint-disable-next-line no-console
  console.log("Seed tugadi. Admin paroli:", initialPass);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
