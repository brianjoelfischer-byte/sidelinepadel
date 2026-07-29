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
- Nivel declarado por el jugador **más nivel percibido por la comunidad**, con peso real sobre el nivel usado para emparejar.
- Directorio de jugadores y perfiles públicos/privados.
- Directorio mundial de sedes de pádel (27 países en el seed inicial).
- Turnos de **exactamente 4 jugadores**, con banda de nivel y **dos ejes separados**: el creador confirma la cancha, cada jugador confirma su asistencia (con estado intermedio *a confirmar*).
- Invitaciones directas: desde el historial de con quién jugaste, por usuario, o por email a alguien que todavía no está en la app.
- **Conexiones automáticas**: haber jugado juntos es la conexión. Sin solicitudes de amistad.
- Aviso a las 24 h para confirmar y recordatorio 30 minutos antes del encuentro.
- Multi-idioma y multi-país desde el día uno.

**Fuera de alcance v1.** App nativa (fase 2), pagos/suscripción, reserva real de cancha, chat en tiempo real, ranking global competitivo, y **torneos** — diseñados en el §17 para no cerrarnos puertas, pero construidos en la v2.

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
| Cron | **pg_cron** en Supabase — **no** Vercel Cron | Dispara los recordatorios. Ver la nota de abajo: no es una preferencia, es una restricción. |
| Rate limiting | **Upstash Redis** (`@upstash/ratelimit`) | Serverless, sin servidor propio que mantener. |
| Errores | **Sentry** con scrubbing de PII | |
| Analítica | **Plausible** (sin cookies) | Evita el banner de cookies y el problema de consentimiento. |
| Deploy | **Vercel** (app) + **Supabase** (datos) | |
| Tests | **Vitest** (unidad) + **Playwright** (e2e) | |
| CI | **GitHub Actions** | typecheck, lint, test, `npm audit`, escaneo de secretos. |

**Restricción de hosting descubierta al montar el bloque 1.** El plan Hobby de
Vercel corre los cron jobs **una vez por día**, y el §14 necesita cada 5 minutos.
Los recordatorios **no pueden** depender de Vercel Cron sin pagar el plan Pro
(20 USD/mes). Por eso el scheduler es `pg_cron` dentro de Supabase, que además es
mejor decisión: el job vive al lado de los datos que consulta, sin salto de red
ni secreto compartido entre dos plataformas.

Segunda restricción del mismo plan: **Hobby prohíbe el uso comercial**. Mientras
la app sea gratis se está en regla; el día que se monetice hay que pasar a Pro.
Está anotado acá para que sea una decisión y no una sorpresa.

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
  -- Niveles: tres valores distintos, ver §12
  declared_level    numeric(2,1) NOT NULL CHECK (declared_level BETWEEN 1.0 AND 7.0),
  perceived_level   numeric(2,1),                  -- calculado de level_ratings, NULL si n=0
  effective_level   numeric(2,1) NOT NULL,         -- mezcla ponderada, la que usa el matchmaking
  rater_count       int NOT NULL DEFAULT 0,        -- votantes DISTINTOS, no votos
  level_locked_until timestamptz,                  -- bloqueo tras cambiar el declarado
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
  id, profile_id FK, field, from_value, to_value, reason, changed_at
  -- field: 'declared' | 'effective'
)

-- Valoraciones de nivel entre jugadores. Base del nivel percibido (§12).
level_ratings (
  id          uuid PK,
  session_id  uuid NOT NULL FK sessions ON DELETE CASCADE,
  rater_id    uuid NOT NULL FK profiles ON DELETE CASCADE,
  subject_id  uuid NOT NULL FK profiles ON DELETE CASCADE,
  value       numeric(2,1) NOT NULL CHECK (value BETWEEN 1.0 AND 7.0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (rater_id <> subject_id),
  UNIQUE (session_id, rater_id, subject_id)   -- una valoración por partido y por par
)
CREATE INDEX ON level_ratings (subject_id, created_at DESC);

-- CONEXIONES: no hay solicitud de amistad. Haber jugado juntos ES la conexión.
-- No es una tabla con estado propio: es un HECHO derivado de las sesiones.
-- Nada que aceptar, nada que rechazar, nada que se pueda desincronizar.
CREATE MATERIALIZED VIEW played_with AS
SELECT
  a.profile_id            AS profile_id,
  b.profile_id            AS other_id,
  count(*)                AS times_played,
  max(s.played_on)        AS last_played_on,
  min(s.played_on)        AS first_played_on
FROM session_participants a
JOIN session_participants b
  ON b.session_id = a.session_id AND b.profile_id <> a.profile_id
JOIN sessions s ON s.id = a.session_id
WHERE a.profile_id IS NOT NULL AND b.profile_id IS NOT NULL
  AND a.confirmed_at IS NOT NULL AND b.confirmed_at IS NOT NULL
GROUP BY a.profile_id, b.profile_id;

CREATE UNIQUE INDEX ON played_with (profile_id, other_id);
CREATE INDEX ON played_with (profile_id, times_played DESC, last_played_on DESC);
-- Refresco CONCURRENTLY tras cada sesión confirmada + job nocturno.

-- follows sigue existiendo, pero para OTRA cosa: interés unilateral en alguien
-- con quien todavía NO jugaste. No requiere aprobación (modelo Twitter, no Facebook).
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
  -- UN TURNO ES SIEMPRE 4 JUGADORES. Ni 3 ni 5. Es pádel.
  --   1 (creador) + spots_open (busca en la app) + guests_count (trae de afuera) = 4
  spots_open    int NOT NULL CHECK (spots_open BETWEEN 1 AND 3),
  guests_count  int NOT NULL DEFAULT 0 CHECK (guests_count BETWEEN 0 AND 2),
  CHECK (1 + spots_open + guests_count = 4),
  visibility    text NOT NULL DEFAULT 'public'
                CHECK (visibility IN ('public','followers','invite_only')),
  -- DOS EJES INDEPENDIENTES. No se mezclan nunca. Ver §12.5.
  --
  -- Eje 1 · LA CANCHA — ¿hay dónde jugar? Solo el creador lo sabe.
  --   'secured' NO significa reservado por la app: significa que el creador
  --   declaró que el CLUB ya le asignó el turno. Regla 2 del §16.
  court_status  text NOT NULL DEFAULT 'pending'
                CHECK (court_status IN ('pending','secured','lost')),
  court_secured_at timestamptz,
  court_lost_reason text,
  --
  -- Eje 2 · EL CUPO — ¿están los jugadores? Se deriva de match_participants.
  roster_status text NOT NULL DEFAULT 'open'
                CHECK (roster_status IN ('open','full','cancelled','completed')),
  --
  notes         text CHECK (char_length(notes) <= 280),
  created_at, updated_at
)
CREATE INDEX ON match_offers (starts_at) WHERE roster_status IN ('open','full');

match_participants (
  id            uuid PK,
  offer_id      uuid NOT NULL FK match_offers ON DELETE CASCADE,
  profile_id    uuid NOT NULL FK profiles,
  state         text NOT NULL DEFAULT 'requested'
                CHECK (state IN ('requested','accepted','declined','withdrawn')),
  -- Confirmación de asistencia, independiente de la aceptación (§12.4)
  --   pending    → todavía no dijo nada
  --   tentative  → "me sumo, pero confirmo en unas horas"
  --   going      → confirmado
  --   not_going  → se bajó
  attendance    text NOT NULL DEFAULT 'pending'
                CHECK (attendance IN ('pending','tentative','going','not_going')),
  attendance_at timestamptz,
  tentative_until timestamptz,     -- se propone al elegir 'tentative'; al vencer
                                   -- vuelve a 'pending' y se le vuelve a preguntar
  requested_at, decided_at,
  origin        text NOT NULL DEFAULT 'request'
                CHECK (origin IN ('request','invitation','creator')),
  UNIQUE (offer_id, profile_id)
)

-- Invitaciones directas a un turno (§12.7). Tres vías: historial, usuario, email.
match_invitations (
  id              uuid PK,
  offer_id        uuid NOT NULL FK match_offers ON DELETE CASCADE,
  inviter_id      uuid NOT NULL FK profiles ON DELETE CASCADE,

  -- Exactamente uno de los dos. El email solo para quien todavía no tiene cuenta.
  invitee_id      uuid FK profiles ON DELETE CASCADE,
  invitee_email   citext,
  CHECK (num_nonnulls(invitee_id, invitee_email) = 1),

  token_hash      bytea NOT NULL UNIQUE,   -- SHA-256 del token. El token en claro
                                           -- vive solo en el email, nunca en la DB.
  state           text NOT NULL DEFAULT 'sent'
                  CHECK (state IN ('sent','accepted','declined','expired','revoked')),
  holds_spot      boolean NOT NULL DEFAULT true,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  responded_at    timestamptz,

  -- Una invitación viva por persona y por turno.
  UNIQUE (offer_id, invitee_id),
  UNIQUE (offer_id, invitee_email)
)
CREATE INDEX ON match_invitations (expires_at) WHERE state = 'sent';

