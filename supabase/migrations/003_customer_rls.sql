-- ============================================================================
-- 003_customer_rls.sql — Customer-Facing RLS Policies
-- ============================================================================
-- 目的：新增 apps/customer 客戶端（LINE Login / 手機 OTP）的存取控制。
--
-- 角色模型
--   service_role  → Server Actions (prismaAdmin) 自動繞過 RLS，不受本檔影響
--   authenticated + is_staff()   → 店家員工（app_metadata.is_staff = true）
--   authenticated + !is_staff()  → 一般客戶（LINE LIFF / 手機 OTP 登入）
--   anon                         → 公開訪客（預約頁、服務查詢）
--
-- ⚠  前置假設
--   1. 員工 Supabase 使用者建立時需在 app_metadata 設 {"is_staff": true}。
--   2. 客戶 Supabase 使用者建立時需在 user_metadata 或 app_metadata
--      設 {"line_user_id": "<LINE_USER_ID>"} 供 current_customer_id() 使用。
--   3. POS / Admin Server Actions 全部使用 service_role，
--      不依賴 authenticated JWT 直接寫入個資表。
-- ============================================================================

-- ─── Helper: is_staff() ──────────────────────────────────────────────────────
-- 判斷目前 JWT 是否為店家員工（app_metadata.is_staff = true）

CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_staff')::boolean,
    false
  );
$$;

COMMENT ON FUNCTION is_staff() IS
  '員工身份判斷：Supabase app_metadata.is_staff = true 時回傳 true。';

-- ─── Helper: current_customer_id() ───────────────────────────────────────────
-- 從 JWT 取出 line_user_id（user_metadata 或 app_metadata），
-- 查 Customer 表回傳對應的 id。
-- SECURITY DEFINER 避免 RLS 遞迴：此函式以定義者身份查詢。

CREATE OR REPLACE FUNCTION current_customer_id()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id
  FROM "Customer"
  WHERE "lineUserId" = COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'line_user_id',
    auth.jwt() -> 'app_metadata'  ->> 'line_user_id'
  )
  LIMIT 1;
$$;

COMMENT ON FUNCTION current_customer_id() IS
  '從 JWT line_user_id 解析目前登入客戶的 Customer.id；查不到回傳 NULL。';

-- ─── Store: 啟用 RLS + 公開唯讀 ──────────────────────────────────────────────

ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;

-- anon：公開預約頁可讀啟用中的店家基本資訊
DROP POLICY IF EXISTS "store_select_anon"          ON "Store";
CREATE POLICY "store_select_anon"
  ON "Store" FOR SELECT
  TO anon
  USING ("isActive" = true);

-- authenticated：員工及客戶皆可讀完整店家資料
DROP POLICY IF EXISTS "store_select_authenticated" ON "Store";
CREATE POLICY "store_select_authenticated"
  ON "Store" FOR SELECT
  TO authenticated
  USING (true);

-- ─── Customer ────────────────────────────────────────────────────────────────
-- 移除既有廣域 policy（USING(true) 允許客戶讀到所有人的資料，不安全）

DROP POLICY IF EXISTS "authenticated_select"          ON "Customer";
DROP POLICY IF EXISTS "customer_select_authenticated" ON "Customer";

-- 員工：可讀所有客戶
DROP POLICY IF EXISTS "customer_select_staff" ON "Customer";
CREATE POLICY "customer_select_staff"
  ON "Customer" FOR SELECT
  TO authenticated
  USING (is_staff());

-- 客戶：只能讀自己的列（line_user_id 直接比對 sub，或透過 helper）
DROP POLICY IF EXISTS "customer_select_self" ON "Customer";
CREATE POLICY "customer_select_self"
  ON "Customer" FOR SELECT
  TO authenticated
  USING (
    "lineUserId" = auth.jwt() ->> 'sub'
    OR id = current_customer_id()
  );

-- 寫入：只允許員工（service_role Server Actions 繞過 RLS，不受影響）
DROP POLICY IF EXISTS "authenticated_insert" ON "Customer";
DROP POLICY IF EXISTS "authenticated_update" ON "Customer";
DROP POLICY IF EXISTS "authenticated_delete" ON "Customer";
DROP POLICY IF EXISTS "customer_write_staff"  ON "Customer";
CREATE POLICY "customer_write_staff"
  ON "Customer" FOR ALL
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- ─── Pet ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated_select"    ON "Pet";
DROP POLICY IF EXISTS "pet_select_authenticated" ON "Pet";

