import { describe, expect, it } from 'vitest';

import { mapsPointUrl, mapsSearchUrl } from './maps';

describe('enlaces a Google Maps', () => {
  it('arma la búsqueda por nombre', () => {
    expect(mapsSearchUrl('Top Padel Córdoba')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Top+Padel+C%C3%B3rdoba',
    );
  });

  /** Un nombre con "&" no puede cortar la URL ni meter parámetros propios. */
  it('escapa lo que el usuario escribió', () => {
    const url = new URL(mapsSearchUrl('Club A & B?x=1')!);
    expect(url.searchParams.get('query')).toBe('Club A & B?x=1');
    expect(url.searchParams.get('x')).toBeNull();
  });

  it('sin texto no hay enlace', () => {
    expect(mapsSearchUrl('   ')).toBeNull();
  });

  it('arma el punto exacto', () => {
    expect(mapsPointUrl(-31.4201, -64.1888)).toBe(
      'https://www.google.com/maps/search/?api=1&query=-31.4201%2C-64.1888',
    );
  });

  it('rechaza coordenadas imposibles', () => {
    expect(mapsPointUrl(91, 0)).toBeNull();
    expect(mapsPointUrl(0, Number.NaN)).toBeNull();
  });
});
