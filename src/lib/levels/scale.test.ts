import { describe, expect, it } from 'vitest';

import {
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

describe('categoría local', () => {
  /**
   * El punto del §11: el valor canónico es el mismo, solo cambia la etiqueta.
   * Sin esto, un argentino y un sueco nunca aparecerían en el mismo turno.
   */
  it('traduce el mismo nivel a la categoría de cada país', () => {
    expect(localCategory(4.2, 'AR')).toBe('3ra');
    expect(localCategory(4.2, 'ES')).toBe('Media-Alta');
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
    expect(localCategory(4.2, 'ar')).toBe('3ra');
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
