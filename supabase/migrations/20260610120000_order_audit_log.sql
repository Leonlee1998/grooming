-- ============================================================================
-- OrderAuditLog — 訂單審計紀錄
-- ============================================================================

CREATE TABLE IF NOT EXISTS "OrderAuditLog" (
  "id"        TEXT        NOT NULL,
  "orderId"   TEXT        NOT NULL,
  "action"    TEXT        NOT NULL,
  "oldValue"  TEXT,
  "newValue"  TEXT,
  "note"      TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "OrderAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderAuditLog_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "OrderAuditLog_orderId_idx"  ON "OrderAuditLog"("orderId");
CREATE INDEX IF NOT EXISTS "OrderAuditLog_createdAt_idx" ON "OrderAuditLog"("createdAt");

-- RLS
ALTER TABLE "OrderAuditLog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select_authenticated" ON "OrderAuditLog";
CREATE POLICY "audit_log_select_authenticated"
  ON "OrderAuditLog" FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_log_insert_service_role" ON "OrderAuditLog";
CREATE POLICY "audit_log_insert_service_role"
  ON "OrderAuditLog" FOR INSERT TO service_role WITH CHECK (true);
