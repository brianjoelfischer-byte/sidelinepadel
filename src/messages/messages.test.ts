import { describe, expect, it } from 'vitest';

import en from './en.json';
import es from './es.json';
import { defaultLocale, locales } from '@/i18n/routing';

type Messages = Record<string, unknown>;

/** Aplana `{a:{b:'x'}}` a `['a.b']` para poder comparar estructuras. */
function flatten(obj: Messages, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object'
      ? flatten(value as Messages, path)
      : [path];
  });
}

function leafValues(obj: Messages): [string, string][] {
  return Object.entries(obj).flatMap(([key, value]): [string, string][] =>
    value !== null && typeof value === 'object'
      ? leafValues(value as Messages).map(
          ([k, v]): [string, string] => [`${key}.${k}`, v],
        )
      : [[key, String(value)]],
  );
}

const catalogs: Record<string, Messages> = { es, en };

describe('catálogos de traducción', () => {
  it('cubre todos los locales declarados en routing', () => {
    expect(Object.keys(catalogs).sort()).toEqual([...locales].sort());
  });

  it('tiene el locale por defecto', () => {
    expect(catalogs[defaultLocale]).toBeDefined();
  });

  /**
   * El bug que atrapa esto: agregás una clave en es.json, te olvidás de en.json
   * y el usuario en inglés ve la clave cruda en pantalla. No lo detecta el
   * typecheck ni el build — solo un test.
   */
  it('tiene exactamente las mismas claves en todos los idiomas', () => {
    const reference = flatten(catalogs[defaultLocale] as Messages).sort();

    for (const locale of locales) {
      const keys = flatten(catalogs[locale] as Messages).sort();

      const missing = reference.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !reference.includes(k));

      expect(missing, `faltan en ${locale}`).toEqual([]);
      expect(extra, `sobran en ${locale}`).toEqual([]);
    }
  });

  it('no tiene valores vacíos ni sin traducir', () => {
    for (const locale of locales) {
      for (const [key, value] of leafValues(catalogs[locale] as Messages)) {
        expect(value.trim(), `${locale}.${key} está vacío`).not.toBe('');
        expect(value, `${locale}.${key} quedó como TODO`).not.toMatch(/^TODO/i);
      }
    }
  });

  /**
   * §12.7 y regla 2: la palabra "reserva" solo puede aparecer para NEGAR que
   * la app reserve canchas. Este test es el guardián de esa regla de
   * vocabulario — si alguien escribe "tu reserva está confirmada", falla acá.
   */
  it('no usa "reserva/booking" fuera del aviso que lo niega', () => {
    const forbidden = /\b(reserv|booking|booked)/i;

    for (const locale of locales) {
      for (const [key, value] of leafValues(catalogs[locale] as Messages)) {
        if (key.startsWith('disclaimer.')) continue;
        expect(
          forbidden.test(value),
          `${locale}.${key} usa vocabulario de reserva: "${value}"`,
        ).toBe(false);
      }
    }
  });
});
