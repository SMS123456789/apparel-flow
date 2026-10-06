-- G03 structural foundation. Workflow authorization/approval RPCs are later work.
-- No application role has direct mutation privileges in this milestone.
CREATE SCHEMA app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;

CREATE TYPE public.app_role AS ENUM (
  'system_admin', 'cutting_supervisor', 'cutting_verifier', 'sewing_supervisor'
);
CREATE TYPE public.production_status AS ENUM (
  'CUTTING_IN_PROGRESS', 'PENDING_VERIFICATION', 'REJECTED', 'VERIFIED'
);
CREATE TYPE public.verification_attempt_status AS ENUM ('OPEN', 'APPROVED', 'REJECTED');
CREATE TYPE public.component_status AS ENUM ('GREEN', 'YELLOW', 'RED');
CREATE TYPE public.verification_decision AS ENUM ('APPROVED', 'REJECTED');
CREATE TYPE public.admin_audit_action AS ENUM (
  'USER_CREATED', 'USER_ROLE_CHANGED', 'USER_ACTIVATED', 'USER_DEACTIVATED'
);

CREATE SEQUENCE app_private.order_number_seq MAXVALUE 999999999999 NO CYCLE;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  full_name text NOT NULL CHECK (full_name = btrim(full_name) AND char_length(full_name) BETWEEN 1 AND 200),
  role public.app_role NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_code text NOT NULL UNIQUE CHECK (recipe_code = btrim(recipe_code) AND char_length(recipe_code) BETWEEN 1 AND 32),
  name text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 200),
  category text NOT NULL CHECK (category = btrim(category) AND char_length(category) BETWEEN 1 AND 100),
  -- Untypmodded NUMERIC checks precision before PostgreSQL can silently round.
  std_fabric_yards numeric NOT NULL CHECK (std_fabric_yards > 0 AND std_fabric_yards < 1000000000 AND scale(std_fabric_yards) <= 3),
  wastage_cap_pct numeric NOT NULL CHECK (wastage_cap_pct >= 0 AND wastage_cap_pct < 1000000000 AND scale(wastage_cap_pct) <= 3),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.recipe_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE RESTRICT,
  component_name text NOT NULL CHECK (component_name = btrim(component_name) AND char_length(component_name) BETWEEN 1 AND 200),
  pieces_per_garment integer NOT NULL CHECK (pieces_per_garment > 0),
  image_url text CHECK (image_url IS NULL OR (image_url = btrim(image_url) AND char_length(image_url) BETWEEN 1 AND 2048)),
  sort_order integer NOT NULL CHECK (sort_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, component_name),
  UNIQUE (recipe_id, sort_order),
  UNIQUE (id, recipe_id)
);

CREATE TABLE public.cutting_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL UNIQUE DEFAULT ('AF-' || lpad(nextval('app_private.order_number_seq')::text, 12, '0')),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE RESTRICT,
  target_qty integer NOT NULL CHECK (target_qty > 0),
  fabric_roll_id text NOT NULL CHECK (fabric_roll_id = btrim(fabric_roll_id) AND char_length(fabric_roll_id) BETWEEN 1 AND 100),
  actual_fabric_yds numeric NOT NULL CHECK (actual_fabric_yds > 0 AND actual_fabric_yds < 1000000000 AND scale(actual_fabric_yds) <= 3),
  status public.production_status NOT NULL DEFAULT 'CUTTING_IN_PROGRESS',
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  current_attempt_id uuid,
  approved_log_id uuid,
  -- Constant discriminator makes the composite approval FK reject rejection logs.
  approval_decision public.verification_decision GENERATED ALWAYS AS (
    CASE WHEN approved_log_id IS NOT NULL THEN 'APPROVED'::public.verification_decision END
  ) STORED,
  first_submitted_at timestamptz,
  sewing_started_at timestamptz,
  started_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, recipe_id),
  CHECK ((status = 'VERIFIED') = (approved_log_id IS NOT NULL)),
  CHECK (status = 'CUTTING_IN_PROGRESS' OR first_submitted_at IS NOT NULL),
  CHECK ((sewing_started_at IS NULL) = (started_by IS NULL)),
  CHECK (sewing_started_at IS NULL OR status = 'VERIFIED')
);

