import { afterAll } from 'vitest';

import { db } from './helpers';

/**
 * Cierra el pool una vez por archivo de test, cuando terminaron TODOS sus
 * describes. Ponerlo dentro de un describe cierra la conexión mientras los
 * siguientes todavía la necesitan.
 */
afterAll(async () => {
  await db.end();
});
