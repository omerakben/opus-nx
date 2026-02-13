-- ============================================================
-- Opus Nx Local Development — Database Bootstrap
-- ============================================================
-- Creates schemas, roles, and extensions for local PostgreSQL + PostgREST.
-- This replaces Supabase's managed infrastructure with a standalone setup.
--
-- Runs automatically on first `docker compose up` via docker-entrypoint-initdb.d.

-- ============================================================
-- Schemas
-- ============================================================

-- Supabase convention: pgvector lives in the 'extensions' schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Stub auth schema (Supabase Auth equivalent)
CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================================
-- Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================================
-- Auth Stub
-- ============================================================
-- Minimal auth.users table to satisfy FK constraints in migrations.
-- Opus Nx uses its own HMAC cookie auth — this is only for schema compatibility.

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PostgREST Roles
-- ============================================================

-- Anonymous role (minimal read access)
CREATE ROLE anon NOLOGIN;

-- Authenticator role (PostgREST connects as this, then switches via JWT)
-- Password must match POSTGRES_PASSWORD in docker-compose.local.yml
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'postgres';

-- Service role (full access — maps to SUPABASE_SERVICE_ROLE_KEY JWT)
CREATE ROLE service_role NOLOGIN BYPASSRLS;

-- Role hierarchy: authenticator can become either role
GRANT anon TO authenticator;
GRANT service_role TO authenticator;

-- ============================================================
-- Default Privileges
-- ============================================================
-- Ensures tables/sequences/functions created by migrations get proper grants.

-- service_role: full access to everything
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO service_role;

-- anon: read-only access
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

-- Schema usage grants
GRANT USAGE ON SCHEMA public TO anon, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, service_role;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO service_role;
