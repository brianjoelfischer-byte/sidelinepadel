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
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildVenues, toSql } from './lib/osm-venues.mjs';

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

async function overpass(query, label) {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
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
      const wait = 15_000 * 2 ** attempt * PAUSE;
      console.warn(`  ! ${label}: ${error.message} — reintento en ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  throw lastError;
}

const area = (cc) => `area["ISO3166-1"="${cc}"][admin_level=2]->.a;`;

/**
 * Lo que tiene pádel, más todo lo que tiene nombre a menos de 80 m de algo de
 * pádel: ahí adentro, o al lado, suelen estar las canchas sin nombre.
 *
 * "Todo lo que tiene nombre" y no solo clubes: la primera corrida sobre
 * Argentina, limitada a sports_centre/club/…, dejó 562 canchas sin sede. Están
 * dentro de colegios, barrios cerrados y complejos que nadie etiquetó como
 * club. Se excluyen calles, vías, ríos, límites y barrios, que tienen nombre
 * pero nunca son la sede. `osm-venues.mjs` decide qué se usa y cómo.
 *
 * `bb` trae la caja de cada vía, que es lo que permite saber qué cancha cae
 * dentro de qué lugar.
 */
const padelQuery = (cc) => `[out:json][timeout:280];
${area(cc)}
nwr(area.a)["sport"~"(^|;) *padel *(;|$)",i]->.padel;
nwr(area.a)["name"][!"highway"][!"railway"][!"waterway"][!"boundary"][!"place"][!"route"][!"power"](around.padel:80)->.named;
(.padel; .named;);
out bb tags;`;

/** Localidades, para mostrar y buscar por ciudad cuando el club no la trae. */
const placesQuery = (cc) => `[out:json][timeout:280];
${area(cc)}
node(area.a)["place"~"^(city|town|village|suburb)$"]["name"];
out;`;

async function fetchCountry(cc, timezoneOf) {
  console.log(`▸ ${cc}: consultando sedes…`);
  const elements = await overpass(padelQuery(cc), `${cc} sedes`);
  console.log(`  ${elements.length} elementos`);

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

  const sql = toSql(rows, {
    countryCode: cc,
    generatedAt: new Date().toISOString().slice(0, 10),
    stats,
  });
  await mkdir(OUT_DIR, { recursive: true });
  const out = join(OUT_DIR, `${cc}.sql`);
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
