-- CreateTable
CREATE TABLE "AdminSessionRecord" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "ipDisplay" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "userAgent" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AdminSessionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminSessionRecord_username_revokedAt_lastSeenAt_idx" ON "AdminSessionRecord"("username", "revokedAt", "lastSeenAt");

-- CreateIndex
CREATE INDEX "AdminSessionRecord_createdAt_idx" ON "AdminSessionRecord"("createdAt");