DROP POLICY IF EXISTS "pet_select_staff" ON "Pet";
CREATE POLICY "pet_select_staff"
  ON "Pet" FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "pet_select_self" ON "Pet";
CREATE POLICY "pet_select_self"
  ON "Pet" FOR SELECT
  TO authenticated
  USING ("customerId" = current_customer_id());

DROP POLICY IF EXISTS "authenticated_insert" ON "Pet";
DROP POLICY IF EXISTS "authenticated_update" ON "Pet";
DROP POLICY IF EXISTS "authenticated_delete" ON "Pet";
DROP POLICY IF EXISTS "pet_write_staff"       ON "Pet";
CREATE POLICY "pet_write_staff"
  ON "Pet" FOR ALL
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- ─── Appointment ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated_select"           ON "Appointment";
DROP POLICY IF EXISTS "appointment_select_authenticated" ON "Appointment";

DROP POLICY IF EXISTS "appointment_select_staff" ON "Appointment";
CREATE POLICY "appointment_select_staff"
  ON "Appointment" FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "appointment_select_self" ON "Appointment";
CREATE POLICY "appointment_select_self"
  ON "Appointment" FOR SELECT
  TO authenticated
  USING ("customerId" = current_customer_id());

DROP POLICY IF EXISTS "authenticated_insert" ON "Appointment";
DROP POLICY IF EXISTS "authenticated_update" ON "Appointment";
DROP POLICY IF EXISTS "authenticated_delete" ON "Appointment";
DROP POLICY IF EXISTS "appointment_write_staff" ON "Appointment";
CREATE POLICY "appointment_write_staff"
  ON "Appointment" FOR ALL
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- 客戶可建立線上預約（Server Action 若改用 service_role 可移除此 policy）
DROP POLICY IF EXISTS "appointment_insert_customer" ON "Appointment";
CREATE POLICY "appointment_insert_customer"
  ON "Appointment" FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT is_staff()
    AND "customerId" = current_customer_id()
    AND source = 'ONLINE'
  );

-- ─── Order ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated_select"     ON "Order";
DROP POLICY IF EXISTS "order_select_authenticated" ON "Order";

DROP POLICY IF EXISTS "order_select_staff" ON "Order";
CREATE POLICY "order_select_staff"
  ON "Order" FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "order_select_self" ON "Order";
CREATE POLICY "order_select_self"
  ON "Order" FOR SELECT
  TO authenticated
  USING ("customerId" = current_customer_id());

DROP POLICY IF EXISTS "authenticated_insert" ON "Order";
DROP POLICY IF EXISTS "authenticated_update" ON "Order";
DROP POLICY IF EXISTS "authenticated_delete" ON "Order";
DROP POLICY IF EXISTS "order_write_staff"    ON "Order";
CREATE POLICY "order_write_staff"
  ON "Order" FOR ALL
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- ─── OrderItem ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated_select"          ON "OrderItem";
DROP POLICY IF EXISTS "orderitem_select_authenticated" ON "OrderItem";

DROP POLICY IF EXISTS "orderitem_select_staff" ON "OrderItem";
CREATE POLICY "orderitem_select_staff"
  ON "OrderItem" FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "orderitem_select_self" ON "OrderItem";
CREATE POLICY "orderitem_select_self"
  ON "OrderItem" FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Order" o
      WHERE o.id = "OrderItem"."orderId"
        AND o."customerId" = current_customer_id()
    )
  );

DROP POLICY IF EXISTS "authenticated_insert" ON "OrderItem";
DROP POLICY IF EXISTS "authenticated_update" ON "OrderItem";
DROP POLICY IF EXISTS "authenticated_delete" ON "OrderItem";
DROP POLICY IF EXISTS "orderitem_write_staff" ON "OrderItem";
CREATE POLICY "orderitem_write_staff"
  ON "OrderItem" FOR ALL
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- ─── Contract ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated_select"          ON "Contract";
DROP POLICY IF EXISTS "contract_select_authenticated" ON "Contract";

DROP POLICY IF EXISTS "contract_select_staff" ON "Contract";
CREATE POLICY "contract_select_staff"
  ON "Contract" FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "contract_select_self" ON "Contract";
