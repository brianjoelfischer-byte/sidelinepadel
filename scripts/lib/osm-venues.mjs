/**
 * De elementos de OpenStreetMap a sedes de pádel.
 *
 * Lógica pura, sin red ni base: recibe lo que devuelve Overpass y devuelve
 * filas listas para `public.venues`. Separada de `venues-fetch.mjs` para
 * poder probarla sin internet — el entorno de desarrollo no llega a Overpass.
 *
 * ## El problema que resuelve
 *
 * En OSM el pádel se mapea de dos formas, y casi nunca como uno esperaría:
 *
 *  1. **La sede entera** con `sport=padel` y nombre: un club de pádel.
 *  2. **Cada cancha** como `leisure=pitch` + `sport=padel`, casi siempre SIN
 *     nombre, dentro de un club (`leisure=sports_centre`, `club`, …) que sí
 *     tiene nombre pero no dice `padel` en ningún lado.
 *
 * Si se tomaran solo los elementos con nombre y `sport=padel`, el caso 2 —
 * que es el más común en clubes multideporte — desaparecería. Por eso cada
 * cancha sin nombre se atribuye al club que la contiene, y ese club pasa a
 * ser la sede, con la cantidad de canchas contadas.
 */

/** @typedef {{ type: 'node'|'way'|'relation', id: number, lat?: number, lon?: number,
 *   bounds?: { minlat: number, minlon: number, maxlat: number, maxlon: number },
 *   tags?: Record<string, string> }} OsmElement */

const PADEL = /(^|;)\s*padel\s*(;|$)/i;

/** Etiquetas de un lugar deportivo. */
const SPORT_LEISURE = new Set([
  'sports_centre',
  'sports_hall',
  'club',
  'fitness_centre',
  'recreation_ground',
]);

/**
 * Nombres que suenan a lugar deportivo. Solo se usa para asignar por
 * cercanía: sin este filtro, una cancha al lado de "Parrilla Don Juan"
 * terminaría llamándose así.
 */
const SPORTY_NAME =
  /\b(club|p[aá]dd?(el|le)|complejo|deportiv|polideportivo|sport|tenis|tennis|country|arena|indoor|squash|gimnasio|gym|f[uú]tbol|golf|atl[eé]tico|athletic)/i;

/** Una cancha sin club que la contenga va al lugar deportivo a menos de esto. */
const NEAR_M = 60;

/**
 * Tope para contenedores que NO son deportivos. Un colegio o un barrio
 * cerrado con canchas adentro es una sede; un área de varios kilómetros con el
 * nombre de la ciudad ("Cruz del Eje") o de una costanera, no: la cancha cae
 * dentro por casualidad. La diagonal de la caja, no el área, porque las áreas
 * alargadas (una costanera) tienen poca superficie y mucho largo.
 */
const MAX_PLAIN_CONTAINER_M = 1_500;

/** Minúsculas y sin tildes, para comparar nombres: "Pádel Club" = "padel club". */
export function fold(text) {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // las tildes, separadas por NFD
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPadel(tags = {}) {
  return PADEL.test(tags.sport ?? '');
}

export function isPitch(tags = {}) {
  return tags.leisure === 'pitch';
}

function isSporty(tags = {}) {
  return (
    SPORT_LEISURE.has(tags.leisure ?? '') ||
    tags.club === 'sport' ||
    Boolean(tags.sport) ||
    SPORTY_NAME.test(tags.name ?? '')
  );
}

/** Nombre utilizable: 2 a 120 caracteres, como exige el CHECK de la tabla. */
export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < 2) return null;
  return name.length > 120 ? name.slice(0, 120).trim() : name;
}

/** Centro del elemento: el punto de un nodo, o el centro de la caja de una vía. */
export function centerOf(el) {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.bounds) {
    return {
      lat: (el.bounds.minlat + el.bounds.maxlat) / 2,
      lng: (el.bounds.minlon + el.bounds.maxlon) / 2,
    };
  }
  return null;
}

function contains(bounds, point) {
  return (
    point.lat >= bounds.minlat &&
    point.lat <= bounds.maxlat &&
    point.lng >= bounds.minlon &&
    point.lng <= bounds.maxlon
  );
}

function area(bounds) {
  return (bounds.maxlat - bounds.minlat) * (bounds.maxlon - bounds.minlon);
}

function diagonalM(bounds) {
  return distanceM(
    { lat: bounds.minlat, lng: bounds.minlon },
    { lat: bounds.maxlat, lng: bounds.maxlon },
  );
}

/** Distancia en metros entre dos puntos (haversine). */
export function distanceM(a, b) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function addressOf(tags = {}) {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  return street.trim() || null;
}

