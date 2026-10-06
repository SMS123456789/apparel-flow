-- Committed fixtures in disposable PostgreSQL only, needed by independent sessions.
INSERT INTO auth.users(id) VALUES ('96000000-0000-4000-8000-000000000001'),('96000000-0000-4000-8000-000000000002'),('96000000-0000-4000-8000-000000000003');
INSERT INTO public.profiles(id,full_name,role,is_active) VALUES
 ('96000000-0000-4000-8000-000000000001','Race Supervisor','cutting_supervisor',true),
 ('96000000-0000-4000-8000-000000000002','Race Verifier One','cutting_verifier',true),
 ('96000000-0000-4000-8000-000000000003','Race Verifier Two','cutting_verifier',true);
CREATE TABLE public.isolated_race_orders(name text PRIMARY KEY,id uuid,attempt uuid);
GRANT SELECT,INSERT ON public.isolated_race_orders TO service_role;
SET ROLE service_role;
DO $$ DECLARE scenario text;batch uuid;attempt uuid;counts jsonb;BEGIN
 FOREACH scenario IN ARRAY ARRAY['dual-approve','count-approve','reject-approve'] LOOP
  batch:=public.cutting_create('96000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',50,scenario,94.5);
  PERFORM public.cutting_submit('96000000-0000-4000-8000-000000000001',batch,0);
  SELECT current_attempt_id INTO attempt FROM public.cutting_orders WHERE id=batch;
  SELECT jsonb_agg(jsonb_build_object('componentId',component_id,'actualQty',expected_qty)) INTO counts FROM public.order_components WHERE order_id=batch;
  PERFORM public.verification_save('96000000-0000-4000-8000-000000000002',batch,attempt,1,counts);
  INSERT INTO public.isolated_race_orders VALUES(scenario,batch,attempt);
 END LOOP;
END $$;
RESET ROLE;
