-- Disposable PostgreSQL test database only. Every fixture/permission change rolls back.
BEGIN;
SET LOCAL TIME ZONE 'UTC';

CREATE FUNCTION pg_temp.expect_error(statement text, expected_state text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected SQLSTATE %, got % for test statement %', expected_state, SQLSTATE, statement;
  END;
  RAISE EXCEPTION 'Expected SQLSTATE %, statement unexpectedly succeeded: %', expected_state, statement;
END;
$$;

INSERT INTO auth.users(id) VALUES
  ('81000000-0000-4000-8000-000000000001'), ('81000000-0000-4000-8000-000000000002'),
  ('81000000-0000-4000-8000-000000000003'), ('81000000-0000-4000-8000-000000000004');
INSERT INTO public.profiles(id, full_name, role, is_active) VALUES
  ('81000000-0000-4000-8000-000000000001', 'Isolated Supervisor', 'cutting_supervisor', true),
  ('81000000-0000-4000-8000-000000000002', 'Isolated Verifier', 'cutting_verifier', true),
  ('81000000-0000-4000-8000-000000000003', 'Isolated Sewing', 'sewing_supervisor', true);
INSERT INTO public.profiles(id, full_name, role) VALUES
  ('81000000-0000-4000-8000-000000000004', 'Isolated Admin', 'system_admin');
DO $$ BEGIN
  ASSERT NOT (SELECT is_active FROM public.profiles WHERE role = 'system_admin'), 'Profile activity must default safely';
END $$;
UPDATE public.profiles SET is_active = true WHERE role = 'system_admin';
DO $$ BEGIN
  ASSERT (SELECT updated_at > created_at FROM public.profiles WHERE role = 'system_admin'), 'Reusable updated_at trigger failed';
END $$;

DO $$
DECLARE
  base_insert text := 'INSERT INTO public.cutting_orders(recipe_id,target_qty,fabric_roll_id,actual_fabric_yds,created_by) VALUES (''10000000-0000-4000-8000-000000000001'',%s,%L,%s,''81000000-0000-4000-8000-000000000001'')';
BEGIN
  PERFORM pg_temp.expect_error(format(base_insert, '0', 'ROLL', '1'), '23514');
  PERFORM pg_temp.expect_error(format(base_insert, '-1', 'ROLL', '1'), '23514');
  PERFORM pg_temp.expect_error(format(base_insert, '''1.5''', 'ROLL', '1'), '22P02');
  PERFORM pg_temp.expect_error(format(base_insert, '2147483648', 'ROLL', '1'), '22003');
  PERFORM pg_temp.expect_error(format(base_insert, '1', '  ', '1'), '23514');
  PERFORM pg_temp.expect_error(format(base_insert, '1', 'ROLL', '0'), '23514');
  PERFORM pg_temp.expect_error(format(base_insert, '1', 'ROLL', '-0.001'), '23514');
  PERFORM pg_temp.expect_error(format(base_insert, '1', 'ROLL', '1.1234'), '23514');
  PERFORM pg_temp.expect_error(format(base_insert, '1', 'ROLL', '1000000000'), '23514');
  PERFORM pg_temp.expect_error('UPDATE public.recipes SET name = ''Changed'' WHERE recipe_code = ''REC-BL01''', '23514');
  PERFORM pg_temp.expect_error('INSERT INTO public.recipes(recipe_code,name,category,std_fabric_yards,wastage_cap_pct) VALUES (''REC-BL01'',''Duplicate'',''Blouse'',1.8,5)', '23505');
  PERFORM pg_temp.expect_error('INSERT INTO public.recipe_components(recipe_id,component_name,pieces_per_garment,sort_order) VALUES (''10000000-0000-4000-8000-000000000001'',''Invalid'',0,6)', '23514');
  PERFORM pg_temp.expect_error('UPDATE public.profiles SET id = ''81000000-0000-4000-8000-000000000003'' WHERE role = ''system_admin''', '23514');
  PERFORM pg_temp.expect_error('DELETE FROM public.profiles WHERE role = ''system_admin''', '23514');
  PERFORM pg_temp.expect_error('DELETE FROM auth.users WHERE id = ''81000000-0000-4000-8000-000000000004''', '23503');
END;
$$;

INSERT INTO public.cutting_orders(id,recipe_id,target_qty,fabric_roll_id,actual_fabric_yds,created_by) VALUES
  ('82000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',50,'ISOLATED-A',200,'81000000-0000-4000-8000-000000000001'),
  ('82000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',50,'ISOLATED-B',55,'81000000-0000-4000-8000-000000000001'),
  ('82000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',10,'ISOLATED-C',16,'81000000-0000-4000-8000-000000000001');

SELECT pg_temp.expect_error($sql$
  INSERT INTO public.order_components(order_id,recipe_id,component_id,component_name_snapshot,pieces_per_garment,expected_qty,sort_order)
  VALUES ('82000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Wrong recipe',1,50,1)
$sql$, '23503');

INSERT INTO public.order_components(order_id,recipe_id,component_id,component_name_snapshot,pieces_per_garment,expected_qty,sort_order)
SELECT o.id,o.recipe_id,c.id,c.component_name,c.pieces_per_garment,o.target_qty::bigint*c.pieces_per_garment,c.sort_order
FROM public.cutting_orders o JOIN public.recipe_components c ON c.recipe_id = o.recipe_id;
UPDATE public.cutting_orders SET first_submitted_at = now(), status = 'PENDING_VERIFICATION';
INSERT INTO public.verification_attempts(id,order_id,recipe_id,attempt_no,submitted_by,target_qty_snapshot,fabric_roll_id_snapshot,std_fabric_yards_snapshot,wastage_cap_pct_snapshot,actual_fabric_yds,expected_fabric_yds)
SELECT CASE o.fabric_roll_id
  WHEN 'ISOLATED-A' THEN '83000000-0000-4000-8000-000000000001'::uuid
  WHEN 'ISOLATED-B' THEN '83000000-0000-4000-8000-000000000002'::uuid
  ELSE '83000000-0000-4000-8000-000000000003'::uuid END,
  o.id,o.recipe_id,1,o.created_by,o.target_qty,o.fabric_roll_id,r.std_fabric_yards,r.wastage_cap_pct,o.actual_fabric_yds,o.target_qty*r.std_fabric_yards
FROM public.cutting_orders o JOIN public.recipes r ON r.id = o.recipe_id;
UPDATE public.cutting_orders o SET current_attempt_id = a.id FROM public.verification_attempts a WHERE a.order_id = o.id;
INSERT INTO public.verification_items(order_id,attempt_id,order_component_id,component_id,expected_qty)
SELECT c.order_id,a.id,c.id,c.component_id,c.expected_qty FROM public.order_components c JOIN public.verification_attempts a ON a.order_id = c.order_id;

DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.verification_items WHERE actual_qty IS NULL AND status IS NULL AND variance_qty IS NULL) = 15, 'Uncounted must remain nullable';
  ASSERT (SELECT count(DISTINCT order_no) FROM public.cutting_orders) = 3, 'Server numbers must be unique';
  ASSERT NOT EXISTS (SELECT 1 FROM public.cutting_orders WHERE order_no !~ '^AF-[0-9]{12}$'), 'Order number format mismatch';
  PERFORM pg_temp.expect_error('UPDATE public.cutting_orders SET target_qty = 51 WHERE fabric_roll_id = ''ISOLATED-A''', '23514');
  PERFORM pg_temp.expect_error('UPDATE public.cutting_orders SET recipe_id = ''10000000-0000-4000-8000-000000000002'' WHERE fabric_roll_id = ''ISOLATED-A''', '23514');
  PERFORM pg_temp.expect_error('UPDATE public.cutting_orders SET first_submitted_at = NULL WHERE fabric_roll_id = ''ISOLATED-A''', '23514');
  PERFORM pg_temp.expect_error('UPDATE public.order_components SET expected_qty = expected_qty + 1', '23514');
  PERFORM pg_temp.expect_error('DELETE FROM public.order_components', '23514');
  PERFORM pg_temp.expect_error('INSERT INTO public.order_components SELECT * FROM public.order_components LIMIT 1', '23514');
  PERFORM pg_temp.expect_error('UPDATE public.verification_attempts SET actual_fabric_yds = 201 WHERE order_id = ''82000000-0000-4000-8000-000000000001''', '23514');
  PERFORM pg_temp.expect_error($sql$INSERT INTO public.verification_attempts(order_id,recipe_id,attempt_no,submitted_by,target_qty_snapshot,fabric_roll_id_snapshot,std_fabric_yards_snapshot,wastage_cap_pct_snapshot,actual_fabric_yds,expected_fabric_yds)
    SELECT order_id,recipe_id,2,submitted_by,target_qty_snapshot,fabric_roll_id_snapshot,std_fabric_yards_snapshot,wastage_cap_pct_snapshot,actual_fabric_yds,expected_fabric_yds FROM public.verification_attempts WHERE id = '83000000-0000-4000-8000-000000000001'$sql$, '23505');
  PERFORM pg_temp.expect_error($sql$INSERT INTO public.verification_items(order_id,attempt_id,order_component_id,component_id,expected_qty)
    SELECT c.order_id,'83000000-0000-4000-8000-000000000001',c.id,c.component_id,c.expected_qty FROM public.order_components c WHERE c.order_id = '82000000-0000-4000-8000-000000000002' LIMIT 1$sql$, '23503');
  PERFORM pg_temp.expect_error('UPDATE public.verification_items SET expected_qty = expected_qty + 1', '23514');
  PERFORM pg_temp.expect_error('UPDATE public.verification_items SET actual_qty = -1, status = ''RED''', '23514');
  PERFORM pg_temp.expect_error('UPDATE public.verification_items SET actual_qty = ''1.5'', status = ''RED''', '22P02');
  PERFORM pg_temp.expect_error('UPDATE public.verification_items SET actual_qty = 9007199254740992, status = ''YELLOW''', '23514');
  PERFORM pg_temp.expect_error('UPDATE public.verification_items SET actual_qty = 0, status = ''GREEN''', '23514');
