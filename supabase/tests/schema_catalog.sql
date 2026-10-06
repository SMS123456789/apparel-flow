-- Read-only assertions shared by isolated PostgreSQL and the assessment project.
DO $$
DECLARE
  tables text[] := ARRAY['profiles', 'recipes', 'recipe_components', 'cutting_orders', 'order_components', 'verification_attempts', 'verification_items', 'verification_logs', 'verification_log_items', 'admin_audit_events'];
  table_name text;
  actor_role text;
  count_value bigint;
BEGIN
  ASSERT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY(tables) AND c.relkind = 'r') = 10, 'Required tables missing';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY(tables) AND NOT c.relrowsecurity), 'RLS must be enabled on every application table';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY(tables)), 'G03 must have no permissive policies';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY(tables) AND k.contype = 'f' AND k.confdeltype <> 'r'), 'Historical foreign keys must restrict deletion';
  ASSERT (SELECT count(*) FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY(tables) AND k.contype = 'c') = 51, 'Structural CHECK constraints missing';
  ASSERT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.verification_logs'::regclass AND conname = 'verification_logs_reason_whitespace_check' AND convalidated), 'Full rejection-reason whitespace guard missing';
  ASSERT (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'app_role') = ARRAY['system_admin', 'cutting_supervisor', 'cutting_verifier', 'sewing_supervisor'], 'Role vocabulary mismatch';
  ASSERT (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'production_status') = ARRAY['CUTTING_IN_PROGRESS', 'PENDING_VERIFICATION', 'REJECTED', 'VERIFIED'], 'Production state vocabulary mismatch';
  ASSERT (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'verification_attempt_status') = ARRAY['OPEN', 'APPROVED', 'REJECTED'], 'Attempt state vocabulary mismatch';
  ASSERT (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'component_status') = ARRAY['GREEN', 'YELLOW', 'RED'], 'Component state vocabulary mismatch';
  ASSERT (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'verification_decision') = ARRAY['APPROVED', 'REJECTED'], 'Decision vocabulary mismatch';
  ASSERT (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'admin_audit_action') = ARRAY['USER_CREATED', 'USER_ROLE_CHANGED', 'USER_ACTIVATED', 'USER_DEACTIVATED'], 'Admin action vocabulary mismatch';

  FOREACH table_name IN ARRAY tables LOOP
    FOREACH actor_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      ASSERT NOT has_table_privilege(actor_role, 'public.' || table_name, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'), 'Ordinary client privilege unexpectedly granted';
    END LOOP;
    ASSERT has_table_privilege('service_role', 'public.' || table_name, 'SELECT'), 'Trusted diagnostic read missing';
    ASSERT NOT has_table_privilege('service_role', 'public.' || table_name, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'), 'Direct privileged mutations must await reviewed commands';
    ASSERT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = ('public.' || table_name)::regclass AND t.tgname = 'prevent_delete' AND t.tgenabled = 'O'), 'No-delete trigger missing';
  END LOOP;
  ASSERT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'app_private' AND p.prorettype = 'trigger'::regtype AND NOT p.prosecdef AND p.proconfig IS NOT NULL) = 7, 'Private invoker trigger helpers missing';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'app_private' AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('service_role', p.oid, 'EXECUTE'))), 'Private helpers must not be callable by API roles';
  ASSERT (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY(ARRAY[
    'profiles_role_active_idx', 'cutting_orders_status_created_idx', 'cutting_orders_creator_idx', 'cutting_orders_recipe_idx', 'cutting_orders_started_by_idx', 'order_components_source_idx',
    'verification_attempts_one_open_idx', 'verification_attempts_status_submitted_idx', 'verification_attempts_submitter_idx', 'verification_items_component_idx', 'verification_items_updated_by_idx',
    'verification_logs_one_approval_idx', 'verification_logs_order_created_idx', 'verification_logs_verifier_idx', 'verification_log_items_attempt_component_idx', 'verification_log_items_component_idx',
    'admin_audit_events_target_created_idx', 'admin_audit_events_actor_idx'])) = 18, 'Purposeful indexes missing';
  ASSERT (SELECT count(*) FROM public.recipes) = 2, 'Exactly two assessment recipes required';
  ASSERT (SELECT count(*) FROM public.recipes WHERE (recipe_code, name, category, std_fabric_yards, wastage_cap_pct) IN
    (('REC-BL01', 'Casual Blouse', 'Blouse', 1.8, 5.0), ('REC-CT02', 'Crop Top', 'Crop Top', 1.1, 8.0))) = 2, 'Recipe values mismatch';
  ASSERT (SELECT count(*) FROM public.recipe_components) = 10, 'Exactly ten assessment BOM components required';
  ASSERT NOT EXISTS (
    SELECT 1 FROM (VALUES
      ('REC-BL01', 'Front Body Panel', 1, 1), ('REC-BL01', 'Back Body Panel', 1, 2), ('REC-BL01', 'Sleeves (Left & Right)', 2, 3), ('REC-BL01', 'Collar & Stand', 1, 4), ('REC-BL01', 'Sleeve Cuffs', 2, 5),
      ('REC-CT02', 'Front Chest Panel', 1, 1), ('REC-CT02', 'Back Support Panel', 1, 2), ('REC-CT02', 'Neck Binding Strip', 1, 3), ('REC-CT02', 'Hem Elastic Casing', 1, 4), ('REC-CT02', 'Side Strap Accents', 2, 5)
    ) AS expected(recipe_code, component_name, pieces, position)
    LEFT JOIN public.recipes r USING (recipe_code)
    LEFT JOIN public.recipe_components c ON c.recipe_id = r.id AND c.component_name = expected.component_name
    WHERE c.id IS NULL OR c.pieces_per_garment <> expected.pieces OR c.sort_order <> expected.position OR c.image_url IS NOT NULL
  ), 'Assessment BOM mismatch';
  -- Real role checks are read-only; table grants deny before RLS is considered.
  FOREACH actor_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    BEGIN
      EXECUTE format('SET LOCAL ROLE %I', actor_role);
      EXECUTE 'SELECT count(*) FROM public.recipes' INTO count_value;
      RAISE EXCEPTION 'Ordinary role unexpectedly read reference data';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END LOOP;
END;
$$;
