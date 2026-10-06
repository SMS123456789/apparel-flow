-- Disposable database only; every fixture rolls back.
BEGIN;
CREATE FUNCTION pg_temp.expect_cutting_error(statement text, expected_state text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE=expected_state THEN RETURN; END IF;
  RAISE EXCEPTION 'Expected %, got %',expected_state,SQLSTATE;
END; RAISE EXCEPTION 'Expected %, command succeeded',expected_state; END $$;
INSERT INTO auth.users(id) SELECT ('92000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,6) n;
INSERT INTO public.profiles(id,full_name,role,is_active) VALUES
 ('92000000-0000-4000-8000-000000000001','Cutting One','cutting_supervisor',true),
 ('92000000-0000-4000-8000-000000000002','Cutting Two','cutting_supervisor',true),
 ('92000000-0000-4000-8000-000000000003','Verifier','cutting_verifier',true),
 ('92000000-0000-4000-8000-000000000004','Sewing','sewing_supervisor',true),
 ('92000000-0000-4000-8000-000000000005','Admin','system_admin',true),
 ('92000000-0000-4000-8000-000000000006','Inactive','cutting_supervisor',false);
CREATE TEMP TABLE cutting_fixture(id uuid);
GRANT SELECT,INSERT ON cutting_fixture TO service_role;
SET LOCAL ROLE service_role;
DO $$ DECLARE batch uuid; actor uuid:='92000000-0000-4000-8000-000000000001'; bad_actor uuid; BEGIN
  FOREACH bad_actor IN ARRAY ARRAY['92000000-0000-4000-8000-000000000003'::uuid,'92000000-0000-4000-8000-000000000004'::uuid,'92000000-0000-4000-8000-000000000005'::uuid,'92000000-0000-4000-8000-000000000006'::uuid] LOOP
    PERFORM pg_temp.expect_cutting_error(format('SELECT public.cutting_create(%L,%L,50,%L,94.5)',bad_actor,'10000000-0000-4000-8000-000000000001','BAD'),'42501');
  END LOOP;
  PERFORM pg_temp.expect_cutting_error(format('SELECT public.cutting_create(%L,%L,0,%L,94.5)',actor,'10000000-0000-4000-8000-000000000001','BAD'),'22023');
  PERFORM pg_temp.expect_cutting_error(format('SELECT public.cutting_create(%L,%L,50,%L,0)',actor,'10000000-0000-4000-8000-000000000001','BAD'),'23514');
  PERFORM pg_temp.expect_cutting_error(format('SELECT public.cutting_create(%L,%L,50,%L,1.1234)',actor,'10000000-0000-4000-8000-000000000001','BAD'),'23514');
  batch:=public.cutting_create(actor,'10000000-0000-4000-8000-000000000001',50,'CUTTING-TEST',94.5);
  INSERT INTO cutting_fixture VALUES(batch);
  ASSERT (SELECT status='CUTTING_IN_PROGRESS' AND created_by=actor AND revision=0 FROM public.cutting_orders WHERE id=batch),'Server-created initial state/identity';
  PERFORM public.cutting_edit(actor,batch,0,p_target_qty=>25,p_actual_fabric=>47.25);
  ASSERT (SELECT target_qty=25 AND revision=1 FROM public.cutting_orders WHERE id=batch),'Editable preparation';
  PERFORM pg_temp.expect_cutting_error(format('SELECT public.cutting_edit(%L,%L,0,p_target_qty=>50)',actor,batch),'40001');
  PERFORM public.cutting_edit(actor,batch,1,p_target_qty=>50,p_actual_fabric=>94.5);
  PERFORM public.cutting_submit(actor,batch,2);
  ASSERT (SELECT status='PENDING_VERIFICATION' AND revision=3 AND first_submitted_at IS NOT NULL FROM public.cutting_orders WHERE id=batch),'Legal pending transition';
  ASSERT (SELECT count(*) FROM public.order_components WHERE order_id=batch)=5,'Complete frozen manifest';
  ASSERT (SELECT expected_qty FROM public.order_components WHERE order_id=batch AND component_name_snapshot='Sleeve Cuffs')=100,'Recipe multiplier';
  ASSERT (SELECT expected_fabric_yds FROM public.verification_attempts WHERE order_id=batch)=90,'Authoritative expected fabric';
  ASSERT (SELECT count(*) FROM public.verification_items WHERE order_id=batch AND actual_qty IS NULL)=5,'Fresh uncounted set';
  PERFORM pg_temp.expect_cutting_error(format('SELECT public.cutting_submit(%L,%L,3)',actor,batch),'40001');
  PERFORM pg_temp.expect_cutting_error(format('SELECT public.cutting_edit(%L,%L,3,p_target_qty=>60)',actor,batch),'40001');
  PERFORM pg_temp.expect_cutting_error('UPDATE public.cutting_orders SET status=''VERIFIED''','42501');
END $$;
RESET ROLE;
-- Simulate a finalized rejection until G06 provides the decision command.
INSERT INTO public.verification_logs(order_id,attempt_id,verifier_id,verifier_name_snapshot,verifier_role_snapshot,decision,rejection_note,actual_fabric_yds,expected_fabric_yds,wastage_pct)
SELECT a.order_id,a.id,'92000000-0000-4000-8000-000000000003','Verifier','cutting_verifier','REJECTED','Re-cut required',a.actual_fabric_yds,a.expected_fabric_yds,5
FROM public.verification_attempts a WHERE order_id=(SELECT id FROM cutting_fixture);
INSERT INTO public.verification_log_items(log_id,order_id,attempt_id,order_component_id,component_id,component_name_snapshot,expected_qty,actual_qty,status)
SELECT l.id,l.order_id,l.attempt_id,c.id,c.component_id,c.component_name_snapshot,c.expected_qty,i.actual_qty,i.status
FROM public.verification_logs l JOIN public.order_components c ON c.order_id=l.order_id JOIN public.verification_items i ON i.attempt_id=l.attempt_id AND i.order_component_id=c.id;
UPDATE public.verification_attempts SET status='REJECTED',closed_at=clock_timestamp() WHERE order_id=(SELECT id FROM cutting_fixture);
UPDATE public.cutting_orders SET status='REJECTED',revision=revision+1 WHERE id=(SELECT id FROM cutting_fixture);
SET LOCAL ROLE service_role;
DO $$ DECLARE batch uuid:=(SELECT id FROM cutting_fixture); actor uuid:='92000000-0000-4000-8000-000000000002'; BEGIN
  PERFORM public.cutting_recut(actor,batch,4);
  PERFORM pg_temp.expect_cutting_error(format('SELECT public.cutting_edit(%L,%L,5,p_target_qty=>60)',actor,batch),'22023');
  PERFORM public.cutting_edit(actor,batch,5,p_fabric_roll_id=>'RECUT-ROLL',p_actual_fabric=>93);
  PERFORM public.cutting_submit(actor,batch,6);
  ASSERT (SELECT count(*) FROM public.verification_attempts WHERE order_id=batch)=2,'Same order, two attempts';
  ASSERT (SELECT count(*) FROM public.verification_items i JOIN public.verification_attempts a ON a.id=i.attempt_id WHERE a.order_id=batch AND a.attempt_no=2 AND i.actual_qty IS NULL)=5,'Resubmission resets count state';
  ASSERT (SELECT rejection_note FROM public.verification_logs WHERE order_id=batch)='Re-cut required','Historical evidence retained';
  ASSERT (SELECT actual_fabric_yds FROM public.verification_attempts WHERE order_id=batch AND attempt_no=1)=94.5,'Old submitted fabric unchanged';
END $$;
RESET ROLE;
-- Factory scope, recipe visibility, inactivity and narrow command grants.
SELECT set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM public.cutting_orders)=1,'Another supervisor sees factory order';
 ASSERT (SELECT count(*) FROM public.recipes)=2,'Supervisor sees seeded recipes';
 PERFORM pg_temp.expect_cutting_error('SELECT public.cutting_submit(''92000000-0000-4000-8000-000000000002'',(SELECT id FROM public.cutting_orders),7)','42501');
 PERFORM pg_temp.expect_cutting_error('UPDATE public.verification_items SET actual_qty=expected_qty,status=''GREEN''','42501');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.recipes)=2,'Verifier reads catalog'; ASSERT (SELECT count(*) FROM public.cutting_orders)=1,'Verifier reads submitted verification history'; END $$;