END $$;
UPDATE public.verification_items SET actual_qty = 0, status = 'RED', updated_by = '81000000-0000-4000-8000-000000000002';
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.verification_items WHERE actual_qty <> 0 OR variance_qty <> -expected_qty), 'Zero count and signed variance must persist';
END $$;
UPDATE public.verification_items SET actual_qty = expected_qty, status = 'GREEN';
UPDATE public.verification_items SET actual_qty = expected_qty + 2, status = 'YELLOW'
WHERE attempt_id = '83000000-0000-4000-8000-000000000001' AND component_id = '20000000-0000-4000-8000-000000000005';

CREATE FUNCTION pg_temp.insert_rejection(note text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.verification_logs(order_id,attempt_id,verifier_id,verifier_name_snapshot,verifier_role_snapshot,decision,rejection_note,actual_fabric_yds,expected_fabric_yds,wastage_pct)
  VALUES ('82000000-0000-4000-8000-000000000003','83000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000002','Isolated Verifier','cutting_verifier','REJECTED',note,16,18,-11.111111111111);
END $$;
SELECT pg_temp.expect_error('SELECT pg_temp.insert_rejection(NULL)', '23514');
SELECT pg_temp.expect_error('SELECT pg_temp.insert_rejection(''   '')', '23514');
SELECT pg_temp.expect_error($sql$SELECT pg_temp.insert_rejection(chr(9) || chr(10))$sql$, '23514');
SELECT pg_temp.expect_error($sql$SELECT pg_temp.insert_rejection(chr(160) || 'Defect')$sql$, '23514');
SELECT pg_temp.expect_error($sql$SELECT pg_temp.insert_rejection('Defect' || chr(65279))$sql$, '23514');
SELECT pg_temp.expect_error('SELECT pg_temp.insert_rejection('' padded '')', '23514');
SELECT pg_temp.expect_error('SELECT pg_temp.insert_rejection(repeat(''x'',1001))', '23514');
SELECT pg_temp.insert_rejection('Physical defect with GREEN counts');

INSERT INTO public.verification_logs(id,order_id,attempt_id,verifier_id,verifier_name_snapshot,verifier_role_snapshot,decision,actual_fabric_yds,expected_fabric_yds,wastage_pct)
VALUES ('84000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','Isolated Verifier','cutting_verifier','APPROVED',200,90,122.222222222222);
INSERT INTO public.verification_log_items(log_id,order_id,attempt_id,order_component_id,component_id,component_name_snapshot,expected_qty,actual_qty,status)
SELECT l.id,l.order_id,l.attempt_id,c.id,c.component_id,c.component_name_snapshot,i.expected_qty,i.actual_qty,i.status
FROM public.verification_logs l JOIN public.verification_items i ON i.attempt_id = l.attempt_id JOIN public.order_components c ON c.id = i.order_component_id;
DO $$ BEGIN
  ASSERT (SELECT wastage_pct FROM public.verification_logs WHERE decision = 'REJECTED') < 0, 'Negative fabric variance must not be clamped';
  ASSERT (SELECT wastage_pct FROM public.verification_logs WHERE decision = 'APPROVED') > 5, 'Wastage cap must remain nonblocking';
  ASSERT (SELECT variance_qty FROM public.verification_log_items WHERE log_id = '84000000-0000-4000-8000-000000000001' AND component_id = '20000000-0000-4000-8000-000000000005') = 2, 'Signed component evidence mismatch';
  PERFORM pg_temp.expect_error('UPDATE public.verification_logs SET wastage_pct = 0', '23514');
  PERFORM pg_temp.expect_error('DELETE FROM public.verification_logs', '23514');
  PERFORM pg_temp.expect_error('UPDATE public.verification_log_items SET actual_qty = 0', '23514');
  PERFORM pg_temp.expect_error('DELETE FROM public.verification_log_items', '23514');
END $$;
UPDATE public.verification_attempts a SET status = l.decision::text::public.verification_attempt_status, closed_at = clock_timestamp()
FROM public.verification_logs l WHERE l.attempt_id = a.id;
UPDATE public.cutting_orders SET status = 'VERIFIED', approved_log_id = '84000000-0000-4000-8000-000000000001' WHERE fabric_roll_id = 'ISOLATED-A';
UPDATE public.cutting_orders SET status = 'REJECTED' WHERE fabric_roll_id = 'ISOLATED-C';
SET CONSTRAINTS ALL IMMEDIATE;

DO $$ BEGIN
  PERFORM pg_temp.expect_error('UPDATE public.verification_attempts SET revision = revision + 1 WHERE id = ''83000000-0000-4000-8000-000000000001''', '23514');
  PERFORM pg_temp.expect_error('UPDATE public.verification_items SET actual_qty = expected_qty + 3, status = ''YELLOW'' WHERE attempt_id = ''83000000-0000-4000-8000-000000000001''', '23514');
  PERFORM pg_temp.expect_error('INSERT INTO public.verification_items(order_id,attempt_id,order_component_id,component_id,expected_qty) SELECT order_id,attempt_id,order_component_id,component_id,expected_qty FROM public.verification_items WHERE attempt_id = ''83000000-0000-4000-8000-000000000001'' LIMIT 1', '23514');
  PERFORM pg_temp.expect_error('INSERT INTO public.verification_log_items SELECT * FROM public.verification_log_items WHERE log_id = ''84000000-0000-4000-8000-000000000001'' LIMIT 1', '428C9');
  PERFORM pg_temp.expect_error($sql$INSERT INTO public.verification_log_items(log_id,order_id,attempt_id,order_component_id,component_id,component_name_snapshot,expected_qty,actual_qty,status)
    SELECT log_id,order_id,attempt_id,order_component_id,component_id,component_name_snapshot,expected_qty,actual_qty,status FROM public.verification_log_items WHERE log_id = '84000000-0000-4000-8000-000000000001' LIMIT 1$sql$, '23514');
  PERFORM pg_temp.expect_error('SELECT pg_temp.insert_rejection(''Late insertion'')', '23514');
  PERFORM pg_temp.expect_error('UPDATE public.cutting_orders SET fabric_roll_id = ''Changed'' WHERE status = ''VERIFIED''', '23514');
  PERFORM pg_temp.expect_error('UPDATE public.cutting_orders SET sewing_started_at = now(), started_by = ''81000000-0000-4000-8000-000000000003'' WHERE fabric_roll_id = ''ISOLATED-B''', '23514');
  PERFORM pg_temp.expect_error($sql$UPDATE public.cutting_orders SET status = 'VERIFIED', approved_log_id = (SELECT id FROM public.verification_logs WHERE decision = 'REJECTED') WHERE fabric_roll_id = 'ISOLATED-C'$sql$, '23503');
END $$;
UPDATE public.cutting_orders SET sewing_started_at = clock_timestamp(), started_by = '81000000-0000-4000-8000-000000000003' WHERE status = 'VERIFIED';
DO $$ BEGIN
  ASSERT (SELECT status FROM public.cutting_orders WHERE fabric_roll_id = 'ISOLATED-A') = 'VERIFIED', 'Sewing must preserve VERIFIED';
  PERFORM pg_temp.expect_error('UPDATE public.cutting_orders SET sewing_started_at = NULL, started_by = NULL WHERE status = ''VERIFIED''', '23514');
END $$;

-- Same order, frozen BOM, new attempt; earlier attempt and evidence survive.
UPDATE public.cutting_orders SET status = 'CUTTING_IN_PROGRESS', actual_fabric_yds = 18 WHERE fabric_roll_id = 'ISOLATED-C';
INSERT INTO public.verification_attempts(order_id,recipe_id,attempt_no,submitted_by,target_qty_snapshot,fabric_roll_id_snapshot,std_fabric_yards_snapshot,wastage_cap_pct_snapshot,actual_fabric_yds,expected_fabric_yds)
SELECT order_id,recipe_id,2,submitted_by,target_qty_snapshot,fabric_roll_id_snapshot,std_fabric_yards_snapshot,wastage_cap_pct_snapshot,18,expected_fabric_yds
FROM public.verification_attempts WHERE id = '83000000-0000-4000-8000-000000000003';
INSERT INTO public.verification_items(order_id,attempt_id,order_component_id,component_id,expected_qty)
SELECT c.order_id,a.id,c.id,c.component_id,c.expected_qty FROM public.order_components c JOIN public.verification_attempts a ON a.order_id = c.order_id AND a.attempt_no = 2;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.verification_attempts WHERE order_id = '82000000-0000-4000-8000-000000000003') = 2, 'Re-cut history must survive';
  ASSERT (SELECT count(*) FROM public.verification_items i JOIN public.verification_attempts a ON a.id = i.attempt_id WHERE a.attempt_no = 2 AND i.actual_qty IS NULL) = 5, 'New attempt must start uncounted';
  PERFORM pg_temp.expect_error('UPDATE public.cutting_orders SET target_qty = 11 WHERE fabric_roll_id = ''ISOLATED-C''', '23514');
