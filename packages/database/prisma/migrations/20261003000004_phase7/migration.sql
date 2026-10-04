-- Bound beta creator counts, wallet reads and transaction/audit lookup scans.
CREATE INDEX "challenges_createdByUserId_status_idx" ON "challenges"("createdByUserId", "status");
CREATE INDEX "challenges_createdByUserId_createdAt_idx" ON "challenges"("createdByUserId", "createdAt");
CREATE INDEX "ledger_entries_ledgerAccountId_createdAt_id_idx" ON "ledger_entries"("ledgerAccountId", "createdAt", "id");
CREATE INDEX "ledger_entries_transactionId_idx" ON "ledger_entries"("transactionId");
CREATE INDEX "audit_logs_entity_entityId_createdAt_idx" ON "audit_logs"("entity", "entityId", "createdAt");
