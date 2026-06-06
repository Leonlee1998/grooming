-- ============================================================================
-- RLS Policies — 寵物美容 POS
-- ============================================================================
-- 存取層級設計：
--   service_role  → 自動繞過所有 RLS（prismaAdmin / Server Actions）
--   authenticated → 店家管理員，登入後可讀取所有業務資料
--   anon          → 公開訪客，僅能讀取上架中的服務與有效優惠
-- ============================================================================

-- ─── Enable RLS ──────────────────────────────────────────────────────────────

ALTER TABLE "Customer"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pet"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Staff"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contract"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContractTemplate"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceRule"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServicePackage"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServicePackageItem"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Member"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberPlan"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PointTransaction"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BalanceTransaction"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Promotion"           ENABLE ROW LEVEL SECURITY;

-- ─── Customer ────────────────────────────────────────────────────────────────

CREATE POLICY "customer_select_authenticated"
  ON "Customer" FOR SELECT
  TO authenticated
  USING (true);

-- ─── Pet ─────────────────────────────────────────────────────────────────────

CREATE POLICY "pet_select_authenticated"
  ON "Pet" FOR SELECT
  TO authenticated
  USING (true);

-- ─── Staff ───────────────────────────────────────────────────────────────────

-- authenticated 只看在職員工（isActive=true）；停職員工由 service_role 操作
CREATE POLICY "staff_select_authenticated"
  ON "Staff" FOR SELECT
  TO authenticated
  USING ("isActive" = true);

-- ─── Appointment ─────────────────────────────────────────────────────────────

CREATE POLICY "appointment_select_authenticated"
  ON "Appointment" FOR SELECT
  TO authenticated
  USING (true);

-- ─── Order / OrderItem ───────────────────────────────────────────────────────

CREATE POLICY "order_select_authenticated"
  ON "Order" FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "orderitem_select_authenticated"
  ON "OrderItem" FOR SELECT
  TO authenticated
  USING (true);

-- ─── Contract / ContractTemplate ─────────────────────────────────────────────

CREATE POLICY "contract_select_authenticated"
  ON "Contract" FOR SELECT
  TO authenticated
  USING (true);

-- ContractTemplate 無需 anon 存取（僅後台管理）
CREATE POLICY "contracttemplate_select_authenticated"
  ON "ContractTemplate" FOR SELECT
  TO authenticated
  USING (true);

-- ─── Service / PriceRule ─────────────────────────────────────────────────────

-- anon：僅看上架服務（未來線上預約頁使用）
CREATE POLICY "service_select_anon"
  ON "Service" FOR SELECT
  TO anon
  USING ("isActive" = true);

-- authenticated：看全部（包含停用的，方便後台管理）
CREATE POLICY "service_select_authenticated"
  ON "Service" FOR SELECT
  TO authenticated
  USING (true);

-- anon：僅看上架服務的定價規則
CREATE POLICY "pricerule_select_anon"
  ON "PriceRule" FOR SELECT
  TO anon
  USING ("isActive" = true);

CREATE POLICY "pricerule_select_authenticated"
  ON "PriceRule" FOR SELECT
  TO authenticated
  USING (true);

-- ─── ServicePackage / ServicePackageItem ─────────────────────────────────────

CREATE POLICY "servicepackage_select_anon"
  ON "ServicePackage" FOR SELECT
  TO anon
  USING ("isActive" = true);

CREATE POLICY "servicepackage_select_authenticated"
  ON "ServicePackage" FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "servicepackageitem_select_anon"
  ON "ServicePackageItem" FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM "ServicePackage" sp
      WHERE sp.id = "ServicePackageItem"."packageId"
        AND sp."isActive" = true
    )
  );

CREATE POLICY "servicepackageitem_select_authenticated"
  ON "ServicePackageItem" FOR SELECT
  TO authenticated
  USING (true);

-- ─── Member / MemberPlan ─────────────────────────────────────────────────────

CREATE POLICY "memberplan_select_authenticated"
  ON "MemberPlan" FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "member_select_authenticated"
  ON "Member" FOR SELECT
  TO authenticated
  USING (true);

-- ─── PointTransaction / BalanceTransaction ───────────────────────────────────

CREATE POLICY "pointtransaction_select_authenticated"
  ON "PointTransaction" FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "balancetransaction_select_authenticated"
  ON "BalanceTransaction" FOR SELECT
  TO authenticated
  USING (true);

-- ─── Promotion ───────────────────────────────────────────────────────────────

-- anon：只看目前有效的優惠（未來行銷頁使用）
CREATE POLICY "promotion_select_anon"
  ON "Promotion" FOR SELECT
  TO anon
  USING (
    "isActive" = true
    AND "startAt" <= now()
    AND "endAt"   >= now()
  );

CREATE POLICY "promotion_select_authenticated"
  ON "Promotion" FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- NOTE：所有 INSERT / UPDATE / DELETE 由 service_role（prismaAdmin）執行，
-- service_role 自動繞過 RLS，無需建立寫入 policy。
-- ============================================================================
