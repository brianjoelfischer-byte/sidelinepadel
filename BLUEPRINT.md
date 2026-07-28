# BLUEPRINT — Sideline Padel

> Plano de construcción. Generado en la fase de diseño, antes de escribir código.
> La estructura y la seguridad están definidas acá, no se parchean al final.
>
> **Estado:** v1 — borrador para revisión del owner.
> **Fecha:** julio 2026

---

## 01 · Visión y alcance

**Qué es.** Una PWA para el jugador de pádel amateur: registra sus partidos y entrenamientos, ve su progreso en estadísticas, encuentra compañeros y rivales de nivel parecido, y coordina turnos con recordatorio antes del encuentro.

**Qué NO es (frontera dura).** No es una plataforma de reservas ni de pagos. La app **nunca** reserva una cancha ni mueve dinero. El jugador reserva por su lado (club, teléfono, Playtomic, lo que use) y en Sideline solo **confirma** que el turno existe: día, hora, lugar y cancha.

**Por qué existe.** Las plataformas de reserva (Playtomic, MATCHi) resuelven la cancha pero tratan al jugador como un cliente de un club. Acá el centro es el jugador: su historial, su progreso, su gente. La coordinación es una consecuencia, no el producto.

**Alcance v1 (MVP).**
- Alta de cuenta y onboarding con perfil de jugador.
- Registro de partidos, entrenamientos y partidos rápidos.
- Estadísticas y progresión de nivel.
- Directorio de jugadores y perfiles públicos/privados.
- Directorio mundial de sedes de pádel.
- Turnos abiertos con banda de nivel y confirmación de participantes.
- Recordatorio 30 minutos antes del encuentro.
- Multi-idioma y multi-país desde el día uno.

**Fuera de alcance v1.** App nativa (fase 2), pagos/suscripción, reserva real de cancha, torneos, chat en tiempo real, ranking global competitivo.

---

## 02 · Arquetipo y usuarios

**Arquetipo:** aplicación social-deportiva con datos de dominio (partidos, niveles, sedes) + coordinación ligera de eventos. No es un marketplace ni un SaaS B2B.

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| `anon` | Visitante sin cuenta | Ver la landing, ver perfiles públicos, buscar sedes. Nada más. |
| `player` | Usuario registrado | Todo lo suyo: perfil, partidos, estadísticas, turnos, seguir jugadores. |
| `moderator` | Voluntario de confianza | Aprobar/rechazar sedes propuestas, resolver reportes de abuso. |
| `admin` | Owner | Todo lo del moderador + gestión de roles, feature flags, importaciones. |

**Usuario primario:** jugador amateur, 20–55 años, juega 1–3 veces por semana, categorías 8va a 1ra (o el equivalente de su país). Usa el celular, no la computadora. Muchos son de Argentina/España pero el diseño no asume un país.

**Restricción de edad.** El pádel amateur incluye menores. La v1 exige **16 años o más** en el registro (declaración + fecha de nacimiento). Menores de 16 quedan bloqueados: evita el régimen de consentimiento parental de GDPR/COPPA, que es desproporcionado para un MVP. Está documentado en Términos.

---

## 03 · Stack técnico

| Capa | Elección | Por qué |
|---|---|---|
| Framework | **Next.js 15+ (App Router) + TypeScript estricto** | SSR para SEO de perfiles/sedes, Server Actions para mutaciones con auth del lado servidor, un solo repo. |
| PWA | **Serwist** (sucesor mantenido de next-pwa) | Service worker, instalable, offline básico, Web Push. |
| Estilos | **Tailwind CSS + CSS variables por token** | Los tokens en variables permiten cambiar la paleta sin tocar componentes. |
| Componentes | **shadcn/ui (Radix)** | Accesibilidad (foco, teclado, ARIA) resuelta de base. |
| Backend + DB | **Supabase (Postgres 16 + PostGIS + Auth + Storage)** | Row Level Security = la autorización vive en la base, no solo en el código. Reutilizable por la app nativa en fase 2. |
| ORM/consultas | **supabase-js** tipado + SQL puro para lo geoespacial | Los tipos se generan del esquema real. |
| Validación | **Zod** en todo borde de entrada | Un solo esquema valida cliente y servidor. |
| i18n | **next-intl** | Rutas por locale, formato de fecha/número por región, carga por chunk. |
| Push | **Web Push (VAPID)** vía `web-push` | Sin dependencia de Firebase. |
| Cron | **pg_cron** en Supabase (o Vercel Cron como respaldo) | Dispara los recordatorios. |
| Rate limiting | **Upstash Redis** (`@upstash/ratelimit`) | Serverless, sin servidor propio que mantener. |
| Errores | **Sentry** con scrubbing de PII | |
| Analítica | **Plausible** (sin cookies) | Evita el banner de cookies y el problema de consentimiento. |
| Deploy | **Vercel** (app) + **Supabase** (datos) | |
| Tests | **Vitest** (unidad) + **Playwright** (e2e) | |
| CI | **GitHub Actions** | typecheck, lint, test, `npm audit`, escaneo de secretos. |

**Decisión clave: por qué Supabase y no un backend propio.** La autorización de esta app es casi toda "¿este usuario puede ver/tocar esta fila?". Con RLS esa regla se escribe una vez en la base y se cumple aunque un endpoint tenga un bug. Un backend propio con Prisma pondría toda esa responsabilidad en el código de aplicación, donde un `where` olvidado filtra datos de otros usuarios. Para un equipo chico, RLS es la decisión de seguridad de mayor retorno.

