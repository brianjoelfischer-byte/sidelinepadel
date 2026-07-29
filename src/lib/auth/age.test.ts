import { describe, expect, it } from 'vitest';

import { MINIMUM_AGE, ageAt, meetsMinimumAge, parseBirthDate } from './age';

describe('cálculo de edad', () => {
  const hoy = new Date(2026, 6, 29); // 29 de julio de 2026

  it('cuenta los años cumplidos', () => {
    expect(ageAt(new Date(2000, 6, 29), hoy)).toBe(26);
  });

  it('el día del cumpleaños ya cuenta', () => {
    expect(ageAt(new Date(2010, 6, 29), hoy)).toBe(16);
  });

  it('un día antes del cumpleaños todavía no', () => {
    expect(ageAt(new Date(2010, 6, 30), hoy)).toBe(15);
  });

  it('descuenta el año si el cumpleaños es en un mes posterior', () => {
    expect(ageAt(new Date(2010, 11, 1), hoy)).toBe(15);
  });

  /**
   * Un 29 de febrero en un año no bisiesto. Restar milisegundos da resultados
   * distintos según el año; comparar por partes es estable.
   */
  it('maneja el 29 de febrero', () => {
    expect(ageAt(new Date(2008, 1, 29), new Date(2026, 1, 28))).toBe(17);
    expect(ageAt(new Date(2008, 1, 29), new Date(2026, 2, 1))).toBe(18);
  });
});

describe('edad mínima', () => {
  const hoy = new Date(2026, 6, 29);

  it('acepta a alguien que cumple justo hoy', () => {
    expect(meetsMinimumAge(new Date(2010, 6, 29), hoy)).toBe(true);
  });

  it('rechaza a alguien un día menor', () => {
    expect(meetsMinimumAge(new Date(2010, 6, 30), hoy)).toBe(false);
  });

  it('el mínimo son 16 años', () => {
    expect(MINIMUM_AGE).toBe(16);
  });
});

describe('parseo de fecha de nacimiento', () => {
  /**
   * El bug que esto atrapa: `new Date('2010-03-15')` es medianoche UTC, así que
   * en Buenos Aires (UTC−3) se convierte en el 14 de marzo. Para un cumpleaños,
   * correrlo un día alcanza para rechazar a alguien que sí tiene la edad.
   */
  it('interpreta la fecha como local, no como UTC', () => {
    const fecha = parseBirthDate('2010-03-15');
    expect(fecha?.getFullYear()).toBe(2010);
    expect(fecha?.getMonth()).toBe(2);
    expect(fecha?.getDate()).toBe(15);
  });

  it('rechaza fechas que no existen', () => {
    // JS "corrige" el 31 de febrero al 2 o 3 de marzo sin avisar.
    expect(parseBirthDate('2010-02-31')).toBeNull();
    expect(parseBirthDate('2010-13-01')).toBeNull();
    expect(parseBirthDate('2010-00-10')).toBeNull();
  });

  it('acepta el 29 de febrero de un año bisiesto', () => {
    expect(parseBirthDate('2008-02-29')).not.toBeNull();
  });

  it('rechaza el 29 de febrero de un año no bisiesto', () => {
    expect(parseBirthDate('2010-02-29')).toBeNull();
  });

  it('rechaza formatos que no son YYYY-MM-DD', () => {
    expect(parseBirthDate('15/03/2010')).toBeNull();
    expect(parseBirthDate('2010-3-5')).toBeNull();
    expect(parseBirthDate('')).toBeNull();
  });
});
