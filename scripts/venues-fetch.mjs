#!/usr/bin/env node
/**
 * Baja las sedes de pádel de OpenStreetMap y escribe un SQL por país.
 *
 *   node scripts/venues-fetch.mjs AR CL UY   → supabase/seed/venues/AR.sql, …
 *
 * Corre en GitHub Actions (.github/workflows/venues-seed.yml), no en la app ni
 * en la máquina de nadie: es la única parte del proyecto que habla con
 * Overpass, y lo hace pocas veces y sin apuro (§13 — nunca en vivo, nunca por
 * pedido de un usuario).
 *
 * Necesita `@photostructure/tz-lookup`, que el workflow instala con
 * `--no-save`. No está en package.json a propósito: solo lo usa este script,
 * y agregarlo obligaría a cada máquina a reinstalar para nada.
 *
 * Política de uso de Overpass: User-Agent identificable, una consulta por país
 * a la vez, pausa entre países, y reintento con espera creciente si el
 * servidor está ocupado — no insistir es parte del acuerdo.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildVenues, isCompleteSql, toSql } from './lib/osm-venues.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(root, 'supabase', 'seed', 'venues');

const USER_AGENT =
  'SidelinePadel/0.1 (+https://github.com/brianjoelfischer-byte/sidelinepadel)';

// OVERPASS_URL permite apuntar a un servidor falso para probar el script sin
// salir a internet.
const ENDPOINTS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];

/** Pausas entre consultas. Se acortan solo contra un servidor de prueba. */
const PAUSE = process.env.OVERPASS_URL ? 0 : 1;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query, label, attempts = 4) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(300_000),
      });
      // 429 y 504 son "ocupado": se espera y se prueba otro servidor.
      if (res.status === 429 || res.status === 504 || res.status >= 500) {
        throw new Error(`${endpoint} respondió ${res.status}`);
      }
      if (!res.ok) throw new Error(`${endpoint} respondió ${res.status}: ${await res.text()}`);
      const json = await res.json();
      // Overpass devuelve 200 con un "remark" cuando se le acaba el tiempo: el
      // resultado viene incompleto y hay que tratarlo como error.
      if (json.remark && /timed out|out of memory/i.test(json.remark)) {
        throw new Error(`${endpoint}: ${json.remark}`);
      }
      return json.elements ?? [];
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      const wait = 15_000 * 2 ** attempt * PAUSE;
      console.warn(`  ! ${label}: ${error.message} — reintento en ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  throw lastError;
}

const area = (cc) => `area["ISO3166-1"="${cc}"][admin_level=2]->.a;`;

const PADEL_SET = (cc) => `${area(cc)}
nwr(area.a)["sport"~"(^|;) *padel *(;|$)",i]->.padel;`;

/**
 * Consulta principal: lo que tiene pádel, más los lugares deportivos con
 * nombre a menos de 80 m. Es la forma de la primera corrida sobre Argentina,
 * que terminó en un minuto: el filtro por etiqueta `leisure` usa un índice
 * chico, así que es barata. Garantiza el piso de sedes.
 *
 * `bb` trae la caja de cada vía: es lo que permite saber qué cancha cae
 * dentro de qué lugar.
 */
const coreQuery = (cc) => `[out:json][timeout:280];
${PADEL_SET(cc)}
nwr(around.padel:80)["leisure"~"^(sports_centre|sports_hall|club|fitness_centre|recreation_ground)$"]["name"]->.hosts;
(.padel; .hosts;);
out bb tags;`;

/**
 * Consulta extra: los otros lugares que contienen canchas. Esa misma primera
 * corrida dejó 562 canchas sin sede: estaban dentro de colegios, barrios
 * cerrados y complejos que nadie etiquetó como club.
 *
 * Acotada a propósito. La versión "todo lo que tenga nombre a 80 m" traía cada
 * negocio y cada casa con nombre alrededor de 1.100 canchas: el servidor
 * principal respondió 504 y los espejos no contestaron en 5 minutos, cuatro
 * veces seguidas. Ahora:
 *  · vías con nombre (áreas: pueden CONTENER canchas), sin calles, ríos,
 *    límites ni barrios;
 *  · puntos solo si son deportivos: un punto nunca contiene nada, y para
 *    asignar por cercanía `osm-venues.mjs` solo acepta lugares deportivos;
 *  · relaciones solo con `leisure`: calcular la geometría de cualquier
 *    relación con nombre cercana (parques nacionales, municipios) es lo caro.
 *
 * Sin `(area.a)` en estos pasos: con el área, Overpass junta primero todo el
 * país y recién después filtra por cercanía. Así arranca por el índice
 * espacial alrededor de cada cancha, que ya son solo las del país.
 */
const extraQuery = (cc) => `[out:json][timeout:280];
${PADEL_SET(cc)}
(
  way(around.padel:80)["name"][!"highway"][!"railway"][!"waterway"][!"boundary"][!"place"][!"route"][!"power"];
  node(around.padel:80)["name"]["sport"];
  node(around.padel:80)["name"]["club"];
  node(around.padel:80)["name"]["leisure"];
  rel(around.padel:80)["name"]["leisure"];
);
out bb tags;`;

/** Localidades, para mostrar y buscar por ciudad cuando el club no la trae. */
const placesQuery = (cc) => `[out:json][timeout:280];
${area(cc)}
node(area.a)["place"~"^(city|town|village|suburb)$"]["name"];
out;`;

async function fetchCountry(cc, timezoneOf) {
  console.log(`▸ ${cc}: consultando sedes…`);
  const core = await overpass(coreQuery(cc), `${cc} sedes`);
  console.log(`  ${core.length} elementos`);

  await sleep(10_000 * PAUSE);

  // Si la extra falla, se sigue con la principal: menos canchas atribuidas,
  // pero nunca un país en cero por culpa de la parte opcional.
  console.log(`▸ ${cc}: consultando otros lugares con canchas…`);
  let extra = [];
  let complete = true;
  try {
    // Cuatro intentos: la extra es la que más sufre cuando Overpass está
    // saturado (504), y eso pasa por ratos. Con esperas crecientes, alguno entra.
    extra = await overpass(extraQuery(cc), `${cc} extra`, 4);
    console.log(`  ${extra.length} elementos`);
  } catch (error) {
    complete = false;
    console.warn(`  ! ${cc} extra: ${error.message} — sigo solo con la principal`);
  }

  // Un mismo elemento puede venir en las dos: se une por tipo e id.
  const byKey = new Map();
  for (const el of [...core, ...extra]) byKey.set(`${el.type}/${el.id}`, el);
  const elements = [...byKey.values()];

  await sleep(10_000 * PAUSE);

  console.log(`▸ ${cc}: consultando localidades…`);
  const placeElements = await overpass(placesQuery(cc), `${cc} localidades`);
  const places = placeElements
    .filter((p) => typeof p.lat === 'number' && p.tags?.name)
    .map((p) => ({ name: p.tags.name, kind: p.tags.place, lat: p.lat, lng: p.lon }));
  console.log(`  ${places.length} localidades`);

  const { rows, stats } = buildVenues(elements, { countryCode: cc, timezoneOf, places });
  console.log(
    `  → ${rows.length} sedes · ${stats.courtsAttributed} canchas dentro de su club · ${stats.courtsNearby} al lado · ` +
      `${stats.duplicatesMerged} duplicados · ${stats.unnamedSkipped} sin nombre`,
  );

  if (rows.length === 0) {
    // Un país sin ninguna sede es sospechoso (consulta rota, área mal
    // resuelta). Mejor no escribir un archivo vacío que parezca válido.
    throw new Error(`${cc}: 0 sedes. No se escribe el archivo.`);
  }

  const out = join(OUT_DIR, `${cc}.sql`);

  // Una corrida parcial nunca pisa una completa. Pasó: con Overpass
  // saturado, una corrida sin la consulta extra reemplazó 355 sedes por 283.
  // El archivo anterior queda, y la próxima corrida completa lo actualiza.
  if (!complete) {
    const previous = await readFile(out, 'utf8').catch(() => '');
    if (isCompleteSql(previous)) {
      console.warn(`  ! ${cc}: corrida parcial — se conserva el archivo anterior, que es completo`);
      return;
    }
  }

  const sql = toSql(rows, {
    countryCode: cc,
    generatedAt: new Date().toISOString().slice(0, 10),
    stats,
    complete,
  });
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(out, sql, 'utf8');
  console.log(`  ✓ ${out}`);
}

const countries = process.argv
  .slice(2)
  .map((c) => c.trim().toUpperCase())
  .filter((c) => /^[A-Z]{2}$/.test(c));

if (countries.length === 0) {
  console.error('Uso: node scripts/venues-fetch.mjs AR [CL UY …]');
  process.exit(1);
}

const { default: tzlookup } = await import('@photostructure/tz-lookup');
const timezoneOf = (lat, lng) => tzlookup(lat, lng);

let failed = 0;
for (const [i, cc] of countries.entries()) {
  try {
    await fetchCountry(cc, timezoneOf);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${cc}: ${error.message}`);
  }
  if (i < countries.length - 1) await sleep(30_000 * PAUSE);
}

process.exitCode = failed > 0 ? 1 : 0;