CREATE POLICY "contract_select_self"
  ON "Contract" FOR SELECT
  TO authenticated
  USING ("customerId" = current_customer_id());

DROP POLICY IF EXISTS "authenticated_insert" ON "Contract";
DROP POLICY IF EXISTS "authenticated_update" ON "Contract";
DROP POLICY IF EXISTS "authenticated_delete" ON "Contract";
DROP POLICY IF EXISTS "contract_write_staff"  ON "Contract";
CREATE POLICY "contract_write_staff"
  ON "Contract" FOR ALL
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- 客戶可提交線上簽約（signMethod = 'ONLINE'）
DROP POLICY IF EXISTS "contract_insert_customer" ON "Contract";
CREATE POLICY "contract_insert_customer"
  ON "Contract" FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT is_staff()
    AND "customerId" = current_customer_id()
    AND "signMethod" = 'ONLINE'
  );

-- ─── Member / 點數 / 餘額 ────────────────────────────────────────────────────
-- 會員個人財務資料同樣需要收窄

DROP POLICY IF EXISTS "authenticated_select"       ON "Member";
DROP POLICY IF EXISTS "member_select_authenticated" ON "Member";

DROP POLICY IF EXISTS "member_select_staff" ON "Member";
CREATE POLICY "member_select_staff"
  ON "Member" FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "member_select_self" ON "Member";
CREATE POLICY "member_select_self"
  ON "Member" FOR SELECT
  TO authenticated
  USING ("customerId" = current_customer_id());

DROP POLICY IF EXISTS "authenticated_insert" ON "Member";
DROP POLICY IF EXISTS "authenticated_update" ON "Member";
DROP POLICY IF EXISTS "authenticated_delete" ON "Member";
DROP POLICY IF EXISTS "member_write_staff"   ON "Member";
CREATE POLICY "member_write_staff"
  ON "Member" FOR ALL
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- PointTransaction

DROP POLICY IF EXISTS "authenticated_select"                 ON "PointTransaction";
DROP POLICY IF EXISTS "pointtransaction_select_authenticated" ON "PointTransaction";

DROP POLICY IF EXISTS "pointtransaction_select_staff" ON "PointTransaction";
CREATE POLICY "pointtransaction_select_staff"
  ON "PointTransaction" FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "pointtransaction_select_self" ON "PointTransaction";
CREATE POLICY "pointtransaction_select_self"
  ON "PointTransaction" FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Member" m
      WHERE m.id = "PointTransaction"."memberId"
        AND m."customerId" = current_customer_id()
    )
  );

DROP POLICY IF EXISTS "authenticated_insert" ON "PointTransaction";
DROP POLICY IF EXISTS "authenticated_update" ON "PointTransaction";
DROP POLICY IF EXISTS "authenticated_delete" ON "PointTransaction";
DROP POLICY IF EXISTS "pointtransaction_write_staff" ON "PointTransaction";
CREATE POLICY "pointtransaction_write_staff"
  ON "PointTransaction" FOR ALL
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- BalanceTransaction

DROP POLICY IF EXISTS "authenticated_select"                    ON "BalanceTransaction";
DROP POLICY IF EXISTS "balancetransaction_select_authenticated" ON "BalanceTransaction";

DROP POLICY IF EXISTS "balancetransaction_select_staff" ON "BalanceTransaction";
CREATE POLICY "balancetransaction_select_staff"
  ON "BalanceTransaction" FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "balancetransaction_select_self" ON "BalanceTransaction";
CREATE POLICY "balancetransaction_select_self"
  ON "BalanceTransaction" FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Member" m
      WHERE m.id = "BalanceTransaction"."memberId"
        AND m."customerId" = current_customer_id()
    )
  );

DROP POLICY IF EXISTS "authenticated_insert" ON "BalanceTransaction";
DROP POLICY IF EXISTS "authenticated_update" ON "BalanceTransaction";
DROP POLICY IF EXISTS "authenticated_delete" ON "BalanceTransaction";
DROP POLICY IF EXISTS "balancetransaction_write_staff" ON "BalanceTransaction";
CREATE POLICY "balancetransaction_write_staff"
  ON "BalanceTransaction" FOR ALL
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- ─── 公開可預約時段查詢函式 ───────────────────────────────────────────────────
-- anon / authenticated 均可呼叫；僅回傳時段統計，不暴露任何個資。
--
-- 回傳：slot_time（Asia/Taipei 當天 09:00–17:00，每小時一格）
--       total_capacity（該店當日在職美容師數）
--       booked_count（已被預約的數量，CANCELLED / NO_SHOW 不計）
--       available_count（剩餘可預約空位）
--
-- 注意：實際營業時段由 Store.businessHours JSON 控制；
--       目前固定產生 09:00–17:00 共 9 個時段作為安全預設值。