CREATE TABLE public.order_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  recipe_id uuid NOT NULL,
  component_id uuid NOT NULL,
  component_name_snapshot text NOT NULL CHECK (component_name_snapshot = btrim(component_name_snapshot) AND char_length(component_name_snapshot) BETWEEN 1 AND 200),
  pieces_per_garment integer NOT NULL CHECK (pieces_per_garment > 0),
  expected_qty bigint NOT NULL CHECK (expected_qty BETWEEN 1 AND 9007199254740991),
  sort_order integer NOT NULL CHECK (sort_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, component_id),
  UNIQUE (order_id, sort_order),
  UNIQUE (id, order_id, component_id, expected_qty),
  FOREIGN KEY (order_id, recipe_id) REFERENCES public.cutting_orders(id, recipe_id) ON DELETE RESTRICT,
  FOREIGN KEY (component_id, recipe_id) REFERENCES public.recipe_components(id, recipe_id) ON DELETE RESTRICT
);

CREATE TABLE public.verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  recipe_id uuid NOT NULL,
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  status public.verification_attempt_status NOT NULL DEFAULT 'OPEN',
  submitted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_qty_snapshot integer NOT NULL CHECK (target_qty_snapshot > 0),
  fabric_roll_id_snapshot text NOT NULL CHECK (fabric_roll_id_snapshot = btrim(fabric_roll_id_snapshot) AND char_length(fabric_roll_id_snapshot) BETWEEN 1 AND 100),
  std_fabric_yards_snapshot numeric NOT NULL CHECK (std_fabric_yards_snapshot > 0 AND std_fabric_yards_snapshot < 1000000000 AND scale(std_fabric_yards_snapshot) <= 3),
  wastage_cap_pct_snapshot numeric NOT NULL CHECK (wastage_cap_pct_snapshot >= 0 AND wastage_cap_pct_snapshot < 1000000000 AND scale(wastage_cap_pct_snapshot) <= 3),
  actual_fabric_yds numeric NOT NULL CHECK (actual_fabric_yds > 0 AND actual_fabric_yds < 1000000000 AND scale(actual_fabric_yds) <= 3),
  expected_fabric_yds numeric NOT NULL CHECK (expected_fabric_yds > 0 AND expected_fabric_yds < 1000000000000000000000 AND scale(expected_fabric_yds) <= 3),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, attempt_no),
  UNIQUE (id, order_id),
  FOREIGN KEY (order_id, recipe_id) REFERENCES public.cutting_orders(id, recipe_id) ON DELETE RESTRICT,
  CHECK ((status = 'OPEN') = (closed_at IS NULL)),
  CHECK (closed_at IS NULL OR closed_at >= submitted_at)
);

CREATE TABLE public.verification_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  order_component_id uuid NOT NULL,
  component_id uuid NOT NULL,
  expected_qty bigint NOT NULL CHECK (expected_qty BETWEEN 1 AND 9007199254740991),
  actual_qty bigint CHECK (actual_qty BETWEEN 0 AND 9007199254740991),
  variance_qty bigint GENERATED ALWAYS AS (actual_qty - expected_qty) STORED,
  status public.component_status,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, order_component_id),
  FOREIGN KEY (attempt_id, order_id) REFERENCES public.verification_attempts(id, order_id) ON DELETE RESTRICT,
  FOREIGN KEY (order_component_id, order_id, component_id, expected_qty) REFERENCES public.order_components(id, order_id, component_id, expected_qty) ON DELETE RESTRICT,
  CHECK (
    (actual_qty IS NULL AND status IS NULL) OR
    (actual_qty IS NOT NULL AND status IS NOT NULL AND status = CASE
      WHEN actual_qty = expected_qty THEN 'GREEN'::public.component_status
      WHEN actual_qty > expected_qty THEN 'YELLOW'::public.component_status
      ELSE 'RED'::public.component_status END)
  )
);