---

## 04 · Arquitectura del sistema

```
┌───────────────────────────────────────────────────────────────┐
│  PWA (Next.js en Vercel)                                      │
│  ├── Server Components → lectura con sesión del usuario       │
│  ├── Server Actions    → TODA mutación (nunca desde cliente)  │
│  ├── Route Handlers    → webhooks, push subscribe, cron       │
│  └── Service Worker    → cache offline + recepción de push    │
└──────────────┬────────────────────────────────────────────────┘
               │ supabase-js (JWT del usuario, nunca service_role)
┌──────────────▼────────────────────────────────────────────────┐
│  Supabase                                                     │
│  ├── Auth (magic link + Google OAuth)                         │
│  ├── Postgres + PostGIS  ── RLS activo en TODAS las tablas    │
│  ├── Storage (avatares)  ── buckets con políticas             │
│  └── pg_cron ── despacho de recordatorios cada 5 min          │
└──────────────┬────────────────────────────────────────────────┘
               │
   ┌───────────┴──────────┬─────────────────┐
   ▼                      ▼                 ▼
Upstash Redis       Overpass API      Web Push (FCM/APNs)
(rate limit)        (seed de sedes,   (recordatorios)
                     job offline)
```

**Regla de oro de la arquitectura:** el cliente nunca habla con servicios externos ni tiene claves. Toda llamada saliente (Overpass, push, Redis) sale del servidor. La clave `service_role` de Supabase **solo** existe en jobs de servidor, nunca en un Server Component que renderice para un usuario.

---

## 05 · Modelo de datos

Postgres. Todo `id` es `uuid`. Todo timestamp es `timestamptz` en UTC. **Todas las tablas tienen RLS activado con política por defecto de negación.**

### Identidad y perfil

```sql
-- profiles: 1:1 con auth.users
profiles (
  id                uuid PK REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 40),
  slug              text UNIQUE NOT NULL,          -- URL pública
  avatar_path       text,                          -- ruta en Storage, no URL
  country_code      char(2) NOT NULL,              -- ISO 3166-1
  locale            text NOT NULL DEFAULT 'es',
  timezone          text NOT NULL,                 -- IANA, ej. America/Argentina/Buenos_Aires
  level_value       numeric(2,1) NOT NULL CHECK (level_value BETWEEN 1.0 AND 7.0),
  level_locked_until timestamptz,                  -- anti-sandbagging
  preferred_side    text CHECK (preferred_side IN ('drive','reves','indistinto')),
  preferred_hand    text CHECK (preferred_hand IN ('left','right')),
  racket            text,
  birth_date        date NOT NULL,                 -- verificación de edad
  is_public         boolean NOT NULL DEFAULT true,
  role              text NOT NULL DEFAULT 'player'
                    CHECK (role IN ('player','moderator','admin')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz                    -- soft delete
)

level_history (
  id, profile_id FK, from_value, to_value, reason, changed_at
)

-- grafo social dirigido (seguir, no amistad mutua)
follows (
  follower_id FK profiles, followee_id FK profiles, created_at,
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
)

blocks (
  blocker_id FK profiles, blocked_id FK profiles, created_at,
  PRIMARY KEY (blocker_id, blocked_id)
)
```

### Sedes y canchas

```sql
venues (
  id            uuid PK,
  name          text NOT NULL,
  country_code  char(2) NOT NULL,
  admin_area    text,                     -- provincia/estado
  city          text,
  address       text,
  location      geography(Point,4326) NOT NULL,
  timezone      text NOT NULL,            -- resuelto del punto, no del usuario
  courts_count  int,
  surface_notes text,
  source        text NOT NULL CHECK (source IN ('osm','user','import')),
  osm_type      text, osm_id bigint,      -- para reconciliar en re-seeds
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','duplicate')),
  submitted_by  uuid FK profiles,
  approved_by   uuid FK profiles,
  created_at, updated_at,
  UNIQUE (osm_type, osm_id)
)
CREATE INDEX ON venues USING GIST (location);
CREATE INDEX ON venues (country_code, status);
```

> `courts` no es una tabla en v1. La cancha se guarda como texto libre en el turno (`court_label`), porque no tenemos forma confiable de conocer la numeración interna de cada club del mundo. Inventar ese catálogo sería datos falsos.

### Sesiones registradas (partidos / entrenamientos)

```sql
sessions (
  id            uuid PK,
  owner_id      uuid NOT NULL FK profiles ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('match','training','quick_match')),
  played_on     date NOT NULL,
  venue_id      uuid FK venues,
  venue_freetext text,                    -- si la sede no está en el directorio
  result        text CHECK (result IN ('win','loss','draw')),   -- NULL en training
  sets          jsonb,                    -- [{me:6,opp:3}, ...] validado con Zod
  side_played   text CHECK (side_played IN ('drive','reves')),
  self_rating   int CHECK (self_rating BETWEEN 1 AND 10),
  opponents_avg_level numeric(2,1),       -- calculado, no ingresado
  notes         text CHECK (char_length(notes) <= 160),
  created_at, updated_at
)
CREATE INDEX ON sessions (owner_id, played_on DESC);

-- participantes: pueden ser usuarios registrados o nombres sueltos
session_participants (
  id            uuid PK,
  session_id    uuid NOT NULL FK sessions ON DELETE CASCADE,
  profile_id    uuid FK profiles,         -- NULL si es un no-usuario
  guest_name    text,                     -- solo si profile_id IS NULL
  team          text NOT NULL CHECK (team IN ('mine','opponent')),
  perceived_level numeric(2,1),           -- lo que el owner le asignó
  CHECK (num_nonnulls(profile_id, guest_name) = 1)
)
```

