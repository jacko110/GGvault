-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM (
  'DRAFT',
  'OPEN',
  'JOINED',
  'FUNDED',
  'READY',
  'IN_PROGRESS',
  'RESULT_SUBMITTED',
  'AWAITING_CONFIRMATION',
  'CONFIRMED',
  'DISPUTED',
  'UNDER_REVIEW',
  'RESOLVED',
  'SETTLED',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED'
);

CREATE TYPE "ChallengePlayerStatus" AS ENUM (
  'JOINED',
  'FUNDED',
  'LOCKED',
  'ELIMINATED',
  'DISQUALIFIED'
);

CREATE TYPE "MatchStatus" AS ENUM (
  'READY',
  'IN_PROGRESS',
  'RESULT_SUBMITTED',
  'CONFIRMED',
  'DISPUTED',
  'SETTLED',
  'CANCELLED'
);

CREATE TYPE "LedgerDirection" AS ENUM (
  'DEBIT',
  'CREDIT'
);

CREATE TYPE "LedgerAccountType" AS ENUM (
  'USER_AVAILABLE',
  'MATCH_VAULT',
  'PLATFORM_REVENUE',
  'SYSTEM'
);

CREATE TYPE "LedgerTransactionType" AS ENUM (
  'INITIAL_CREDIT',
  'STAKE_LOCK',
  'STAKE_REFUND',
  'MATCH_SETTLEMENT',
  'PLATFORM_FEE',
  'ADMIN_ADJUSTMENT'
);

CREATE TYPE "SettlementStatus" AS ENUM (
  'PENDING',
  'SETTLED',
  'DISPUTED',
  'CANCELLED'
);

CREATE TYPE "DisputeStatus" AS ENUM (
  'OPEN',
  'REVIEW',
  'RESOLVED',
  'REJECTED'
);

CREATE TYPE "EvidenceType" AS ENUM (
  'SCREENSHOT',
  'VIDEO',
  'LOG',
  'OTHER'
);

-- CreateTable users
CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable profiles
CREATE TABLE "profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bio" TEXT,
  "region" TEXT,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable games
CREATE TABLE "games" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable game_accounts
CREATE TABLE "game_accounts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "externalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "game_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable challenges
CREATE TABLE "challenges" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ChallengeStatus" NOT NULL DEFAULT 'OPEN',
  "gameId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "entryFee" INTEGER NOT NULL DEFAULT 0,
  "prizePool" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable challenge_players
CREATE TABLE "challenge_players" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "status" "ChallengePlayerStatus" NOT NULL DEFAULT 'JOINED',

  CONSTRAINT "challenge_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable matches
CREATE TABLE "matches" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "status" "MatchStatus" NOT NULL DEFAULT 'READY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable match_results
CREATE TABLE "match_results" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "winnerUserId" TEXT,
  "score" TEXT,
  "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable ledger_accounts
CREATE TABLE "ledger_accounts" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "challengeId" TEXT,
  "accountType" "LedgerAccountType" NOT NULL,
  "singletonKey" TEXT,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable ledger_transactions
CREATE TABLE "ledger_transactions" (
  "id" TEXT NOT NULL,
  "matchId" TEXT,
  "type" "LedgerTransactionType" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable ledger_entries
CREATE TABLE "ledger_entries" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "ledgerAccountId" TEXT NOT NULL,
  "direction" "LedgerDirection" NOT NULL DEFAULT 'CREDIT',
  "amount" INTEGER NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable evidence
CREATE TABLE "evidence" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "type" "EvidenceType" NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable disputes
CREATE TABLE "disputes" (
  "id" TEXT NOT NULL,
  "matchResultId" TEXT NOT NULL,
  "raisedByUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable audit_logs
CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");
CREATE UNIQUE INDEX "games_slug_key" ON "games"("slug");
CREATE UNIQUE INDEX "game_accounts_userId_gameId_key" ON "game_accounts"("userId", "gameId");
CREATE UNIQUE INDEX "challenges_slug_key" ON "challenges"("slug");
CREATE UNIQUE INDEX "challenge_players_challengeId_userId_key" ON "challenge_players"("challengeId", "userId");
CREATE UNIQUE INDEX "match_results_matchId_key" ON "match_results"("matchId");
CREATE UNIQUE INDEX "ledger_accounts_singletonKey_key" ON "ledger_accounts"("singletonKey");
CREATE UNIQUE INDEX "ledger_accounts_userId_accountType_key" ON "ledger_accounts"("userId", "accountType");
CREATE UNIQUE INDEX "ledger_accounts_challengeId_accountType_key" ON "ledger_accounts"("challengeId", "accountType");
CREATE UNIQUE INDEX "ledger_transactions_idempotencyKey_key" ON "ledger_transactions"("idempotencyKey");
CREATE UNIQUE INDEX "ledger_transactions_matchId_type_key" ON "ledger_transactions"("matchId", "type");

-- AddForeignKey
ALTER TABLE "profiles"
ADD CONSTRAINT "profiles_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_accounts"
ADD CONSTRAINT "game_accounts_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_accounts"
ADD CONSTRAINT "game_accounts_gameId_fkey"
FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "challenges"
ADD CONSTRAINT "challenges_gameId_fkey"
FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "challenge_players"
ADD CONSTRAINT "challenge_players_challengeId_fkey"
FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "challenge_players"
ADD CONSTRAINT "challenge_players_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "matches"
ADD CONSTRAINT "matches_challengeId_fkey"
FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_results"
ADD CONSTRAINT "match_results_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_results"
ADD CONSTRAINT "match_results_winnerUserId_fkey"
FOREIGN KEY ("winnerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ledger_accounts"
ADD CONSTRAINT "ledger_accounts_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
ADD CONSTRAINT "ledger_entries_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "ledger_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
ADD CONSTRAINT "ledger_entries_ledgerAccountId_fkey"
FOREIGN KEY ("ledgerAccountId") REFERENCES "ledger_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "disputes"
ADD CONSTRAINT "disputes_matchResultId_fkey"
FOREIGN KEY ("matchResultId") REFERENCES "match_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "disputes"
ADD CONSTRAINT "disputes_raisedByUserId_fkey"
FOREIGN KEY ("raisedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