CREATE TABLE public.verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  attempt_id uuid NOT NULL UNIQUE,
  verifier_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  verifier_name_snapshot text NOT NULL CHECK (verifier_name_snapshot = btrim(verifier_name_snapshot) AND char_length(verifier_name_snapshot) BETWEEN 1 AND 200),
  verifier_role_snapshot public.app_role NOT NULL CHECK (verifier_role_snapshot = 'cutting_verifier'),
  decision public.verification_decision NOT NULL,
  rejection_note text,
  actual_fabric_yds numeric NOT NULL CHECK (actual_fabric_yds > 0 AND actual_fabric_yds < 1000000000 AND scale(actual_fabric_yds) <= 3),
  expected_fabric_yds numeric NOT NULL CHECK (expected_fabric_yds > 0 AND expected_fabric_yds < 1000000000000000000000 AND scale(expected_fabric_yds) <= 3),
  wastage_pct numeric NOT NULL CHECK (abs(wastage_pct) < 100000000000000000000 AND scale(wastage_pct) <= 12),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, order_id),
  UNIQUE (id, order_id, decision),
  UNIQUE (id, order_id, attempt_id),
  FOREIGN KEY (attempt_id, order_id) REFERENCES public.verification_attempts(id, order_id) ON DELETE RESTRICT,
  CHECK (
    (decision = 'REJECTED' AND rejection_note IS NOT NULL AND rejection_note = btrim(rejection_note) AND char_length(rejection_note) BETWEEN 1 AND 1000) OR
    (decision = 'APPROVED' AND rejection_note IS NULL)
  )
);

CREATE TABLE public.verification_log_items (
  -- A sign-off/component pair is the immutable natural identity; no standalone ID.
  log_id uuid NOT NULL,
  order_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  order_component_id uuid NOT NULL,
  component_id uuid NOT NULL,
  component_name_snapshot text NOT NULL CHECK (component_name_snapshot = btrim(component_name_snapshot) AND char_length(component_name_snapshot) BETWEEN 1 AND 200),
  expected_qty bigint NOT NULL CHECK (expected_qty BETWEEN 1 AND 9007199254740991),
  actual_qty bigint CHECK (actual_qty BETWEEN 0 AND 9007199254740991),
  variance_qty bigint GENERATED ALWAYS AS (actual_qty - expected_qty) STORED,
  status public.component_status,
  PRIMARY KEY (log_id, order_component_id),
  FOREIGN KEY (log_id, order_id, attempt_id) REFERENCES public.verification_logs(id, order_id, attempt_id) ON DELETE RESTRICT,
  FOREIGN KEY (attempt_id, order_component_id) REFERENCES public.verification_items(attempt_id, order_component_id) ON DELETE RESTRICT,
  FOREIGN KEY (order_component_id, order_id, component_id, expected_qty) REFERENCES public.order_components(id, order_id, component_id, expected_qty) ON DELETE RESTRICT,
  CHECK (
    (actual_qty IS NULL AND status IS NULL) OR
    (actual_qty IS NOT NULL AND status IS NOT NULL AND status = CASE
      WHEN actual_qty = expected_qty THEN 'GREEN'::public.component_status
      WHEN actual_qty > expected_qty THEN 'YELLOW'::public.component_status
      ELSE 'RED'::public.component_status END)
  )
);

CREATE TABLE public.admin_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action public.admin_audit_action NOT NULL,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Allowlisted account facts only; credential/production payloads have no field.
  CHECK (jsonb_typeof(before_state) = 'object' AND before_state - ARRAY['full_name', 'role', 'is_active']::text[] = '{}'::jsonb AND octet_length(before_state::text) <= 4000),
  CHECK (jsonb_typeof(after_state) = 'object' AND after_state - ARRAY['full_name', 'role', 'is_active']::text[] = '{}'::jsonb AND octet_length(after_state::text) <= 4000),
  CHECK ((NOT before_state ? 'role' OR (jsonb_typeof(before_state->'role') = 'string' AND before_state->>'role' IN ('system_admin', 'cutting_supervisor', 'cutting_verifier', 'sewing_supervisor')))
    AND (NOT before_state ? 'is_active' OR jsonb_typeof(before_state->'is_active') = 'boolean')
    AND (NOT before_state ? 'full_name' OR (jsonb_typeof(before_state->'full_name') = 'string' AND char_length(before_state->>'full_name') BETWEEN 1 AND 200))),
  CHECK ((NOT after_state ? 'role' OR (jsonb_typeof(after_state->'role') = 'string' AND after_state->>'role' IN ('system_admin', 'cutting_supervisor', 'cutting_verifier', 'sewing_supervisor')))
    AND (NOT after_state ? 'is_active' OR jsonb_typeof(after_state->'is_active') = 'boolean')
    AND (NOT after_state ? 'full_name' OR (jsonb_typeof(after_state->'full_name') = 'string' AND char_length(after_state->>'full_name') BETWEEN 1 AND 200)))
);

