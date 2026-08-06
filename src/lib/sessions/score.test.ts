import { describe, expect, it } from 'vitest';

import {
  formatSets,
  gameTotals,
  isComeback,
  isValidSet,
  resultFromSets,
} from './score';

describe('validez de un set', () => {
  it('acepta los marcadores normales', () => {
    expect(isValidSet({ me: 6, opp: 0 })).toBe(true);
    expect(isValidSet({ me: 6, opp: 4 })).toBe(true);
    expect(isValidSet({ me: 4, opp: 6 })).toBe(true);
  });

  it('acepta 7-5 y el tie-break 7-6', () => {
    expect(isValidSet({ me: 7, opp: 5 })).toBe(true);
    expect(isValidSet({ me: 7, opp: 6 })).toBe(true);
  });

  /** 6-5 no existe: con 5-5 se sigue hasta 7-5 o se va a tie-break. */
  it('rechaza 6-5, que no puede terminar así', () => {
    expect(isValidSet({ me: 6, opp: 5 })).toBe(false);
  });

  it('rechaza un set sin ganador', () => {
    expect(isValidSet({ me: 4, opp: 4 })).toBe(false);
    expect(isValidSet({ me: 0, opp: 0 })).toBe(false);
    expect(isValidSet({ me: 5, opp: 3 })).toBe(false);
  });

  it('rechaza 7-4, que se habría cerrado en 6', () => {
    expect(isValidSet({ me: 7, opp: 4 })).toBe(false);
  });

  it('rechaza negativos y decimales', () => {
    expect(isValidSet({ me: -1, opp: 6 })).toBe(false);
    expect(isValidSet({ me: 6.5, opp: 3 })).toBe(false);
  });
});

describe('resultado derivado de los sets', () => {
  /**
   * El resultado no se ingresa aparte. Si se pidiera, alguien podría cargar
   * "gané" con un 3-6 3-6, y esa contradicción ensucia las estadísticas sin
   * que después nadie sepa por qué.
   */
  it('gana quien se llevó más sets', () => {
    expect(resultFromSets([{ me: 6, opp: 3 }, { me: 6, opp: 4 }])).toBe('win');
    expect(resultFromSets([{ me: 3, opp: 6 }, { me: 4, opp: 6 }])).toBe('loss');
  });

  it('un partido a tres sets se decide por el tercero', () => {
    expect(
      resultFromSets([
        { me: 6, opp: 3 },
        { me: 4, opp: 6 },
        { me: 7, opp: 5 },
      ]),
    ).toBe('win');
  });

  /**
   * Un partido cortado porque se acabó el turno de cancha queda 1-1. Pasa de
   * verdad en amateur: es un empate, no un dato inválido.
   */
  it('1-1 es empate, no error', () => {
    expect(resultFromSets([{ me: 6, opp: 3 }, { me: 3, opp: 6 }])).toBe('draw');
  });

  it('devuelve null si algún set es imposible', () => {
    expect(resultFromSets([{ me: 6, opp: 5 }])).toBeNull();
    expect(resultFromSets([{ me: 9, opp: 1 }])).toBeNull();
  });

  it('devuelve null sin sets', () => {
    expect(resultFromSets([])).toBeNull();
  });
});

describe('totales y formato', () => {
  it('suma los juegos de todos los sets', () => {
    expect(
      gameTotals([
        { me: 6, opp: 3 },
        { me: 4, opp: 6 },
      ]),
    ).toEqual({ for: 10, against: 9 });
  });

  it('arma el marcador legible', () => {
    expect(
      formatSets([
        { me: 6, opp: 3 },
        { me: 7, opp: 5 },
      ]),
    ).toBe('6-3, 7-5');
  });
});

describe('remontada', () => {
  it('perdiste el primero y ganaste el partido', () => {
    expect(
      isComeback([
        { me: 3, opp: 6 },
        { me: 6, opp: 4 },
        { me: 6, opp: 2 },
      ]),
    ).toBe(true);
  });

  it('ganar el primero y el partido no es remontada', () => {
    expect(isComeback([{ me: 6, opp: 3 }, { me: 6, opp: 4 }])).toBe(false);
  });

  it('perder el primero y el partido tampoco', () => {
    expect(isComeback([{ me: 3, opp: 6 }, { me: 4, opp: 6 }])).toBe(false);
  });
});