**Nota de privacidad importante.** Un partido lo registra *un* jugador y menciona a otros. Eso significa que A puede escribir datos que aparecen en el historial de B. Regla: una sesión registrada por A **nunca** se inserta automáticamente en las estadísticas de B. B ve una notificación "te etiquetaron en un partido" y decide si la acepta (`session_participants.confirmed_at`). Sin confirmación, no cuenta. Esto evita que alguien infle o ensucie el historial ajeno.

### Turnos (coordinación)

```sql
match_offers (
  id            uuid PK,
  creator_id    uuid NOT NULL FK profiles,
  venue_id      uuid FK venues,
  venue_freetext text,
  court_label   text,                     -- "Cancha 3", texto libre
  starts_at     timestamptz NOT NULL,     -- UTC
  duration_min  int NOT NULL DEFAULT 90,
  timezone      text NOT NULL,            -- IANA de la sede, para mostrar
  level_min     numeric(2,1) NOT NULL,
  level_max     numeric(2,1) NOT NULL CHECK (level_max >= level_min),
  spots_total   int NOT NULL CHECK (spots_total BETWEEN 1 AND 3),
  visibility    text NOT NULL DEFAULT 'public'
                CHECK (visibility IN ('public','followers','invite_only')),
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','full','confirmed','cancelled','completed')),
  notes         text CHECK (char_length(notes) <= 280),
  created_at, updated_at
)
CREATE INDEX ON match_offers (starts_at) WHERE status IN ('open','full','confirmed');

match_participants (
  id            uuid PK,
  offer_id      uuid NOT NULL FK match_offers ON DELETE CASCADE,
  profile_id    uuid NOT NULL FK profiles,
  state         text NOT NULL DEFAULT 'requested'
                CHECK (state IN ('requested','accepted','declined','withdrawn')),
  requested_at, decided_at,
  UNIQUE (offer_id, profile_id)
)
```

### Recordatorios y push

```sql
push_subscriptions (
  id, profile_id FK, endpoint text UNIQUE, p256dh text, auth text,
  user_agent text, created_at, last_ok_at, failure_count int DEFAULT 0
)

reminders (
  id            uuid PK,
  offer_id      uuid NOT NULL FK match_offers ON DELETE CASCADE,
  profile_id    uuid NOT NULL FK profiles ON DELETE CASCADE,
  fire_at       timestamptz NOT NULL,     -- starts_at - 30 min
  channel       text NOT NULL CHECK (channel IN ('push','email')),
  state         text NOT NULL DEFAULT 'pending'
                CHECK (state IN ('pending','sent','failed','cancelled')),
  attempts      int NOT NULL DEFAULT 0,
  sent_at       timestamptz,
  UNIQUE (offer_id, profile_id, channel)
)
CREATE INDEX ON reminders (fire_at) WHERE state = 'pending';
```

### Trofeos y auditoría

```sql
achievements (code PK, name_key, description_key, icon, criteria jsonb)
profile_achievements (profile_id, achievement_code, unlocked_at, PRIMARY KEY(...))

audit_log (
  id, actor_id, action, entity, entity_id, metadata jsonb, ip_hash, created_at
)
-- ip_hash: SHA-256 de (ip + pepper del servidor). Nunca la IP en claro.

abuse_reports (
  id, reporter_id, target_type, target_id, reason, state, resolved_by, created_at
)
```

---

## 06 · API y rutas

**Principio:** no hay una API REST pública. Las mutaciones van por **Server Actions** y las lecturas por Server Components. Los Route Handlers existen solo donde algo externo tiene que llamarnos.

### Rutas de página (con prefijo de locale: `/es/...`, `/en/...`)

| Ruta | Acceso | Qué |
|---|---|---|
| `/` | público | Landing |
| `/onboarding` | auth | Flujo de 5 pasos |
| `/panel` | auth | Dashboard |
| `/sesiones` | auth | Historial |
| `/sesiones/nueva` | auth | Alta de partido/entrenamiento |
| `/estadisticas` | auth | Gráficos y progresión |
| `/jugadores` | auth | Directorio |
| `/j/[slug]` | público *si* `is_public` | Perfil |
| `/turnos` | auth | Turnos abiertos cerca / de mi nivel |
| `/turnos/[id]` | auth | Detalle y solicitudes |
| `/sedes` | público | Buscador mundial |
| `/sedes/[id]` | público | Ficha de sede |
| `/ajustes` | auth | Cuenta, idioma, privacidad, datos |
| `/moderacion` | moderator+ | Cola de sedes y reportes |

### Server Actions (todas: sesión verificada → Zod → autorización → efecto → auditoría)

```
auth:      completeOnboarding, updateProfile, changeLevel, deleteAccount, exportData
sessions:  createSession, updateSession, deleteSession, confirmTag, rejectTag
social:    followPlayer, unfollowPlayer, blockPlayer, reportAbuse
offers:    createOffer, cancelOffer, requestJoin, acceptRequest, declineRequest,
           withdrawFromOffer, confirmOffer
venues:    submitVenue, searchVenuesNearby, approveVenue*, rejectVenue*   (* = moderator)
push:      savePushSubscription, removePushSubscription
```

