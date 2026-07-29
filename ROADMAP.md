# Plan de trabajo

Estado y próximos pasos. El **qué** y el **por qué** de cada decisión están en
[`BLUEPRINT.md`](./BLUEPRINT.md); acá está el **cuándo** y el **en qué orden**.

---

## Dónde estamos

**Bloques 1 y 2 terminados.** Los cimientos y toda la capa de datos.

| | Qué quedó funcionando |
|---|---|
| **Diseño** | 17 secciones, 35 reglas no negociables, con la investigación de matchmaking y formatos de torneo hecha |
| **App** | Next.js 16, TypeScript estricto, Tailwind 4 con los tokens, español e inglés, CI con typecheck + lint + audit + escaneo de secretos |
| **Datos** | 8 migraciones, RLS activo y forzado en todas las tablas, PostGIS para las sedes |
| **Seguridad** | 68 tests que prueban que un usuario no puede leer ni escribir lo de otro |

Se levanta en cualquier máquina con `npm install && npm run db:reset`.

**Lo que todavía no existe:** cualquier cosa que un usuario pueda ver o tocar.
Hay una landing y nada más. No hay login, ni perfil, ni forma de cargar un
partido.

---

## El único bloqueo real

**Hace falta un proyecto Supabase para seguir.** El bloque 3 es autenticación, y
eso corre sobre GoTrue, el servicio de auth de Supabase — un Postgres local no lo
emula.

Son unos 5 minutos y el plan gratis alcanza:

1. Crear el proyecto en [supabase.com](https://supabase.com) (región: São Paulo o
   la más cercana).
2. Copiar de *Project Settings → API*:
   - la **URL** del proyecto
   - la **anon key** (pública, va al navegador)
3. Aplicar el esquema: `export DATABASE_URL=<connection string> && npm run db:migrate`

> **La `service_role` key no se comparte con nadie ni se pega en un chat.** Va
> derecho a las variables de entorno del servidor cuando haga falta, y no antes.

Mientras tanto se puede avanzar con las pantallas del onboarding y la lógica de
niveles, que no dependen de auth real.

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
| 3 | ¿Desde cuántos votantes se publica el percibido? | Ocultarlo hasta 3. Un solo voto no debería definir la reputación de nadie. |
| 4 | ¿Torneos en v1 o v2? | v2. Duplican la superficie de la app y hundirían la fecha de salida. |
| 5 | ¿Mexicano antes que Super 8/12? | Sí. Mexicano siembra con el nivel efectivo — es lo que una planilla de Excel no puede hacer. |

---

## Cómo retomar

```bash
npm install
npm run db:reset     # base limpia + las 8 migraciones
npm run test:rls     # 68 tests de aislamiento
npm run dev
```

El Postgres local es descartable y se recrea con ese `db:reset`. Nada depende de
una máquina en particular.
