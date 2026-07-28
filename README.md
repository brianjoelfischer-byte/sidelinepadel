# Sideline Padel

PWA para el jugador de pádel amateur: registrá tus partidos, seguí tu progreso
y coordiná turnos con gente de tu nivel.

**Sideline no reserva canchas.** La reserva la hacés vos en el club; acá se
coordina quién juega, dónde y cuándo, con recordatorio antes del partido.

El diseño completo está en **[`BLUEPRINT.md`](./BLUEPRINT.md)** — 17 secciones
con el modelo de datos, las políticas de seguridad, el sistema de niveles y las
reglas no negociables. Se escribió antes que el código y manda sobre él.

## Arrancar

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre en <http://localhost:3000> y redirige a `/es`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (incluye typecheck) |
| `npm run typecheck` | Solo tipos |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run check` | Typecheck + lint + test — lo mismo que corre CI |

## Estructura

```
src/
├── app/
│   ├── [locale]/          # todo lo que ve el usuario, con prefijo de idioma
│   ├── globals.css        # tokens de diseño (§10)
│   └── not-found.tsx      # 404 sin locale conocido
├── components/
├── i18n/                  # routing, navegación y carga de mensajes
├── lib/env.ts             # ÚNICO acceso a process.env
├── messages/              # es.json · en.json
└── proxy.ts               # detección y prefijo de idioma
```

## Convenciones que hace cumplir el tooling

No son sugerencias: fallan el build o el CI.

- **Nada de texto suelto en JSX.** Todo va en `messages/*.json`, y un test
  verifica que los idiomas tengan exactamente las mismas claves.
- **La palabra "reserva" solo se usa para negar que la app reserve canchas**
  (§12.7). Hay un test que falla si aparece en cualquier otro mensaje.
- **`process.env` solo en `src/lib/env.ts`.** Lo bloquea ESLint. Separa lo
  público de lo secreto para que un secreto no termine en el bundle.
- **`next/link` y `next/navigation` están prohibidos** — usá los de
  `@/i18n/navigation`, que conservan el idioma de la URL.
- **`any` es error, no warning.**
- **TypeScript estricto de verdad**: además de `strict`, van
  `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`.
- **Una vulnerabilidad alta o crítica bloquea el merge** (`npm audit`).

## Estado

Bloque 1 de 14 (§09 del blueprint): fundaciones, i18n, tokens de diseño y CI.
Todavía no hay base de datos, autenticación ni funcionalidad de producto.