### Route Handlers

| Endpoint | Método | Autenticación | Uso |
|---|---|---|---|
| `/api/cron/reminders` | POST | Header `Authorization: Bearer $CRON_SECRET`, comparado con `timingSafeEqual` | Despacha recordatorios vencidos |
| `/api/cron/seed-venues` | POST | idem | Sincroniza sedes desde Overpass |
| `/api/health` | GET | público | Liveness, sin datos internos |

**No existe** ningún endpoint que devuelva una lista de usuarios con su email. Nunca.

---

## 07 · Frontend

```
src/
├── app/
│   └── [locale]/
│       ├── (public)/          # landing, sedes, perfiles públicos
│       ├── (auth)/            # login, callback
│       └── (app)/             # todo lo autenticado, layout con nav
│           └── layout.tsx     # guard de sesión en el layout, no por página
├── components/
│   ├── ui/                    # shadcn, sin lógica de dominio
│   ├── domain/                # LevelBadge, PlayerCard, SessionForm, OfferCard...
│   └── charts/                # progresión, ratio de victorias
├── lib/
│   ├── supabase/              # clientes server / browser / admin (separados)
│   ├── auth/                  # requireUser(), requireRole()
│   ├── levels/                # conversión escala canónica ↔ categoría local
│   ├── geo/                   # búsqueda por distancia, resolución de timezone
│   ├── validation/            # esquemas Zod compartidos
│   └── rate-limit/
├── actions/                   # Server Actions por dominio
├── messages/                  # es.json, en.json, pt.json, it.json, fr.json
└── types/database.ts          # generado del esquema
```

**Navegación (móvil primero):** barra inferior con 5 destinos — Panel · Sesiones · **+ Registrar** (botón central) · Turnos · Perfil. La versión escritorio expande a sidebar. Es la estructura que ya validaron apps del rubro y no hay motivo para inventar otra.

---

## 08 · Autenticación, permisos y protección — **núcleo de seguridad**

### 8.1 Autenticación

- **Supabase Auth** con dos métodos: **magic link por email** y **Google OAuth**.
- **No almacenamos contraseñas.** Sin contraseñas no hay hash débil, ni relleno de credenciales, ni recuperación insegura. Es la superficie de ataque que se elimina gratis.
- Sesión en cookie `httpOnly`, `Secure`, `SameSite=Lax`. Nunca el JWT en `localStorage`.
- Token de acceso 1 h, refresh rotativo. Cierre de sesión revoca del lado servidor.
- Magic link: un solo uso, 15 min de validez, invalidado al usarse.
- Verificación de edad en el onboarding: `birth_date`; menores de 16 → cuenta bloqueada con mensaje claro.

### 8.2 Autorización — RLS como fuente de verdad

Cada tabla arranca así:

```sql
ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <tabla> FORCE ROW LEVEL SECURITY;
-- sin políticas = nadie ve nada. Se abre solo lo necesario.
```

Políticas centrales:

```sql
-- Un perfil se lee si es público, si es propio, o si compartís un turno confirmado.
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  deleted_at IS NULL AND (
    id = auth.uid()
    OR (is_public = true AND NOT EXISTS (
          SELECT 1 FROM blocks
          WHERE blocker_id = profiles.id AND blocked_id = auth.uid()))
  )
);

-- Solo el dueño edita su perfil, y NO puede cambiarse el rol.
CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Las sesiones son privadas del dueño; los etiquetados ven solo las que confirmaron.
CREATE POLICY sessions_select ON sessions FOR SELECT USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM session_participants sp
             WHERE sp.session_id = sessions.id
               AND sp.profile_id = auth.uid()
               AND sp.confirmed_at IS NOT NULL)
);

-- Un turno abierto es visible según su visibilidad.
CREATE POLICY offers_select ON match_offers FOR SELECT USING (
  creator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM match_participants mp
             WHERE mp.offer_id = id AND mp.profile_id = auth.uid())
  OR (visibility = 'public' AND status IN ('open','full'))
  OR (visibility = 'followers' AND EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = auth.uid() AND followee_id = creator_id))
);
```

El rol se guarda **en la fila del perfil**, no en el JWT editable por el cliente. Las políticas de moderador consultan `profiles.role` con una función `SECURITY DEFINER` estable.

### 8.3 Protección de endpoints — el patrón obligatorio

**Toda** Server Action sigue esta secuencia, sin excepción:

```ts
export async function acceptRequest(input: unknown) {
  // 1. Sesión — falla cerrado
  const user = await requireUser();

  // 2. Forma de la entrada — nunca confiar en el cliente
  const data = AcceptRequestSchema.parse(input);

  // 3. Límite de tasa por usuario + acción
  await rateLimit(`accept:${user.id}`, { limit: 30, window: '1h' });

  // 4. Autorización explícita del recurso (además de RLS)
  const offer = await getOfferOwnedBy(data.offerId, user.id);
  if (!offer) throw new ForbiddenError();

  // 5. Reglas de negocio
  if (offer.status !== 'open') throw new ConflictError('offer_not_open');

  // 6. Efecto
  const result = await db.acceptParticipant(data);

  // 7. Auditoría
  await audit(user.id, 'offer.accept', 'match_offers', offer.id);

  return result;
}
```

