import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Nada invisible en el código.
 *
 * Pasó tres veces: un rango de tildes (U+0300 a U+036F) en una expresión
 * regular, un ESC (U+001B) de color de terminal y un rango de caracteres de
 * control terminaron escritos como los caracteres en sí, no como su código.
 * El archivo funciona igual, pero en pantalla se ve vacío o como basura, así
 * que nadie puede revisar qué hace, y un editor lo puede romper al guardar.
 *
 * Se permiten tabulación y saltos de línea. Todo lo demás se escribe con su
 * secuencia de escape (la del ESC, la de un código Unicode) o, para las
 * tildes, con la clase de propiedad Unicode de marcas.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['src', 'scripts', 'supabase'];
const EXT = /\.(ts|tsx|mjs|js|sql|json)$/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return EXT.test(entry.name) ? [path] : [];
  });
}

function isInvisible(code: number): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return false;
  if (code < 0x20 || code === 0x7f) return true; // control
  if (code >= 0x0300 && code <= 0x036f) return true; // tildes sueltas
  if (code >= 0x200b && code <= 0x200f) return true; // espacios de ancho cero
  if (code === 0xfeff) return true; // BOM
  return false;
}

describe('guardas de código fuente', () => {
  it('ningún archivo tiene caracteres invisibles', () => {
    const found: string[] = [];
    for (const dir of DIRS) {
      for (const file of files(join(ROOT, dir))) {
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          for (const ch of line) {
            const code = ch.codePointAt(0) ?? 0;
            if (isInvisible(code)) {
              found.push(`${relative(ROOT, file)}:${i + 1} U+${code.toString(16).padStart(4, '0')}`);
              break;
            }
          }
        });
      }
    }
    expect(found).toEqual([]);
  });
});
