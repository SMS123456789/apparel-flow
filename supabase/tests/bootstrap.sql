-- Isolated plain-PostgreSQL test database only, never the assessment project.
-- Minimal Auth identity/FK and API-role infrastructure; no Auth flows are mocked.
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
-- Simulate permissive provider defaults so migration revocations are exercised.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