RLS **y** chequeo en la acción. Es redundante a propósito: la redundancia es la defensa.

### 8.4 Límites de tasa (rate limiting)

| Acción | Límite | Ventana | Por qué |
|---|---|---|---|
| Envío de magic link | 5 | 15 min / email + IP | Evita bombardeo de correo |
| Login OAuth callback | 20 | 10 min / IP | |
| `requestJoin` | 20 | 1 h / usuario | Evita spam a creadores |
| `createOffer` | 10 | 24 h / usuario | Evita saturar el listado |
| `submitVenue` | 5 | 24 h / usuario | La moderación es humana |
| `reportAbuse` | 10 | 24 h / usuario | Evita reportes en masa |
| `searchVenuesNearby` | 60 | 1 min / usuario | Protege PostGIS |
| Escritura genérica | 100 | 1 min / usuario | Red de contención |

Superar el límite devuelve `429` con `Retry-After`. Los límites por IP usan el hash de IP, no la IP.

### 8.5 Datos sensibles

| Dato | Tratamiento |
|---|---|
| Email | Solo en `auth.users` (Supabase). **Nunca** en `profiles`, nunca expuesto a otro usuario, nunca en respuestas de API. |
| Contraseña | No existe. |
| Fecha de nacimiento | Se guarda; **nunca** se expone. La API devuelve solo un booleano `is_adult` si hace falta. |
| Ubicación del usuario | Se usa en memoria para "cerca mío" y **no se persiste**. Solo se guarda `country_code` y ciudad opcional, elegidos por el usuario. Sin rastreo continuo. |
| Avatar | Bucket privado; se sirve por URL firmada de 1 h. Al subir: validar magic bytes (no la extensión), re-codificar con `sharp` (elimina EXIF y GPS), máx. 5 MB, solo jpeg/png/webp. |
| IP | Nunca en claro. `sha256(ip + PEPPER)` solo en `audit_log`. |
| Notas de partido | Texto del usuario; se escapa al renderizar, sin HTML. |
| Token de push | Tratado como credencial: no se expone al cliente ni se loguea. |

**Cifrado.** TLS 1.3 obligatorio en tránsito (HSTS con preload). En reposo, cifrado de disco de Supabase. No se agrega cifrado a nivel de columna en v1 porque no guardamos datos que lo justifiquen — y cifrar mal es peor que no cifrar. Si en el futuro entra un dato de salud o documento, se revisa.

### 8.6 Cabeceras y protección del navegador

```
Content-Security-Policy: default-src 'self';
  script-src 'self' 'nonce-{RANDOM}';        # sin unsafe-inline, sin unsafe-eval
  img-src 'self' data: blob: https://*.supabase.co;
  connect-src 'self' https://*.supabase.co https://plausible.io;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self';
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=()
```

CSRF: cubierto por Server Actions (Next verifica origen) + cookies `SameSite=Lax`.

---

## 09 · Orden de construcción

Cada bloque es entregable y verificable. **No se avanza al siguiente con el anterior sin probar.**

| # | Bloque | Deja funcionando |
|---|---|---|
| **1** | Fundaciones | Next.js + TS estricto + Tailwind + tokens de diseño + i18n (es/en) + CI con typecheck y lint. |
| **2** | Datos y RLS | Migraciones completas del §05, RLS activo en todas las tablas, **tests de políticas** que prueban que el usuario A no lee lo de B. Esto va antes que cualquier pantalla. |
| **3** | Auth y onboarding | Magic link + Google, guard de sesión, verificación de edad, onboarding de 5 pasos, perfil creado. |
| **4** | Perfil y niveles | Escala canónica ↔ categoría local, tarjeta de jugador, edición con bloqueo anti-sandbagging, público/privado. |
| **5** | Sesiones | Alta de partido/entrenamiento/rápido, participantes invitados y registrados, flujo de confirmación de etiqueta, historial. |
| **6** | Estadísticas | Ratio de victorias, racha, forma reciente, progresión de nivel, calendario de días jugados. |
| **7** | Sedes | Job de seed desde Overpass, búsqueda PostGIS por cercanía, ficha, alta por usuario + cola de moderación, atribución ODbL. |
| **8** | Social | Directorio, seguir, bloquear, reportar, cara a cara. |
| **9** | Turnos | Crear turno con banda de nivel, listar por cercanía/nivel, solicitar, aceptar/rechazar, confirmar, cancelar. |
| **10** | Recordatorios | Suscripción push, `reminders` al confirmar, cron cada 5 min, respaldo por email, cancelación en cascada. |
| **11** | PWA | Manifest, service worker, instalable, offline del historial propio, prompt de instalación en iOS. |
| **12** | Trofeos | Motor de logros por criterios, modal de desbloqueo, grilla. |
| **13** | Cumplimiento | Exportar datos (JSON+CSV), borrar cuenta con cascada real, política de privacidad, términos, página de atribuciones. |
| **14** | Endurecimiento | Cabeceras, rate limits, escaneo de dependencias, auditoría de seguridad completa, pruebas de carga básicas. |

El bloque 2 antes que el 3 no es negociable: si las políticas se escriben después de tener pantallas, se escriben para no romper la UI en vez de para proteger los datos.

---

## 10 · Diseño e identidad visual

Referencia estructural: Padelis. **Paleta deliberadamente distinta** — nada de cian sobre azul marino.

### Tokens