/**
 * Localidad más cercana, para mostrar "Top Pádel · Córdoba" y poder buscar por
 * ciudad. Se usa solo si el elemento no trae `addr:city`, que es lo habitual.
 *
 * Radios distintos por tipo: a 15 km de una ciudad seguís "en" esa ciudad; a
 * 15 km de un pueblo, probablemente no.
 *
 * Ciudad, pueblo o villa antes que barrio: con los datos reales, tomar lo más
 * cercano daba "Sociedad Tiro Suizo Rosario · Tiro Suizo", el barrio en lugar
 * de Rosario. El barrio queda solo si no hay ninguna localidad en rango.
 */
const SETTLEMENT_RADIUS_M = { city: 20_000, town: 10_000, village: 4_000 };
const SUBURB_RADIUS_M = 3_000;

export function nearestPlace(point, places) {
  let settlement = null;
  let suburb = null;
  for (const place of places) {
    const d = distanceM(point, place);
    const limit = SETTLEMENT_RADIUS_M[place.kind];
    if (limit !== undefined) {
      if (d <= limit && (!settlement || d < settlement.d)) settlement = { name: place.name, d };
    } else if (place.kind === 'suburb' && d <= SUBURB_RADIUS_M) {
      if (!suburb || d < suburb.d) suburb = { name: place.name, d };
    }
  }
  return (settlement ?? suburb)?.name ?? null;
}

/**
 * Convierte la respuesta de Overpass en sedes.
 *
 * @param {OsmElement[]} elements  padel + posibles contenedores
 * @param {object} opts
 * @param {string} opts.countryCode
 * @param {(lat: number, lng: number) => string} opts.timezoneOf
 * @param {{ name: string, kind: string, lat: number, lng: number }[]} [opts.places]
 */
export function buildVenues(elements, { countryCode, timezoneOf, places = [] }) {
  const stats = {
    padelElements: 0,
    courtsAttributed: 0,
    courtsNearby: 0,
    unnamedSkipped: 0,
    duplicatesMerged: 0,
    invalidSkipped: 0,
  };

  const padel = elements.filter((el) => isPadel(el.tags));
  stats.padelElements = padel.length;

  // Contenedores: CUALQUIER área con nombre que no sea una cancha. Un colegio,
  // un barrio cerrado o un complejo sin etiqueta de club también cuentan — las
  // canchas están adentro, y así es como la gente nombra el lugar. La consulta
  // ya descarta calles, límites y barrios. Del más chico al más grande: una
  // cancha dentro de un club dentro de un parque va al club, no al parque.
  const containers = elements
    .filter((el) => el.bounds && cleanName(el.tags?.name) && !isPitch(el.tags))
    .filter((el) => isSporty(el.tags) || diagonalM(el.bounds) <= MAX_PLAIN_CONTAINER_M)
    .sort((a, b) => area(a.bounds) - area(b.bounds));

  // Por cercanía, en cambio, solo lugares deportivos: sin contención, un nombre
  // cualquiera al lado no alcanza. Incluye clubes cargados como un punto, que
  // no tienen área y nunca pueden "contener" nada.
  const nearbyHosts = elements
    .filter((el) => cleanName(el.tags?.name) && !isPitch(el.tags) && isSporty(el.tags))
    .map((el) => ({ el, point: centerOf(el) }))
    .filter((h) => h.point);

  const nearestSporty = (point) => {
    let best = null;
    for (const h of nearbyHosts) {
      const d = distanceM(point, h.point);
      if (d <= NEAR_M && (!best || d < best.d)) best = { el: h.el, d };
    }
    return best?.el ?? null;
  };

  /** @type {Map<string, { el: OsmElement, courts: number }>} */
  const candidates = new Map();
  const key = (el) => `${el.type}/${el.id}`;
  const upsert = (el) => {
    const k = key(el);
    if (!candidates.has(k)) candidates.set(k, { el, courts: 0 });
    return candidates.get(k);
  };

  for (const el of padel) {
    const point = centerOf(el);
    if (!point) {
      stats.invalidSkipped += 1;
      continue;
    }

    if (isPitch(el.tags)) {
      // Una cancha va al club que la contiene, tenga nombre o no: un nombre de
      // cancha es "Cancha 2", no el de la sede.
      const host = containers.find((h) => h !== el && contains(h.bounds, point));
      if (host) {
        upsert(host).courts += 1;
        stats.courtsAttributed += 1;
        continue;
      }
      const near = nearestSporty(point);
      if (near) {
        upsert(near).courts += 1;
        stats.courtsNearby += 1;
        continue;
      }
      // Cancha suelta con nombre: se toma como sede de una cancha.
      if (cleanName(el.tags?.name)) {
        upsert(el).courts += 1;
        continue;
      }
      stats.unnamedSkipped += 1;
      continue;
    }

    // Sede entera marcada como pádel.
    if (cleanName(el.tags?.name)) upsert(el);
    else stats.unnamedSkipped += 1;
  }

  // Filas, y deduplicación: el mismo club cargado como nodo y como vía, o dos
  // veces por dos mapeadores, aparece con el mismo nombre a pocos metros.
  const rows = [];
  for (const { el, courts } of candidates.values()) {
    const point = centerOf(el);
    const name = cleanName(el.tags?.name);
    if (!point || !name) continue;

    const dupe = rows.find(
      (r) => fold(r.name) === fold(name) && distanceM(r, point) < 250,
    );
    if (dupe) {
      stats.duplicatesMerged += 1;
      dupe.courts_count = Math.max(dupe.courts_count ?? 0, courts) || null;
      // Se queda la vía/relación antes que el nodo: tiene el contorno real.
      if (dupe.osm_type === 'node' && el.type !== 'node') {
        dupe.osm_type = el.type;
        dupe.osm_id = el.id;
      }
      continue;
    }

    const tags = el.tags ?? {};
    rows.push({
      name,
      country_code: countryCode,
      admin_area: cleanName(tags['addr:state'] ?? tags['addr:province']) ?? null,
      city: cleanName(tags['addr:city']) ?? nearestPlace(point, places),
      address: addressOf(tags),
      lat: point.lat,
      lng: point.lng,
      timezone: timezoneOf(point.lat, point.lng),
      courts_count: courts >= 1 ? Math.min(courts, 100) : null,
      osm_type: el.type,
      osm_id: el.id,
    });
  }

  rows.sort((a, b) => fold(a.name).localeCompare(fold(b.name)));
  return { rows, stats };
}

