-- Order.content FK ni ON DELETE CASCADE qilib qayta yaratamiz
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_contentId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