CREATE OR REPLACE FUNCTION get_available_slots(
  p_store_id  TEXT,
  p_date      DATE
)
RETURNS TABLE (
  slot_time       TIMESTAMPTZ,
  total_capacity  INT,
  booked_count    INT,
  available_count INT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH staff_capacity AS (
    -- 當日在職美容師即為最大同時服務量
    SELECT COUNT(*)::INT AS capacity
    FROM   "Staff"
    WHERE  "storeId" = p_store_id
      AND  "isActive" = true
      AND  "role"     = 'GROOMER'
  ),
  hourly_slots AS (
    SELECT gs AS slot_time
    FROM   generate_series(
             (p_date::TEXT || ' 09:00:00+08')::TIMESTAMPTZ,
             (p_date::TEXT || ' 17:00:00+08')::TIMESTAMPTZ,
             '1 hour'::INTERVAL
           ) AS gs
  ),
  booked AS (
    -- 只計有效預約的數量；不回傳任何客戶識別欄位
    SELECT
      date_trunc('hour', "scheduledAt" AT TIME ZONE 'Asia/Taipei')
        AT TIME ZONE 'Asia/Taipei'  AS slot_hour,
      COUNT(*)::INT                 AS cnt
    FROM   "Appointment"
    WHERE  "storeId" = p_store_id
      AND  ("scheduledAt" AT TIME ZONE 'Asia/Taipei')::DATE = p_date
      AND  "status" NOT IN ('CANCELLED', 'NO_SHOW')
    GROUP BY 1
  )
  SELECT
    s.slot_time,
    c.capacity                                         AS total_capacity,
    COALESCE(b.cnt, 0)                                AS booked_count,
    GREATEST(0, c.capacity - COALESCE(b.cnt, 0))      AS available_count
  FROM  hourly_slots    s
  CROSS JOIN staff_capacity c
  LEFT  JOIN booked     b ON b.slot_hour = s.slot_time
  ORDER BY s.slot_time;
$$;

COMMENT ON FUNCTION get_available_slots(TEXT, DATE) IS
  '公開預約頁使用：回傳指定店家/日期的可預約時段與剩餘空位，不含任何個資。';

-- anon 與 authenticated 皆可呼叫
GRANT EXECUTE ON FUNCTION get_available_slots(TEXT, DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_available_slots(TEXT, DATE) TO authenticated;

-- ─── 明確標示 anon 完全禁止存取個資表 ────────────────────────────────────────
-- 以下表格沒有 anon policy；PostgreSQL RLS 預設 DENY。
-- 加上 COMMENT 提醒未來維護者不要意外新增 anon 讀取 policy。

COMMENT ON TABLE "Customer"         IS 'PII. anon: RLS default DENY. authenticated: staff=all, customer=own row.';
COMMENT ON TABLE "Pet"              IS 'PII. anon: RLS default DENY. authenticated: staff=all, customer=own pets.';
COMMENT ON TABLE "Appointment"      IS 'PII. anon: RLS default DENY. authenticated: staff=all, customer=own appointments.';
COMMENT ON TABLE "Order"            IS 'PII. anon: RLS default DENY. authenticated: staff=all, customer=own orders.';
COMMENT ON TABLE "OrderItem"        IS 'PII. anon: RLS default DENY. authenticated: staff=all, customer=own order items.';
COMMENT ON TABLE "Contract"         IS 'PII. anon: RLS default DENY. authenticated: staff=all, customer=own contracts.';
COMMENT ON TABLE "Member"           IS 'PII. anon: RLS default DENY. authenticated: staff=all, customer=own membership.';
COMMENT ON TABLE "PointTransaction" IS 'PII. anon: RLS default DENY. authenticated: staff=all, customer=own transactions.';
COMMENT ON TABLE "BalanceTransaction" IS 'PII. anon: RLS default DENY. authenticated: staff=all, customer=own transactions.';
