-- ===========================================================================
--  01 · Extensiones y helpers de autorización
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid, digest
CREATE EXTENSION IF NOT EXISTS citext;     -- emails case-insensitive
CREATE EXTENSION IF NOT EXISTS postgis;    -- geografía de sedes (§13)

-- Esquema propio para funciones internas. No se expone por la API.
CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
--  updated_at automático
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Los helpers que consultan tablas (`app.is_moderator`, `app.is_blocked_with`,
-- etc.) viven en la migración de la tabla de la que dependen: Postgres valida
-- el cuerpo de una función SQL al crearla, así que no pueden existir antes.

-- ---------------------------------------------------------------------------
--  Hash con pepper — para IPs y emails que nunca se guardan en claro (§8.5).
--
--  El pepper viene de una GUC que setea el servidor de aplicación por sesión.
--  Si falta, la función LANZA en vez de hashear con string vacío: un hash sin
--  pepper es reversible con una tabla arcoíris y sería peor que no tenerlo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.peppered_hash(value text)
RETURNS bytea
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  pepper text := nullif(current_setting('app.pepper', true), '');
BEGIN
  IF pepper IS NULL THEN
    RAISE EXCEPTION 'app.pepper no está configurado: no se puede hashear de forma segura';
  END IF;
  RETURN digest(value || pepper, 'sha256');
END;
$$;
