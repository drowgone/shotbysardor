/*
  Warnings:

  - The primary key for the `_ContentGenres` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_ContentGenres` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "_ContentGenres" DROP CONSTRAINT "_ContentGenres_AB_pkey";

-- CreateIndex
CREATE UNIQUE INDEX "_ContentGenres_AB_unique" ON "_ContentGenres"("A", "B");
