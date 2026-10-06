-- G05: JWT-scoped reads; backend-only, locked cutting commands.
CREATE ROLE apparelflow_production_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
GRANT apparelflow_production_owner TO CURRENT_USER WITH INHERIT FALSE;
GRANT USAGE, CREATE ON SCHEMA public, app_private TO apparelflow_production_owner;
GRANT SELECT ON public.profiles, public.recipes, public.recipe_components, public.cutting_orders,
  public.order_components, public.verification_attempts, public.verification_items TO apparelflow_production_owner;
-- PostgreSQL row locks require UPDATE privilege. Identity cannot be changed by its trigger.
GRANT UPDATE(id) ON public.profiles, public.verification_attempts TO apparelflow_production_owner;
GRANT INSERT ON public.cutting_orders, public.order_components, public.verification_attempts, public.verification_items TO apparelflow_production_owner;
GRANT UPDATE(recipe_id,target_qty,fabric_roll_id,actual_fabric_yds,status,current_attempt_id,first_submitted_at,revision,updated_at)
  ON public.cutting_orders TO apparelflow_production_owner;
GRANT USAGE ON SEQUENCE app_private.order_number_seq TO apparelflow_production_owner;

GRANT SELECT ON public.recipes, public.recipe_components, public.cutting_orders, public.order_components,
  public.verification_attempts, public.verification_items, public.verification_logs, public.verification_log_items TO authenticated;
CREATE POLICY recipes_cutting_read ON public.recipes FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role IN ('cutting_supervisor','cutting_verifier')));
CREATE POLICY recipe_components_cutting_read ON public.recipe_components FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.recipes r WHERE r.id=recipe_id));
CREATE POLICY orders_production_read ON public.cutting_orders FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role='cutting_supervisor'));
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['order_components','verification_attempts','verification_items','verification_logs','verification_log_items'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.cutting_orders o WHERE o.id=order_id))',table_name || '_parent_read',table_name);
  END LOOP;
END $$;

CREATE FUNCTION app_private.production_assert_actor(p_actor_id uuid, p_role public.app_role) RETURNS public.profiles
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE actor public.profiles;
BEGIN
  SELECT * INTO actor FROM public.profiles WHERE id=p_actor_id FOR UPDATE;
  IF NOT FOUND OR NOT actor.is_active OR actor.role<>p_role THEN
    RAISE EXCEPTION 'ROLE_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN actor;
END $$;

CREATE FUNCTION app_private.cutting_create(p_actor_id uuid,p_recipe_id uuid,p_target_qty integer,p_fabric_roll_id text,p_actual_fabric numeric) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
  PERFORM app_private.production_assert_actor(p_actor_id,'cutting_supervisor');
  IF NOT EXISTS(SELECT 1 FROM public.recipes WHERE id=p_recipe_id) THEN
    RAISE EXCEPTION 'RECIPE_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  IF p_target_qty IS NULL OR p_target_qty<=0 OR NOT EXISTS(SELECT 1 FROM public.recipe_components WHERE recipe_id=p_recipe_id)
    OR EXISTS(SELECT 1 FROM public.recipe_components WHERE recipe_id=p_recipe_id AND p_target_qty::bigint*pieces_per_garment>9007199254740991) THEN
    RAISE EXCEPTION 'INVALID_REQUIREMENTS' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.cutting_orders(recipe_id,target_qty,fabric_roll_id,actual_fabric_yds,created_by)
    VALUES(p_recipe_id,p_target_qty,p_fabric_roll_id,p_actual_fabric,p_actor_id) RETURNING id INTO result;
  RETURN result;
END $$;