RESET ROLE;
DO $$ DECLARE who uuid; n bigint; BEGIN
 FOREACH who IN ARRAY ARRAY['92000000-0000-4000-8000-000000000004'::uuid,'92000000-0000-4000-8000-000000000005'::uuid,'92000000-0000-4000-8000-000000000006'::uuid] LOOP
   PERFORM set_config('request.jwt.claim.sub',who::text,true); SET LOCAL ROLE authenticated;
   SELECT count(*) INTO n FROM public.cutting_orders; ASSERT n=0,'No unauthorized production rows';
   SELECT count(*) INTO n FROM public.order_components; ASSERT n=0,'No unauthorized child rows';
   SELECT count(*) INTO n FROM public.recipes; ASSERT n=0,'No unauthorized catalog';
   RESET ROLE;
 END LOOP;
END $$;
-- Inject submission failure; manifest and attempt insertion must roll back too.
CREATE FUNCTION pg_temp.fail_cutting_item() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected failure' USING ERRCODE='23514'; END $$;
CREATE TRIGGER isolated_cutting_failure BEFORE INSERT ON public.verification_items FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_cutting_item();
SET LOCAL ROLE service_role;
DO $$ DECLARE batch uuid; BEGIN
 batch:=public.cutting_create('92000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',50,'ROLLBACK',55);
 PERFORM pg_temp.expect_cutting_error(format('SELECT public.cutting_submit(%L,%L,0)','92000000-0000-4000-8000-000000000001',batch),'23514');
 ASSERT (SELECT status='CUTTING_IN_PROGRESS' AND first_submitted_at IS NULL AND revision=0 FROM public.cutting_orders WHERE id=batch),'Failed submission leaves preparation intact';
 ASSERT NOT EXISTS(SELECT 1 FROM public.order_components WHERE order_id=batch),'No partial manifest';
 ASSERT NOT EXISTS(SELECT 1 FROM public.verification_attempts WHERE order_id=batch),'No partial attempt';
END $$;
RESET ROLE;
ROLLBACK;
