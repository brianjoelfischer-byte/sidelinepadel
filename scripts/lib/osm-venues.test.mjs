import { describe, expect, it } from 'vitest';

import { buildVenues, fold, isCompleteSql, nearestPlace, sqlText, toSql } from './osm-venues.mjs';

const tz = () => 'America/Argentina/Cordoba';
const opts = { countryCode: 'AR', timezoneOf: tz };

/** Caja de ~100 m alrededor de un punto. */
const box = (lat, lon, d = 0.0005) => ({
  minlat: lat - d,
  maxlat: lat + d,
  minlon: lon - d,
  maxlon: lon + d,
});

describe('de OpenStreetMap a sedes', () => {
  it('un club marcado como pádel es una sede', () => {
    const { rows } = buildVenues(
      [{ type: 'node', id: 1, lat: -31.4, lon: -64.2, tags: { sport: 'padel', name: 'Top Pádel' } }],
      opts,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Top Pádel', osm_type: 'node', osm_id: 1, courts_count: null });
  });

  /**
   * El caso más común y el que se perdería con un filtro ingenuo: canchas sin
   * nombre dentro de un club multideporte que no dice "pádel" en ningún lado.
   */
  it('las canchas sin nombre se atribuyen al club que las contiene', () => {
    const { rows, stats } = buildVenues(
      [
        { type: 'way', id: 10, bounds: box(-31.4, -64.2), tags: { leisure: 'sports_centre', name: 'Club Atlético' } },
        { type: 'way', id: 11, bounds: box(-31.4001, -64.2001, 0.0001), tags: { leisure: 'pitch', sport: 'padel' } },
        { type: 'way', id: 12, bounds: box(-31.3999, -64.1999, 0.0001), tags: { leisure: 'pitch', sport: 'padel' } },
      ],
      opts,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Club Atlético', osm_id: 10, courts_count: 2 });
    expect(stats.courtsAttributed).toBe(2);
  });

  /** Una cancha llamada "Cancha 2" no es el nombre de la sede. */
  it('una cancha con nombre dentro de un club cuenta para el club', () => {
    const { rows } = buildVenues(
      [
        { type: 'way', id: 10, bounds: box(-31.4, -64.2), tags: { leisure: 'club', name: 'Los Olivos' } },
        { type: 'way', id: 11, bounds: box(-31.4, -64.2, 0.0001), tags: { leisure: 'pitch', sport: 'padel', name: 'Cancha 2' } },
      ],
      opts,
    );
    expect(rows.map((r) => r.name)).toEqual(['Los Olivos']);
  });

  it('va al contenedor más chico, no al parque que lo rodea', () => {
    const { rows } = buildVenues(
      [
        { type: 'way', id: 1, bounds: box(-31.4, -64.2, 0.01), tags: { leisure: 'recreation_ground', name: 'Parque Sarmiento' } },
        { type: 'way', id: 2, bounds: box(-31.4, -64.2, 0.001), tags: { leisure: 'sports_centre', name: 'Polideportivo' } },
        { type: 'way', id: 3, bounds: box(-31.4, -64.2, 0.0001), tags: { leisure: 'pitch', sport: 'padel' } },
      ],
      opts,
    );
    expect(rows.map((r) => r.name)).toEqual(['Polideportivo']);
  });

  /**
   * De la primera corrida real: 562 canchas quedaron sin sede porque estaban
   * dentro de lugares que nadie etiquetó como club.
   */
  it('una cancha dentro de un colegio o un barrio cerrado va a ese lugar', () => {
    const { rows } = buildVenues(
      [
        { type: 'way', id: 1, bounds: box(-31.4, -64.2), tags: { amenity: 'school', name: 'Colegio San José' } },
        { type: 'way', id: 2, bounds: box(-31.4, -64.2, 0.0001), tags: { leisure: 'pitch', sport: 'padel' } },
      ],
      opts,
    );
    expect(rows.map((r) => r.name)).toEqual(['Colegio San José']);
  });

  /** Un club cargado como un punto no tiene área: nunca "contiene" nada. */
  it('una cancha al lado de un club cargado como punto va a ese club', () => {
    const { rows, stats } = buildVenues(
      [
        { type: 'node', id: 1, lat: -31.4, lon: -64.2, tags: { leisure: 'sports_centre', name: 'Complejo Norte' } },
        // ~30 m al norte
        { type: 'way', id: 2, bounds: box(-31.39973, -64.2, 0.0001), tags: { leisure: 'pitch', sport: 'padel' } },
      ],
      opts,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Complejo Norte', courts_count: 1 });
    expect(stats.courtsNearby).toBe(1);
  });

  it('pero no a un negocio cualquiera que está al lado', () => {
    const { rows } = buildVenues(
      [
        { type: 'node', id: 1, lat: -31.4, lon: -64.2, tags: { amenity: 'restaurant', name: 'Parrilla Don Juan' } },
        { type: 'way', id: 2, bounds: box(-31.39973, -64.2, 0.0001), tags: { leisure: 'pitch', sport: 'padel' } },
      ],
      opts,
    );
    expect(rows).toHaveLength(0);
  });

  it('ni a un club que está a más de 60 m', () => {
    const { rows } = buildVenues(
      [
        { type: 'node', id: 1, lat: -31.4, lon: -64.2, tags: { leisure: 'sports_centre', name: 'Complejo Norte' } },
        // ~110 m
        { type: 'way', id: 2, bounds: box(-31.399, -64.2, 0.0001), tags: { leisure: 'pitch', sport: 'padel' } },
      ],
      opts,
    );
    expect(rows).toHaveLength(0);
  });

  /** Real: "Hit Paddle", "Corner Paddle". En Argentina se escribe así. */
  it('"paddle" con doble d también es deportivo', () => {
    const { rows } = buildVenues(
      [
        { type: 'node', id: 1, lat: -31.4, lon: -64.2, tags: { name: 'Hit Paddle' } },
        { type: 'way', id: 2, bounds: box(-31.39973, -64.2, 0.0001), tags: { leisure: 'pitch', sport: 'padel' } },
      ],
      opts,
    );
    expect(rows.map((r) => r.name)).toEqual(['Hit Paddle']);
  });

  /** Real: una cancha suelta terminó llamándose "Cruz del Eje", como la ciudad. */
  it('un área enorme no deportiva no se lleva las canchas', () => {
    const { rows } = buildVenues(
      [
        { type: 'way', id: 1, bounds: box(-30.72, -64.8, 0.02), tags: { landuse: 'residential', name: 'Cruz del Eje' } },
        { type: 'way', id: 2, bounds: box(-30.72, -64.8, 0.0001), tags: { leisure: 'pitch', sport: 'padel' } },
      ],
      opts,
    );
    expect(rows).toHaveLength(0);
  });

  it('pero un club grande sí, aunque sea enorme', () => {
    const { rows } = buildVenues(
      [
        { type: 'way', id: 1, bounds: box(-34.5, -58.5, 0.02), tags: { leisure: 'club', name: 'Club Náutico' } },
        { type: 'way', id: 2, bounds: box(-34.5, -58.5, 0.0001), tags: { leisure: 'pitch', sport: 'padel' } },
      ],
      opts,
    );
    expect(rows.map((r) => r.name)).toEqual(['Club Náutico']);
  });

  it('una cancha suelta sin nombre ni club no entra', () => {
    const { rows, stats } = buildVenues(
      [{ type: 'way', id: 1, bounds: box(-31.4, -64.2, 0.0001), tags: { leisure: 'pitch', sport: 'padel' } }],
      opts,
    );
    expect(rows).toHaveLength(0);
    expect(stats.unnamedSkipped).toBe(1);
  });

  it('pádel entre otros deportes cuenta; paddle tennis no', () => {
    const { rows } = buildVenues(
      [
        { type: 'node', id: 1, lat: -31.4, lon: -64.2, tags: { sport: 'tennis;padel', name: 'Mixto' } },
        { type: 'node', id: 2, lat: -31.5, lon: -64.3, tags: { sport: 'paddle_tennis', name: 'Otro deporte' } },
      ],
      opts,
    );
    expect(rows.map((r) => r.name)).toEqual(['Mixto']);
  });

  it('une el mismo club cargado dos veces, y se queda con la vía', () => {
    const { rows, stats } = buildVenues(
      [
        { type: 'node', id: 1, lat: -31.4, lon: -64.2, tags: { sport: 'padel', name: 'Top Padel' } },
        { type: 'way', id: 9, bounds: box(-31.4003, -64.2003), tags: { sport: 'padel', leisure: 'sports_centre', name: 'Top Pádel' } },
      ],
      opts,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ osm_type: 'way', osm_id: 9 });
    expect(stats.duplicatesMerged).toBe(1);
  });

  it('mismo nombre en otra ciudad son dos sedes', () => {
    const { rows } = buildVenues(
      [
        { type: 'node', id: 1, lat: -31.4, lon: -64.2, tags: { sport: 'padel', name: 'Padel Point' } },
        { type: 'node', id: 2, lat: -34.6, lon: -58.4, tags: { sport: 'padel', name: 'Padel Point' } },
      ],
      opts,
    );
    expect(rows).toHaveLength(2);
  });

  it('usa addr:city si está, y si no la localidad más cercana', () => {
    const places = [{ name: 'Córdoba', kind: 'city', lat: -31.41, lng: -64.19 }];
    const { rows } = buildVenues(
      [
        { type: 'node', id: 1, lat: -31.4, lon: -64.2, tags: { sport: 'padel', name: 'Club A', 'addr:city': 'Villa Allende' } },
        { type: 'node', id: 2, lat: -31.4, lon: -64.2, tags: { sport: 'padel', name: 'Club B' } },
      ],
      { ...opts, places },
    );
    expect(rows.find((r) => r.name === 'Club A')?.city).toBe('Villa Allende');
    expect(rows.find((r) => r.name === 'Club B')?.city).toBe('Córdoba');
  });
});

describe('localidad más cercana', () => {
  /** Real: "Sociedad Tiro Suizo Rosario · Tiro Suizo" en vez de Rosario. */
  it('prefiere la ciudad aunque un barrio esté más cerca', () => {
    expect(
      nearestPlace({ lat: -32.95, lng: -60.66 }, [
        { name: 'Tiro Suizo', kind: 'suburb', lat: -32.951, lng: -60.661 },
        { name: 'Rosario', kind: 'city', lat: -32.94, lng: -60.65 },
      ]),
    ).toBe('Rosario');
  });

  it('usa el barrio si no hay ninguna localidad en rango', () => {
    expect(
      nearestPlace({ lat: -32.95, lng: -60.66 }, [
        { name: 'Barrio Aislado', kind: 'suburb', lat: -32.951, lng: -60.661 },
      ]),
    ).toBe('Barrio Aislado');
  });

  it('un pueblo lejano no cuenta', () => {
    expect(
      nearestPlace({ lat: -31.4, lng: -64.2 }, [{ name: 'Lejano', kind: 'village', lat: -31.5, lng: -64.2 }]),
    ).toBeNull();
  });
});

describe('SQL', () => {
  it('escapa comillas en los nombres', () => {
    expect(sqlText("L'Escala Pádel")).toBe("'L''Escala Pádel'");
    expect(sqlText(null)).toBe('NULL');
  });

  it('arma un archivo que no pisa lo ya cargado', () => {
    const { rows, stats } = buildVenues(
      [{ type: 'node', id: 1, lat: -31.4, lon: -64.2, tags: { sport: 'padel', name: "O'Brien" } }],
      opts,
    );
    const sql = toSql(rows, { countryCode: 'AR', generatedAt: 'hoy', stats });
    expect(sql).toContain("'O''Brien'");
    expect(sql).toContain('ON CONFLICT (osm_type, osm_id) DO NOTHING');
    expect(sql).toContain('ODbL');
    expect(sql.trim().startsWith('--')).toBe(true);
  });
});

describe('marca de consulta completa', () => {
  /** Es lo que impide que una corrida parcial pise 355 sedes con 283. */
  it('distingue una corrida completa de una parcial', () => {
    const { rows, stats } = buildVenues(
      [{ type: 'node', id: 1, lat: -31.4, lon: -64.2, tags: { sport: 'padel', name: 'Top Pádel' } }],
      opts,
    );
    const full = toSql(rows, { countryCode: 'AR', generatedAt: 'hoy', stats, complete: true });
    const partial = toSql(rows, { countryCode: 'AR', generatedAt: 'hoy', stats, complete: false });
    expect(isCompleteSql(full)).toBe(true);
    expect(isCompleteSql(partial)).toBe(false);
    expect(isCompleteSql('')).toBe(false);
  });
});

describe('fold', () => {
  it('ignora tildes, mayúsculas y espacios', () => {
    expect(fold('  Pádel   CLUB ')).toBe('padel club');
  });
});
