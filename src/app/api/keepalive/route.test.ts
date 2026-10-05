import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = { CRON_SECRET: undefined as string | undefined };
const query = { error: null as null | { message: string } };

vi.mock('@/lib/env', () => ({
  serverEnv: () => env,
  supabaseConfig: () => ({ url: 'https://x.supabase.co', anonKey: 'anon' }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ limit: async () => query }) }),
  }),
}));

const { GET } = await import('./route');

describe('/api/keepalive', () => {
  beforeEach(() => {
    env.CRON_SECRET = undefined;
    query.error = null;
  });

  it('consulta la base y responde ok', async () => {
    const res = await GET(new Request('https://app/api/keepalive'));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it('con CRON_SECRET, rechaza a quien no lo manda', async () => {
    env.CRON_SECRET = 'un-secreto-largo-de-prueba';
    const sin = await GET(new Request('https://app/api/keepalive'));
    expect(sin.status).toBe(401);
    const con = await GET(
      new Request('https://app/api/keepalive', {
        headers: { authorization: 'Bearer un-secreto-largo-de-prueba' },
      }),
    );
    expect(con.status).toBe(200);
  });

  it('si la base falla, lo dice con un error (Vercel lo marca)', async () => {
    query.error = { message: 'down' };
    const res = await GET(new Request('https://app/api/keepalive'));
    expect(res.status).toBe(502);
  });
});
