import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';

// eslint-config-next 16 ya publica flat config: se importa directo,
// sin la capa de compatibilidad FlatCompat.
export default tseslint.config(
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },

  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    rules: {
      /* Regla 28 del BLUEPRINT: `any` prohibido salvo justificación escrita.
         Es error, no warning — un warning se ignora. */
      '@typescript-eslint/no-explicit-any': 'error',

      /* Una variable sin usar suele ser una refactorización a medio terminar.
         El prefijo `_` es la vía explícita para decir "sé que no la uso". */
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      /* Regla 23: cero secretos en el bundle del cliente. Esto ataja el error
         obvio; `src/lib/env.ts` es la única puerta legítima. */
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Leé variables de entorno desde src/lib/env.ts, que separa las públicas de las del servidor.',
        },
      ],

      /* Regla 24: sin dangerouslySetInnerHTML sobre contenido de usuario. */
      'react/no-danger': 'error',

      /* §11: la navegación tiene que conservar el locale. `next/link` lo pierde. */
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/link',
              message:
                'Usá el Link de @/i18n/navigation para no perder el idioma.',
            },
            {
              name: 'next/navigation',
              importNames: ['redirect', 'usePathname', 'useRouter'],
              message:
                'Usá los equivalentes de @/i18n/navigation para no perder el idioma.',
            },
          ],
        },
      ],
    },
  },

  /* La capa de i18n, el proxy y env son los únicos que pueden usar los
     originales: son justamente quienes los envuelven. */
  {
    files: ['src/i18n/**', 'src/proxy.ts', 'src/lib/env.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-properties': 'off',
    },
  },

  /* Herramientas de build y tests de base de datos: corren solo en Node y
     nunca entran a un bundle, así que la regla que protege al cliente de los
     secretos no aplica. Leen DATABASE_URL, que es su razón de existir. */
  {
    files: ['scripts/**', 'supabase/tests/**'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
);