```css
:root {
  /* Base — grafito cálido, no azul */
  --bg-base:      #14161A;
  --bg-surface:   #1D2026;
  --bg-elevated:  #262A31;
  --border:       #333842;

  /* Acento primario — volt lime, alto contraste sobre oscuro */
  --accent:       #C8F751;
  --accent-hover: #D9FF7A;
  --accent-ink:   #14161A;   /* texto sobre el acento */

  /* Acento secundario — ámbar quemado (premium, logros) */
  --accent-2:     #FF9F45;

  /* Semánticos */
  --win:          #4ADE80;
  --loss:         #F87171;
  --info:         #7DD3FC;

  /* Texto */
  --text-primary:   #F2F4F7;
  --text-secondary: #9BA3B0;
  --text-muted:     #6B7280;
}
```

**Contraste verificado:** `--accent` sobre `--bg-base` da ~13.8:1; `--text-secondary` sobre `--bg-surface` da ~5.9:1. Ambos superan WCAG AA. El acento se usa **como fondo con texto oscuro** en botones, no como texto fino sobre oscuro.

### Reglas

- **Modo oscuro por defecto.** Modo claro en fase 2, con los tokens ya preparados.
- Tipografía: una sans geométrica para títulos (`Outfit`), sistema para el cuerpo. Autohospedada — sin llamadas a Google Fonts (privacidad + CSP).
- Sin `text-shadow` de resplandor. El acento lime ya destaca; el glow satura y arruina la legibilidad.
- Radios: `12px` en tarjetas, `999px` en píldoras y botones principales.
- El color **nunca** es el único portador de información: victoria/derrota llevan icono y texto, no solo verde/rojo.
- Todo objetivo táctil mínimo 44×44 px.
- Respetar `prefers-reduced-motion` en las animaciones de logro.

---

## 11 · Internacionalización y localización

**Idiomas v1:** español, inglés. **Preparados:** portugués, italiano, francés (la estructura ya los soporta; se agregan cuando haya traducción real).

- Rutas con prefijo de locale (`/es/turnos`). Detección inicial por `Accept-Language`, luego preferencia guardada en el perfil.
- **Todo** texto visible en `messages/*.json`. Cero cadenas literales en componentes. Un test de CI falla si encuentra texto suelto en JSX.
- Fechas, horas y números con `Intl` según locale **y** zona horaria — nunca formato hardcodeado.
- Plurales con ICU MessageFormat (el español y el inglés difieren, el ruso o el polaco mucho más).

### La decisión difícil: los niveles

"8va a 1ra" es el sistema de categorías de Argentina, Uruguay y parte de España. **No es universal.** Escandinavia usa 1–7, Playtomic usa 0–7, Estados Unidos piensa en términos de tenis.

**Solución:** una escala canónica interna `1.0–7.0` con un decimal (compatible de facto con lo que ya usa el mercado), y una capa de presentación por país:

| Canónico | AR / UY (categoría) | ES (categoría) | Genérico (EN) |
|---|---|---|---|
| 1.0–1.9 | 8va | Iniciación | Beginner |
| 2.0–2.9 | 7ma / 6ta | Baja | Improver |
| 3.0–3.9 | 5ta / 4ta | Media | Intermediate |
| 4.0–4.9 | 3ra | Media-Alta | Advanced |
| 5.0–5.9 | 2da | Alta | Expert |
| 6.0–7.0 | 1ra | Competición | Elite |

La comparación, el matchmaking y las estadísticas usan **siempre** el valor canónico. La etiqueta local es cosmética. Esto es lo que hace que un jugador argentino y uno sueco puedan aparecer en el mismo turno abierto sin traducir nada a mano.

**Zonas horarias:** un turno se guarda en UTC y muestra la hora **de la sede**, no la del que mira. Si vivís en Madrid y mirás un turno en Buenos Aires, ves la hora de Buenos Aires con la zona indicada. El recordatorio se calcula sobre el instante UTC — así funciona igual aunque el jugador esté viajando.

---

## 12 · Matchmaking y niveles

Modelo tomado del patrón validado por Playtomic ("open match"), adaptado a que **acá no hay reserva ni pago**.

### Cómo funciona

1. **Crear turno.** El jugador ya tiene (o va a conseguir) la cancha. Publica: sede, cancha (texto libre, opcional), fecha y hora, cuántos lugares faltan (1 a 3), y la **banda de nivel** aceptada.
2. **Banda de nivel automática.** Por defecto: `[mi_nivel − 0.25, mi_nivel + 0.75]`, editable. Es el rango que usa Playtomic y funciona: tolera un poco por abajo y bastante por arriba, porque jugar contra alguien mejor es lo que hace progresar.
3. **Descubrir.** El listado filtra por: dentro de mi banda de nivel, cerca mío (radio configurable), fecha, y a quién sigo. Ordenado por cercanía de nivel primero, distancia después.
4. **Solicitar.** Un jugador fuera de la banda **no puede** solicitar — la regla se aplica en el servidor, no ocultando el botón.
5. **Aceptar.** El creador aprueba o rechaza. Al llenarse los lugares, el turno pasa a `full`.
6. **Confirmar.** El creador confirma que la cancha está efectivamente conseguida → `confirmed`. **Recién ahí** se programan los recordatorios.
7. **Cancelar.** Cualquier participante puede bajarse; si el turno queda incompleto vuelve a `open` y avisa a los demás. Si el creador cancela, se cancela todo y se notifica.