ALTER TABLE public.cutting_orders ADD CONSTRAINT cutting_orders_current_attempt_fk
  FOREIGN KEY (current_attempt_id, id) REFERENCES public.verification_attempts(id, order_id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.cutting_orders ADD CONSTRAINT cutting_orders_approved_log_fk
  FOREIGN KEY (approved_log_id, id, approval_decision) REFERENCES public.verification_logs(id, order_id, decision)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

-- Uniqueness already indexes codes, numbers, per-order attempts, and per-attempt items.
CREATE INDEX profiles_role_active_idx ON public.profiles(role, is_active, id);
CREATE INDEX cutting_orders_status_created_idx ON public.cutting_orders(status, created_at DESC, id);
CREATE INDEX cutting_orders_creator_idx ON public.cutting_orders(created_by);
CREATE INDEX cutting_orders_recipe_idx ON public.cutting_orders(recipe_id);
CREATE INDEX cutting_orders_started_by_idx ON public.cutting_orders(started_by) WHERE started_by IS NOT NULL;
CREATE INDEX order_components_source_idx ON public.order_components(component_id, recipe_id);
CREATE UNIQUE INDEX verification_attempts_one_open_idx ON public.verification_attempts(order_id) WHERE status = 'OPEN';
CREATE INDEX verification_attempts_status_submitted_idx ON public.verification_attempts(status, submitted_at, id);
CREATE INDEX verification_attempts_submitter_idx ON public.verification_attempts(submitted_by);
CREATE INDEX verification_items_component_idx ON public.verification_items(order_component_id, order_id, component_id, expected_qty);
CREATE INDEX verification_items_updated_by_idx ON public.verification_items(updated_by) WHERE updated_by IS NOT NULL;
CREATE UNIQUE INDEX verification_logs_one_approval_idx ON public.verification_logs(order_id) WHERE decision = 'APPROVED';
CREATE INDEX verification_logs_order_created_idx ON public.verification_logs(order_id, created_at DESC, id);
CREATE INDEX verification_logs_verifier_idx ON public.verification_logs(verifier_id);
CREATE INDEX verification_log_items_attempt_component_idx ON public.verification_log_items(attempt_id, order_component_id);
CREATE INDEX verification_log_items_component_idx ON public.verification_log_items(order_component_id, order_id, component_id, expected_qty);
CREATE INDEX admin_audit_events_target_created_idx ON public.admin_audit_events(target_user_id, created_at DESC, id);
CREATE INDEX admin_audit_events_actor_idx ON public.admin_audit_events(actor_id);

CREATE FUNCTION app_private.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (to_jsonb(NEW)->'id', to_jsonb(NEW)->'created_at') IS DISTINCT FROM
     (to_jsonb(OLD)->'id', to_jsonb(OLD)->'created_at') THEN
    RAISE EXCEPTION 'Record identity and creation timestamp are immutable' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE FUNCTION app_private.prevent_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Historical/reference records cannot be modified or deleted' USING ERRCODE = '23514';
END;
$$;

CREATE FUNCTION app_private.guard_order_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (NEW.id, NEW.order_no, NEW.created_by, NEW.created_at) IS DISTINCT FROM
     (OLD.id, OLD.order_no, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'Order identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.first_submitted_at IS NOT NULL AND
     (NEW.recipe_id, NEW.target_qty, NEW.first_submitted_at) IS DISTINCT FROM
     (OLD.recipe_id, OLD.target_qty, OLD.first_submitted_at) THEN
    RAISE EXCEPTION 'Submitted recipe, target and submission timestamp are frozen' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'VERIFIED' AND
     (to_jsonb(NEW) - ARRAY['sewing_started_at', 'started_by', 'revision', 'updated_at', 'approval_decision']::text[]) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['sewing_started_at', 'started_by', 'revision', 'updated_at', 'approval_decision']::text[]) THEN
    RAISE EXCEPTION 'Verified order facts are immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.sewing_started_at IS NOT NULL AND
     (NEW.sewing_started_at, NEW.started_by) IS DISTINCT FROM (OLD.sewing_started_at, OLD.started_by) THEN
    RAISE EXCEPTION 'Sewing start attribution is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION app_private.guard_manifest_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE submitted_at timestamptz;
BEGIN
  SELECT first_submitted_at INTO submitted_at FROM public.cutting_orders WHERE id = NEW.order_id FOR UPDATE;
  IF submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Submitted BOM cannot be extended' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION app_private.guard_attempt_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status <> 'OPEN' THEN
    RAISE EXCEPTION 'Finalized attempt is immutable' USING ERRCODE = '23514';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status', 'closed_at', 'revision', 'updated_at']::text[]) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status', 'closed_at', 'revision', 'updated_at']::text[]) THEN
    RAISE EXCEPTION 'Submitted attempt basis is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION app_private.guard_item_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE attempt_state public.verification_attempt_status;
