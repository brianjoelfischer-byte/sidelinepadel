import { describe, expect, it } from 'vitest';

import { readGoogleFlag } from './providers';

describe('readGoogleFlag', () => {
  it('es true solo si Supabase dice google: true', () => {
    expect(readGoogleFlag({ external: { google: true, email: true } })).toBe(true);
  });

  it('es false si Google está apagado', () => {
    expect(readGoogleFlag({ external: { google: false, email: true } })).toBe(false);
  });

  it('es false ante respuestas raras, en vez de romper', () => {
    for (const body of [null, 'x', {}, { external: null }, { external: { google: 'true' } }]) {
      expect(readGoogleFlag(body)).toBe(false);
    }
  });
});
