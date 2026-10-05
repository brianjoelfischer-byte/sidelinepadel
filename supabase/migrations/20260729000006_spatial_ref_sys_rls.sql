-- ===========================================================================
--  14 · RLS en spatial_ref_sys (PostGIS)
-- ===========================================================================
--
-- PostGIS instala `spatial_ref_sys` (el catálogo de sistemas de coordenadas)
-- en `public`. En Supabase todo lo de `public` sale por la API, y los
-- privilegios por defecto les dan a `anon` y `authenticated` permiso de
-- escritura: cualquiera podía borrar o cambiar filas con la clave pública.
-- No hay datos de usuarios ahí, pero sin la fila 4326 se rompen las
-- búsquedas por cercanía y `::geography`. El asesor de seguridad de Supabase
-- lo marca como CRÍTICO ("RLS Disabled in Public").
--
-- Mover la extensión a otro esquema no se puede (PostGIS no soporta
-- `ALTER EXTENSION ... SET SCHEMA`). Se hace lo siguiente:
--
--  · RLS activado, con una política de solo lectura para todos. PostGIS
--    consulta esta tabla con el rol de quien llama, así que la lectura tiene
--    que seguir abierta: sin ella fallan las funciones geográficas.
--  · Sin políticas de escritura: con RLS, INSERT/UPDATE/DELETE quedan
--    bloqueados aunque el GRANT exista. Además se revoca el GRANT.
--
-- Va en un bloque con manejo de error: si en algún proyecto la tabla no es de
-- `postgres` (y no se puede alterar), avisa en vez de cortar la migración.

DO $$
BEGIN
  ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS spatial_ref_sys_read ON public.spatial_ref_sys;
  CREATE POLICY spatial_ref_sys_read ON public.spatial_ref_sys
    FOR SELECT TO anon, authenticated
    USING (true);

  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.spatial_ref_sys
    FROM anon, authenticated;
  GRANT SELECT ON public.spatial_ref_sys TO anon, authenticated;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'spatial_ref_sys no es de este rol: no se pudo activar RLS. Avisar.';
END;
$$;
