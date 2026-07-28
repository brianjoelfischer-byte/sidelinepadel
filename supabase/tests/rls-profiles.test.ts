import { beforeEach, describe, expect, it } from 'vitest';

import {
  asAnon,
  asUser,
  createUser,
  db,
  expectRejected,
  truncateAll,
} from './helpers';

describe('RLS · perfiles', () => {
  beforeEach(truncateAll);

  it('un perfil público se ve desde otra cuenta', async () => {
    const a = await createUser();
    const b = await createUser({ isPublic: true });

    const rows = await asUser(a.id, (sql) =>
      sql`SELECT id FROM public.profiles WHERE id = ${b.id}`,
    );
    expect(rows).toHaveLength(1);
  });

  it('un perfil privado NO se ve desde otra cuenta', async () => {
    const a = await createUser();
    const b = await createUser({ isPublic: false });

    const rows = await asUser(a.id, (sql) =>
      sql`SELECT id FROM public.profiles WHERE id = ${b.id}`,
    );
    expect(rows).toHaveLength(0);
  });

  it('el dueño ve su propio perfil aunque sea privado', async () => {
    const a = await createUser({ isPublic: false });

    const rows = await asUser(a.id, (sql) =>
      sql`SELECT id FROM public.profiles WHERE id = ${a.id}`,
    );
    expect(rows).toHaveLength(1);
  });

  it('un perfil borrado no se ve nunca', async () => {
    const a = await createUser();
    const b = await createUser();
    await db`UPDATE public.profiles SET deleted_at = now() WHERE id = ${b.id}`;

    const rows = await asUser(a.id, (sql) =>
      sql`SELECT id FROM public.profiles WHERE id = ${b.id}`,
    );
    expect(rows).toHaveLength(0);
  });

  it('un visitante sin sesión solo ve perfiles públicos', async () => {
    const publico = await createUser({ isPublic: true });
    const privado = await createUser({ isPublic: false });

    const rows = await asAnon((sql) => sql`SELECT id FROM public.profiles`);
    const ids = rows.map((r) => r.id);

    expect(ids).toContain(publico.id);
    expect(ids).not.toContain(privado.id);
  });

  it('NO se puede editar el perfil de otro', async () => {
    const a = await createUser();
    const b = await createUser();

    await asUser(a.id, (sql) =>
      sql`UPDATE public.profiles SET display_name = 'hackeado' WHERE id = ${b.id}`,
    );

    // El UPDATE no lanza: simplemente no toca ninguna fila. Por eso se
    // verifica el valor, no la ausencia de excepción.
    const [row] = await db`SELECT display_name FROM public.profiles WHERE id = ${b.id}`;
    expect(row?.display_name).not.toBe('hackeado');
  });

  it('NO se puede escalar el propio rol a admin', async () => {
    const a = await createUser({ role: 'player' });

    await expectRejected(
      asUser(a.id, (sql) =>
        sql`UPDATE public.profiles SET role = 'admin' WHERE id = ${a.id}`,
      ),
    );

    const [row] = await db`SELECT role FROM public.profiles WHERE id = ${a.id}`;
    expect(row?.role).toBe('player');
  });

  it('NO se puede crear un perfil para otro usuario', async () => {
    const a = await createUser();
    const otro = crypto.randomUUID();
    await db`INSERT INTO auth.users (id, email) VALUES (${otro}, 'x@test.local')`;

    await expectRejected(
      asUser(a.id, (sql) =>
        sql`
          INSERT INTO public.profiles (
            id, display_name, slug, country_code, timezone,
            declared_level, effective_level, birth_date
          ) VALUES (
            ${otro}, 'Impostor', 'impostor-x', 'AR', 'UTC', 4.0, 4.0, '1990-01-01'
          )
        `,
      ),
    );
  });

  it('NO se puede nacer moderador', async () => {
    const id = crypto.randomUUID();
    await db`INSERT INTO auth.users (id, email) VALUES (${id}, 'mod@test.local')`;

    await expectRejected(
      asUser(id, (sql) =>
        sql`
          INSERT INTO public.profiles (
            id, display_name, slug, country_code, timezone,
            declared_level, effective_level, birth_date, role
          ) VALUES (
            ${id}, 'Auto Mod', 'auto-mod', 'AR', 'UTC', 4.0, 4.0, '1990-01-01', 'moderator'
          )
        `,
      ),
    );
  });
});

describe('RLS · bloqueos', () => {
  beforeEach(truncateAll);

  it('bloquear oculta el perfil en ambos sentidos', async () => {
    const a = await createUser();
    const b = await createUser();

    await asUser(a.id, (sql) =>
      sql`INSERT INTO public.blocks (blocker_id, blocked_id) VALUES (${a.id}, ${b.id})`,
    );

    // A no ve a B
    const desdeA = await asUser(a.id, (sql) =>
      sql`SELECT id FROM public.profiles WHERE id = ${b.id}`,
    );
    expect(desdeA).toHaveLength(0);

    // Y B tampoco ve a A, aunque el bloqueo lo puso A.
    const desdeB = await asUser(b.id, (sql) =>
      sql`SELECT id FROM public.profiles WHERE id = ${a.id}`,
    );
    expect(desdeB).toHaveLength(0);
  });

  it('el bloqueado NO puede saber que lo bloquearon', async () => {
    const a = await createUser();
    const b = await createUser();

    await asUser(a.id, (sql) =>
      sql`INSERT INTO public.blocks (blocker_id, blocked_id) VALUES (${a.id}, ${b.id})`,
    );

    const rows = await asUser(b.id, (sql) => sql`SELECT * FROM public.blocks`);
    expect(rows).toHaveLength(0);
  });

  it('NO se puede bloquear en nombre de otro', async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();

    await expectRejected(
      asUser(a.id, (sql) =>
        sql`INSERT INTO public.blocks (blocker_id, blocked_id) VALUES (${b.id}, ${c.id})`,
      ),
    );
  });
});
