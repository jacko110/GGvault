CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');
ALTER TABLE "users"
  ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
-- Abort rather than merge identities if normalization finds legacy collisions.
UPDATE "users" SET "email" = lower(trim("email")), "username" = lower("username");
ALTER TABLE "profiles" ADD COLUMN "countryCode" TEXT;
ALTER TABLE "games" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "game_accounts" ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'PC', ADD COLUMN "gamertag" TEXT NOT NULL DEFAULT '';
UPDATE "game_accounts" SET "gamertag" = COALESCE(NULLIF("externalId", ''), "id");
DROP INDEX "game_accounts_userId_gameId_key";
CREATE UNIQUE INDEX "game_accounts_userId_gameId_platform_key" ON "game_accounts"("userId", "gameId", "platform");
CREATE UNIQUE INDEX "game_accounts_gameId_platform_gamertag_key" ON "game_accounts"("gameId", "platform", "gamertag");
ALTER TABLE "challenges" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'TEST', ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'PC', ADD COLUMN "mode" TEXT NOT NULL DEFAULT '1v1';
ALTER TABLE "audit_logs" ADD COLUMN "entityId" TEXT;
CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sessions_refreshTokenHash_key" ON "sessions"("refreshTokenHash");
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");
