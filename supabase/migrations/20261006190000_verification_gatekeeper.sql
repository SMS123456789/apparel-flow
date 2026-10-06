-- G06: current verifier scope, explicit counts, and atomic immutable decisions.
ALTER POLICY orders_production_read ON public.cutting_orders USING (
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active AND
   (p.role='cutting_supervisor' OR (p.role='cutting_verifier' AND (status='PENDING_VERIFICATION' OR first_submitted_at IS NOT NULL)))));
GRANT SELECT,INSERT ON public.verification_logs,public.verification_log_items TO apparelflow_production_owner;
GRANT UPDATE(actual_qty,status,updated_by,updated_at) ON public.verification_items TO apparelflow_production_owner;
GRANT UPDATE(status,closed_at,revision,updated_at) ON public.verification_attempts TO apparelflow_production_owner;
GRANT UPDATE(approved_log_id) ON public.cutting_orders TO apparelflow_production_owner;
GRANT CREATE ON SCHEMA public,app_private TO apparelflow_production_owner;

-- Exact decimal evidence is transported as strings; invoker view retains RLS.
CREATE VIEW public.verification_evidence WITH(security_invoker=true) AS
 SELECT id,order_id,attempt_id,verifier_id,verifier_name_snapshot,decision,rejection_note,
   actual_fabric_yds::text AS actual_fabric_yds,expected_fabric_yds::text AS expected_fabric_yds,
   wastage_pct::text AS wastage_pct,created_at FROM public.verification_logs;
REVOKE ALL ON public.verification_evidence FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.verification_evidence TO authenticated,service_role;

CREATE FUNCTION app_private.verification_lock(p_actor uuid,p_order uuid,p_attempt uuid,p_revision bigint) RETURNS public.verification_attempts
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE batch public.cutting_orders; attempt public.verification_attempts;
BEGIN
 PERFORM app_private.production_assert_actor(p_actor,'cutting_verifier');
 SELECT * INTO batch FROM public.cutting_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR batch.first_submitted_at IS NULL THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
 IF batch.created_by=p_actor THEN RAISE EXCEPTION 'CREATOR_CANNOT_VERIFY' USING ERRCODE='42501'; END IF;
 IF batch.status<>'PENDING_VERIFICATION' OR p_revision IS NULL OR batch.revision<>p_revision OR p_attempt IS NULL OR batch.current_attempt_id<>p_attempt THEN
   RAISE EXCEPTION 'STALE_OR_INVALID_STATE' USING ERRCODE='40001'; END IF;
 SELECT * INTO attempt FROM public.verification_attempts WHERE id=p_attempt AND order_id=p_order FOR UPDATE;
 IF NOT FOUND OR attempt.status<>'OPEN' THEN RAISE EXCEPTION 'STALE_ATTEMPT' USING ERRCODE='40001'; END IF;
 RETURN attempt;
END $$;

