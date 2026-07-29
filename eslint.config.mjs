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

      /* Regla 24: sin dangerouslySetInnerHTML sobre contenido de usuario. */
      'react/no-danger': 'error',

      /* Nada de estado de la app en localStorage ni sessionStorage.
         Son POR DISPOSITIVO: entrás desde el celular y ves datos viejos del
         que quedó en la notebook, sin forma de saber cuál es el bueno. La
         sesión va en cookies (que el servidor lee y valida en cada request) y
         todo lo demás sale de Supabase, que es la única fuente de verdad. */
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            'Es por dispositivo y se desincroniza. La sesión va en cookies y el resto en Supabase.',
        },
        {
          name: 'sessionStorage',
          message:
            'Es por dispositivo y se desincroniza. La sesión va en cookies y el resto en Supabase.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Leé variables de entorno desde src/lib/env.ts, que separa las públicas de las del servidor.',
        },
        {
          object: 'window',
          property: 'localStorage',
          message: 'Es por dispositivo y se desincroniza. Usá cookies o Supabase.',
        },
        {
          object: 'window',
          property: 'sessionStorage',
          message: 'Es por dispositivo y se desincroniza. Usá cookies o Supabase.',
        },
      ],

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
