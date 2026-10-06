-- Isolated fixtures: never execute on the assessment cloud database.
BEGIN;
CREATE FUNCTION pg_temp.expect_sewing_error(statement text,expected_state text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN BEGIN EXECUTE statement;EXCEPTION WHEN OTHERS THEN IF SQLSTATE=expected_state THEN RETURN;END IF;RAISE EXCEPTION 'Expected %, got %',expected_state,SQLSTATE;END;RAISE EXCEPTION 'Expected %, command succeeded',expected_state;END $$;
INSERT INTO auth.users(id) SELECT ('97000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,5) n;
INSERT INTO public.profiles(id,full_name,role,is_active) VALUES
 ('97000000-0000-4000-8000-000000000001','Supervisor','cutting_supervisor',true),
 ('97000000-0000-4000-8000-000000000002','Verifier','cutting_verifier',true),
 ('97000000-0000-4000-8000-000000000003','Sewing','sewing_supervisor',true),
 ('97000000-0000-4000-8000-000000000004','Admin','system_admin',true),
 ('97000000-0000-4000-8000-000000000005','Inactive sewing','sewing_supervisor',false);
CREATE TEMP TABLE sewing_fixture(name text,id uuid);GRANT SELECT ON sewing_fixture TO authenticated,service_role;GRANT INSERT ON sewing_fixture TO service_role;
SET LOCAL ROLE service_role;
DO $$ DECLARE batch uuid;attempt uuid;counts jsonb;scenario text;
BEGIN
 FOREACH scenario IN ARRAY ARRAY['PREPARED','PENDING','REJECTED','VERIFIED','RECUT'] LOOP
 batch:=public.cutting_create('97000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',50,'SEWING-'||scenario,CASE WHEN scenario='VERIFIED' THEN 100 ELSE 94.5 END);
 INSERT INTO sewing_fixture VALUES(scenario,batch);
 IF scenario='PREPARED' THEN CONTINUE;END IF;
 PERFORM public.cutting_submit('97000000-0000-4000-8000-000000000001',batch,0);
 SELECT current_attempt_id INTO attempt FROM public.cutting_orders WHERE id=batch;
 IF scenario='PENDING' THEN CONTINUE;END IF;
 IF scenario IN('REJECTED','RECUT') THEN
 PERFORM public.verification_reject('97000000-0000-4000-8000-000000000002',batch,attempt,1,'Damaged panels');
 IF scenario='REJECTED' THEN CONTINUE;END IF;
 PERFORM public.cutting_recut('97000000-0000-4000-8000-000000000001',batch,2);
 PERFORM public.cutting_submit('97000000-0000-4000-8000-000000000001',batch,3);
 SELECT current_attempt_id INTO attempt FROM public.cutting_orders WHERE id=batch;
 END IF;
 SELECT jsonb_agg(jsonb_build_object('componentId',component_id,'actualQty',expected_qty)) INTO counts FROM public.order_components WHERE order_id=batch;
 PERFORM public.verification_save('97000000-0000-4000-8000-000000000002',batch,attempt,CASE WHEN scenario='RECUT' THEN 4 ELSE 1 END,counts);
 PERFORM public.verification_approve('97000000-0000-4000-8000-000000000002',batch,attempt,CASE WHEN scenario='RECUT' THEN 5 ELSE 2 END);
 END LOOP;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE child text;n bigint; BEGIN
 ASSERT (SELECT count(*) FROM public.cutting_orders)=2,'ASMT-05: sewing sees VERIFIED only';
 ASSERT NOT EXISTS(SELECT 1 FROM public.cutting_orders WHERE status<>'VERIFIED'),'No unapproved status leakage';
 ASSERT (SELECT count(*) FROM public.sewing_batches)=2,'Fixed VERIFIED sewing query';
 ASSERT (SELECT count(*) FROM public.recipes)=0 AND (SELECT count(*) FROM public.recipe_components)=0,'Sewing cannot read reference catalog';
 ASSERT (SELECT count(*) FROM public.order_components)=10,'Only verified manifest';
 ASSERT (SELECT count(*) FROM public.verification_attempts)=2 AND NOT EXISTS(SELECT 1 FROM public.verification_attempts WHERE status<>'APPROVED'),'No rejected attempts of a verified recut';
 ASSERT (SELECT count(*) FROM public.verification_items)=10,'Only approved counts';
 ASSERT (SELECT count(*) FROM public.verification_logs)=2 AND NOT EXISTS(SELECT 1 FROM public.verification_logs WHERE decision<>'APPROVED'),'Only approved evidence';
 ASSERT (SELECT count(*) FROM public.verification_log_items)=10 AND (SELECT count(*) FROM public.verification_evidence)=2,'Related views retain child scope';
 ASSERT NOT EXISTS(SELECT 1 FROM public.sewing_batches WHERE recipe_code_snapshot<>'REC-BL01' OR recipe_name_snapshot<>'Casual Blouse'),'Frozen recipe labels available without catalog';
 PERFORM pg_temp.expect_sewing_error('SELECT public.sewing_start(''97000000-0000-4000-8000-000000000003'',(SELECT id FROM sewing_fixture WHERE name=''VERIFIED''),3)','42501');
 PERFORM pg_temp.expect_sewing_error('UPDATE public.cutting_orders SET status=''VERIFIED''','42501');
END $$;
RESET ROLE;
DO $$ DECLARE actor uuid; BEGIN
 FOREACH actor IN ARRAY ARRAY['97000000-0000-4000-8000-000000000001'::uuid,'97000000-0000-4000-8000-000000000002'::uuid,'97000000-0000-4000-8000-000000000004'::uuid,'97000000-0000-4000-8000-000000000005'::uuid] LOOP
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);SET LOCAL ROLE authenticated;
 ASSERT (SELECT count(*) FROM public.sewing_batches)=0,'No other persona has sewing view access';RESET ROLE;
 END LOOP;
END $$;
SET LOCAL ROLE service_role;
DO $$ DECLARE batch uuid;actor uuid; BEGIN
 SELECT id INTO batch FROM sewing_fixture WHERE name='VERIFIED';
 ASSERT (SELECT l.wastage_pct>a.wastage_cap_pct_snapshot FROM public.verification_logs l JOIN public.verification_attempts a ON a.id=l.attempt_id WHERE l.order_id=batch),'Above-cap fabric does not block approval';
 FOREACH actor IN ARRAY ARRAY['97000000-0000-4000-8000-000000000001'::uuid,'97000000-0000-4000-8000-000000000002'::uuid,'97000000-0000-4000-8000-000000000004'::uuid,'97000000-0000-4000-8000-000000000005'::uuid] LOOP
 PERFORM pg_temp.expect_sewing_error(format('SELECT public.sewing_start(%L,%L,3)',actor,batch),'42501');END LOOP;
 PERFORM pg_temp.expect_sewing_error(format('SELECT public.sewing_start(%L,%L,2)','97000000-0000-4000-8000-000000000003',batch),'40001');
 PERFORM public.sewing_start('97000000-0000-4000-8000-000000000003',batch,3);
 ASSERT (SELECT status='VERIFIED' AND revision=4 AND started_by='97000000-0000-4000-8000-000000000003' AND sewing_started_at IS NOT NULL FROM public.cutting_orders WHERE id=batch),'Started retains status with actor/time/revision';
 PERFORM pg_temp.expect_sewing_error(format('SELECT public.sewing_start(%L,%L,4)','97000000-0000-4000-8000-000000000003',batch),'40001');
 SELECT id INTO batch FROM sewing_fixture WHERE name='PENDING';
 PERFORM pg_temp.expect_sewing_error(format('SELECT public.sewing_start(%L,%L,1)','97000000-0000-4000-8000-000000000003',batch),'P0002');
END $$;
RESET ROLE;
DO $$ BEGIN
 PERFORM pg_temp.expect_sewing_error('UPDATE public.cutting_orders SET started_by=''97000000-0000-4000-8000-000000000005'' WHERE sewing_started_at IS NOT NULL','23514');
 PERFORM pg_temp.expect_sewing_error('UPDATE public.verification_attempts SET recipe_name_snapshot=''Changed'' WHERE status=''APPROVED''','23514');
END $$;
ROLLBACK;