BEGIN
  IF TG_OP = 'UPDATE' AND
     (NEW.id, NEW.order_id, NEW.attempt_id, NEW.order_component_id, NEW.component_id, NEW.expected_qty, NEW.created_at) IS DISTINCT FROM
     (OLD.id, OLD.order_id, OLD.attempt_id, OLD.order_component_id, OLD.component_id, OLD.expected_qty, OLD.created_at) THEN
    RAISE EXCEPTION 'Count item identity and expected basis are immutable' USING ERRCODE = '23514';
  END IF;
  SELECT status INTO attempt_state FROM public.verification_attempts WHERE id = NEW.attempt_id FOR UPDATE;
  IF attempt_state IS DISTINCT FROM 'OPEN'::public.verification_attempt_status THEN
    RAISE EXCEPTION 'Finalized attempt count evidence is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION app_private.guard_open_evidence_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE attempt_state public.verification_attempt_status;
BEGIN
  SELECT status INTO attempt_state FROM public.verification_attempts WHERE id = NEW.attempt_id FOR UPDATE;
  IF attempt_state IS DISTINCT FROM 'OPEN'::public.verification_attempt_status THEN
    RAISE EXCEPTION 'Finalized attempt evidence cannot be extended' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles', 'recipes', 'recipe_components', 'cutting_orders', 'order_components',
    'verification_attempts', 'verification_items', 'verification_logs', 'verification_log_items', 'admin_audit_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', table_name);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', table_name);
    EXECUTE format('CREATE TRIGGER prevent_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.prevent_mutation()', table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['profiles', 'cutting_orders', 'verification_attempts', 'verification_items'] LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at()', table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['recipes', 'recipe_components', 'order_components', 'verification_logs', 'verification_log_items', 'admin_audit_events'] LOOP
    EXECUTE format('CREATE TRIGGER prevent_update BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.prevent_mutation()', table_name);
  END LOOP;
END;
$$;

CREATE TRIGGER guard_order_history BEFORE UPDATE ON public.cutting_orders FOR EACH ROW EXECUTE FUNCTION app_private.guard_order_history();
CREATE TRIGGER guard_manifest_insert BEFORE INSERT ON public.order_components FOR EACH ROW EXECUTE FUNCTION app_private.guard_manifest_insert();
CREATE TRIGGER guard_attempt_history BEFORE UPDATE ON public.verification_attempts FOR EACH ROW EXECUTE FUNCTION app_private.guard_attempt_history();
CREATE TRIGGER guard_item_history BEFORE INSERT OR UPDATE ON public.verification_items FOR EACH ROW EXECUTE FUNCTION app_private.guard_item_history();
CREATE TRIGGER guard_log_insert BEFORE INSERT ON public.verification_logs FOR EACH ROW EXECUTE FUNCTION app_private.guard_open_evidence_insert();
CREATE TRIGGER guard_log_item_insert BEFORE INSERT ON public.verification_log_items FOR EACH ROW EXECUTE FUNCTION app_private.guard_open_evidence_insert();

-- Private trigger helpers are not Data API RPCs; invoker security is retained.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
NOTIFY pgrst, 'reload schema';
