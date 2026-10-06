-- Isolated, rollback-only identity/admin fixtures. Never run against cloud.
BEGIN;
CREATE FUNCTION pg_temp.expect_identity_error(statement text, expected_state text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected %, got %', expected_state, SQLSTATE;
  END;
  RAISE EXCEPTION 'Expected %, statement unexpectedly succeeded', expected_state;
END;
$$;
INSERT INTO auth.users(id,email) VALUES
 ('91000000-0000-4000-8000-000000000001','admin@isolated.test'),
 ('91000000-0000-4000-8000-000000000002','supervisor@isolated.test'),
 ('91000000-0000-4000-8000-000000000003','new@isolated.test'),
 ('91000000-0000-4000-8000-000000000004','failure@isolated.test');
INSERT INTO public.profiles(id,full_name,role,is_active) VALUES
 ('91000000-0000-4000-8000-000000000001','Isolated Admin','system_admin',true),
 ('91000000-0000-4000-8000-000000000002','Isolated Supervisor','cutting_supervisor',true);

DO $$ BEGIN
  ASSERT NOT (SELECT rolcanlogin FROM pg_roles WHERE rolname='apparelflow_identity_owner'), 'Definer owner must not log in';
  ASSERT NOT pg_has_role('service_role','apparelflow_identity_owner','MEMBER'), 'Service must not inherit command owner';
  ASSERT NOT has_table_privilege('apparelflow_identity_owner','public.cutting_orders','SELECT,INSERT,UPDATE,DELETE'), 'Identity owner must not access production';
  ASSERT NOT has_table_privilege('apparelflow_identity_owner','public.recipes','SELECT,INSERT,UPDATE,DELETE'), 'Identity owner must not access recipes';
  ASSERT NOT has_schema_privilege('apparelflow_identity_owner','auth','USAGE'), 'No managed Auth schema grant needed';
  ASSERT NOT has_column_privilege('apparelflow_identity_owner','auth.users','email','SELECT,UPDATE'), 'Identity owner accesses only the safe private projection';
  ASSERT has_table_privilege('apparelflow_identity_owner','app_private.auth_identity_emails','SELECT'), 'Narrow identity view access required';
  ASSERT NOT has_table_privilege('service_role','app_private.auth_identity_emails','SELECT'), 'No direct API view access';
  ASSERT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app_private' AND p.proname LIKE 'identity_%' AND p.prosecdef) = 4, 'Four narrow private commands required';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'admin_%' AND p.prosecdef), 'Gateways must be invoker-only';
  ASSERT NOT has_function_privilege('authenticated','public.admin_list_users(uuid,text,public.app_role,boolean,integer,timestamptz,uuid)','EXECUTE'), 'User RPC access denied';
  ASSERT NOT has_function_privilege('anon','public.admin_create_profile(uuid,uuid,text,public.app_role,uuid)','EXECUTE'), 'Anon command access denied';
END $$;

SET LOCAL ROLE service_role;
DO $$ DECLARE users jsonb; BEGIN
  users := public.admin_list_users('91000000-0000-4000-8000-000000000001',p_limit=>20);
  ASSERT jsonb_array_length(users)=2, 'Admin can list safe identities';
  ASSERT users->0 ? 'email' AND NOT users->0 ? 'encrypted_password', 'Safe projection only';
  PERFORM pg_temp.expect_identity_error($q$SELECT public.admin_list_users('91000000-0000-4000-8000-000000000002')$q$,'42501');
  PERFORM pg_temp.expect_identity_error($q$SELECT public.admin_list_users('91000000-0000-4000-8000-000000000001',p_limit=>0)$q$,'22023');
  PERFORM pg_temp.expect_identity_error($q$INSERT INTO public.profiles(id,full_name,role) VALUES(gen_random_uuid(),'Bypass','system_admin')$q$,'42501');
  PERFORM pg_temp.expect_identity_error($q$UPDATE public.profiles SET is_active=false$q$,'42501');
  PERFORM pg_temp.expect_identity_error($q$UPDATE public.cutting_orders SET status='VERIFIED'$q$,'42501');
  PERFORM public.admin_create_profile('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','New Production User','cutting_verifier',gen_random_uuid());
  PERFORM pg_temp.expect_identity_error($q$SELECT public.admin_create_profile('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','Duplicate','cutting_verifier',gen_random_uuid())$q$,'23505');
  PERFORM pg_temp.expect_identity_error($q$SELECT public.admin_create_profile('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000004','Admin Promotion','system_admin',gen_random_uuid())$q$,'42501');
  PERFORM pg_temp.expect_identity_error($q$SELECT public.admin_update_profile('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',0,p_active=>false,p_request_id=>gen_random_uuid())$q$,'42501');
  PERFORM pg_temp.expect_identity_error($q$SELECT public.admin_update_profile('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',0,p_role=>'cutting_supervisor',p_request_id=>gen_random_uuid())$q$,'42501');
  PERFORM pg_temp.expect_identity_error($q$SELECT public.admin_update_profile('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003',0,p_role=>'system_admin',p_request_id=>gen_random_uuid())$q$,'42501');
  PERFORM pg_temp.expect_identity_error($q$SELECT public.admin_update_profile('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003',1,p_active=>false,p_request_id=>gen_random_uuid())$q$,'40001');
  PERFORM public.admin_update_profile('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003',0,p_role=>'sewing_supervisor',p_request_id=>gen_random_uuid());
  PERFORM public.admin_update_profile('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003',1,p_active=>false,p_request_id=>gen_random_uuid());
  ASSERT jsonb_array_length(public.admin_list_audit('91000000-0000-4000-8000-000000000001'))=3, 'Creation/role/status each audited';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.profiles)=1, 'Only own active profile visible';
  ASSERT (SELECT role FROM public.profiles)='cutting_supervisor', 'Profile role is database authority';
  PERFORM pg_temp.expect_identity_error($q$SELECT public.admin_list_users('91000000-0000-4000-8000-000000000001')$q$,'42501');
  PERFORM pg_temp.expect_identity_error($q$UPDATE public.profiles SET role='system_admin'$q$,'42501');
  PERFORM pg_temp.expect_identity_error($q$SELECT * FROM public.admin_audit_events$q$,'42501');
  ASSERT (SELECT count(*) FROM public.cutting_orders)=0, 'Supervisor reads only existing production rows';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.profiles)=0, 'Inactive JWT has no application profile access'; END $$;
