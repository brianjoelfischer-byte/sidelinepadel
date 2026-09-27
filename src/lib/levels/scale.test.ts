import { describe, expect, it } from 'vitest';

import {
  categoryRange,
  clampLevel,
  defaultLevelBand,
  formatLevel,
  isWithinBand,
  levelBand,
  localCategory,
} from './scale';

describe('escala canónica', () => {
  it('acota al rango 1.0–7.0', () => {
    expect(clampLevel(0.2)).toBe(1.0);
    expect(clampLevel(9.9)).toBe(7.0);
    expect(clampLevel(4.3)).toBe(4.3);
  });

  it('redondea a un decimal', () => {
    // Guardar 4.37 daría una precisión que la escala no tiene.
    expect(clampLevel(4.37)).toBe(4.4);
    expect(clampLevel(4.34)).toBe(4.3);
  });

  it('asigna la banda correcta en los bordes', () => {
    expect(levelBand(1.0)).toBe('beginner');
    expect(levelBand(1.9)).toBe('beginner');
    expect(levelBand(2.0)).toBe('improver');
    expect(levelBand(4.9)).toBe('advanced');
    expect(levelBand(5.0)).toBe('expert');
    expect(levelBand(7.0)).toBe('elite');
  });
});

describe('categoría estimada', () => {
  /**
   * El punto del §11: el valor canónico es el mismo, solo cambia la etiqueta.
   * Sin esto, un argentino y un sueco nunca aparecerían en el mismo turno.
   */
  it('traduce el mismo nivel a la categoría de cada país', () => {
    expect(localCategory(4.2, 'AR')).toBe('5ta');
    expect(localCategory(4.2, 'ES')).toBe('Media-Baja');
  });

  /**
   * Anclajes tomados de fuentes del deporte: 7ma es principiante con
   * dificultad en las paredes, 6ta ya tiene regularidad, y quien juega 2-3
   * veces por semana hace más de un año cae entre 5ta y 4ta.
   */
  it('cubre las ocho categorías del sistema argentino', () => {
    expect(localCategory(1.5, 'AR')).toBe('8va');
    expect(localCategory(2.6, 'AR')).toBe('7ma');
    expect(localCategory(3.4, 'AR')).toBe('6ta');
    expect(localCategory(4.1, 'AR')).toBe('5ta');
    expect(localCategory(4.8, 'AR')).toBe('4ta');
    expect(localCategory(5.4, 'AR')).toBe('3ra');
    expect(localCategory(6.2, 'AR')).toBe('2da');
    expect(localCategory(6.8, 'AR')).toBe('1ra');
  });

  /**
   * Los tramos se angostan hacia arriba. Media décima cerca de la cima es una
   * diferencia de juego enorme; en la base, no tanto. Y arriba de 6.0 es
   * territorio de ex profesionales, así que 1ra y 2da viven ahí — no en 5.4.
   */
  it('los tramos altos son más angostos que los bajos', () => {
    const ancho = (nivel: number) => {
      const r = categoryRange(nivel, 'AR');
      return r === null ? null : Math.round((r.max - r.min) * 10) / 10;
    };

    const base = ancho(1.5); // 8va
    const cima = ancho(6.2); // 2da

    expect(base).not.toBeNull();
    expect(cima).not.toBeNull();
    expect(cima!).toBeLessThan(base!);
  });

  it('devuelve el rango que cubre cada categoría', () => {
    // Mostrarlo evita que la estimación parezca más precisa de lo que es.
    expect(categoryRange(4.8, 'AR')).toEqual({ min: 4.5, max: 5.1 });
    expect(categoryRange(1.2, 'AR')).toEqual({ min: 1.0, max: 2.2 });
    expect(categoryRange(4.5, 'SE')).toBeNull();
  });

  it('Chile y Uruguay usan el sistema argentino', () => {
    expect(localCategory(6.5, 'CL')).toBe('1ra');
    expect(localCategory(6.5, 'UY')).toBe('1ra');
    expect(localCategory(6.5, 'AR')).toBe('1ra');
  });

  it('devuelve null donde no hay sistema local', () => {
    // Suecia y Estados Unidos no usan categorías numeradas: la interfaz cae
    // en la banda genérica traducida.
    expect(localCategory(4.2, 'SE')).toBeNull();
    expect(localCategory(4.2, 'US')).toBeNull();
  });

  it('no distingue mayúsculas en el código de país', () => {
    expect(localCategory(4.2, 'ar')).toBe('5ta');
  });
});

describe('banda de nivel de un turno', () => {
  it('tolera poco por abajo y bastante por arriba', () => {
    // Jugar contra alguien mejor es lo que hace progresar (§12.5).
    expect(defaultLevelBand(4.0)).toEqual({ min: 3.8, max: 4.8 });
  });

  it('no se sale del rango en los extremos', () => {
    expect(defaultLevelBand(1.0).min).toBe(1.0);
    expect(defaultLevelBand(7.0).max).toBe(7.0);
  });

  it('los bordes de la banda están incluidos', () => {
    expect(isWithinBand(3.5, 3.5, 4.5)).toBe(true);
    expect(isWithinBand(4.5, 3.5, 4.5)).toBe(true);
    expect(isWithinBand(4.6, 3.5, 4.5)).toBe(false);
    expect(isWithinBand(3.4, 3.5, 4.5)).toBe(false);
  });
});

describe('formato', () => {
  it('usa el separador decimal del idioma', () => {
    expect(formatLevel(4, 'es')).toBe('4,0');
    expect(formatLevel(4, 'en')).toBe('4.0');
  });
});
