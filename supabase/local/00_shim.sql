-- ===========================================================================
--  SHIM DE SUPABASE — solo para Postgres pelado
-- ===========================================================================
--
--  Esto NO es una migración y NUNCA se aplica a un proyecto Supabase real:
--  allá todo esto ya existe. Sirve para poder correr las migraciones y los
--  tests de RLS contra un Postgres común (CI, contenedor sin Docker, etc.).
--
--  Reproduce lo mínimo que las migraciones y las políticas necesitan:
--    · el esquema `auth` con `users`, `uid()`, `role()` y `jwt()`
--    · los roles `anon`, `authenticated` y `service_role`
--
--  `auth.uid()` lee el claim desde una variable de sesión, que es exactamente
--  lo que hace Supabase en producción: PostgREST setea `request.jwt.claims`
--  por conexión y las políticas leen de ahí.
--
--  Es idempotente: se puede correr muchas veces.
-- ===========================================================================

CREATE SCHEMA IF NOT EXISTS auth;

-- Roles de PostgREST. En Supabase vienen creados.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$$;

-- Versión mínima de auth.users. La real tiene muchas más columnas, pero las
-- migraciones solo dependen de `id` (para las claves foráneas) y de `email`.
CREATE TABLE IF NOT EXISTS auth.users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Los claims del JWT de la petición en curso.
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  )
$$;

-- El id del usuario autenticado. NULL si no hay sesión (visitante anónimo).
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(auth.jwt() ->> 'role', 'anon')
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
