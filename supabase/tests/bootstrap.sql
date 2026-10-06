-- Isolated plain-PostgreSQL test database only, never the assessment project.
-- Minimal Auth identity/FK and API-role infrastructure; no Auth flows are mocked.
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
-- Simulate permissive provider defaults so migration revocations are exercised.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- Minimal verified-subject accessor for isolated RLS tests, not an Auth mock.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
-- Exercise migrations as a restricted operator, matching cloud postgres rather
-- than relying on superuser's ability to grant another owner's function rights.
GRANT anon, authenticated, service_role TO postgres WITH INHERIT FALSE;
CREATE ROLE provider_auth_owner NOLOGIN;
ALTER SCHEMA auth OWNER TO provider_auth_owner;
GRANT USAGE ON SCHEMA auth TO postgres;
CREATE ROLE cloud_operator LOGIN NOINHERIT NOSUPERUSER CREATEROLE BYPASSRLS;
GRANT postgres TO cloud_operator WITH INHERIT TRUE;
