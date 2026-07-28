<div align="center">

# Sideline Padel

**Jugá. Registrá. Progresá.**

PWA para el jugador de pádel amateur: registrá tus partidos, mirá cómo evoluciona
tu nivel y coordiná turnos con gente que juega parecido a vos.

[![CI](https://github.com/brianjoelfischer-byte/sidelinepadel/actions/workflows/ci.yml/badge.svg)](https://github.com/brianjoelfischer-byte/sidelinepadel/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Estado](https://img.shields.io/badge/estado-en%20construcci%C3%B3n-C8F751)

</div>

---

## Qué es

Las plataformas de reserva resuelven la cancha, pero tratan al jugador como
cliente de un club. Acá el centro es el jugador: su historial, su progreso, su
gente. La coordinación es una consecuencia, no el producto.

> ### ⚠️ Sideline **no reserva canchas**
>
> La reserva la hacés vos en el club, por teléfono o por donde reserves
> siempre. En Sideline confirmás que el turno **ya existe** y coordinás quién
> juega. La app nunca mueve dinero ni bloquea una cancha.

## Qué hace

| | |
|---|---|
| 📊 **Registrá y medí** | Partidos, entrenamientos y partidos rápidos. Ratio de victorias, racha, forma reciente y progresión de nivel. |
| 🎯 **Un nivel honesto** | Vos declarás tu categoría y la comunidad opina. El nivel que te empareja sale de los dos, con peso creciente de quienes jugaron con vos. |
| 🤝 **Coordiná turnos** | Turnos de 4 con banda de nivel. El creador confirma la cancha; cada jugador confirma si va. |
| 📍 **Sedes de todo el mundo** | Directorio con seed de OpenStreetMap en 27 países, más altas de la comunidad. |
| 🔔 **Recordatorios** | Aviso a las 24 h para confirmar y recordatorio 30 minutos antes de jugar. |
| 🌍 **Multi-idioma** | Español e inglés desde el día uno, con la estructura lista para más. |

### El sistema de niveles

El problema de todas estas apps: el nivel autodeclarado se abusa. Acá hay tres
valores, y los tres son públicos.

| Valor | Qué es | Quién manda |
|---|---|---|
| **Declarado** | Lo que vos decís que sos | Vos |
| **Percibido** | Lo que dicen los que jugaron con vos | Ellos |
| **Efectivo** | La mezcla — **es el que te empareja** | El sistema |

El peso de la comunidad crece con la cantidad de votantes distintos: con 5
votantes es 50 %, con 20 es 80 %. Hay frenos contra el abuso — una voz por
persona, decaimiento por antigüedad, media recortada, mínimo de partidos para
votar, y un tope de 0,5 puntos de movimiento cada 30 días. Tu nivel declarado
**nunca se reescribe**; se calcula otro al lado.

Como "8va a 1ra" no es universal, internamente la escala es canónica (1.0–7.0) y
la categoría local es solo una etiqueta. Así un jugador argentino y uno sueco
pueden aparecer en el mismo turno sin traducir nada a mano.

## El plano

Todo el diseño está en **[`BLUEPRINT.md`](./BLUEPRINT.md)**: 17 secciones con el
modelo de datos, las políticas de seguridad, el sistema de niveles, el directorio
de sedes, los torneos y 35 reglas no negociables.

Se escribió **antes** que el código y manda sobre él. Si algo del código lo
contradice, el que está mal es el código.

## Stack

| Capa | Elección | Por qué |
|---|---|---|
| Framework | **Next.js 16** (App Router) | SSR para perfiles y sedes, Server Actions para mutaciones con auth del lado servidor |
| Lenguaje | **TypeScript** estricto | Más que `strict`: `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` |
| Estilos | **Tailwind 4** + tokens CSS | La paleta se cambia sin tocar componentes |
| Datos | **Supabase** (Postgres + PostGIS) | Row Level Security: la autorización vive en la base, no solo en el código |
| i18n | **next-intl** | Rutas por idioma, formato por región y zona horaria |
| Tests | **Vitest** · **Playwright** | |
| Deploy | **Vercel** + Supabase | |

**Por qué RLS y no un backend propio:** casi toda la autorización de esta app es
"¿este usuario puede ver esta fila?". Con RLS la regla se escribe una vez en la
base y se cumple aunque un endpoint tenga un bug. Con un backend propio, un
`where` olvidado filtra datos de otros usuarios.

## Arrancar

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre <http://localhost:3000>, que redirige a `/es`.

### Comandos

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
│   ├── globals.css        # tokens de diseño
│   └── not-found.tsx      # 404 cuando no hay idioma conocido
├── components/
├── i18n/                  # routing, navegación y carga de mensajes
├── lib/env.ts             # ÚNICO acceso a process.env
├── messages/              # es.json · en.json
└── proxy.ts               # detección y prefijo de idioma
```

## Convenciones

No son sugerencias: fallan el build o el CI.

- **Cero texto suelto en JSX.** Todo va en `messages/*.json`, y un test verifica
  que los idiomas tengan exactamente las mismas claves — ese bug no lo detecta
  ni el typecheck ni el build, pero le muestra la clave cruda al usuario.
- **La palabra "reserva" solo se usa para negar que la app reserve canchas.**
  Hay un test que falla si aparece en cualquier otro mensaje.
- **`process.env` solo en `src/lib/env.ts`**, que separa lo público de lo
  secreto para que un secreto no derive al bundle del cliente.
- **`next/link` y `next/navigation` están prohibidos** — usá los de
  `@/i18n/navigation`, que conservan el idioma de la URL.
- **`any` es error**, no warning.
- **Una vulnerabilidad alta o crítica bloquea el merge.**

## Estado

🚧 **En construcción.** Bloque 1 de 14 del plan de §09.

| | Bloque | Estado |
|---|---|---|
| 1 | Fundaciones, i18n, tokens, CI | ✅ |
| 2 | Datos y RLS | ⏳ siguiente |
| 3 | Auth y onboarding | |
| 4 | Perfil y niveles | |
| 5 | Sesiones y valoraciones | |
| 6 | Estadísticas | |
| 7 | Sedes | |
| 8 | Social | |
| 9 | Turnos | |
| 10 | Recordatorios | |
| 11 | PWA | |
| 12 | Trofeos | |
| 13 | Cumplimiento (GDPR) | |
| 14 | Endurecimiento | |

Todavía no hay base de datos, autenticación ni funcionalidad de producto.

## Créditos y licencias

Los datos de sedes vienen de **OpenStreetMap**, bajo
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — la atribución es una
obligación de licencia, no una cortesía.
