-- G07: frozen recipe labels, VERIFIED-only sewing reads, once-only assembly start.
ALTER TABLE public.verification_attempts ADD COLUMN recipe_code_snapshot text, ADD COLUMN recipe_name_snapshot text;
-- These new labels are backfilled from the immutable seeded reference catalog.
-- No existing count/fabric/decision evidence is changed. DDL holds the table lock.
ALTER TABLE public.verification_attempts DISABLE TRIGGER guard_attempt_history;
UPDATE public.verification_attempts a SET recipe_code_snapshot=r.recipe_code,recipe_name_snapshot=r.name FROM public.recipes r WHERE r.id=a.recipe_id;
ALTER TABLE public.verification_attempts ENABLE TRIGGER guard_attempt_history;
ALTER TABLE public.verification_attempts ALTER COLUMN recipe_code_snapshot SET NOT NULL, ALTER COLUMN recipe_name_snapshot SET NOT NULL,
 ADD CONSTRAINT attempt_recipe_code_snapshot_check CHECK(char_length(recipe_code_snapshot) BETWEEN 1 AND 50 AND recipe_code_snapshot=btrim(recipe_code_snapshot)),
 ADD CONSTRAINT attempt_recipe_name_snapshot_check CHECK(char_length(recipe_name_snapshot) BETWEEN 1 AND 200 AND recipe_name_snapshot=btrim(recipe_name_snapshot));
CREATE FUNCTION app_private.snapshot_attempt_recipe() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 SELECT recipe_code_snapshot,recipe_name_snapshot INTO NEW.recipe_code_snapshot,NEW.recipe_name_snapshot FROM public.verification_attempts
 WHERE order_id=NEW.order_id ORDER BY attempt_no LIMIT 1;
 IF NOT FOUND THEN SELECT recipe_code,name INTO NEW.recipe_code_snapshot,NEW.recipe_name_snapshot FROM public.recipes WHERE id=NEW.recipe_id; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.snapshot_attempt_recipe() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER snapshot_attempt_recipe BEFORE INSERT ON public.verification_attempts FOR EACH ROW EXECUTE FUNCTION app_private.snapshot_attempt_recipe();

ALTER POLICY orders_production_read ON public.cutting_orders USING (
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active AND
 (p.role='cutting_supervisor' OR (p.role='cutting_verifier' AND first_submitted_at IS NOT NULL) OR (p.role='sewing_supervisor' AND status='VERIFIED'))));
ALTER POLICY verification_attempts_parent_read ON public.verification_attempts USING (
 EXISTS(SELECT 1 FROM public.cutting_orders o WHERE o.id=order_id AND
 (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role IN('cutting_supervisor','cutting_verifier')) OR (o.current_attempt_id=verification_attempts.id AND verification_attempts.status='APPROVED'))));
ALTER POLICY verification_items_parent_read ON public.verification_items USING (
 EXISTS(SELECT 1 FROM public.verification_attempts a WHERE a.id=attempt_id));
ALTER POLICY verification_logs_parent_read ON public.verification_logs USING (
 EXISTS(SELECT 1 FROM public.cutting_orders o WHERE o.id=order_id AND
 (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role IN('cutting_supervisor','cutting_verifier')) OR (o.approved_log_id=verification_logs.id AND verification_logs.decision='APPROVED'))));
ALTER POLICY verification_log_items_parent_read ON public.verification_log_items USING (
 EXISTS(SELECT 1 FROM public.verification_logs l WHERE l.id=log_id));

CREATE VIEW public.sewing_batches WITH(security_invoker=true) AS
 SELECT o.id,o.order_no,o.status,o.revision,o.target_qty,o.created_at,o.updated_at,o.sewing_started_at,o.started_by,
 a.recipe_code_snapshot,a.recipe_name_snapshot,a.fabric_roll_id_snapshot,a.wastage_cap_pct_snapshot::text AS wastage_cap_pct,
 l.id AS log_id,l.attempt_id,l.verifier_id,l.verifier_name_snapshot,l.created_at AS verified_at,
 l.actual_fabric_yds::text AS actual_fabric_yds,l.expected_fabric_yds::text AS expected_fabric_yds,l.wastage_pct::text AS wastage_pct
 FROM public.cutting_orders o JOIN public.verification_attempts a ON a.id=o.current_attempt_id AND a.order_id=o.id AND a.status='APPROVED'
 JOIN public.verification_logs l ON l.id=o.approved_log_id AND l.order_id=o.id AND l.attempt_id=a.id AND l.decision='APPROVED'
 WHERE o.status='VERIFIED' AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role='sewing_supervisor');
REVOKE ALL ON public.sewing_batches FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.sewing_batches TO authenticated,service_role;
GRANT UPDATE(sewing_started_at,started_by) ON public.cutting_orders TO apparelflow_production_owner;
GRANT CREATE ON SCHEMA public,app_private TO apparelflow_production_owner;
CREATE FUNCTION app_private.sewing_start(p_actor_id uuid,p_order_id uuid,p_revision bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE batch public.cutting_orders;
BEGIN
 PERFORM app_private.production_assert_actor(p_actor_id,'sewing_supervisor');
 SELECT * INTO batch FROM public.cutting_orders WHERE id=p_order_id AND status='VERIFIED' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
 IF p_revision IS NULL OR batch.revision<>p_revision OR batch.sewing_started_at IS NOT NULL THEN RAISE EXCEPTION 'STALE_OR_ALREADY_STARTED' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.verification_logs l JOIN public.verification_attempts a ON a.id=l.attempt_id WHERE l.id=batch.approved_log_id AND l.order_id=p_order_id AND l.decision='APPROVED' AND a.id=batch.current_attempt_id AND a.status='APPROVED') THEN
 RAISE EXCEPTION 'APPROVED_EVIDENCE_REQUIRED' USING ERRCODE='40001'; END IF;
 UPDATE public.cutting_orders SET sewing_started_at=clock_timestamp(),started_by=p_actor_id,revision=revision+1 WHERE id=p_order_id;
 RETURN p_order_id;
END $$;
CREATE FUNCTION public.sewing_start(p_actor_id uuid,p_order_id uuid,p_revision bigint) RETURNS uuid
LANGUAGE sql SET search_path='' AS $$ SELECT app_private.sewing_start(p_actor_id,p_order_id,p_revision); $$;
REVOKE ALL ON FUNCTION app_private.sewing_start(uuid,uuid,bigint),public.sewing_start(uuid,uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.sewing_start(uuid,uuid,bigint),public.sewing_start(uuid,uuid,bigint) TO service_role;
ALTER FUNCTION app_private.sewing_start(uuid,uuid,bigint) OWNER TO apparelflow_production_owner;
ALTER FUNCTION public.sewing_start(uuid,uuid,bigint) OWNER TO apparelflow_production_owner;
REVOKE CREATE ON SCHEMA public,app_private FROM apparelflow_production_owner;
NOTIFY pgrst,'reload schema';
