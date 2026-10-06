-- Supabase's operator cannot grant USAGE on its managed auth schema.
-- This private, fixed projection reads as its existing operator owner. Only the
-- NOLOGIN identity command owner can SELECT it; no API role can query the view.
CREATE VIEW app_private.auth_identity_emails WITH (security_barrier = true) AS
  SELECT id, email FROM auth.users;
REVOKE ALL ON app_private.auth_identity_emails FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON app_private.auth_identity_emails TO apparelflow_identity_owner;
REVOKE SELECT (id, email) ON auth.users FROM apparelflow_identity_owner;
GRANT CREATE ON SCHEMA app_private TO apparelflow_identity_owner;
SET LOCAL ROLE apparelflow_identity_owner;
CREATE OR REPLACE FUNCTION app_private.identity_list_users(
  p_actor_id uuid, p_search text, p_role public.app_role, p_active boolean,
  p_limit integer, p_cursor_time timestamptz, p_cursor_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM app_private.identity_assert_admin(p_actor_id);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR char_length(coalesce(p_search, '')) > 100
    OR ((p_cursor_time IS NULL) <> (p_cursor_id IS NULL)) THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY page.created_at DESC, page.id DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT p.id, u.email, p.full_name, p.role, p.is_active, p.revision, p.created_at, p.updated_at
    FROM public.profiles p JOIN app_private.auth_identity_emails u ON u.id = p.id
    WHERE (p_role IS NULL OR p.role = p_role) AND (p_active IS NULL OR p.is_active = p_active)
      AND (coalesce(p_search, '') = '' OR strpos(lower(p.full_name), lower(p_search)) > 0 OR strpos(lower(u.email), lower(p_search)) > 0)
      AND (p_cursor_time IS NULL OR (p.created_at, p.id) < (p_cursor_time, p_cursor_id))
    ORDER BY p.created_at DESC, p.id DESC LIMIT p_limit + 1
  ) page;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.identity_create_profile(
  p_actor_id uuid, p_user_id uuid, p_full_name text, p_role public.app_role, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result public.profiles; user_email text;
BEGIN
  PERFORM app_private.identity_assert_admin(p_actor_id);
  IF p_actor_id = p_user_id OR p_role IS NULL OR p_role = 'system_admin' THEN
    RAISE EXCEPTION 'PRODUCTION_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023'; END IF;
  SELECT email INTO user_email FROM app_private.auth_identity_emails WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.profiles(id, full_name, role, is_active)
    VALUES (p_user_id, p_full_name, p_role, true) RETURNING * INTO result;
  INSERT INTO public.admin_audit_events(actor_id, target_user_id, action, before_state, after_state, request_id)
    VALUES (p_actor_id, p_user_id, 'USER_CREATED', '{}'::jsonb,
      jsonb_build_object('full_name', result.full_name, 'role', result.role, 'is_active', result.is_active), p_request_id);
  RETURN to_jsonb(result) || jsonb_build_object('email', user_email);
END;
$$;

CREATE OR REPLACE FUNCTION app_private.identity_update_profile(
  p_actor_id uuid, p_user_id uuid, p_expected_revision bigint,
  p_role public.app_role, p_active boolean, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor public.profiles; target public.profiles; result public.profiles; audit_action public.admin_audit_action; user_email text;
BEGIN
  -- Common deterministic actor/target lock order closes revocation and update races.
  PERFORM id FROM public.profiles WHERE id IN (p_actor_id, p_user_id) ORDER BY id FOR UPDATE;
  SELECT * INTO actor FROM public.profiles WHERE id = p_actor_id;
  IF NOT FOUND OR actor.role <> 'system_admin' OR NOT actor.is_active THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF p_actor_id = p_user_id OR target.role = 'system_admin' OR p_role = 'system_admin' THEN
    RAISE EXCEPTION 'PROTECTED_ADMINISTRATOR' USING ERRCODE = '42501';
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 0 OR p_request_id IS NULL
    OR ((p_role IS NULL) = (p_active IS NULL)) THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;
  IF target.revision <> p_expected_revision OR (p_role IS NOT NULL AND target.role = p_role)
    OR (p_active IS NOT NULL AND target.is_active = p_active) THEN
    RAISE EXCEPTION 'STALE_OR_UNCHANGED' USING ERRCODE = '40001';
  END IF;
  UPDATE public.profiles SET role = coalesce(p_role, role), is_active = coalesce(p_active, is_active), revision = revision + 1
    WHERE id = p_user_id RETURNING * INTO result;
  audit_action := CASE WHEN p_role IS NOT NULL THEN 'USER_ROLE_CHANGED'::public.admin_audit_action
    WHEN p_active THEN 'USER_ACTIVATED'::public.admin_audit_action ELSE 'USER_DEACTIVATED'::public.admin_audit_action END;
  INSERT INTO public.admin_audit_events(actor_id, target_user_id, action, before_state, after_state, request_id)
    VALUES (p_actor_id, p_user_id, audit_action,
      jsonb_build_object('full_name', target.full_name, 'role', target.role, 'is_active', target.is_active),
      jsonb_build_object('full_name', result.full_name, 'role', result.role, 'is_active', result.is_active), p_request_id);
  SELECT email INTO user_email FROM app_private.auth_identity_emails WHERE id = p_user_id;
  RETURN to_jsonb(result) || jsonb_build_object('email', user_email);
END;
$$;

CREATE OR REPLACE FUNCTION app_private.identity_list_audit(
  p_actor_id uuid, p_limit integer, p_cursor_time timestamptz, p_cursor_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM app_private.identity_assert_admin(p_actor_id);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR ((p_cursor_time IS NULL) <> (p_cursor_id IS NULL)) THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY page.created_at DESC, page.id DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT e.id, e.actor_id, a.full_name AS actor_name, e.target_user_id, t.full_name AS target_name,
      e.action, e.before_state, e.after_state, e.request_id, e.created_at
    FROM public.admin_audit_events e JOIN public.profiles a ON a.id = e.actor_id JOIN public.profiles t ON t.id = e.target_user_id
    WHERE p_cursor_time IS NULL OR (e.created_at, e.id) < (p_cursor_time, p_cursor_id)
    ORDER BY e.created_at DESC, e.id DESC LIMIT p_limit + 1
  ) page;
  RETURN result;
END;
$$;


RESET ROLE;
REVOKE CREATE ON SCHEMA app_private FROM apparelflow_identity_owner;
NOTIFY pgrst, 'reload schema';
