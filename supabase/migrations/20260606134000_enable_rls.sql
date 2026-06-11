DO $$
DECLARE
  app_table text;
  app_tables text[] := ARRAY[
    'Customer',
    'Pet',
    'Staff',
    'Service',
    'PriceRule',
    'ServicePackage',
    'ServicePackageItem',
    'MemberPlan',
    'Member',
    'PointTransaction',
    'BalanceTransaction',
    'Promotion',
    'ContractTemplate',
    'Contract',
    'Appointment',
    'Order',
    'OrderItem'
  ];
BEGIN
  FOREACH app_table IN ARRAY app_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table);

    EXECUTE format('DROP POLICY IF EXISTS "authenticated_select" ON public.%I', app_table);
    EXECUTE format(
      'CREATE POLICY "authenticated_select" ON public.%I FOR SELECT TO authenticated USING (true)',
      app_table
    );

    EXECUTE format('DROP POLICY IF EXISTS "authenticated_insert" ON public.%I', app_table);
    EXECUTE format(
      'CREATE POLICY "authenticated_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)',
      app_table
    );

    EXECUTE format('DROP POLICY IF EXISTS "authenticated_update" ON public.%I', app_table);
    EXECUTE format(
      'CREATE POLICY "authenticated_update" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      app_table
    );

    EXECUTE format('DROP POLICY IF EXISTS "authenticated_delete" ON public.%I', app_table);
    EXECUTE format(
      'CREATE POLICY "authenticated_delete" ON public.%I FOR DELETE TO authenticated USING (true)',
      app_table
    );
  END LOOP;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('pet-avatars', 'pet-avatars', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('contracts', 'contracts', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "authenticated_read_pet_avatars" ON storage.objects;
CREATE POLICY "authenticated_read_pet_avatars"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pet-avatars');

DROP POLICY IF EXISTS "authenticated_write_pet_avatars" ON storage.objects;
CREATE POLICY "authenticated_write_pet_avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pet-avatars');

DROP POLICY IF EXISTS "authenticated_update_pet_avatars" ON storage.objects;
CREATE POLICY "authenticated_update_pet_avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pet-avatars')
  WITH CHECK (bucket_id = 'pet-avatars');

DROP POLICY IF EXISTS "authenticated_delete_pet_avatars" ON storage.objects;
CREATE POLICY "authenticated_delete_pet_avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pet-avatars');

DROP POLICY IF EXISTS "authenticated_read_contracts" ON storage.objects;
CREATE POLICY "authenticated_read_contracts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contracts');

DROP POLICY IF EXISTS "authenticated_write_contracts" ON storage.objects;
CREATE POLICY "authenticated_write_contracts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracts');

DROP POLICY IF EXISTS "authenticated_update_contracts" ON storage.objects;
CREATE POLICY "authenticated_update_contracts"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contracts')
  WITH CHECK (bucket_id = 'contracts');

DROP POLICY IF EXISTS "authenticated_delete_contracts" ON storage.objects;
CREATE POLICY "authenticated_delete_contracts"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contracts');
