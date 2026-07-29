# Plan de trabajo

Estado y próximos pasos. El **qué** y el **por qué** de cada decisión están en
[`BLUEPRINT.md`](./BLUEPRINT.md); acá está el **cuándo** y el **en qué orden**.

---

## Dónde estamos

**Bloques 1, 2 y 3 terminados.** Cimientos, capa de datos y autenticación.

| | Qué quedó funcionando |
|---|---|
| **Diseño** | 17 secciones y 37 reglas no negociables, con la investigación de matchmaking, formatos de torneo y sistemas de rango competitivos |
| **App** | Next.js 16, TypeScript estricto, Tailwind 4 con los tokens, español e inglés, CI con typecheck + lint + audit + escaneo de secretos |
| **Datos** | 10 migraciones, RLS activo y forzado en todas las tablas, PostGIS para las sedes |
| **Auth** | Login sin contraseñas (magic link + Google), guard de sesión en el layout, verificación de 16 años, onboarding de 5 pasos |
| **Niveles** | Declarado + percibido + efectivo, con confianza adaptativa, límite de ±2,5 por voto y categoría estimada |
| **Seguridad** | 85 tests de base que prueban que un usuario no puede leer ni escribir lo de otro, más 32 de lógica |

Se levanta en cualquier máquina con `npm install && npm run db:reset`.

**Lo que todavía no existe:** registrar un partido. El perfil se crea y se ve,
pero no hay forma de cargar lo que jugaste — que es el corazón de la app.

---

## Pendiente del owner

- **Aplicar las dos migraciones nuevas** (`rating_bounds` y `level_confidence`).
  Con `npm run db:bundle` y pegando el resultado en el SQL Editor, o con
  `supabase db push` si usás el CLI. Ver [`GUIA.md`](./GUIA.md).
- **Agregar el Redirect URL** en Supabase → Authentication → URL Configuration:
  `http://localhost:3000/auth/callback`. Sin eso el enlace de acceso no vuelve
  a la app.
- **Probar el login de punta a punta.** No se pudo verificar acá: el entorno de
  desarrollo bloquea el acceso a `supabase.co`, así que el magic link real
  nunca se vio llegar.

---

## El camino, en cuatro hitos

Los 14 bloques del §09 no pesan lo mismo. Agrupados por lo que **desbloquean**:

### Hito 1 · Una app que te sirve a vos solo
**Bloques 3 · 4 · 5 · 6**

Entrás, cargás tus partidos, y ves tus estadísticas y tu progresión de nivel.

Es el primer punto en el que la app vale algo — y es el primero que se le puede
mostrar a alguien. Todo lo social viene después, porque una red social vacía no
convence a nadie, pero un registro de partidos que funciona, sí.

| Bloque | Qué trae |
|---|---|
| **3** · Auth y onboarding ✅ | Magic link + Google, guard de sesión, verificación de 16 años, onboarding de 5 pasos |
| **4** · Perfil y niveles | Los tres niveles en pantalla, escala canónica ↔ categoría local, tarjeta de jugador, público/privado |
| **5** · Sesiones | Cargar partido / entrenamiento / partido rápido, participantes, confirmación de etiqueta, historial |
| **6** · Estadísticas | Ratio de victorias, racha, forma reciente, progresión, calendario |

**Al terminar:** se puede usar de verdad, aunque seas el único usuario.

---

### Hito 2 · Una app que te sirve con otros
**Bloques 7 · 8 · 9 · 9b · 9c**

Encontrás gente, publicás turnos, coordinás.

| Bloque | Qué trae |
|---|---|
| **7** · Sedes | Seed de OpenStreetMap en 27 países, búsqueda por cercanía, alta por usuario con moderación, atribución ODbL |
| **8** · Social | Directorio, conexiones derivadas de haber jugado, seguir, bloquear, reportar |
| **9** · Turnos · cupo | Crear turno de 4, banda de nivel, solicitar, aceptar, los cuatro estados de asistencia |
| **9b** · Turnos · cancha | `court_status`, empujón al creador, "se cayó la cancha" sin perder el grupo, los cinco avisos de "no reservamos" |
| **9c** · Invitaciones | Desde el historial, por usuario, por email con token hasheado y lista de supresión |

**Al terminar:** la app hace lo que promete el nombre. Es el punto donde tiene
sentido invitar a un grupo de prueba.

---

### Hito 3 · Una app a la que se vuelve
**Bloques 10 · 11 · 12**

| Bloque | Qué trae |
|---|---|
| **10** · Recordatorios | Push, aviso de 24 h, recordatorio de 30 min, cron en `pg_cron`, respaldo por email |
| **11** · PWA | Instalable, offline del historial propio, prompt de instalación en iOS |
| **12** · Trofeos | Motor de logros, modal de desbloqueo, grilla |

El bloque 10 es el que hace que la app deje de ser algo que abrís cuando te
acordás. El 11 no es cosmético: **en iPhone, sin PWA instalada no hay push.**

---

### Hito 4 · Lista para mostrar
**Bloques 13 · 14**

| Bloque | Qué trae |
|---|---|
| **13** · Cumplimiento | Exportar datos, borrar cuenta con cascada real, privacidad, términos, atribuciones |
| **14** · Endurecimiento | CSP con nonce, rate limits, auditoría completa, pruebas de carga |

No son opcionales ni "para después": el borrado de cuenta es obligación legal
desde el primer usuario real, y los rate limits protegen el envío de correo desde
el día que exista la invitación por email.

---

## Después de la v1

- **App nativa** (Expo, reutilizando Supabase)
- **Torneos** — §17, diseñado pero sin construir. Sugerencia: v2.0 Americano y
  triangular, v2.1 Mexicano y los presets Super 8 / Super 12, v2.2 eliminación
  directa y King of the Court.

---

## Decisiones pendientes

Ninguna frena los hitos 1 y 2, pero conviene cerrarlas antes del bloque 9.

| # | Pregunta | Mi recomendación |
|---|---|---|
| 1 | Radio por defecto de búsqueda | Adaptativo: arranca en 25 km y se expande hasta encontrar 5 turnos o llegar a 150 km. 25 km fijos dejan vacía media Latinoamérica. |
| 2 | ¿Avisar si el declarado y el efectivo divergen? | Sí, en privado y con tono neutro. Hay que redactarlo bien: es una conversación incómoda. |
| 3 | ~~¿Desde cuántos votantes se publica el percibido?~~ | **Resuelto:** se oculta hasta 3. |
| 4 | ¿Torneos en v1 o v2? | v2. Duplican la superficie de la app y hundirían la fecha de salida. |
| 5 | ¿Mexicano antes que Super 8/12? | Sí. Mexicano siembra con el nivel efectivo — es lo que una planilla de Excel no puede hacer. |

---

## Cómo retomar

```bash
npm install
npm run db:reset     # base limpia + las 10 migraciones
npm run test:rls     # 85 tests de aislamiento
npm run dev
```

¿Nunca usaste una terminal? [`GUIA.md`](./GUIA.md) lo explica desde cero.

El Postgres local es descartable y se recrea con ese `db:reset`. Nada depende de
una máquina en particular.
