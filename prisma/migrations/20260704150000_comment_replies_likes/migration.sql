-- Izohlarga admin javobi (parentId + isAdmin) va like tizimi
ALTER TABLE "Comment" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Comment" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Comment" ADD COLUMN "likesCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CommentLike: bitta sessiya bitta izohga bir marta like qo'yadi
CREATE TABLE "CommentLike" (
  "id"         TEXT NOT NULL,
  "commentId"  TEXT NOT NULL,
  "sessionId"  TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommentLike_commentId_sessionId_key" ON "CommentLike"("commentId", "sessionId");
CREATE INDEX "CommentLike_sessionId_idx" ON "CommentLike"("sessionId");

ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