-- Lista de supresión: quien pidió no recibir más, no recibe más. Nunca.
-- Se consulta ANTES de cualquier envío a un email no registrado.
invite_suppressions (
  email_hash  bytea PK,          -- sha256(lower(email) + PEPPER), no el email
  reason      text NOT NULL CHECK (reason IN ('unsubscribed','reported','bounced')),
  created_at  timestamptz NOT NULL DEFAULT now()
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
  kind          text NOT NULL
                CHECK (kind IN ('confirm_request','court_nudge',
                                'tentative_expiry','match_reminder')),
  fire_at       timestamptz NOT NULL,     -- −24 h o −30 min según kind
  channel       text NOT NULL CHECK (channel IN ('push','email')),
  state         text NOT NULL DEFAULT 'pending'
                CHECK (state IN ('pending','sent','failed','cancelled')),
  attempts      int NOT NULL DEFAULT 0,
  sent_at       timestamptz,
  UNIQUE (offer_id, profile_id, kind, channel)
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
| `/turnos/[id]` | auth | Detalle, solicitudes e invitaciones |
| `/turnos/[id]/invitar` | auth (creador) | Historial de compañeros, buscar usuario, invitar por email |
| `/i/[token]` | público | Aceptar invitación; si no tiene cuenta, registro y entra al turno |
| `/invitaciones/baja` | público, sin login | Baja de invitaciones por email (`invite_suppressions`) |
| `/sedes` | público | Buscador mundial |
| `/sedes/[id]` | público | Ficha de sede |
| `/ajustes` | auth | Cuenta, idioma, privacidad, datos |
| `/moderacion` | moderator+ | Cola de sedes y reportes |

### Server Actions (todas: sesión verificada → Zod → autorización → efecto → auditoría)

```
auth:      completeOnboarding, updateProfile, changeLevel, deleteAccount, exportData
sessions:  createSession, updateSession, deleteSession, confirmTag, rejectTag
levels:    rateParticipantLevel, recomputePerceivedLevel*   (* = job, no acción)
social:    followPlayer, unfollowPlayer, blockPlayer, reportAbuse
offers:    createOffer, cancelOffer, requestJoin, acceptRequest, declineRequest,
           withdrawFromOffer
  eje cancha:  setCourtSecured, setCourtLost
  eje cupo:    setAttendance
invites:   listPlayedWith, invitePlayer, inviteByEmail, revokeInvitation,
           acceptInvitation, declineInvitation, unsubscribeInvites (sin login)
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

-- Valorar el nivel de alguien: solo si jugaron juntos ESA sesión, confirmada.
CREATE POLICY level_ratings_insert ON level_ratings FOR INSERT WITH CHECK (
  rater_id = auth.uid()
  AND EXISTS (SELECT 1 FROM session_participants sp
              WHERE sp.session_id = level_ratings.session_id
                AND sp.profile_id = auth.uid()
                AND sp.confirmed_at IS NOT NULL)
  AND EXISTS (SELECT 1 FROM session_participants sp
              WHERE sp.session_id = level_ratings.session_id
                AND sp.profile_id = level_ratings.subject_id)
);

-- El valor individual de cada voto es PRIVADO; solo se publica el agregado.
-- Sin esto, sabés quién te bajó el nivel y eso genera represalias.
CREATE POLICY level_ratings_select ON level_ratings FOR SELECT USING (
  rater_id = auth.uid()
);

-- Un turno abierto es visible según su visibilidad.
CREATE POLICY offers_select ON match_offers FOR SELECT USING (
  creator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM match_participants mp
             WHERE mp.offer_id = id AND mp.profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM match_invitations mi
             WHERE mi.offer_id = id AND mi.invitee_id = auth.uid()
               AND mi.state = 'sent')
  OR (visibility = 'public' AND roster_status IN ('open','full'))
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
| `rateParticipantLevel` | 30 | 24 h / usuario | Limita el brigading masivo |
| `invitePlayer` (in-app) | 50 | 24 h / usuario | Invitar a usuarios existentes es barato |
| **`inviteByEmail`** | **10** | **24 h / usuario** | **Correo saliente a dirección arbitraria: vector de spam** |
| `inviteByEmail` global | 2 000 | 1 h / plataforma | Freno de emergencia con alerta |
| `acceptInvitation` (token) | 10 | 1 h / IP | Impide adivinar tokens por fuerza bruta |
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
| Email de un invitado | Se guarda en `match_invitations.invitee_email` **solo hasta que se resuelve** la invitación; al aceptar, vencer o revocarse se borra (ya existe la cuenta o no hace falta). Nunca visible para nadie salvo quien invitó, que ya lo conocía. |
| Token de invitación | En claro **solo en el correo**. En la base va `sha256(token)`. Un volcado no sirve para aceptar invitaciones ajenas. |

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
| **4** | Perfil y niveles | Escala canónica ↔ categoría local, tarjeta de jugador, los tres niveles (declarado/percibido/efectivo), bloqueo de 14 días, público/privado. |
| **5** | Sesiones y valoraciones | Alta de partido/entrenamiento/rápido, participantes invitados y registrados, confirmación de etiqueta, historial, `level_ratings` y el recálculo del percibido con sus tests. |
| **6** | Estadísticas | Ratio de victorias, racha, forma reciente, progresión de nivel, calendario de días jugados. |
| **7** | Sedes | Job de seed desde Overpass, búsqueda PostGIS por cercanía, ficha, alta por usuario + cola de moderación, atribución ODbL. |
| **8** | Social | Directorio, vista `played_with` con su refresco, seguir, bloquear, reportar, cara a cara. |
| **9** | Turnos · eje cupo | Crear turno de 4 con banda de nivel, listar por cercanía/nivel, solicitar, aceptar/rechazar, los cuatro estados de asistencia con vencimiento del tentativo, bajarse con aviso a los confirmados, cancelar. |
| **9b** | Turnos · eje cancha | `court_status` con sus tres estados, empujón al creador, "se cayó la cancha" sin perder el grupo, priorización de *cancha confirmada + faltan jugadores* en el listado. **Los cinco avisos de "no reservamos" del §12.8 entran acá, no después.** |
| **9c** | Invitaciones | Lista de "jugaste con", invitar por usuario, invitar por email con token hasheado, reserva de cupo con vencimiento, revocar, aceptar/rechazar, baja de invitaciones sin login, `invite_suppressions`. |
| **10** | Recordatorios | Suscripción push, `reminders` de 24 h y 30 min, empujón de cancha, acciones en la notificación, cron cada 5 min, respaldo por email, cancelación en cascada. |
| **11** | PWA | Manifest, service worker, instalable, offline del historial propio, prompt de instalación en iOS. |
| **12** | Trofeos | Motor de logros por criterios, modal de desbloqueo, grilla. |
| **13** | Cumplimiento | Exportar datos (JSON+CSV), borrar cuenta con cascada real, política de privacidad, términos, página de atribuciones. |
| **14** | Endurecimiento | Cabeceras, rate limits, escaneo de dependencias, auditoría de seguridad completa, pruebas de carga básicas. |

El bloque 2 antes que el 3 no es negociable: si las políticas se escriben después de tener pantallas, se escriben para no romper la UI en vez de para proteger los datos.

**Fase 2 (después de que la v1 esté en producción y con usuarios reales):** app nativa y **torneos** (§17), en ese orden de decisión — pero primero mirando qué pide la gente que ya usa la v1.

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

### 12.1 Los tres niveles

El jugador declara su nivel, pero **la comunidad tiene voto**. Son tres valores distintos y los tres se muestran:

| Valor | Qué es | Quién lo controla |
|---|---|---|
| **Declarado** | Lo que vos decís que sos | Vos |
| **Percibido** | Lo que los que jugaron con vos dicen que sos | Los demás |
| **Efectivo** | La mezcla de ambos. **Es el que usa el matchmaking** | El sistema |

Los tres son **públicos** en el perfil. Que se vean juntos es el punto: si declarás 5.0 y el percibido dice 3.8, cualquiera lo nota antes de invitarte.

#### Categoría estimada

El número 1–7 es el que manda: es lo que compara, lo que empareja y lo que se
muestra grande. Pero "4,2" no le dice nada a alguien que toda su vida habló de
cuartas y quintas, así que **al lado** aparece una categoría estimada.

| Nivel | AR · UY · PY · BO · CL | ES |
|---|---|---|
| 1.0–1.9 | 8va | Iniciación |
| 2.0–2.7 | 7ma | Iniciación alta |
| 2.8–3.4 | 6ta | Baja |
| 3.5–4.0 | 5ta | Media-Baja |
| 4.1–4.6 | 4ta | Media |
| 4.7–5.3 | 3ra | Media-Alta |
| 5.4–6.0 | 2da | Alta |
| 6.1–7.0 | 1ra | Competición |

Anclada en fuentes del deporte: 7ma es principiante consolidando golpes básicos
con dificultad en las paredes; 6ta ya tiene regularidad y control moderado de
derecha y revés; quien juega dos o tres veces por semana desde hace más de un
año cae entre 5ta y 4ta.

**Siempre se muestra como aproximación, nunca como categoría oficial.** Las
categorías argentinas salen de resultados en torneos federados —se asciende por
puntos— así que alguien que nunca compitió no tiene categoría, y dos personas
con el mismo nivel real pueden estar en categorías distintas según cuánto
torneo hayan jugado. Se muestra también el rango que cubre ("4ta ≈ 4.1–4.6")
para que la estimación no parezca más precisa de lo que es.

### 12.2 Cómo se calcula el percibido

Cuando registrás un partido, le asignás un nivel a cada rival y compañero. Eso genera una fila en `level_ratings`. El percibido de una persona se calcula así:

**Paso 1 — Una voz por persona.** Se agrupan las valoraciones por votante y se promedia. Que Juan te haya valorado en 10 partidos vale lo mismo que si te valoró en uno. Sin esto, dos amigos jugando seguido dominan tu nivel.

**Paso 2 — Decaimiento por antigüedad.** Cada voz pesa `0.5 ^ (días / 180)`. Una valoración de hace seis meses vale la mitad que una de hoy. La gente mejora; el nivel tiene que poder seguirla.

**Paso 3 — Media recortada.** Con 10 votantes o más, se descarta el 10 % más alto y el 10 % más bajo antes de promediar. Neutraliza tanto al amigo que te infla como al rival dolido que te hunde.

```
perceived_level = media_recortada_ponderada(voces)
```

**Paso 4 — Mezcla con credibilidad.** Con pocos votantes el percibido no es confiable, así que pesa poco. A medida que entran votantes, manda:

```
w = n / (n + 5)                                   -- n = votantes DISTINTOS
effective_level = (1 − w) · declared + w · perceived
```

| Votantes | Peso de la comunidad | Lectura |
|---|---|---|
| 0 | 0 % | Solo tu palabra |
| 3 | 38 % | Empieza a pesar |
| 5 | 50 % | Empate |
| 10 | 67 % | Manda la comunidad |
| 20 | 80 % | Tu declaración es casi anecdótica |

**Paso 5 — Freno de velocidad.** El efectivo se mueve como máximo **0,5 puntos cada 30 días**. Un grupo coordinado no te puede tirar de 4.5 a 2.0 en una semana; necesitaría meses de valoraciones sostenidas, y para entonces la moderación lo ve. El freno cuesta convergencia lenta en casos legítimos, y es un precio que vale la pena.

**Se recalcula** en cada `level_ratings` nuevo y en un job nocturno (por el decaimiento, que corre solo con el tiempo).

### 12.3 Confianza del nivel — lo que aprendimos de los juegos competitivos

Antes de cerrar el diseño se investigó cómo manejan esto Valorant, Rocket
League, CS2 y Fortnite. Hay tres ideas que se repiten y que sirven acá.

**1 · Un número visible y una incertidumbre invisible.** Valorant tiene el RR
que ves y el MMR que no ves. Rocket League usa Glicko-2, que además del rating
guarda una *desviación* (RD): cuánto duda el sistema de ese número. No es un
detalle técnico — es lo que decide cuánto se mueve tu rating después de cada
partido.

**2 · Cuanto menos sabemos, más rápido corregimos.** Una cuenta nueva en
Valorant tiene "MMR de alta incertidumbre" y por eso llega a su nivel real en
20–30 partidas en vez de cientos. Al revés, una cuenta con historial se mueve
poco: ya se sabe dónde está.

**3 · La opinión de alguien incierto vale menos.** En Glicko, un rival cuya
fuerza real no se conoce aporta poca información, así que el resultado contra
él mueve menos el rating.

Y una cuarta, transversal: **reinicio suave, nunca duro**. La incertidumbre
sube con la inactividad, pero lo aprendido no se tira.

#### Qué cambia en Sideline

El freno del §12.2 era **fijo**: 0,5 puntos cada 30 días para todos. Eso trata
igual dos casos opuestos, y en los dos se equivoca:

| | Con freno fijo | Con confianza |
|---|---|---|
| Recién llegado que declaró 3.0 siendo 5.0 | **4 meses** para llegar a su nivel, jugando partidos desparejos todo ese tiempo | Converge en la primera tanda de valoraciones |
| Veterano con 25 votantes | Se lo puede empujar 0,5 por mes | Se mueve 0,3 — cuesta el doble manipularlo |

Se agrega `profiles.level_confidence` (0 a 1):

```
confianza = votantes/(votantes+8)  ×  0.5 ^ (días desde el último partido / 240)
paso máximo = 1.5 − 1.2 × confianza
```

| Confianza | Paso máximo | Situación |
|---|---|---|
| 0.00 | 1.5 | Nadie lo valoró: calibrando |
| 0.43 | 1.0 | Unos 6 votantes |
| 0.71 | 0.65 | Unos 20 votantes |
| 1.00 | 0.3 | Muy establecido |

Nunca llega a 1 exactamente — como la RD de Glicko, siempre queda margen a
seguir aprendiendo.

**El peso de cada votante también escala con SU confianza**, con piso 0,4:
jugó el partido y vio algo, pero si su propio nivel es incierto su opinión
pesa menos. Efecto lateral valioso: una red de cuentas nuevas coordinadas
tiene confianza baja entre todas, así que su peso combinado es chico **sin que
haga falta detectarlas como fraude**.

**La inactividad devuelve incertidumbre.** Alguien que jugó 50 partidos y paró
dos años vuelve a ser incierto — que es la verdad, porque el nivel cambia
cuando dejás de jugar. No se le borra nada: se admite que ya no sabemos.

#### Lo que NO tomamos

- **Nada de ELO ni resultados automáticos.** El insumo sigue siendo la
  valoración humana. Ganar o perder no mueve tu nivel: en pádel amateur el
  resultado depende tanto del compañero que sería ruido.
- **Nada de temporadas ni reinicios periódicos.** En un juego existen para
  vender la próxima temporada. Acá solo confundirían.
- **Nada de rangos con nombre** (Oro, Platino). La escala 1.0–7.0 ya es la del
  deporte; inventar otra encima sería una capa de traducción de más.

### 12.4 Reglas anti-abuso de las valoraciones

1. **Solo valora quien jugó con vos.** `rater_id` tiene que estar en `session_participants` de esa misma sesión, con `confirmed_at` no nulo. Sin partido confirmado no hay voto.
2. **Un voto por partido y por par.** Lo garantiza `UNIQUE (session_id, rater_id, subject_id)`.
3. **El votante necesita historia.** Una cuenta con menos de 3 sesiones confirmadas **no** suma al percibido de nadie. Su voto se guarda y entra retroactivamente cuando llegue a 3. Sin esto, se crean cuentas descartables para hundir a alguien.
4. **Detección de coordinación.** Si el grueso de las valoraciones bajas de una persona viene de un grupo que juega casi siempre entre sí, se marca para moderación y esos votos se ponderan a la baja. Es un `abuse_reports` automático, no un bloqueo silencioso.
5. **Tu declarado no se toca nunca.** El sistema jamás reescribe lo que vos dijiste. Solo calcula el efectivo, que es otra cosa.
6. **El historial es público.** `level_history` en tu perfil. Bajarse el declarado deja rastro visible.
7. **Bloqueo de cambio.** Tras editar el declarado, `level_locked_until = now() + 14 días`. Evita el ajuste oportunista justo antes de un turno.

8. **Límite de desvío: ±2,5 puntos.** Una valoración no puede alejarse más de eso del nivel efectivo que la persona tiene hoy. Si alguien está en 4.0, el rango válido va de 1.5 a 6.5 — poner 1.0 o 7.0 "de chiste" se rechaza en la base, no se promedia.

   Los otros frenos actúan **después** de recibir el voto; este actúa **antes**. La media recortada descarta extremos, pero recién con 10 votantes o más: con pocos, un amigo poniendo 1.0 sí movía el número.

   Es una **ventana móvil, no un techo**: a medida que el efectivo se corrige, la ventana se corre con él. Una categoría mal declarada igual converge —despacio, como pide la regla del §16— pero nadie la hunde de un golpe. El nivel de referencia queda guardado en cada valoración (`subject_level_at_rating`) para poder auditar después si un voto era razonable en su contexto.

### 12.5 Los dos ejes del turno — están separados a propósito

Un turno tiene **dos preguntas independientes**, y meterlas en un solo campo `status` es el error de modelado que hay que evitar:

| | **Eje CANCHA** | **Eje CUPO** |
|---|---|---|
| Pregunta | ¿Hay dónde jugar? | ¿Están los jugadores? |
| Quién lo sabe | Solo el creador | Cada jugador, sobre sí mismo |
| Dónde vive | `match_offers.court_status` | `match_participants.attendance` |
| Valores | `pending` · `secured` · `lost` | `pending` · `tentative` · `going` · `not_going` |
| Se responde | Una vez, por el creador | Una vez por cada participante |

**Un turno es siempre 4 jugadores.** Ni 3 ni 5 — es pádel. La base lo obliga: `1 (creador) + spots_open + guests_count = 4`. Si el creador viene con un amigo que no usa la app, marca `guests_count = 1` y busca 2. No hay forma de publicar un turno de 3 ni de 6, ni por error ni a propósito.

#### Los cuatro estados de asistencia

| Estado | Qué significa | Cuenta para el cupo | Recordatorio 30 min |
|---|---|---|---|
| `pending` | Todavía no dijo nada | Sí, reserva el lugar | No |
| `tentative` | *"Me sumo, pero confirmo en unas horas"* | Sí, reserva el lugar | No |
| `going` | Confirmado | Sí | **Sí** |
| `not_going` | Se bajó | No, libera el lugar | No |

`tentative` es el estado honesto que falta en casi todas estas apps. La alternativa es que la gente ponga "voy" sin estar segura —porque no hay otra opción— y el "voy" pierde todo significado. Con un tentativo explícito, un `going` vale.

Al elegir `tentative` el jugador propone **hasta cuándo** (`tentative_until`, por defecto 6 h, tope: `starts_at − 3 h`). Al vencer vuelve a `pending` y se le pregunta de nuevo. Un tentativo no puede quedar colgado indefinidamente reteniendo un lugar.

**El creador ve la diferencia.** El detalle del turno muestra `2 confirmados · 1 a confirmar · falta 1`, no un "3 de 4" que esconde el riesgo. Y mientras haya algún `tentative` o `pending`, el turno **no** figura como "todo listo" aunque el cupo esté completo.

#### Cuando alguien se baja

`not_going` o `withdrawFromOffer` dispara, en este orden:

1. Libera el lugar → `roster_status` vuelve a `open`.
2. **Notifica primero a quien ya está en `going`.** Ellos reorganizaron su día por este turno; son los que más pierden si no se llena. El aviso dice quién se bajó y cuántos faltan.
3. Notifica al resto (`pending`, `tentative`) y al creador.
4. Cancela los recordatorios de quien se fue.
5. Si el turno vuelve a ser visible, reaparece en el listado con la etiqueta **"Se liberó un lugar"** — se llena mucho más rápido que uno nuevo, porque ya tiene gente confirmada y muchas veces cancha.

A menos de 3 h del turno, bajarse **exige un motivo** (una línea, opcional pero pedida) y avisa que a esa altura es difícil reemplazarlo. No lo bloquea: bajarse tarde es mejor que no aparecer.

**Son ortogonales.** Las cuatro combinaciones existen y todas son estados reales:

| Cancha | Cupo | Situación | Qué muestra la app |
|---|---|---|---|
| `pending` | incompleto | Recién publicado | *"Buscando jugadores · cancha sin confirmar"* |
| `pending` | completo | Están los cuatro, falta la cancha | *"Completo · falta confirmar la cancha"* → empuja al creador |
| `secured` | incompleto | Hay cancha, faltan jugadores | *"Cancha confirmada · faltan 2"* → **prioridad alta en el listado** |
| `secured` | completo, con algún `tentative` | Falta que confirmen | *"Cancha lista · 1 a confirmar"* |
| `secured` | completo + los 4 en `going` | **Listo para jugar** | *"Todo listo"* |

Ese tercer caso es el que más importa y el que un `status` único te esconde: **hay cancha pagada y faltan jugadores**. Es urgente y hay que empujarlo arriba del listado. Con un solo campo de estado, ese turno se ve igual que uno sin cancha.

**"Listo para jugar" no se guarda, se deriva:** `court_status = 'secured'` **y** cupo completo **y** los 4 en `going`. Guardarlo como un estado más obligaría a mantenerlo sincronizado desde cinco lugares distintos, y ahí es donde aparecen los bugs.

### 12.6 Flujo del turno

**Publicar**
1. **Crear.** Sede, cancha (texto libre, opcional), fecha y hora, cuántos lugares faltan (1–3), y la **banda de nivel**. El creador entra como participante con `attendance = 'going'` y `origin = 'creator'`.
   - **Primer aviso de que no se reserva nada** (§12.8).
2. **Banda automática.** Por defecto `[efectivo − 0.25, efectivo + 0.75]`, editable. Es el rango de Playtomic y funciona: tolera poco por abajo, bastante por arriba — jugar contra alguien mejor es lo que hace progresar.

**Llenar el cupo** — dos vías que conviven
3. **Abierto.** Otros lo descubren filtrando por banda de nivel (contra el **efectivo**), cercanía, fecha y a quién siguen. Solicitan; el creador acepta o rechaza. Quien está fuera de la banda no puede solicitar — validado en el servidor, no escondiendo el botón.
4. **Invitado.** El creador invita directo desde el historial, por usuario o por email (§12.7).

**Eje cancha** *(en cualquier momento, independiente del cupo)*
5. **Confirmar la cancha.** El creador declara que **el club ya le asignó el turno** → `court_status = 'secured'`.
   - **Segundo aviso acá, más fuerte** (§12.8).
6. **Perder la cancha.** El club se la dio de baja → `court_status = 'lost'` + motivo. Avisa a todos. **El cupo no se toca**: los jugadores siguen ahí y el creador puede conseguir otra cancha sin rearmar el grupo. Esto solo funciona porque los ejes están separados.

**Eje cupo** *(en cualquier momento, independiente de la cancha)*
7. **Confirmar asistencia.** Cada participante responde si va → `going` / `not_going`. Aviso a las 24 h para quien no respondió.
8. **Bajarse.** Libera el lugar, el turno vuelve a `open`, se avisa al resto. La cancha sigue confirmada.

**Cancelar todo.** Solo el creador. `roster_status = 'cancelled'`, se cancelan los recordatorios y se notifica.

**Por qué dos confirmaciones y no una.** Son hechos distintos que conoce gente distinta: solo el creador sabe si el club le dio la cancha, y solo cada jugador sabe si va a ir. Si confirma solo el creador, tenés cancha y tres personas que dijeron que sí hace una semana. Si confirman solo los jugadores, se organizan para un turno que no existe. **El modo de falla real del pádel amateur no es la cancha: es el que no aparece.**

El paso extra se paga barato: el creador queda auto-confirmado al crear, y el resto responde **con un toque desde la notificación**, sin abrir la app.

### 12.7 Invitaciones

Tres vías, en orden de uso esperado:

**1. Desde el historial** *(la principal)*
La app ya sabe con quién jugaste. Ofrece la lista ordenada por frecuencia y recencia — *"Sergio Castro · 8 partidos · el último hace 2 semanas"* — filtrando por quién entra en la banda de nivel. Un toque y queda invitado. Para el 90 % de los turnos amateur, los compañeros son los de siempre; que la app te los ponga adelante es la diferencia entre usarla y volver a WhatsApp.

> **No hay solicitud de amistad.** Haber jugado juntos *es* la conexión: la vista `played_with` se deriva de las sesiones confirmadas, sin nada que aceptar ni rechazar. Un flujo de solicitud acá no aporta nada — ya compartieron una cancha, el vínculo es un hecho, no un pedido. Y al ser derivado no hay estado que mantener ni que se pueda desincronizar.
>
> Los dos controles que sí importan siguen existiendo: **`blocks`**, que corta la conexión en los dos sentidos y saca a la persona de tus listas, y **`is_public`**, que decide si tu perfil se ve. Una conexión automática nunca expone más de lo que el perfil ya mostraba.

**2. Por usuario**
Buscador sobre el directorio, por `display_name` o `slug`. Solo aparecen perfiles con `is_public = true`, y nunca se busca por email — eso permitiría averiguar si una dirección tiene cuenta.

**3. Por email** *(para quien todavía no está en la app)*
Se manda un link con token. Al aceptar, la persona se registra y cae directo en el turno. Es la vía de crecimiento natural: el compañero nuevo entra invitado, no buscando la app.

**Reglas comunes**

- **La invitación reserva el lugar** mientras está `sent`, hasta `expires_at` = mín(48 h, `starts_at` − 2 h). Vencida, libera el cupo automáticamente. Sin esto invitás a tres y te llenan el turno dos desconocidos mientras esperás respuesta.
- **Invitar no es agregar.** El invitado acepta y recién ahí entra como participante. Nadie queda metido en un turno sin decir que sí.
- **La invitación directa saltea la banda de nivel**, con una advertencia visible al creador (*"Está fuera de tu rango"*) y el nivel del invitado a la vista. Si conocés a la persona, sabés lo que hacés; el filtro está para desconocidos, no para tu compañero de siempre.
- **Un invitado bloqueado no recibe nada.** `blocks` se consulta antes de crear la invitación, en los dos sentidos.
- **Se puede revocar** mientras esté `sent`.

**Seguridad de la invitación por email** — es la única función de la app que dispara un correo hacia una dirección arbitraria elegida por un usuario. Eso es un vector de spam y de acoso, y necesita cinco defensas:

| Riesgo | Defensa |
|---|---|
| Spam masivo | **10 invitaciones por email/día por usuario** (las de historial y usuario tienen su propio límite, más alto). Además, tope global por hora en toda la plataforma con alerta. |
| Acoso dirigido | `invite_suppressions`. Todo email lleva **"No quiero recibir más invitaciones"** en un clic, sin login. Suprimido = nunca más, de nadie. |
| Enumeración de cuentas | La respuesta al creador es **siempre la misma** — *"Invitación enviada"* — exista o no la cuenta. Si el email ya tiene cuenta, se convierte en invitación in-app y **no** se manda correo. |
| Robo de token | Token de 32 bytes de `crypto.randomBytes`, **guardado hasheado** (SHA-256), un solo uso, vencimiento corto. Un volcado de la base no permite aceptar invitaciones ajenas. |
| Fuga de datos antes de aceptar | El email dice solo: quién invita (nombre público), qué deporte, día y sede. **No** lleva los otros participantes, ni sus niveles, ni ningún email. |

El contenido del correo es de la plataforma, no del usuario: el creador **no puede escribir un mensaje libre**. Un campo de texto libre en un email saliente es un canal de abuso servido en bandeja.

### 12.8 Aviso obligatorio: la app no reserva canchas

Es el malentendido más caro posible: alguien cree que Sideline le reservó la cancha, se presenta y no hay nada. Aparece en **cuatro** lugares, y no es un `<small>` gris:

| Dónde | Texto | Formato |
|---|---|---|
| Al crear el turno | *"Sideline no reserva canchas. Reservá vos en el club y publicá el turno cuando lo tengas."* | Recuadro con borde ámbar, arriba del formulario |
| En la tarjeta del turno, si `court_status ≠ 'secured'` | *"Cancha sin confirmar"* | Píldora ámbar |
| Al confirmar la cancha | *"¿Ya tenés el turno asignado por el club? Confirmá solo si el club te lo dio. Sideline no reservó nada."* | Diálogo con confirmación explícita — el botón dice **"Sí, ya tengo la cancha"**, no "Aceptar" |
| En el detalle con `court_status = 'secured'` | *"Cancha confirmada por [nombre]. La reserva la gestiona el club, no Sideline."* | Línea permanente al pie |
| En el email de invitación | *"Sideline no reserva canchas. Coordina el turno quien te invitó."* | Al pie, siempre |

También en el onboarding, en la pantalla que explica los turnos. Y en Términos.

`court_status = 'secured'` **nunca** se muestra como "reservado". Ni en la UI, ni en los textos, ni en las notificaciones. Es una regla de vocabulario del producto: la palabra "reserva" solo se usa para decir que la app **no** la hace. Por eso el valor se llama `secured` y no `booked` — el nombre del campo también educa a quien escribe el código.

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

   **Países del seed inicial** (`country_code` ISO 3166-1, en orden de ejecución):

   | Grupo | Países |
   |---|---|
   | Cono Sur | AR · CL · UY · PY · BO |
   | Brasil | BR |
   | Andina / Caribe | PE · EC · CO · VE |
   | Centroamérica y México | MX · CR · PA · GT · SV · HN · NI · DO · CU · PR |
   | Norteamérica | US |
   | Europa (referencia del deporte) | ES · IT · PT · FR · SE |
   | África | ZA |

   Son 27 países. Brasil, Estados Unidos y México se procesan **por estado/provincia**, no de una sola consulta: un `nwr` sobre todo Brasil hace expirar el timeout de Overpass. El job trocea por área administrativa y encola cada trozo por separado, con reintento.

   La cobertura de OSM es despareja: muy buena en España, Italia y Suecia; buena en Argentina y México; **floja en Centroamérica y Sudáfrica**. Ahí el alta por usuario no es un complemento, es la fuente principal — y hay que asumirlo en el diseño de esa pantalla, no tratarla como un caso raro.
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

Dos avisos, con propósitos distintos:

| Aviso | Cuándo | Para quién | Para qué | Eje |
|---|---|---|---|---|
| **Pedido de confirmación** | 24 h antes | Quien tiene `attendance = 'pending'` | Que diga si va, mientras hay tiempo de reemplazarlo | cupo |
| **Empujón de cancha** | 24 h antes | El creador, si `court_status = 'pending'` | Que consiga la cancha o avise | cancha |
| **Vencimiento de tentativo** | Cuando expira `tentative_until` | Quien está en `tentative` | Que defina, o que libere el lugar | cupo |
| **Se liberó un lugar** | Al instante | Los `going` primero, después el resto | Que sepan que el turno está en riesgo | cupo |
| **Recordatorio** | 30 min antes | Quien tiene `attendance = 'going'` | Que no se olvide | cupo |

El de 24 h es el que salva el turno: si alguien se baja con un día de anticipación, el lugar vuelve a `open` y todavía se llena. Enterarse a los 30 minutos ya no sirve de nada.

### Flujo

Los recordatorios cuelgan del **eje cupo**, no del eje cancha. Un turno sin cancha confirmada igual manda avisos: la gente tiene que saber que se comprometió, y el creador tiene que sentir la presión de conseguir la cancha.

```
acceptRequest() | acceptInvitation()     -- entra un participante
  └→ reminder 'confirm_request'  (fire_at = starts_at − 24 h)
     reminder 'court_nudge'      (fire_at = starts_at − 24 h)  → SOLO al creador,
        y solo si court_status = 'pending'. Se cancela al pasar a 'secured'.

createOffer()
  └→ el creador queda attendance='going' → su 'match_reminder' directo

setAttendance(going)
  └→ programa su 'match_reminder'  (fire_at = starts_at − 30 min)
     cancela su 'confirm_request' pendiente

setAttendance(tentative, hasta_cuando)
  └→ NO programa 'match_reminder' (todavía no confirmó)
     programa 'tentative_expiry' (fire_at = tentative_until)
        al vencer → vuelve a 'pending' + se le vuelve a preguntar

setAttendance(not_going)  |  withdrawFromOffer()
  └→ cancela sus reminders
     libera el lugar → roster_status vuelve a 'open'
     notifica PRIMERO a los 'going', después al resto y al creador

setCourtLost()
  └→ NO cancela nada del eje cupo. Solo notifica:
     "Se cayó la cancha. [nombre] está buscando otra."

pg_cron cada 5 min → /api/cron/reminders
  ├── SELECT ... WHERE state='pending' AND fire_at <= now() FOR UPDATE SKIP LOCKED
  ├── envía, marca 'sent'
  ├── error 410/404 del push → borra la suscripción muerta
  └── otro error → attempts++, reintenta; a los 3 intentos → 'failed' + email

cancelOffer()
  └→ todos los reminders del turno → state='cancelled'
```

`FOR UPDATE SKIP LOCKED` evita el envío duplicado si dos ejecuciones del cron se solapan.

La acción de confirmar viaja **en la notificación push** (`actions: [{action:'going'}, {action:'not_going'}]`). Un toque, sin abrir la app. En los clientes que no soportan acciones, el tap abre directo el detalle del turno con los dos botones arriba.

### Restricciones reales que hay que asumir

- **iOS solo permite Web Push si la PWA está instalada en la pantalla de inicio** (16.4+). Un usuario de iPhone en el navegador **no** va a recibir push. Por eso el email es respaldo obligatorio, no opcional, y por eso el onboarding en iOS explica cómo instalar la app.
- Cron cada 5 min ⇒ el aviso llega entre 30 y 25 minutos antes. Es aceptable y hay que decirlo en la UI ("~30 min antes"), no prometer exactitud al minuto.
- El endpoint del cron se protege con un secreto comparado en **tiempo constante**. Si se filtra, alguien podría disparar avisos en masa.

**Contenido del push:** mínimo. `"Turno en 30 min · Fusión Padel"`. Sin nombres de otros jugadores ni datos personales — la notificación aparece en una pantalla bloqueada que puede ver cualquiera. Y **nunca** la palabra "reserva": es `"Turno en 30 min"`, no `"Tu reserva es en 30 min"` (§12.8).

---

## 15 · Observabilidad, testing y despliegue

**Testing**
- **Unidad (Vitest):** conversión de niveles, cálculo de estadísticas, cálculo de `fire_at` con zonas horarias, esquemas Zod.
- **Motor de niveles (Vitest, suite propia):** el cálculo del percibido y el efectivo necesita casos adversarios explícitos — un votante con 20 valoraciones no pesa más que uno con una; 10 cuentas nuevas coordinadas no mueven el efectivo; el decaimiento por antigüedad se aplica; el freno de 0,5/30 días se respeta; con 0 votantes el efectivo es igual al declarado. Cada regla del §12.2 y §12.4 es un test.
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
2. **No se reservan canchas.** La app registra y coordina; la reserva ocurre afuera. El aviso del §12.8 va en los cinco lugares indicados. **La palabra "reserva" solo se usa para negar que la app la haga** — nunca para describir `court_status = 'secured'`, ni en UI, ni en emails, ni en push.
3. **Cancha y cupo son ejes separados.** Nunca se colapsan en un solo campo de estado, ni siquiera "para simplificar la query". Perder la cancha no disuelve el grupo; que falte un jugador no invalida la cancha. Si aparece un `status` único en un PR, se rechaza.
4. **Invitar no es agregar.** Nadie entra a un turno sin aceptar. No hay "agregar directo" ni para el creador ni para un admin.
5. **Un turno es exactamente 4 jugadores.** Garantizado por CHECK en la base, no por validación de formulario. Ni 3 ni 5, ni siquiera "temporalmente".
6. **No hay solicitudes de amistad.** La conexión se deriva de haber jugado juntos. Si alguien propone agregar aceptar/rechazar, la respuesta es no: agrega estado, fricción y una cola de pendientes, y no protege nada que `blocks` e `is_public` no protejan ya.
7. **Un partido de torneo genera sesiones normales** (§17.4). Nunca un historial paralelo.
8. **El correo de invitación no lleva texto libre del usuario.** El cuerpo lo controla la plataforma. Un campo abierto en un email saliente es un canal de acoso.
9. **`invite_suppressions` se consulta antes de cada envío.** Sin excepción, sin "pero es una invitación de un amigo". Quien pidió no recibir más, no recibe más.
10. **Nunca se revela si un email tiene cuenta.** La respuesta a `inviteByEmail` es idéntica en ambos casos.
11. **Ningún dato de un jugador se modifica por acción de otro** sin confirmación explícita del afectado. Excepción única y explícita: el **nivel efectivo**, que por diseño incorpora valoraciones de terceros (§12). El **declarado** sigue siendo intocable.
12. **Las valoraciones de nivel individuales son privadas.** Se publica el agregado, nunca quién puso qué. Si esto se rompe, aparecen las represalias y el sistema deja de ser honesto.
13. **Ninguna valoración se aparta más de ±2,5 del nivel efectivo actual.** Lo aplica un trigger en la base, no la validación del formulario.
14. **Nada de estado de la app en `localStorage` ni `sessionStorage`.** Son por dispositivo: entrás desde el celular y ves datos viejos del que quedó en la notebook, sin forma de saber cuál es el bueno. La sesión va en **cookies** —que el servidor lee y valida en cada request— y todo lo demás sale de Supabase. Lo hace cumplir una regla de ESLint.
15. **Solo valora quien jugó.** Sesión confirmada por ambos, y el votante con 3 sesiones confirmadas mínimo. Sin excepciones por conveniencia de producto.
16. **El efectivo no se mueve más de 0,5 puntos en 30 días.** Es el freno contra el brigading. Si alguien propone sacarlo "para que converja más rápido", la respuesta es no.
17. Nada de datos de salud, documentos de identidad ni información financiera. Si aparece el requerimiento, se rediseña la sección 8.5 antes de tocar código.

### Seguridad
18. **RLS activo y forzado en todas las tablas.** Una tabla sin política es una tabla que nadie lee — y así se queda hasta que se escriba la política.
19. **Toda Server Action:** sesión → Zod → rate limit → autorización → efecto → auditoría. Sin saltear pasos.
20. **`service_role` nunca** en código que corra para un usuario. Solo en jobs de servidor.
21. **Cero secretos en el bundle del cliente.** Regla de lint que falla si una variable secreta lleva `NEXT_PUBLIC_`.
22. **Sin `dangerouslySetInnerHTML`** sobre contenido de usuario. Sin excepciones.
23. **CSP sin `unsafe-inline` ni `unsafe-eval`.** Si una librería lo exige, se cambia la librería.
24. **Email nunca sale del sistema de auth.** No aparece en ninguna respuesta que otro usuario pueda ver.
25. **Nada de PII en logs, errores ni notificaciones push.**
26. **Subidas de archivo:** validar magic bytes, re-codificar siempre (mata EXIF y payloads), límite de tamaño, tipos en lista blanca.
27. **Dependencias:** `npm audit` en CI; una vulnerabilidad crítica o alta bloquea el deploy.

### Legal
28. **Atribución ODbL de OpenStreetMap** visible. Es una obligación de licencia, no una cortesía.
29. **Prohibido scrapear** Playtomic, MATCHi o cualquier plataforma. Integración solo por canal oficial y con acuerdo.
30. **GDPR desde el día uno:** exportar mis datos y borrar mi cuenta funcionan de verdad (borrado en cascada real, no un flag), disponibles sin escribir a soporte.
31. **Edad mínima 16 años**, verificada en el registro.
32. Analítica sin cookies (Plausible) — sin banner de consentimiento y sin rastreo entre sitios.

### Técnicas
33. TypeScript en modo estricto. `any` prohibido salvo con comentario que justifique.
34. Toda migración es reversible y está versionada en el repo.
35. Todo instante se guarda en UTC. Toda visualización usa la zona horaria correcta explícitamente.
36. Cero texto visible fuera de `messages/*.json`.
37. Presupuesto de rendimiento móvil: LCP < 2,5 s en 4G, JS inicial < 200 KB comprimido.

---

## 17 · Torneos — **fase 2, diseñado ahora**

> **Recomendación de alcance, y es importante.** Los torneos son un dominio nuevo completo: emparejamientos, rondas, tablas de posiciones, programación por cancha y estados que no se parecen a nada del §12. Es aproximadamente **el doble de superficie** que todo el eje de turnos. Metido en la v1, el MVP no sale.
>
> Va acá porque **diseñarlo ahora es gratis y no diseñarlo es caro**: si el modelo de sesiones y niveles no lo contempla, en seis meses hay que migrar el historial de todos. Con esto escrito, la v1 se construye sin cerrarse puertas.
>
> **Sugerencia de fases:**
> - **v2.0** — Americano y triangular. Los dos más simples y los que más se juegan.
> - **v2.1** — Mexicano y `groups_knockout` con los presets Super 8 / Super 12.
> - **v2.2** — Eliminación directa pura y King of the Court.
>
> Es tu decisión — si querés torneos en la v1, se hace, pero mové la fecha de salida en consecuencia.

### 17.1 Formatos

Dos familias, y la diferencia es estructural:

- **Individuales con rotación** — te anotás solo, la app arma las parejas cada ronda. Puntaje individual acumulado.
- **Por equipos** — venís con compañero, la pareja es fija todo el torneo.

#### Familia 1 · Individuales con rotación

| Formato | Jugadores | Cómo empareja | Para qué sirve |
|---|---|---|---|
| **Americano** | 4, 8, 12, 16… (múltiplos de 4) | Rotación **fija**: jugás con cada uno exactamente una vez | Grupo parejo, ambiente social |
| **Mexicano** | Igual | Rotación **dinámica**: cada ronda se arma según la tabla — 1º+4º vs 2º+3º | **Niveles mezclados** |
| **King of the Court** | 8+ (flexible) | El que gana se queda en la cancha, el que pierde rota | Entrada y salida libre |

**Americano** es el formato del pádel amateur. Partidos a puntos fijos (16, 24 o 32, no a sets), puntaje **individual acumulado** — cambiás de compañero pero tu total sigue creciendo. Con 8 jugadores a 24 puntos son unos 90 minutos. Termina cuando todos jugaron con todos.

**Mexicano merece atención especial: resuelve el mismo problema que tu app.** En vez de una rotación predefinida, cada ronda se genera desde la tabla de posiciones del momento, cruzando 1º+4º contra 2º+3º. Eso mantiene los equipos parejos ronda a ronda. Si el grupo tiene niveles mezclados —que es exactamente el caso cuando juntás gente por la app y no un grupo de amigos— **Mexicano da mejores partidos que Americano**. Y ya tenés la infraestructura: es el mismo criterio de nivel del §12, aplicado dentro del torneo.

**King of the Court** son carreras cortas a 4–7 puntos con rotación de perdedores. Encaja para un evento de tarde donde la gente entra y sale, no para un torneo con resultado formal. Lo dejaría para v2.2.

#### Familia 2 · Por equipos

| Formato | Equipos | Cómo funciona |
|---|---|---|
| **Triangular** | 3 | Todos contra todos, 3 partidos |
| **Liga (round robin)** | 3–8 | Todos contra todos |
| **Eliminación directa** | 4, 8, 16 (*byes* si no) | Cuadro; el que pierde se va |
| **Grupos + eliminación** | 8–32 | Fase de grupos y después cuadro |

La eliminación directa pura es la que peor encaja con un amateur: la mitad de la gente juega un partido y se vuelve a casa.

#### Sobre el "Super 8" y el "Super 12" — lo que encontré

**No son un formato estandarizado.** Busqué y no existe un reglamento único: el nombre se usa distinto según el club y hasta según el país. Encontré al menos tres usos en circulación:

1. **8 parejas, fase de grupos + final** — la lectura más común en Argentina y España.
2. **Grupos + cuadro a gran escala** — por ejemplo 32 parejas en 8 grupos de 4, los dos mejores de cada grupo a cuadros de eliminación desde cuartos, todo a un set.
3. **Marca de un circuito o evento puntual**, con reglas propias del organizador.

**Por eso no lo hardcodeo, y creo que es la decisión correcta.** Si escribo un formato `super_8` con reglas fijas, el primer club que lo use distinto se encuentra con una app que no le sirve — y va a tener razón.

En su lugar, `groups_knockout` es **paramétrico**: cantidad de participantes, cuántos grupos, cuántos avanzan por grupo, desde qué ronda arranca el cuadro, y si se juega a puntos o a sets. **"Super 8" y "Super 12" son *presets* de eso**, con nombre visible y todos los parámetros editables por el organizador.

| Preset | Participantes | Grupos | Avanzan | Cuadro desde |
|---|---|---|---|---|
| Super 8 | 8 parejas | 2 × 4 | 2 | Semifinal |
| Super 12 | 12 parejas | 3 × 4 | 2 + 2 mejores terceros | Cuartos |
| Super 8 (grande) | 32 parejas | 8 × 4 | 2 | Cuartos, doble cuadro |

El organizador elige el preset, ve los parámetros y los cambia si su club lo juega distinto. La app sugiere, no impone.

### 17.2 Modelo de datos

```sql
tournaments (
  id            uuid PK,
  creator_id    uuid NOT NULL FK profiles,
  name          text NOT NULL,
  format        text NOT NULL CHECK (format IN
                -- individuales con rotación        -- por equipos
                ('americano','mexicano','king_of_court',
                 'triangular','round_robin','single_elim','groups_knockout')),
  entry_unit    text NOT NULL CHECK (entry_unit IN ('individual','team')),

  -- Parámetros del formato. "Super 8" y "Super 12" son PRESETS de
  -- groups_knockout, no formatos propios — no están estandarizados (§17.1).
  --   groups_knockout: {groups:3, per_group:4, advance:2, best_thirds:2,
  --                     knockout_from:'quarter', preset:'super_12'}
  --   americano/mexicano: {points_per_match:24}
  --   king_of_court:      {race_to:5}
  format_config jsonb NOT NULL DEFAULT '{}',
  scoring_mode  text NOT NULL DEFAULT 'sets'
                CHECK (scoring_mode IN ('points','sets')),
  venue_id      uuid FK venues,
  venue_freetext text,
  courts_count  int NOT NULL CHECK (courts_count >= 1),   -- limita la programación
  starts_at     timestamptz NOT NULL,
  timezone      text NOT NULL,
  level_min     numeric(2,1),
  level_max     numeric(2,1),
  max_entrants  int NOT NULL,
  visibility    text NOT NULL DEFAULT 'link'
                CHECK (visibility IN ('public','link','private')),
  join_token_hash bytea UNIQUE,          -- solo si visibility='link'
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','open','locked','running',
                                  'finished','cancelled')),
  created_at, updated_at
)

tournament_entrants (
  id            uuid PK,
  tournament_id uuid NOT NULL FK tournaments ON DELETE CASCADE,
  -- 'individual' (americano): solo profile_id
  -- 'team': profile_id + partner_profile_id (o partner_guest_name)
  profile_id    uuid NOT NULL FK profiles,
  partner_profile_id uuid FK profiles,
  partner_guest_name text,
  team_name     text,
  seed          int,
  state         text NOT NULL DEFAULT 'registered'
                CHECK (state IN ('registered','confirmed','withdrawn')),
  UNIQUE (tournament_id, profile_id)     -- nadie se anota dos veces
)

tournament_rounds (
  id, tournament_id FK, idx int NOT NULL, label text,
  phase text NOT NULL DEFAULT 'main'
        CHECK (phase IN ('group','knockout','main')),
  group_label text,                      -- 'A','B','C'… solo en phase='group'
  UNIQUE (tournament_id, idx)
)

-- Puntaje individual acumulado. Solo en americano / mexicano / king_of_court.
-- En los formatos por equipos la tabla se deriva de tournament_matches.
tournament_scores (
  tournament_id uuid NOT NULL FK tournaments ON DELETE CASCADE,
  profile_id    uuid NOT NULL FK profiles,
  points_for    int NOT NULL DEFAULT 0,
  points_against int NOT NULL DEFAULT 0,
  matches_played int NOT NULL DEFAULT 0,
  PRIMARY KEY (tournament_id, profile_id)
)

tournament_matches (
  id            uuid PK,
  tournament_id uuid NOT NULL FK tournaments ON DELETE CASCADE,
  round_id      uuid NOT NULL FK tournament_rounds,
  court_label   text,
  scheduled_at  timestamptz,
  -- En 'team' apuntan a entrants. En 'americano' las parejas son por ronda,
  -- así que los cuatro jugadores van en side_a_players / side_b_players.
  side_a_entrant_id uuid FK tournament_entrants,
  side_b_entrant_id uuid FK tournament_entrants,
  side_a_players uuid[],
  side_b_players uuid[],
  score         jsonb,
  winner_side   text CHECK (winner_side IN ('a','b')),
  state         text NOT NULL DEFAULT 'scheduled'
                CHECK (state IN ('scheduled','playing','finished','walkover')),
  -- Cableado del cuadro (solo single_elim)
  next_match_id uuid FK tournament_matches,
  next_slot     text CHECK (next_slot IN ('a','b')),
  -- Cada partido terminado genera una session por jugador (§17.4)
  session_ids   uuid[]
)
```

### 17.3 Reglas de generación

Hay una diferencia grande entre los formatos, y define cuándo se generan los partidos:

| | Se generan… | Por qué |
|---|---|---|
| Americano, grupos, cuadro | **Todos al cerrar la inscripción** | El calendario es determinista; la gente quiere verlo completo desde el principio |
| **Mexicano**, King of the Court | **Ronda a ronda** | La siguiente depende de resultados que todavía no existen |

**Americano.** Rotación fija por cantidad de jugadores (4, 8, 12, 16…), **precalculada como tabla constante y testeada** — no se genera en runtime. Con 8 jugadores y 2 canchas son 7 rondas y cada uno juega con cada uno exactamente una vez. Partidos a puntos fijos (`points_per_match`, por defecto 24), puntaje individual acumulado en `tournament_scores`.

**Mexicano.** Cada ronda se genera al cerrar la anterior: se ordena `tournament_scores`, se agrupan de a 4 por posición y dentro de cada grupo se cruza **1º+4º vs 2º+3º**. La primera ronda no tiene tabla todavía — se siembra por `effective_level` (§12), que es justo el dato que la app ya tiene y que a un organizador con planilla de Excel le falta. Regla extra: **no repetir compañero** mientras haya alternativa, si no en un torneo largo se repiten parejas.

**King of the Court.** Sin calendario. Carreras a `race_to` puntos; los ganadores se quedan, los perdedores van al final de la cola. El estado es la cola, no un cuadro.

**Round robin / triangular.** Emparejamiento circular clásico. Con N impar, un equipo descansa por ronda. Las rondas se reparten entre las canchas: `ceil(partidos_por_ronda / courts_count)` franjas.

**Grupos + eliminación** *(la base de Super 8 / Super 12)*. Se lee todo de `format_config`:
1. Repartir participantes en `groups` grupos, sembrando en serpentina por `effective_level` para que no quede un grupo de la muerte.
2. Round robin dentro de cada grupo.
3. Al cerrar los grupos, ordenar por: partidos ganados → diferencia de juegos → juegos a favor → **enfrentamiento directo**. Empate persistente: sorteo con semilla registrada, para que sea reproducible y auditable.
4. Clasifican `advance` por grupo, más los `best_thirds` mejores terceros si el preset los usa (Super 12 los necesita para llegar a 8).
5. Armar el cuadro desde `knockout_from`, cruzando 1º de un grupo contra 2º de otro.

**Eliminación directa.** El cuadro se arma sobre la potencia de 2 más cercana hacia arriba; los mejor sembrados reciben *bye*. El cableado (`next_match_id`, `next_slot`) se calcula al cerrar la inscripción, no partido a partido — así el cuadro se ve completo desde el principio.

**Cierre de inscripción.** Al pasar a `locked` se congela la lista, se siembra y se genera lo que corresponda según la tabla de arriba. Después de eso, alguien que se baja **no** regenera nada: se registra `walkover`. Regenerar un cuadro en curso es la clase de operación que corrompe datos.

**Validación al crear.** Los formatos tienen restricciones duras de cantidad — Americano necesita múltiplo de 4, un triangular son 3 equipos, Super 12 no funciona con 9 parejas. Se valida **al crear el torneo**, no al cerrarlo: enterarte de que tu formato no cierra cuando ya tenés 11 inscriptos es la peor forma posible de descubrirlo. Si al cerrar faltan participantes, la app propone el preset más cercano que sí cierre.

### 17.4 Un partido de torneo **es** una sesión

Decisión clave: al terminar un `tournament_match`, se generan filas en `sessions` y `session_participants` para cada jugador, marcadas con el origen del torneo.

Sin esto habría **dos historiales paralelos** — tus partidos sueltos por un lado y los de torneo por otro — con estadísticas que no suman, niveles que no se alimentan de la mitad de lo que jugaste, y un "ratio de victorias" que miente. El torneo no es un módulo aparte: es otra forma de generar los mismos hechos.

Consecuencia directa: **las valoraciones de nivel del §12.2 funcionan igual en torneos**, y un torneo de 16 jugadores aporta muchísimos votantes distintos de una sola vez. Es la vía más rápida para que el nivel percibido de alguien se estabilice.

En Americano y Mexicano esto se potencia: cambiás de compañero cada ronda, así que un solo torneo te cruza con 7 personas distintas y genera 7 sesiones. Para el motor de niveles del §12 es la mejor fuente de datos que existe — muchos votantes independientes, todos habiendo jugado con vos el mismo día.

**Detalle de puntuación.** Americano, Mexicano y King of the Court se juegan a puntos, no a sets, así que `sessions.sets` guarda una sola entrada con el marcador de la ronda (`[{me:15, opp:9}]`) y `tournaments.scoring_mode = 'points'` marca cómo interpretarlo. Sin ese flag, el cálculo de estadísticas leería un 15-9 como un set de pádel imposible.

### 17.5 Visibilidad y acceso

| Modo | Quién lo ve | Cómo se entra |
|---|---|---|
| `public` | Cualquiera, aparece en el listado | Se anota solo, sujeto a banda de nivel |
| `link` | Solo con el link | Token en la URL; no figura en ningún listado |
| `private` | Solo invitados | Invitación nominal, igual que §12.6 |

El token del link se guarda **hasheado** y se puede rotar sin recrear el torneo. `private` significa privado de verdad: no aparece en listados, ni en búsquedas, ni en el perfil público del creador.

### 17.6 Lo que reutiliza (y por qué eso valida el diseño de la v1)

Torneos **no** trae infraestructura nueva. Usa lo que ya existe: la escala de niveles canónica (§11) para las bandas, el directorio de sedes (§13), el mecanismo de invitaciones con token hasheado y supresión (§12.7), los recordatorios (§14) y el motor de sesiones y valoraciones (§05, §12.2).

Si al construir la v2 alguna de esas piezas no alcanza, es señal de que estaba mal abstraída en la v1. Ese es el valor real de haber escrito esta sección ahora.

---

## Preguntas abiertas para el owner

Estas no bloquean el arranque (los bloques 1 a 6 se pueden construir igual), pero hay que resolverlas antes del bloque 9:

1. **Radio por defecto de búsqueda de turnos.** 25 km funciona en Buenos Aires o Madrid; en Costa Rica o Sudáfrica, con pocas canchas mapeadas, queda vacío. Propuesta: radio adaptativo — arranca en 25 km y se expande hasta encontrar al menos 5 turnos o llegar a 150 km.
2. **Qué pasa cuando el efectivo y el declarado divergen mucho.** Si declarás 5.0 y el efectivo dice 3.5, ¿la app te avisa en privado ("la comunidad te ve en 3.5")? Creo que sí, y con tono neutro — pero es una conversación incómoda que hay que redactar bien.
3. **Umbral de votantes para publicar el percibido.** Hoy: se muestra desde el primer votante, con el `rater_count` al lado. Alternativa: ocultarlo hasta 3 votantes, para que un solo voto no defina la reputación de nadie. Me inclino por ocultarlo hasta 3.

4. **Torneos: ¿v1 o v2?** Mi recomendación es v2, y arrancar por **Americano** (§17.1) — no por eliminación directa. En un torneo amateur, la eliminación manda a la mitad de la gente a su casa después de un partido; el Americano hace que todos jueguen con todos y encaja con lo que la app ya resuelve.
5. **¿Mexicano antes que grupos+cuadro?** Mexicano usa el nivel efectivo para sembrar y equilibrar cada ronda — es la ventaja competitiva real de esta app frente a una planilla de Excel. Yo lo pondría en la v2.1 antes que el Super 8/12, aunque el Super 8 suene más conocido.

**Resueltas:**
- ~~¿Estado intermedio de asistencia?~~ → **Sí, `tentative`** con vencimiento propuesto por el jugador (§12.4).
- ~~¿Cuántos jugadores por turno?~~ → **Exactamente 4**, garantizado por CHECK en la base.
- ~~¿Solicitudes de amistad?~~ → **No.** Conexión derivada de haber jugado juntos (`played_with`).
- ~~¿Percibido público o privado?~~ → **Público, y con peso real sobre el nivel efectivo** (§12.1–12.2).
- ~~Países del seed.~~ → **27 países** (§13): toda América Latina + US + ZA + los europeos de referencia.
- ~~¿Quién confirma el turno?~~ → **Los dos, cosas distintas**: el creador confirma la cancha, cada jugador su asistencia (§12.4).

---

*Plano generado en fase de diseño para Sideline Padel. Referencia estructural: padelis.app. Investigación de matchmaking: Playtomic Open Matches, MATCHi. Fuente de sedes: OpenStreetMap (ODbL).*