### Por qué el nivel lo elige el jugador

Es tu decisión de producto y es defendible: un algoritmo de ELO con pocos partidos y resultados autoreportados produce números que parecen precisos pero no lo son. Con nivel autodeclarado el número es honesto sobre lo que es: una declaración.

**Pero el autodeclarado se abusa** (bajarse el nivel para ganar fácil — "sandbagging"). Tres contramedidas, sin quitarle el control al jugador:

- **Bloqueo temporal.** Después de cambiar el nivel, `level_locked_until = now() + 14 días`. Evita el ajuste oportunista antes de un turno.
- **Nivel percibido.** Cuando registrás un partido, asignás un nivel a cada rival (como en la referencia). El promedio de lo que **otros** te asignaron se muestra en tu perfil junto a tu autodeclarado. Si declarás 3.0 y ocho personas te vieron 4.5, se nota — sin que el sistema te fuerce.
- **Historial visible.** `level_history` es público en tu perfil. Bajarse el nivel deja rastro.

Ninguna de las tres cambia tu nivel automáticamente. Informan, no imponen.

---

## 13 · Directorio mundial de sedes

**Decisión: OpenStreetMap vía Overpass API como fuente base, más altas de usuarios con moderación.**

Google Places arranca en ~275 USD/mes en 2026 y sube con los detalles de contacto — insostenible para un proyecto sin ingresos, y además su licencia prohíbe almacenar los resultados. OSM es gratis, permite guardar los datos y tiene una cobertura de pádel razonable en Europa y creciente en Latinoamérica.

### Estrategia de datos

1. **Seed offline por país.** Un job consulta Overpass por país (no en vivo, no por request del usuario):
   ```
   [out:json][timeout:180];
   area["ISO3166-1"="AR"]->.a;
   (
     nwr(area.a)["sport"="padel"];
     nwr(area.a)["leisure"="pitch"]["sport"~"padel"];
     nwr(area.a)["sport"~"^padel"];
   );
   out center tags;
   ```
   Normaliza, resuelve la zona horaria del punto, deduplica por `(osm_type, osm_id)` y por proximidad + similitud de nombre, e inserta con `status='approved'`, `source='osm'`.
2. **Re-sincronización mensual** por país. Nunca pisa los campos editados por moderadores.
3. **Altas de usuario.** Si tu club no está, lo cargás: nombre, dirección, punto en el mapa. Entra como `pending`. Un moderador aprueba. **Mientras tanto podés usarlo igual** en tus sesiones vía `venue_freetext` — nunca se bloquea al usuario esperando moderación.
4. **Búsqueda.** PostGIS `ST_DWithin` sobre el índice GIST, con radio configurable. Nunca se llama a Overpass desde una petición de usuario: es una API comunitaria gratuita y saturarla sería abusar de ella.

### Obligación legal — no es opcional

OSM está bajo **ODbL 1.0**. Al usar sus datos:
- Atribución visible: *"Datos de sedes © colaboradores de OpenStreetMap, ODbL"* en `/sedes` y en `/atribuciones`.
- Si publicamos una base derivada, va bajo ODbL.
- Respetar la política de uso de Overpass: pocas consultas, con `User-Agent` identificable y contacto.

**Prohibido:** extraer datos de Playtomic, MATCHi o cualquier plataforma por medios no oficiales. Su API es para clubes y partners certificados vía Playtomic Connect, con acuerdo legal de por medio. Scrapear su API privada viola sus términos y no entra en este proyecto. Si algún día queremos integración real, se pide por el canal oficial.

---

## 14 · Notificaciones y recordatorios

**Único recordatorio en v1: 30 minutos antes del encuentro.** Simple, y resuelve el problema real (que alguien no aparezca).

### Flujo

```
confirmOffer()
  └→ crea reminders (fire_at = starts_at − 30 min) para cada participante aceptado
       ├── canal 'push'  si tiene suscripción activa
       └── canal 'email' siempre (respaldo)

pg_cron cada 5 min → /api/cron/reminders
  ├── SELECT ... WHERE state='pending' AND fire_at <= now() FOR UPDATE SKIP LOCKED
  ├── envía, marca 'sent'
  ├── error 410/404 del push → borra la suscripción muerta
  └── otro error → attempts++, reintenta; a los 3 intentos → 'failed' + email

cancelOffer / withdrawFromOffer
  └→ reminders afectados → state='cancelled'
```

`FOR UPDATE SKIP LOCKED` evita que dos ejecuciones solapadas del cron manden el aviso dos veces.

### Restricciones reales que hay que asumir

- **iOS solo permite Web Push si la PWA está instalada en la pantalla de inicio** (16.4+). Un usuario de iPhone en el navegador **no** va a recibir push. Por eso el email es respaldo obligatorio, no opcional, y por eso el onboarding en iOS explica cómo instalar la app.
- Cron cada 5 min ⇒ el aviso llega entre 30 y 25 minutos antes. Es aceptable y hay que decirlo en la UI ("~30 min antes"), no prometer exactitud al minuto.
- El endpoint del cron se protege con un secreto comparado en **tiempo constante**. Si se filtra, alguien podría disparar avisos en masa.

**Contenido del push:** mínimo. `"Turno en 30 min · Fusión Padel"`. Sin nombres de otros jugadores ni datos personales — la notificación aparece en una pantalla bloqueada que puede ver cualquiera.

---

## 15 · Observabilidad, testing y despliegue