CREATE FUNCTION app_private.verification_save(p_actor_id uuid,p_order_id uuid,p_attempt_id uuid,p_revision bigint,p_items jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry jsonb; component uuid; actual numeric;
BEGIN
 PERFORM app_private.verification_lock(p_actor_id,p_order_id,p_attempt_id,p_revision);
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
   RAISE EXCEPTION 'INVALID_COUNTS' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) e GROUP BY e->>'componentId' HAVING count(*)>1) THEN
   RAISE EXCEPTION 'DUPLICATE_COMPONENT' USING ERRCODE='22023'; END IF;
 FOR entry IN SELECT * FROM jsonb_array_elements(p_items) LOOP
   IF jsonb_typeof(entry)<>'object' OR entry-ARRAY['componentId','actualQty']::text[]<>'{}'::jsonb
     OR jsonb_typeof(entry->'componentId') IS DISTINCT FROM 'string' OR jsonb_typeof(entry->'actualQty') IS DISTINCT FROM 'number' THEN
     RAISE EXCEPTION 'INVALID_COUNTS' USING ERRCODE='22023'; END IF;
   component:=(entry->>'componentId')::uuid; actual:=(entry->>'actualQty')::numeric;
   IF actual<0 OR actual>9007199254740991 OR trunc(actual)<>actual THEN RAISE EXCEPTION 'INVALID_COUNT' USING ERRCODE='22023'; END IF;
   UPDATE public.verification_items SET actual_qty=actual::bigint,
     status=CASE WHEN actual=expected_qty THEN 'GREEN'::public.component_status WHEN actual>expected_qty THEN 'YELLOW'::public.component_status ELSE 'RED'::public.component_status END,
     updated_by=p_actor_id WHERE order_id=p_order_id AND attempt_id=p_attempt_id AND component_id=component;
   IF NOT FOUND THEN RAISE EXCEPTION 'FOREIGN_OR_MISSING_COMPONENT' USING ERRCODE='22023'; END IF;
 END LOOP;
 UPDATE public.verification_attempts SET revision=revision+1 WHERE id=p_attempt_id;
 UPDATE public.cutting_orders SET revision=revision+1 WHERE id=p_order_id;
 RETURN p_order_id;
END $$;

-- Internal shared sign-off; public callers get only named approve/reject commands.
CREATE FUNCTION app_private.verification_decide(p_actor_id uuid,p_order_id uuid,p_attempt_id uuid,p_revision bigint,p_decision public.verification_decision,p_reason text) RETURNS uuid
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE attempt public.verification_attempts; actor public.profiles; log uuid; decision_time timestamptz; violations jsonb; expected numeric;
BEGIN
 attempt:=app_private.verification_lock(p_actor_id,p_order_id,p_attempt_id,p_revision);
 SELECT * INTO actor FROM public.profiles WHERE id=p_actor_id;
 expected:=attempt.target_qty_snapshot*attempt.std_fabric_yards_snapshot;
 IF p_decision='REJECTED' THEN
   p_reason:=btrim(p_reason,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
   IF p_reason IS NULL OR char_length(p_reason) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='22023'; END IF;
 ELSIF p_decision='APPROVED' THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('componentId',c.component_id,'reason',CASE
     WHEN i.id IS NULL OR i.expected_qty<>c.expected_qty OR c.expected_qty<>attempt.target_qty_snapshot::bigint*c.pieces_per_garment THEN 'MISSING_COMPONENT'
     WHEN i.actual_qty IS NULL THEN 'UNCOUNTED' ELSE 'SHORTAGE' END)),'[]'::jsonb) INTO violations
   FROM public.order_components c LEFT JOIN public.verification_items i ON i.order_component_id=c.id AND i.attempt_id=p_attempt_id
   WHERE c.order_id=p_order_id AND (i.id IS NULL OR i.expected_qty<>c.expected_qty OR c.expected_qty<>attempt.target_qty_snapshot::bigint*c.pieces_per_garment OR i.actual_qty IS NULL OR i.actual_qty<c.expected_qty);
   IF jsonb_array_length(violations)>0 OR NOT EXISTS(SELECT 1 FROM public.order_components WHERE order_id=p_order_id)
     OR (SELECT count(*) FROM public.verification_items WHERE attempt_id=p_attempt_id)<>(SELECT count(*) FROM public.order_components WHERE order_id=p_order_id)
     OR expected<>attempt.expected_fabric_yds THEN
     RAISE EXCEPTION 'APPROVAL_BLOCKED' USING ERRCODE='P0422',DETAIL=violations::text; END IF;
   p_reason:=NULL;
 ELSE RAISE EXCEPTION 'INVALID_DECISION' USING ERRCODE='22023'; END IF;
 decision_time:=clock_timestamp();
 INSERT INTO public.verification_logs(order_id,attempt_id,verifier_id,verifier_name_snapshot,verifier_role_snapshot,decision,rejection_note,
   actual_fabric_yds,expected_fabric_yds,wastage_pct,created_at)
 VALUES(p_order_id,p_attempt_id,p_actor_id,actor.full_name,'cutting_verifier',p_decision,p_reason,
   attempt.actual_fabric_yds,expected,round(((attempt.actual_fabric_yds-expected)/expected)*100,12),decision_time) RETURNING id INTO log;
 INSERT INTO public.verification_log_items(log_id,order_id,attempt_id,order_component_id,component_id,component_name_snapshot,expected_qty,actual_qty,status)
 SELECT log,p_order_id,p_attempt_id,c.id,c.component_id,c.component_name_snapshot,c.expected_qty,i.actual_qty,
   CASE WHEN i.actual_qty IS NULL THEN NULL WHEN i.actual_qty=c.expected_qty THEN 'GREEN'::public.component_status WHEN i.actual_qty>c.expected_qty THEN 'YELLOW'::public.component_status ELSE 'RED'::public.component_status END
 FROM public.order_components c JOIN public.verification_items i ON i.order_component_id=c.id AND i.attempt_id=p_attempt_id WHERE c.order_id=p_order_id;
 UPDATE public.verification_attempts SET status=CASE WHEN p_decision='APPROVED' THEN 'APPROVED'::public.verification_attempt_status ELSE 'REJECTED'::public.verification_attempt_status END,
   closed_at=decision_time,revision=revision+1 WHERE id=p_attempt_id;
 UPDATE public.cutting_orders SET status=CASE WHEN p_decision='APPROVED' THEN 'VERIFIED'::public.production_status ELSE 'REJECTED'::public.production_status END,
   approved_log_id=CASE WHEN p_decision='APPROVED' THEN log ELSE NULL END,revision=revision+1 WHERE id=p_order_id;
 RETURN p_order_id;