RESET ROLE;

-- Inject a real audit failure: create/update must roll back their profile writes.
CREATE FUNCTION pg_temp.fail_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Isolated audit failure' USING ERRCODE='23514'; END $$;
CREATE TRIGGER isolated_audit_failure BEFORE INSERT ON public.admin_audit_events FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_admin_audit();
SET LOCAL ROLE service_role;
DO $$ BEGIN
  PERFORM pg_temp.expect_identity_error($q$SELECT public.admin_create_profile('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000004','Rollback User','cutting_verifier',gen_random_uuid())$q$,'23514');
  ASSERT NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='91000000-0000-4000-8000-000000000004'), 'Audit failure must roll back creation';
  PERFORM pg_temp.expect_identity_error($q$SELECT public.admin_update_profile('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003',2,p_active=>true,p_request_id=>gen_random_uuid())$q$,'23514');
  ASSERT (SELECT revision=2 AND NOT is_active FROM public.profiles WHERE id='91000000-0000-4000-8000-000000000003'), 'Audit failure must roll back status/revision';
  ASSERT (SELECT count(*) FROM public.admin_audit_events)=3, 'No partial audit';
END $$;
RESET ROLE;
DROP TRIGGER isolated_audit_failure ON public.admin_audit_events;
UPDATE public.profiles SET is_active=false WHERE id='91000000-0000-4000-8000-000000000001';
SET LOCAL ROLE service_role;
DO $$ BEGIN
  PERFORM pg_temp.expect_identity_error($q$SELECT public.admin_list_users('91000000-0000-4000-8000-000000000001')$q$,'42501');
  PERFORM pg_temp.expect_identity_error($q$SELECT public.admin_update_profile('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003',2,p_active=>true,p_request_id=>gen_random_uuid())$q$,'42501');
END $$;
RESET ROLE;
ROLLBACK;