/** Literal SQL seguro: comillas simples duplicadas, NULL si no hay valor. */
export function sqlText(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  if (value === null || value === undefined) return 'NULL';
  if (!Number.isFinite(value)) throw new Error(`número inválido: ${value}`);
  return String(value);
}

/**
 * El archivo SQL para pegar en el SQL Editor.
 *
 * `ON CONFLICT DO NOTHING`: una segunda carga no pisa nada. Si un moderador
 * corrigió un club, la re-sincronización no le deshace el trabajo (§13). La
 * actualización de clubes ya cargados queda para el job mensual.
 */
/**
 * Marca de consulta completa en la cabecera del SQL. `venues-fetch.mjs` la
 * lee para no pisar un archivo completo con uno parcial.
 */
export const COMPLETE_MARK = '--  Consulta: completa';

export function isCompleteSql(sql) {
  return sql.includes(COMPLETE_MARK);
}

export function toSql(rows, { countryCode, generatedAt, stats, complete = true }) {
  const header = `-- ===========================================================================
--  Sideline Padel · sedes de pádel de ${countryCode} desde OpenStreetMap
--  Generado por scripts/venues-fetch.mjs · ${generatedAt}
${complete ? COMPLETE_MARK : '--  Consulta: parcial (falló la consulta extra; solo clubes etiquetados)'}
--
--  ${rows.length} sedes · ${stats.courtsAttributed + stats.courtsNearby} canchas atribuidas a su club (${stats.courtsNearby} por cercanía)
--  ${stats.duplicatesMerged} duplicados unidos · ${stats.unnamedSkipped} canchas sin nombre ni club
--
--  Datos © colaboradores de OpenStreetMap, bajo licencia ODbL 1.0.
--  https://www.openstreetmap.org/copyright
--
--  Pegá TODO este archivo en el SQL Editor de Supabase y ejecutá.
--  Se puede correr más de una vez: lo que ya está cargado no se toca.
-- ===========================================================================

BEGIN;

-- Las sedes de OSM entran ya aprobadas y con origen 'osm', que es justo lo
-- que las políticas de RLS le prohíben a un usuario. Por eso esto tiene que
-- correr como un rol que saltea RLS: el SQL Editor usa \`postgres\`, que puede.
DO $$
BEGIN
  IF NOT (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION
      'Este archivo tiene que correr en el SQL Editor de Supabase (rol postgres). El rol actual, %, no puede cargar sedes aprobadas.',
      current_user;
  END IF;
END $$;
`;

  const CHUNK = 500;
  const inserts = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const values = rows
      .slice(i, i + CHUNK)
      .map(
        (r) =>
          `  (${sqlText(r.name)}, ${sqlText(r.country_code)}, ${sqlText(r.admin_area)}, ` +
          `${sqlText(r.city)}, ${sqlText(r.address)}, ` +
          `ST_SetSRID(ST_MakePoint(${sqlNumber(r.lng)}, ${sqlNumber(r.lat)}), 4326)::geography, ` +
          `${sqlText(r.timezone)}, ${sqlNumber(r.courts_count)}, 'osm', ` +
          `${sqlText(r.osm_type)}, ${sqlNumber(r.osm_id)}, 'approved')`,
      )
      .join(',\n');
    inserts.push(`
INSERT INTO public.venues
  (name, country_code, admin_area, city, address, location, timezone,
   courts_count, source, osm_type, osm_id, status)
VALUES
${values}
ON CONFLICT (osm_type, osm_id) DO NOTHING;
`);
  }

  const footer = `
COMMIT;

-- Verificación:
-- SELECT count(*) FROM public.venues WHERE country_code = '${countryCode}' AND source = 'osm';
`;

  return header + inserts.join('') + footer;
}
