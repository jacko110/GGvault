ALTER TYPE "MatchStatus" ADD VALUE 'REFUNDED';
ALTER TYPE "SettlementStatus" ADD VALUE 'RESOLVED';
ALTER TYPE "SettlementStatus" ADD VALUE 'REFUNDED';
CREATE TYPE "DisputeResolution" AS ENUM ('PLAYER_A_WINS', 'PLAYER_B_WINS', 'VOID_MATCH');
ALTER TABLE "match_results"
  ADD COLUMN "vaultAmount" INTEGER,
  ADD COLUMN "winnerAmount" INTEGER,
  ADD COLUMN "platformFee" INTEGER,
  ADD COLUMN "feeBasisPoints" INTEGER,
  ADD COLUMN "settledAt" TIMESTAMP(3);
ALTER TABLE "disputes"
  ADD COLUMN "resolvedByUserId" TEXT,
  ADD COLUMN "resolution" "DisputeResolution",
  ADD COLUMN "resolutionReason" TEXT,
  ADD COLUMN "resolvedAt" TIMESTAMP(3);
-- One financial outcome across both kinds, in addition to existing (matchId, type).
CREATE UNIQUE INDEX "ledger_transactions_one_match_outcome"
ON "ledger_transactions" ("matchId")
WHERE "type" IN ('MATCH_SETTLEMENT', 'STAKE_REFUND');
CREATE INDEX "disputes_createdAt_id_idx" ON "disputes" ("createdAt", "id");