END $$;

INSERT INTO public.admin_audit_events(actor_id,target_user_id,action,after_state,request_id)
VALUES ('81000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000001','USER_CREATED','{"role":"cutting_supervisor","is_active":true}',gen_random_uuid());
DO $$ BEGIN
  PERFORM pg_temp.expect_error('UPDATE public.admin_audit_events SET action = ''USER_DEACTIVATED''', '23514');
  PERFORM pg_temp.expect_error('DELETE FROM public.admin_audit_events', '23514');
  PERFORM pg_temp.expect_error($sql$INSERT INTO public.admin_audit_events(actor_id,target_user_id,action,after_state,request_id)
    VALUES ('81000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000001','USER_CREATED','{"password":"isolated-invalid-field"}',gen_random_uuid())$sql$, '23514');
  PERFORM pg_temp.expect_error($sql$INSERT INTO public.admin_audit_events(actor_id,target_user_id,action,after_state,request_id)
    VALUES ('81000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000001','USER_CREATED','{"role":{"token":"isolated-invalid-field"}}',gen_random_uuid())$sql$, '23514');
END $$;

-- Temporarily permit SELECT to demonstrate RLS itself still returns zero rows.
-- These grants and synthetic identities are discarded by the final rollback.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
SET LOCAL ROLE anon;
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.recipes) = 0, 'Anon RLS must deny all rows'; END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.cutting_orders) = 0, 'Authenticated RLS must deny all rows'; END $$;
RESET ROLE;
ROLLBACK;
