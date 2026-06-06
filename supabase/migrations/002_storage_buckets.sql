-- ============================================================================
-- Storage Buckets — 寵物美容 POS
-- 請在 Supabase Dashboard → SQL Editor 執行（非 Prisma migration）
-- ============================================================================

-- ─── Buckets ─────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('pet-avatars', 'pet-avatars', false, 5242880,  ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('contracts',   'contracts',   false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── pet-avatars Storage Policies ────────────────────────────────────────────

DROP POLICY IF EXISTS "pet_avatars_select_authenticated" ON storage.objects;
CREATE POLICY "pet_avatars_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pet-avatars');

DROP POLICY IF EXISTS "pet_avatars_insert_authenticated" ON storage.objects;
CREATE POLICY "pet_avatars_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pet-avatars');

DROP POLICY IF EXISTS "pet_avatars_update_authenticated" ON storage.objects;
CREATE POLICY "pet_avatars_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pet-avatars')
  WITH CHECK (bucket_id = 'pet-avatars');

DROP POLICY IF EXISTS "pet_avatars_delete_authenticated" ON storage.objects;
CREATE POLICY "pet_avatars_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pet-avatars');

-- ─── contracts Storage Policies ──────────────────────────────────────────────

DROP POLICY IF EXISTS "contracts_select_authenticated" ON storage.objects;
CREATE POLICY "contracts_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contracts');

DROP POLICY IF EXISTS "contracts_insert_authenticated" ON storage.objects;
CREATE POLICY "contracts_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracts');

DROP POLICY IF EXISTS "contracts_update_authenticated" ON storage.objects;
CREATE POLICY "contracts_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contracts')
  WITH CHECK (bucket_id = 'contracts');

DROP POLICY IF EXISTS "contracts_delete_authenticated" ON storage.objects;
CREATE POLICY "contracts_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contracts');