**Testing**
- **Unidad (Vitest):** conversión de niveles, cálculo de estadísticas, cálculo de `fire_at` con zonas horarias, esquemas Zod.
- **Políticas RLS:** suite dedicada que, con dos usuarios reales, verifica que A no lee ni escribe lo de B en cada tabla. Es la suite más importante del proyecto.
- **E2E (Playwright):** onboarding completo, registrar partido, crear turno → solicitar → aceptar → confirmar, exportar y borrar cuenta.
- **Accesibilidad:** `axe` en las pantallas principales dentro de Playwright.

**Observabilidad**
- Sentry con `beforeSend` que elimina email, tokens y cuerpos de petición.
- Logs estructurados sin PII: se loguea `user_id`, nunca email ni IP.
- Alertas: tasa de error > 2 %, recordatorios `failed` > 5 en una hora, cola de moderación > 50.

**Entornos:** `local` (Supabase CLI) → `preview` (rama, datos sintéticos) → `production`. Migraciones versionadas en el repo, aplicadas por CI. **Nunca** se toca el esquema de producción a mano.

**Secretos:** solo en variables de entorno de Vercel/Supabase. `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `VAPID_PRIVATE_KEY` e `IP_PEPPER` jamás con prefijo `NEXT_PUBLIC_`. Gitleaks corre en CI y bloquea el merge.

---

## 16 · Restricciones y reglas no negociables

Esto no se discute durante la construcción. Si un bloque necesita romper una de estas reglas, se para y se consulta.

### Producto
1. **No hay pagos.** Ni suscripción, ni reservas pagas, ni datos de tarjeta. No entra Stripe ni ningún procesador en v1.
2. **No se reservan canchas.** La app registra y coordina; la reserva ocurre afuera. La UI lo dice explícitamente para no generar la expectativa equivocada.
3. **Ningún dato de un jugador se modifica por acción de otro** sin confirmación explícita del afectado.
4. Nada de datos de salud, documentos de identidad ni información financiera. Si aparece el requerimiento, se rediseña la sección 8.5 antes de tocar código.

### Seguridad
5. **RLS activo y forzado en todas las tablas.** Una tabla sin política es una tabla que nadie lee — y así se queda hasta que se escriba la política.
6. **Toda Server Action:** sesión → Zod → rate limit → autorización → efecto → auditoría. Sin saltear pasos.
7. **`service_role` nunca** en código que corra para un usuario. Solo en jobs de servidor.
8. **Cero secretos en el bundle del cliente.** Regla de lint que falla si una variable secreta lleva `NEXT_PUBLIC_`.
9. **Sin `dangerouslySetInnerHTML`** sobre contenido de usuario. Sin excepciones.
10. **CSP sin `unsafe-inline` ni `unsafe-eval`.** Si una librería lo exige, se cambia la librería.
11. **Email nunca sale del sistema de auth.** No aparece en ninguna respuesta que otro usuario pueda ver.
12. **Nada de PII en logs, errores ni notificaciones push.**
13. **Subidas de archivo:** validar magic bytes, re-codificar siempre (mata EXIF y payloads), límite de tamaño, tipos en lista blanca.
14. **Dependencias:** `npm audit` en CI; una vulnerabilidad crítica o alta bloquea el deploy.

### Legal
15. **Atribución ODbL de OpenStreetMap** visible. Es una obligación de licencia, no una cortesía.
16. **Prohibido scrapear** Playtomic, MATCHi o cualquier plataforma. Integración solo por canal oficial y con acuerdo.
17. **GDPR desde el día uno:** exportar mis datos y borrar mi cuenta funcionan de verdad (borrado en cascada real, no un flag), disponibles sin escribir a soporte.
18. **Edad mínima 16 años**, verificada en el registro.
19. Analítica sin cookies (Plausible) — sin banner de consentimiento y sin rastreo entre sitios.

### Técnicas
20. TypeScript en modo estricto. `any` prohibido salvo con comentario que justifique.
21. Toda migración es reversible y está versionada en el repo.
22. Todo instante se guarda en UTC. Toda visualización usa la zona horaria correcta explícitamente.
23. Cero texto visible fuera de `messages/*.json`.
24. Presupuesto de rendimiento móvil: LCP < 2,5 s en 4G, JS inicial < 200 KB comprimido.

---

## Preguntas abiertas para el owner

Estas no bloquean el arranque (los bloques 1 a 6 se pueden construir igual), pero hay que resolverlas antes del bloque 9:

1. **¿Nivel percibido visible o privado?** Mostrar el promedio que otros te asignaron es la mejor defensa contra el sandbagging, pero puede incomodar. Alternativa: visible solo para vos.
2. **Radio por defecto de búsqueda de turnos.** 25 km funciona en una ciudad grande; en zonas con poca densidad de canchas queda vacío. ¿Radio adaptativo?
3. **Países del seed inicial de sedes.** Sugerencia: Argentina, España, México, Italia, Suecia — donde OSM ya tiene buena cobertura de pádel.
4. **Confirmación de participantes.** Hoy el creador confirma el turno. ¿Debería cada participante confirmar su asistencia por separado (y recibir el recordatorio solo quien confirmó)?

---

*Plano generado en fase de diseño para Sideline Padel. Referencia estructural: padelis.app. Investigación de matchmaking: Playtomic Open Matches, MATCHi. Fuente de sedes: OpenStreetMap (ODbL).*
