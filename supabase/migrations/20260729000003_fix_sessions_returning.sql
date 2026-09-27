-- ===========================================================================
--  11 · Arreglo: `INSERT ... RETURNING` fallaba en sessions
-- ===========================================================================
--
--  SÍNTOMA
--
--    INSERT INTO sessions (...) VALUES (...) RETURNING id
--    → "new row violates row-level security policy for table sessions"
--
--  ...aunque el mismo INSERT sin RETURNING funcionaba perfecto.
--
--  CAUSA
--
--  `RETURNING` obliga a evaluar la política de SELECT sobre la fila nueva. La
--  política era:
--
--      USING (app.can_see_session(id))
--
--  y esa función es SECURITY DEFINER y hace un `SELECT ... FROM sessions`
--  nuevo. Esa consulta corre con el snapshot de la sentencia, que es ANTERIOR
--  a la fila que se está insertando: no la encuentra, devuelve false, y el
--  RETURNING se rechaza.
--
--  Es un problema real y no de los tests: cualquier alta de partido hace
--  `INSERT ... RETURNING id` para saber qué sesión se creó.
--
--  ARREGLO
--
--  La política se evalúa ahora contra las columnas de la fila directamente. La
--  condición del dueño —el caso que importa al insertar— no consulta nada: se
--  compara `owner_id` con `auth.uid()` y listo.
--
--  El caso del etiquetado sí necesita mirar otra tabla, pero eso no rompe el
--  RETURNING: al insertar una sesión todavía no hay participantes, y la
--  primera condición ya resolvió que sí.
-- ===========================================================================

DROP POLICY IF EXISTS sessions_select ON public.sessions;

CREATE POLICY sessions_select ON public.sessions
  FOR SELECT TO authenticated
  USING (
    -- Directo sobre la fila: funciona también durante un INSERT ... RETURNING.
    owner_id = auth.uid()
    -- Quien fue etiquetado Y confirmó. Consulta otra tabla, no `sessions`,
    -- así que no hay recursión ni problema de snapshot.
    OR EXISTS (
      SELECT 1
      FROM public.session_participants sp
      WHERE sp.session_id = sessions.id
        AND sp.profile_id = auth.uid()
        AND sp.confirmed_at IS NOT NULL
    )
  );

-- `app.can_see_session` queda para uso interno del servidor, donde no está el
-- problema de snapshot. Se documenta para que nadie la vuelva a poner en una
-- política de SELECT.
COMMENT ON FUNCTION app.can_see_session(uuid) IS
  'NO usar en políticas de SELECT: al re-consultar sessions no ve la fila de '
  'un INSERT en curso y rompe RETURNING. Para políticas, comparar columnas '
  'directamente.';
