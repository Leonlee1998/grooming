-- 多店支援 migration
-- 策略：先建 Store 表 → 插入預設店 → 新增 storeId 欄位（暫給 DEFAULT）→ 補值 → 移除 DEFAULT → 加 FK / Index

-- ─── 1. 建立 Store 資料表 ──────────────────────────────────────────────────────

CREATE TABLE "Store" (
    "id"                   TEXT         NOT NULL,
    "name"                 TEXT         NOT NULL,
    "slug"                 TEXT         NOT NULL,
    "address"              TEXT,
    "phone"                TEXT,
    "taxId"                TEXT,
    "lineOaId"             TEXT,
    "businessHours"        JSONB,
    "overtimeFeePerHour"   INTEGER      NOT NULL DEFAULT 0,
    "overtimeGraceMinutes" INTEGER      NOT NULL DEFAULT 30,
    "isActive"             BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");

-- ─── 2. 插入預設店（現有資料都歸屬於此店）─────────────────────────────────────

INSERT INTO "Store" ("id", "name", "slug", "updatedAt")
VALUES ('default-store', '預設店', 'default', CURRENT_TIMESTAMP);

-- ─── 3. 新增 storeId 欄位（暫給 DEFAULT = 預設店 ID，讓現有資料能填入）────────

ALTER TABLE "Customer"    ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "Customer"    ADD COLUMN "lineBindAt" TIMESTAMP(3);
ALTER TABLE "Pet"         ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "Staff"       ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "Service"     ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "MemberPlan"  ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "Promotion"   ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "Contract"    ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "Appointment" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "Order"       ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';

-- ─── 4. 移除暫時的 DEFAULT（Prisma schema 沒有 @default，需保持一致）──────────

ALTER TABLE "Customer"    ALTER COLUMN "storeId" DROP DEFAULT;
ALTER TABLE "Pet"         ALTER COLUMN "storeId" DROP DEFAULT;
ALTER TABLE "Staff"       ALTER COLUMN "storeId" DROP DEFAULT;
ALTER TABLE "Service"     ALTER COLUMN "storeId" DROP DEFAULT;
ALTER TABLE "MemberPlan"  ALTER COLUMN "storeId" DROP DEFAULT;
ALTER TABLE "Promotion"   ALTER COLUMN "storeId" DROP DEFAULT;
ALTER TABLE "Contract"    ALTER COLUMN "storeId" DROP DEFAULT;
ALTER TABLE "Appointment" ALTER COLUMN "storeId" DROP DEFAULT;
ALTER TABLE "Order"       ALTER COLUMN "storeId" DROP DEFAULT;

-- ─── 5. 處理 Customer.phone 唯一鍵：全域唯一 → 同店唯一 ───────────────────────

ALTER TABLE "Customer" DROP CONSTRAINT IF EXISTS "Customer_phone_key";
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_storeId_phone_key" UNIQUE ("storeId", "phone");

-- ─── 6. 建立外鍵 ──────────────────────────────────────────────────────────────

ALTER TABLE "Customer"    ADD CONSTRAINT "Customer_storeId_fkey"    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pet"         ADD CONSTRAINT "Pet_storeId_fkey"         FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Staff"       ADD CONSTRAINT "Staff_storeId_fkey"       FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Service"     ADD CONSTRAINT "Service_storeId_fkey"     FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MemberPlan"  ADD CONSTRAINT "MemberPlan_storeId_fkey"  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Promotion"   ADD CONSTRAINT "Promotion_storeId_fkey"   FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract"    ADD CONSTRAINT "Contract_storeId_fkey"    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order"       ADD CONSTRAINT "Order_storeId_fkey"       FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 7. 建立索引 ──────────────────────────────────────────────────────────────

CREATE INDEX "Customer_storeId_idx"              ON "Customer"("storeId");
CREATE INDEX "Pet_storeId_idx"                   ON "Pet"("storeId");
CREATE INDEX "Staff_storeId_idx"                 ON "Staff"("storeId");
CREATE INDEX "Service_storeId_idx"               ON "Service"("storeId");
CREATE INDEX "MemberPlan_storeId_idx"            ON "MemberPlan"("storeId");
CREATE INDEX "Promotion_storeId_idx"             ON "Promotion"("storeId");
CREATE INDEX "Contract_storeId_idx"              ON "Contract"("storeId");
CREATE INDEX "Appointment_storeId_scheduledAt_idx" ON "Appointment"("storeId", "scheduledAt");
CREATE INDEX "Order_storeId_createdAt_idx"       ON "Order"("storeId", "createdAt");
