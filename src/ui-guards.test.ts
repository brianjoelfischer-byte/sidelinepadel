import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Guardas estructurales sobre la interfaz, como las de `rls-coverage` para la
 * base: revisan todo el código en vez de un caso puntual.
 *
 * Existe por un bug real: los dos botones de la portada eran `<button>`
 * sin acción, puestos en el bloque 1 cuando no había a dónde ir. Cuando la
 * pantalla de login existió nadie los enlazó, y el typecheck, el lint y los
 * tests pasaban igual. Se vio recién cuando alguien hizo clic.
 */

const SRC = fileURLToPath(new URL('.', import.meta.url));

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

describe('guardas de interfaz', () => {
  /**
   * Un `<button>` hace algo solo si tiene `onClick`, envía un formulario
   * (`type="submit"`) o dispara una acción (`formAction`). Si no tiene
   * ninguno de los tres, es decoración que parece clickeable.
   *
   * Si el botón navega, no debería ser un botón: va un `<Link>`.
   */
  it('ningún <button> queda sin acción', () => {
    const dead: string[] = [];

    for (const file of tsxFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/<button\b([\s\S]*?)>/g)) {
        const attrs = match[1] ?? '';
        if (/onClick|type="submit"|formAction/.test(attrs)) continue;
        const line = source.slice(0, match.index).split('\n').length;
        dead.push(`${relative(SRC, file)}:${line}`);
      }
    }

    expect(dead).toEqual([]);
  });
});