CREATE FUNCTION app_private.cutting_edit(p_actor_id uuid,p_order_id uuid,p_revision bigint,p_recipe_id uuid,p_target_qty integer,p_fabric_roll_id text,p_actual_fabric numeric) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE batch public.cutting_orders; recipe uuid; target integer;
BEGIN
  PERFORM app_private.production_assert_actor(p_actor_id,'cutting_supervisor');
  SELECT * INTO batch FROM public.cutting_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF batch.status<>'CUTTING_IN_PROGRESS' OR p_revision IS NULL OR batch.revision<>p_revision THEN
    RAISE EXCEPTION 'STALE_OR_INVALID_STATE' USING ERRCODE='40001';
  END IF;
  IF p_recipe_id IS NULL AND p_target_qty IS NULL AND p_fabric_roll_id IS NULL AND p_actual_fabric IS NULL THEN
    RAISE EXCEPTION 'EMPTY_CHANGE' USING ERRCODE='22023';
  END IF;
  recipe:=coalesce(p_recipe_id,batch.recipe_id); target:=coalesce(p_target_qty,batch.target_qty);
  IF batch.first_submitted_at IS NOT NULL AND (recipe,target) IS DISTINCT FROM (batch.recipe_id,batch.target_qty) THEN
    RAISE EXCEPTION 'FROZEN_REQUIREMENTS' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.recipes WHERE id=recipe) THEN RAISE EXCEPTION 'RECIPE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF target<=0 OR NOT EXISTS(SELECT 1 FROM public.recipe_components WHERE recipe_id=recipe)
    OR EXISTS(SELECT 1 FROM public.recipe_components WHERE recipe_id=recipe AND target::bigint*pieces_per_garment>9007199254740991) THEN
    RAISE EXCEPTION 'INVALID_REQUIREMENTS' USING ERRCODE='22023';
  END IF;
  UPDATE public.cutting_orders SET recipe_id=recipe,target_qty=target,fabric_roll_id=coalesce(p_fabric_roll_id,fabric_roll_id),
    actual_fabric_yds=coalesce(p_actual_fabric,actual_fabric_yds),revision=revision+1 WHERE id=p_order_id;
  RETURN p_order_id;
END $$;

CREATE FUNCTION app_private.cutting_submit(p_actor_id uuid,p_order_id uuid,p_revision bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE batch public.cutting_orders; recipe public.recipes; first_attempt public.verification_attempts; attempt uuid; attempt_number integer;
  standard_yards numeric; cap numeric;
BEGIN
  PERFORM app_private.production_assert_actor(p_actor_id,'cutting_supervisor');
  SELECT * INTO batch FROM public.cutting_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF batch.status<>'CUTTING_IN_PROGRESS' OR p_revision IS NULL OR batch.revision<>p_revision THEN
    RAISE EXCEPTION 'STALE_OR_INVALID_STATE' USING ERRCODE='40001';
  END IF;
  IF batch.first_submitted_at IS NULL THEN
    SELECT * INTO recipe FROM public.recipes WHERE id=batch.recipe_id;
    IF NOT EXISTS(SELECT 1 FROM public.recipe_components WHERE recipe_id=batch.recipe_id)
      OR EXISTS(SELECT 1 FROM public.recipe_components WHERE recipe_id=batch.recipe_id AND batch.target_qty::bigint*pieces_per_garment>9007199254740991)
      OR EXISTS(SELECT 1 FROM public.order_components WHERE order_id=p_order_id) THEN
      RAISE EXCEPTION 'INVALID_MANIFEST' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.order_components(order_id,recipe_id,component_id,component_name_snapshot,pieces_per_garment,expected_qty,sort_order)
      SELECT p_order_id,batch.recipe_id,id,component_name,pieces_per_garment,batch.target_qty::bigint*pieces_per_garment,sort_order
      FROM public.recipe_components WHERE recipe_id=batch.recipe_id;
    standard_yards:=recipe.std_fabric_yards; cap:=recipe.wastage_cap_pct;
  ELSE
    SELECT * INTO first_attempt FROM public.verification_attempts WHERE order_id=p_order_id ORDER BY attempt_no LIMIT 1;
    IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.order_components WHERE order_id=p_order_id)
      OR EXISTS(SELECT 1 FROM public.order_components WHERE order_id=p_order_id AND expected_qty<>batch.target_qty::bigint*pieces_per_garment) THEN
      RAISE EXCEPTION 'INVALID_FROZEN_MANIFEST' USING ERRCODE='22023';
    END IF;
    standard_yards:=first_attempt.std_fabric_yards_snapshot; cap:=first_attempt.wastage_cap_pct_snapshot;
  END IF;
  SELECT coalesce(max(attempt_no),0)+1 INTO attempt_number FROM public.verification_attempts WHERE order_id=p_order_id;
  INSERT INTO public.verification_attempts(order_id,recipe_id,attempt_no,submitted_by,target_qty_snapshot,fabric_roll_id_snapshot,
    std_fabric_yards_snapshot,wastage_cap_pct_snapshot,actual_fabric_yds,expected_fabric_yds)
    VALUES(p_order_id,batch.recipe_id,attempt_number,p_actor_id,batch.target_qty,batch.fabric_roll_id,standard_yards,cap,batch.actual_fabric_yds,batch.target_qty*standard_yards)
    RETURNING id INTO attempt;
  INSERT INTO public.verification_items(order_id,attempt_id,order_component_id,component_id,expected_qty)
    SELECT p_order_id,attempt,id,component_id,expected_qty FROM public.order_components WHERE order_id=p_order_id;
  UPDATE public.cutting_orders SET status='PENDING_VERIFICATION',first_submitted_at=coalesce(first_submitted_at,clock_timestamp()),
    current_attempt_id=attempt,revision=revision+1 WHERE id=p_order_id;
  RETURN p_order_id;
