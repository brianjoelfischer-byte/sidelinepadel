import { describe, expect, it } from 'vitest';

import { summarize, type SessionLike } from './summary';

const m = (played_on: string, result: SessionLike['result'], extra: Partial<SessionLike> = {}): SessionLike => ({
  kind: 'match',
  played_on,
  result,
  ...extra,
});

const today = '2026-09-28';

describe('resumen del panel', () => {
  it('sin partidos no inventa un 0 %', () => {
    const s = summarize([], { today });
    expect(s.matches).toBe(0);
    expect(s.winRate).toBeNull();
    expect(s.streak).toBeNull();
    expect(s.form).toEqual([]);
  });

  it('cuenta victorias, derrotas y empates', () => {
    const s = summarize(
      [m('2026-09-20', 'win'), m('2026-09-21', 'loss'), m('2026-09-22', 'draw'), m('2026-09-23', 'win')],
      { today },
    );
    expect(s).toMatchObject({ matches: 4, wins: 2, losses: 1, draws: 1 });
    expect(s.winRate).toBe(0.5);
  });

  it('los entrenamientos no son partidos', () => {
    const s = summarize(
      [m('2026-09-20', 'win'), { kind: 'training', played_on: '2026-09-21', result: null }],
      { today },
    );
    expect(s.matches).toBe(1);
    expect(s.trainings).toBe(1);
    expect(s.winRate).toBe(1);
  });

  it('el partido rápido cuenta como partido', () => {
    const s = summarize([m('2026-09-20', 'loss', { kind: 'quick_match' })], { today });
    expect(s.matches).toBe(1);
    expect(s.losses).toBe(1);
  });

  describe('racha', () => {
    it('cuenta desde el más reciente, sin importar el orden de llegada', () => {
      const s = summarize(
        [m('2026-09-25', 'win'), m('2026-09-10', 'loss'), m('2026-09-27', 'win'), m('2026-09-20', 'win')],
        { today },
      );
      expect(s.streak).toEqual({ result: 'win', count: 3 });
    });

    it('también de derrotas', () => {
      const s = summarize([m('2026-09-27', 'loss'), m('2026-09-26', 'loss'), m('2026-09-25', 'win')], { today });
      expect(s.streak).toEqual({ result: 'loss', count: 2 });
    });

    it('un empate la corta', () => {
      expect(summarize([m('2026-09-27', 'draw'), m('2026-09-26', 'win')], { today }).streak).toBeNull();
      expect(
        summarize([m('2026-09-27', 'win'), m('2026-09-26', 'draw'), m('2026-09-25', 'win')], { today }).streak,
      ).toEqual({ result: 'win', count: 1 });
    });

    /** Dos partidos el mismo día: manda el último que se cargó. */
    it('el mismo día desempata por hora de carga', () => {
      const s = summarize(
        [
          m('2026-09-27', 'loss', { created_at: '2026-09-27T10:00:00Z' }),
          m('2026-09-27', 'win', { created_at: '2026-09-27T20:00:00Z' }),
        ],
        { today },
      );
      expect(s.streak).toEqual({ result: 'win', count: 1 });
      expect(s.form).toEqual(['win', 'loss']);
    });
  });

  it('la forma reciente son los últimos 5, del más nuevo al más viejo', () => {
    const days = ['01', '02', '03', '04', '05', '06', '07'];
    const results: SessionLike['result'][] = ['win', 'win', 'loss', 'draw', 'win', 'loss', 'win'];
    const s = summarize(
      days.map((d, i) => m(`2026-09-${d}`, results[i] ?? null)),
      { today },
    );
    expect(s.form).toEqual(['win', 'loss', 'win', 'draw', 'loss']);
  });

  it('partidos de este mes', () => {
    const s = summarize([m('2026-09-01', 'win'), m('2026-08-31', 'win'), m('2025-09-15', 'loss')], { today });
    expect(s.matchesThisMonth).toBe(1);
  });
});
