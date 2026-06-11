-- 線上簽約 + 補充契約支援

-- ─── 1. Enum 擴充 ──────────────────────────────────────────────────────────────

ALTER TYPE "AppointmentSource" ADD VALUE IF NOT EXISTS 'POS_ONSITE';
ALTER TYPE "ContractType" ADD VALUE IF NOT EXISTS 'SUPPLEMENTARY';

-- ─── 2. 新增 SignMethod enum ────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "SignMethod" AS ENUM ('ONSITE', 'ONLINE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ─── 3. Appointment：新增 signedOnline、onlineContractId ────────────────────────

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "signedOnline"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "onlineContractId" TEXT;

-- ─── 4. Contract：orderId 改 nullable（補充契約不一定有獨立 order）──────────────

-- 先確認是否有 NOT NULL 約束，直接 ALTER
ALTER TABLE "Contract" ALTER COLUMN "orderId" DROP NOT NULL;

-- ─── 5. Contract：新增 signMethod、isSupplementary、parentContractId ────────────

ALTER TABLE "Contract"
  ADD COLUMN IF NOT EXISTS "signMethod"       "SignMethod" NOT NULL DEFAULT 'ONSITE',
  ADD COLUMN IF NOT EXISTS "isSupplementary"  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "parentContractId" TEXT;

-- ─── 6. Contract self-relation FK ──────────────────────────────────────────────

ALTER TABLE "Contract"
  ADD CONSTRAINT "Contract_parentContractId_fkey"
  FOREIGN KEY ("parentContractId")
  REFERENCES "Contract"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- ─── 7. Index ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "Contract_parentContractId_idx" ON "Contract"("parentContractId");
