-- Isolated transactional fixtures only. Never run against cloud.
BEGIN;
CREATE FUNCTION pg_temp.expect_verification_error(statement text,expected_state text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN BEGIN EXECUTE statement;EXCEPTION WHEN OTHERS THEN IF SQLSTATE=expected_state THEN RETURN;END IF;RAISE EXCEPTION 'Expected %, got %',expected_state,SQLSTATE;END;RAISE EXCEPTION 'Expected %, command succeeded',expected_state;END $$;
INSERT INTO auth.users(id) SELECT ('95000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,6) n;
INSERT INTO public.profiles(id,full_name,role,is_active) VALUES
 ('95000000-0000-4000-8000-000000000001','Supervisor','cutting_supervisor',true),
 ('95000000-0000-4000-8000-000000000002','Verifier','cutting_verifier',true),
 ('95000000-0000-4000-8000-000000000003','Sewing','sewing_supervisor',true),
 ('95000000-0000-4000-8000-000000000004','Admin','system_admin',true),
 ('95000000-0000-4000-8000-000000000005','Inactive','cutting_verifier',false),
 ('95000000-0000-4000-8000-000000000006','Other Verifier','cutting_verifier',true);
CREATE TEMP TABLE verification_fixture(name text PRIMARY KEY,id uuid);
GRANT SELECT,INSERT ON verification_fixture TO service_role;
SET LOCAL ROLE service_role;
DO $$ DECLARE scenario text;batch uuid;BEGIN
 FOREACH scenario IN ARRAY ARRAY['GREEN','YELLOW','RED','NULL','REJECT','ROLLBACK','CREATOR','MISSING','EMPTY'] LOOP
  batch:=public.cutting_create('95000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',50,scenario,CASE WHEN scenario='YELLOW' THEN 81 ELSE 94.5 END);
  PERFORM public.cutting_submit('95000000-0000-4000-8000-000000000001',batch,0);
  INSERT INTO verification_fixture VALUES(scenario,batch);
 END LOOP;
END $$;
-- ASMT-01/02/03/04, YELLOW, zero/null, subset, stale and input integrity.
DO $$ DECLARE batch uuid;attempt uuid;counts jsonb;scenario text;bad_actor uuid;actor uuid:='95000000-0000-4000-8000-000000000002';BEGIN
 FOREACH scenario IN ARRAY ARRAY['GREEN','YELLOW','RED','REJECT','ROLLBACK','MISSING'] LOOP
  SELECT id INTO batch FROM verification_fixture f WHERE f.name=scenario;
  SELECT current_attempt_id INTO attempt FROM public.cutting_orders WHERE id=batch;
  SELECT jsonb_agg(jsonb_build_object('componentId',component_id,'actualQty',expected_qty+CASE WHEN scenario='YELLOW' THEN 3 WHEN scenario='RED' THEN -1 ELSE 0 END)) INTO counts FROM public.order_components WHERE order_id=batch;
  PERFORM public.verification_save(actor,batch,attempt,1,counts);
 END LOOP;
 SELECT id INTO batch FROM verification_fixture WHERE name='NULL';SELECT current_attempt_id INTO attempt FROM public.cutting_orders WHERE id=batch;
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_approve(%L,%L,%L,1)',actor,batch,attempt),'P0422');
 SELECT jsonb_build_array(jsonb_build_object('componentId',component_id,'actualQty',0)) INTO counts FROM public.order_components WHERE order_id=batch LIMIT 1;
 PERFORM public.verification_save(actor,batch,attempt,1,counts);
 ASSERT (SELECT count(*) FROM public.verification_items WHERE attempt_id=attempt AND actual_qty=0 AND status='RED')=1,'Zero is counted shortage';
 ASSERT (SELECT count(*) FROM public.verification_items WHERE attempt_id=attempt AND actual_qty IS NULL)=4,'Subset keeps others uncounted';
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_approve(%L,%L,%L,2)',actor,batch,attempt),'P0422');
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_save(%L,%L,%L,2,%L::jsonb)',actor,batch,attempt,'[{"componentId":"20000000-0000-4000-8000-000000000001","actualQty":1.5}]'),'22023');
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_save(%L,%L,%L,2,%L::jsonb)',actor,batch,attempt,'[{"componentId":"20000000-0000-4000-8000-000000000001","actualQty":null}]'),'22023');
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_save(%L,%L,%L,2,%L::jsonb)',actor,batch,attempt,'[{"componentId":"20000000-0000-4000-8000-000000000001","actualQty":10,"status":"GREEN"}]'),'22023');
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_save(%L,%L,%L,2,%L::jsonb)',actor,batch,attempt,'[{"componentId":"20000000-0000-4000-8000-000000000001","actualQty":10},{"componentId":"20000000-0000-4000-8000-000000000001","actualQty":20}]'),'22023');
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_save(%L,%L,%L,2,%L::jsonb)',actor,batch,attempt,'[{"componentId":"20000000-0000-4000-8000-000000000006","actualQty":10}]'),'22023');
 SELECT id INTO batch FROM verification_fixture WHERE name='RED';SELECT current_attempt_id INTO attempt FROM public.cutting_orders WHERE id=batch;
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_approve(%L,%L,%L,2)',actor,batch,attempt),'P0422');
 ASSERT (SELECT status FROM public.cutting_orders WHERE id=batch)='PENDING_VERIFICATION','RED never verified';ASSERT NOT EXISTS(SELECT 1 FROM public.verification_logs WHERE order_id=batch),'No RED sign-off';
 FOREACH bad_actor IN ARRAY ARRAY['95000000-0000-4000-8000-000000000001'::uuid,'95000000-0000-4000-8000-000000000003'::uuid,'95000000-0000-4000-8000-000000000004'::uuid,'95000000-0000-4000-8000-000000000005'::uuid] LOOP
  PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_approve(%L,%L,%L,2)',bad_actor,batch,attempt),'42501');
  PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_reject(%L,%L,%L,2,%L)',bad_actor,batch,attempt,'Reason'),'42501');
  PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_save(%L,%L,%L,2,%L::jsonb)',bad_actor,batch,attempt,counts),'42501');
 END LOOP;
 SELECT id INTO batch FROM verification_fixture WHERE name='REJECT';SELECT current_attempt_id INTO attempt FROM public.cutting_orders WHERE id=batch;
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_reject(%L,%L,%L,2,NULL)',actor,batch,attempt),'22023');
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_reject(%L,%L,%L,2,%L)',actor,batch,attempt,chr(9)||chr(10)||chr(160)),'22023');
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_reject(%L,%L,%L,2,%L)',actor,batch,attempt,repeat('x',1001)),'22023');
 PERFORM public.verification_reject(actor,batch,attempt,2,'  Physical defect despite matching counts  ');
 ASSERT (SELECT rejection_note FROM public.verification_logs WHERE order_id=batch)='Physical defect despite matching counts','Trimmed physical-defect reason';
 ASSERT (SELECT count(*) FROM public.verification_log_items l JOIN public.verification_logs log ON log.id=l.log_id WHERE log.order_id=batch AND l.status='GREEN')=5,'GREEN rejection preserves evidence';
 FOREACH scenario IN ARRAY ARRAY['GREEN','YELLOW'] LOOP
  SELECT id INTO batch FROM verification_fixture f WHERE f.name=scenario;SELECT current_attempt_id INTO attempt FROM public.cutting_orders WHERE id=batch;
  PERFORM public.verification_approve(actor,batch,attempt,2);
  ASSERT (SELECT status='VERIFIED' AND approved_log_id IS NOT NULL FROM public.cutting_orders WHERE id=batch),'Valid persisted approval';
  ASSERT (SELECT verifier_id=actor AND verifier_name_snapshot='Verifier' FROM public.verification_logs WHERE order_id=batch),'Server attribution';
  ASSERT (SELECT count(*) FROM public.verification_log_items l JOIN public.verification_logs log ON log.id=l.log_id WHERE log.order_id=batch)=5,'Complete immutable evidence';
  PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_approve(%L,%L,%L,2)',actor,batch,attempt),'40001');
  PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_save(%L,%L,%L,3,%L::jsonb)',actor,batch,attempt,counts),'40001');
 END LOOP;
 ASSERT (SELECT wastage_pct FROM public.verification_logs WHERE order_id=(SELECT id FROM verification_fixture WHERE name='GREEN'))=5,'Correct signed wastage';
 ASSERT (SELECT wastage_pct FROM public.verification_logs WHERE order_id=(SELECT id FROM verification_fixture WHERE name='YELLOW'))=-10,'Negative wastage retained; YELLOW permitted';
END $$;
RESET ROLE;
-- Corruption fixtures bypass only isolated no-delete triggers; commands still hard-stop.
ALTER TABLE public.verification_items DISABLE TRIGGER prevent_delete;
DELETE FROM public.verification_items WHERE order_id=(SELECT id FROM verification_fixture WHERE name='MISSING') AND component_id='20000000-0000-4000-8000-000000000001';
DELETE FROM public.verification_items WHERE order_id=(SELECT id FROM verification_fixture WHERE name='EMPTY');
ALTER TABLE public.verification_items ENABLE TRIGGER prevent_delete;
ALTER TABLE public.order_components DISABLE TRIGGER prevent_delete;
DELETE FROM public.order_components WHERE order_id=(SELECT id FROM verification_fixture WHERE name='EMPTY');
ALTER TABLE public.order_components ENABLE TRIGGER prevent_delete;
SET LOCAL ROLE service_role;
DO $$ DECLARE scenario text;batch uuid;attempt uuid;BEGIN FOREACH scenario IN ARRAY ARRAY['MISSING','EMPTY'] LOOP
 SELECT id INTO batch FROM verification_fixture f WHERE f.name=scenario;SELECT current_attempt_id INTO attempt FROM public.cutting_orders WHERE id=batch;
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_approve(%L,%L,%L,%s)','95000000-0000-4000-8000-000000000002',batch,attempt,CASE WHEN scenario='MISSING' THEN 2 ELSE 1 END),'P0422');
END LOOP;END $$;
RESET ROLE;
-- Creator separation survives reassignment.
UPDATE public.profiles SET role='cutting_verifier' WHERE id='95000000-0000-4000-8000-000000000001';
SET LOCAL ROLE service_role;
DO $$ DECLARE batch uuid:=(SELECT id FROM verification_fixture WHERE name='CREATOR');attempt uuid;BEGIN
 SELECT current_attempt_id INTO attempt FROM public.cutting_orders WHERE id=batch;
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_approve(%L,%L,%L,1)','95000000-0000-4000-8000-000000000001',batch,attempt),'42501');
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_reject(%L,%L,%L,1,%L)','95000000-0000-4000-8000-000000000001',batch,attempt,'Self rejection'),'42501');
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_save(%L,%L,%L,1,%L::jsonb)','95000000-0000-4000-8000-000000000001',batch,attempt,'[]'),'42501');
END $$;
RESET ROLE;
UPDATE public.profiles SET role='cutting_supervisor' WHERE id='95000000-0000-4000-8000-000000000001';
-- Failure after log insertion proves full decision/audit rollback.
CREATE FUNCTION pg_temp.fail_decision_item() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected audit failure' USING ERRCODE='23514';END $$;
CREATE TRIGGER isolated_decision_failure BEFORE INSERT ON public.verification_log_items FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_decision_item();
SET LOCAL ROLE service_role;
DO $$ DECLARE batch uuid:=(SELECT id FROM verification_fixture WHERE name='ROLLBACK');attempt uuid;BEGIN
 SELECT current_attempt_id INTO attempt FROM public.cutting_orders WHERE id=batch;
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_approve(%L,%L,%L,2)','95000000-0000-4000-8000-000000000002',batch,attempt),'23514');
 ASSERT NOT EXISTS(SELECT 1 FROM public.verification_logs WHERE order_id=batch),'No partial log';
 ASSERT (SELECT status='OPEN' FROM public.verification_attempts WHERE id=attempt),'Attempt remains open';
 ASSERT (SELECT status='PENDING_VERIFICATION' AND revision=2 FROM public.cutting_orders WHERE id=batch),'No partial VERIFIED/revision';
END $$;
RESET ROLE;
DROP TRIGGER isolated_decision_failure ON public.verification_log_items;
SET LOCAL ROLE service_role;
DO $$ DECLARE batch uuid:=(SELECT id FROM verification_fixture WHERE name='REJECT');old_attempt uuid;new_attempt uuid;BEGIN
 SELECT current_attempt_id INTO old_attempt FROM public.cutting_orders WHERE id=batch;
 PERFORM public.cutting_recut('95000000-0000-4000-8000-000000000001',batch,3);
 PERFORM public.cutting_edit('95000000-0000-4000-8000-000000000001',batch,4,p_actual_fabric=>99,p_fabric_roll_id=>'RECUT');
 PERFORM public.cutting_submit('95000000-0000-4000-8000-000000000001',batch,5);
 SELECT current_attempt_id INTO new_attempt FROM public.cutting_orders WHERE id=batch;
 ASSERT new_attempt<>old_attempt,'Fresh resubmitted attempt';
 ASSERT (SELECT count(*) FROM public.verification_items WHERE attempt_id=new_attempt AND actual_qty IS NULL)=5,'Fresh uncounted state';
 ASSERT (SELECT count(*) FROM public.verification_log_items l JOIN public.verification_logs log ON log.id=l.log_id WHERE log.attempt_id=old_attempt AND l.actual_qty=l.expected_qty)=5,'Old evidence immutable';
 PERFORM pg_temp.expect_verification_error(format('SELECT public.verification_save(%L,%L,%L,6,%L::jsonb)','95000000-0000-4000-8000-000000000002',batch,old_attempt,'[]'),'40001');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM public.verification_evidence)=3,'Invoker evidence view applies verifier scope';
 PERFORM pg_temp.expect_verification_error('SELECT public.verification_approve(''95000000-0000-4000-8000-000000000002'',NULL,NULL,0)','42501');
 PERFORM pg_temp.expect_verification_error('UPDATE public.verification_logs SET decision=''APPROVED''','42501');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.verification_evidence)=0,'Admin cannot read manufacturing evidence';END $$;
RESET ROLE;
ROLLBACK;
