-- Fix current_customer_id() to recognise the camelCase keys set by the LIFF
-- auth flow (user_metadata.customerId / user_metadata.lineUserId).
-- The previous version only checked snake_case line_user_id, which caused
-- RLS policies to always return NULL and silently block all customer queries.

CREATE OR REPLACE FUNCTION current_customer_id()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    -- 1. Direct Customer.id injected by LIFF auth (most efficient — no JOIN)
    auth.jwt() -> 'user_metadata' ->> 'customerId',

    -- 2. Look up by lineUserId (camelCase, set by LIFF auth route.ts)
    (SELECT id FROM "Customer"
     WHERE "lineUserId" = auth.jwt() -> 'user_metadata' ->> 'lineUserId'
     LIMIT 1),

    -- 3. Legacy snake_case fallback (older auth flows / manual bindings)
    (SELECT id FROM "Customer"
     WHERE "lineUserId" = COALESCE(
       auth.jwt() -> 'user_metadata' ->> 'line_user_id',
       auth.jwt() -> 'app_metadata'  ->> 'line_user_id'
     )
     LIMIT 1)
  );
$$;

COMMENT ON FUNCTION current_customer_id() IS
  'JWT → Customer.id 解析。優先使用 user_metadata.customerId（直接 ID，LIFF auth 流程注入），'
  'fallback 到 user_metadata.lineUserId 欄位查詢，最後嘗試 snake_case line_user_id（舊格式）。';