END $$;
CREATE FUNCTION app_private.verification_approve(p_actor_id uuid,p_order_id uuid,p_attempt_id uuid,p_revision bigint) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT app_private.verification_decide(p_actor_id,p_order_id,p_attempt_id,p_revision,'APPROVED',NULL); $$;
CREATE FUNCTION app_private.verification_reject(p_actor_id uuid,p_order_id uuid,p_attempt_id uuid,p_revision bigint,p_reason text) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT app_private.verification_decide(p_actor_id,p_order_id,p_attempt_id,p_revision,'REJECTED',p_reason); $$;
CREATE FUNCTION public.verification_save(p_actor_id uuid,p_order_id uuid,p_attempt_id uuid,p_revision bigint,p_items jsonb) RETURNS uuid
LANGUAGE sql SET search_path='' AS $$ SELECT app_private.verification_save(p_actor_id,p_order_id,p_attempt_id,p_revision,p_items); $$;
CREATE FUNCTION public.verification_approve(p_actor_id uuid,p_order_id uuid,p_attempt_id uuid,p_revision bigint) RETURNS uuid
LANGUAGE sql SET search_path='' AS $$ SELECT app_private.verification_approve(p_actor_id,p_order_id,p_attempt_id,p_revision); $$;
CREATE FUNCTION public.verification_reject(p_actor_id uuid,p_order_id uuid,p_attempt_id uuid,p_revision bigint,p_reason text) RETURNS uuid
LANGUAGE sql SET search_path='' AS $$ SELECT app_private.verification_reject(p_actor_id,p_order_id,p_attempt_id,p_revision,p_reason); $$;
DO $$ DECLARE fn record; BEGIN
 FOR fn IN SELECT p.oid::regprocedure AS signature,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname IN ('public','app_private') AND p.proname IN ('verification_lock','verification_decide','verification_save','verification_approve','verification_reject') LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',fn.signature);
   IF fn.proname IN ('verification_save','verification_approve','verification_reject') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.signature); END IF;
   EXECUTE format('ALTER FUNCTION %s OWNER TO apparelflow_production_owner',fn.signature);
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,app_private FROM apparelflow_production_owner;
NOTIFY pgrst,'reload schema';
