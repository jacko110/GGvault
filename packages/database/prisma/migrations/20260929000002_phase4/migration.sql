ALTER TYPE "SettlementStatus" ADD VALUE 'CONFIRMED';
-- Fail on ambiguous legacy duplicates; never silently delete historical matches/disputes.
CREATE UNIQUE INDEX "matches_challengeId_key" ON "matches"("challengeId");
CREATE UNIQUE INDEX "disputes_matchResultId_key" ON "disputes"("matchResultId");
ALTER TABLE "matches" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "match_results"
  ADD COLUMN "myScore" INTEGER,
  ADD COLUMN "opponentScore" INTEGER,
  ADD COLUMN "submittedByUserId" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "confirmedByUserId" TEXT,
  ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "match_results" ADD CONSTRAINT "result_valid_scores" CHECK (
  ("myScore" IS NULL AND "opponentScore" IS NULL) OR
  ("myScore" >= 0 AND "opponentScore" >= 0 AND "myScore" <> "opponentScore")
);
CREATE TABLE "match_participants" (
  "id" TEXT PRIMARY KEY,
  "matchId" TEXT NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "readyAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "match_participants_matchId_userId_key" ON "match_participants"("matchId", "userId");
CREATE TABLE "match_events" (
  "id" TEXT PRIMARY KEY,
  "sequence" SERIAL NOT NULL,
  "matchId" TEXT NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "actorUserId" TEXT,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "match_events_sequence_key" ON "match_events"("sequence");
CREATE INDEX "match_events_matchId_sequence_idx" ON "match_events"("matchId", "sequence");
ALTER TABLE "evidence"
  ADD COLUMN "matchId" TEXT REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD COLUMN "uploadedByUserId" TEXT,
  ADD COLUMN "objectKey" TEXT,
  ADD COLUMN "originalFilename" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "size" INTEGER,
  ADD COLUMN "sha256" TEXT;
CREATE UNIQUE INDEX "evidence_objectKey_key" ON "evidence"("objectKey");
CREATE INDEX "evidence_matchId_idx" ON "evidence"("matchId");
-- Existing match rows receive their participant snapshot; future matches are created by the domain service.
INSERT INTO "matches" ("id", "challengeId", "status", "createdAt", "updatedAt")
SELECT 'c' || substr(md5(c."id"), 1, 24), c."id", 'READY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "challenges" c WHERE c."status" = 'FUNDED'
AND NOT EXISTS (SELECT 1 FROM "matches" m WHERE m."challengeId" = c."id")
AND (SELECT count(*) FROM "challenge_players" p WHERE p."challengeId" = c."id") = 2
AND (SELECT count(*) FROM "challenge_players" p WHERE p."challengeId" = c."id" AND p."status" IN ('FUNDED', 'LOCKED')) = 2;
INSERT INTO "match_participants" ("id", "matchId", "userId")
SELECT 'c' || substr(md5(m."id" || ':' || p."userId"), 1, 24), m."id", p."userId"
FROM "matches" m JOIN "challenge_players" p ON p."challengeId" = m."challengeId";
INSERT INTO "match_events" ("id", "matchId", "type", "createdAt")
SELECT 'c' || substr(md5('created:' || "id"), 1, 24), "id", 'MATCH_CREATED', "createdAt" FROM "matches";

CREATE FUNCTION protect_match_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."objectKey" IS NOT NULL THEN
    RAISE EXCEPTION 'Submitted evidence is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER evidence_immutable BEFORE UPDATE OR DELETE ON "evidence"
FOR EACH ROW EXECUTE FUNCTION protect_match_evidence();