END $$;

CREATE FUNCTION app_private.cutting_recut(p_actor_id uuid,p_order_id uuid,p_revision bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE batch public.cutting_orders;
BEGIN
  PERFORM app_private.production_assert_actor(p_actor_id,'cutting_supervisor');
  SELECT * INTO batch FROM public.cutting_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF batch.status<>'REJECTED' OR p_revision IS NULL OR batch.revision<>p_revision THEN
    RAISE EXCEPTION 'STALE_OR_INVALID_STATE' USING ERRCODE='40001';
  END IF;
  UPDATE public.cutting_orders SET status='CUTTING_IN_PROGRESS',revision=revision+1 WHERE id=p_order_id;
  RETURN p_order_id;
END $$;

CREATE FUNCTION public.cutting_create(p_actor_id uuid,p_recipe_id uuid,p_target_qty integer,p_fabric_roll_id text,p_actual_fabric numeric) RETURNS uuid
LANGUAGE sql SET search_path='' AS $$ SELECT app_private.cutting_create(p_actor_id,p_recipe_id,p_target_qty,p_fabric_roll_id,p_actual_fabric); $$;
CREATE FUNCTION public.cutting_edit(p_actor_id uuid,p_order_id uuid,p_revision bigint,p_recipe_id uuid DEFAULT NULL,p_target_qty integer DEFAULT NULL,p_fabric_roll_id text DEFAULT NULL,p_actual_fabric numeric DEFAULT NULL) RETURNS uuid
LANGUAGE sql SET search_path='' AS $$ SELECT app_private.cutting_edit(p_actor_id,p_order_id,p_revision,p_recipe_id,p_target_qty,p_fabric_roll_id,p_actual_fabric); $$;
CREATE FUNCTION public.cutting_submit(p_actor_id uuid,p_order_id uuid,p_revision bigint) RETURNS uuid
LANGUAGE sql SET search_path='' AS $$ SELECT app_private.cutting_submit(p_actor_id,p_order_id,p_revision); $$;
CREATE FUNCTION public.cutting_recut(p_actor_id uuid,p_order_id uuid,p_revision bigint) RETURNS uuid
LANGUAGE sql SET search_path='' AS $$ SELECT app_private.cutting_recut(p_actor_id,p_order_id,p_revision); $$;

DO $$ DECLARE fn record; BEGIN
  FOR fn IN SELECT p.oid::regprocedure AS signature,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='app_private' AND p.proname IN ('production_assert_actor','cutting_create','cutting_edit','cutting_submit','cutting_recut'))
      OR (n.nspname='public' AND p.proname IN ('cutting_create','cutting_edit','cutting_submit','cutting_recut')) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',fn.signature);
    IF fn.proname<>'production_assert_actor' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.signature); END IF;
    EXECUTE format('ALTER FUNCTION %s OWNER TO apparelflow_production_owner',fn.signature);
  END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,app_private FROM apparelflow_production_owner;
NOTIFY pgrst,'reload schema';
