import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    projects: [
      {
        // Tests de la app: puros, sin base de datos.
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        },
      },
      {
        // Tests de RLS: necesitan un Postgres con las migraciones aplicadas.
        // Van en serie: comparten la base y se truncan entre casos.
        extends: true,
        test: {
          name: 'rls',
          include: ['supabase/tests/**/*.test.ts'],
          setupFiles: ['supabase/tests/setup.ts'],
          fileParallelism: false,
          testTimeout: 20000,
        },
      },
    ],
  },
});
