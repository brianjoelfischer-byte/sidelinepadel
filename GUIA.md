# Guía para arrancar, sin saber programar

Todo lo que hay que hacer, explicado desde cero. Si algo no se entiende, es
culpa de esta guía, no tuya.

---

## 1 · Qué es cada cosa

**La terminal.** Una ventana donde se escriben órdenes en vez de hacer clic.
En Windows se llama **PowerShell** o **Símbolo del sistema**; en Mac,
**Terminal**. Es donde van todos los comandos de esta guía.

**Git.** Un programa que guarda el historial del código. `git clone` significa
"bajate una copia de este proyecto a mi computadora".

**Node.** El motor que hace funcionar la app. Sin esto instalado, nada anda.

**npm.** Viene con Node. Instala las piezas que la app necesita
(`npm install`) y ejecuta órdenes del proyecto (`npm run dev`).

**Una migración.** Un archivo de instrucciones que le dice a la base de datos
qué tablas crear o cambiar. Están en `supabase/migrations/`. Se aplican **en
orden**, y cada una se aplica **una sola vez**. Es el equivalente a las
reformas de una casa: primero los cimientos, después las paredes.

**Docker.** Un programa que corre otros programas en cajas aisladas, sin
ensuciar tu computadora. Sirve para tener una copia de la base de datos en tu
máquina y poder romper cosas sin miedo. **No lo necesitás** para lo que sigue.

---

## 2 · Instalar lo necesario (una sola vez)

### Node

Andá a **<https://nodejs.org>** y bajá la versión **LTS**. Instalás con
siguiente-siguiente-siguiente.

Para verificar, abrí la terminal y escribí:

```bash
node --version
```

Tiene que responder algo como `v22.x.x`. Si dice "no se reconoce el comando",
cerrá la terminal, abrila de nuevo y reintentá.

### Git

**<https://git-scm.com/downloads>** — también siguiente-siguiente. Verificás
igual:

```bash
git --version
```

---

## 3 · Bajar el proyecto (una vez por computadora)

> **Cambiaste de máquina, o borraste la carpeta?** No se pierde nada: el
> proyecto vive en GitHub, y la computadora es solo una copia de trabajo. Se
> baja de nuevo con estos mismos comandos. Lo único que **no** viaja es el
> archivo `.env.local` del paso 4 — a propósito, porque lleva tu clave.

Abrí la terminal. Vas a estar parado en tu carpeta de usuario; está bien.

Copiá y pegá **una línea a la vez**, apretando Enter después de cada una:

```bash
git clone https://github.com/brianjoelfischer-byte/sidelinepadel.git
```

```bash
cd sidelinepadel
```

```bash
git checkout claude/the-architect-repo-1y35w4
```

```bash
npm install
```

El último tarda un par de minutos y escribe muchas líneas. Es normal.

> **Qué hizo cada uno:** bajó el proyecto · entró a la carpeta · se paró en la
> rama donde está el trabajo · instaló las piezas necesarias.

---

## 4 · Conectar con tu Supabase (una sola vez)

```bash
npm run dev
```

La primera vez te va a decir que falta configurar Supabase y va a crear un
archivo llamado `.env.local`. Paralo con **Ctrl + C**.

Abrí ese archivo con el Bloc de notas. Está dentro de la carpeta
`sidelinepadel`. Buscá estas dos líneas y completalas:

```
NEXT_PUBLIC_SUPABASE_URL=https://xajnoqtxuzpgtlzbjkxo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=  ← acá va la anon key
```

La *anon key* la sacás de tu proyecto en Supabase:
**Project Settings → API → anon public**. Es un texto largo que empieza con
`eyJ...`.

> Este archivo **nunca** se sube a GitHub. Está en la lista de exclusiones a
> propósito.

---

## 5 · Configurar Supabase (una sola vez)

En el panel de Supabase, **Authentication → URL Configuration**:

| Campo | Valor |
|---|---|
| **Site URL** | `http://localhost:3000` |
| **Redirect URLs** | `http://localhost:3000/**` ← con **Add URL** |

> **Por qué `/**` y no `/auth/callback`.** El enlace vuelve a
> `/auth/callback?locale=es`, con el idioma al final, y Supabase compara la
> dirección entera: la exacta sin `?locale=es` no coincide. Si no coincide, no
> tira error. Te manda a la portada sin la sesión, y parece que el login no
> hizo nada. `/**` acepta cualquier ruta de localhost.
>
> **Abrí el enlace del mail en la misma computadora y el mismo navegador** en
> que lo pediste. El login deja una marca en ese navegador y la necesita para
> terminar. Si lo abrís desde el celular, falla con *"El enlace venció o ya se
> usó"*.
>
> **Pedí el enlace una sola vez.** El correo de prueba de Supabase manda muy
> pocos mails por hora. Si apretás varias veces, te bloquea un rato.

En tu captura el segundo estaba vacío. Sin eso, el enlace de acceso que llega
por mail no te trae de vuelta a la app.

---

## 6 · Aplicar las migraciones

Hay **11 archivos** en `supabase/migrations/`. Ya aplicaste los 8 primeros
—las tablas que viste con RLS activado—, pero faltan tres:

| Falta | Qué hace |
|---|---|
| `rating_bounds` | El límite de ±2,5 en las valoraciones |
| `level_confidence` | La confianza del nivel |
| `fix_sessions_returning` | **Sin esta, guardar un partido falla.** Arregla un permiso de lectura que rechazaba el alta |

### La forma simple: copiar y pegar

En la terminal, dentro de la carpeta del proyecto:

```bash
npm run db:bundle -- --from 20260729000001
```

Eso crea `supabase/bundle.sql` con **solo las tres que faltan**. Abrilo:

```bash
notepad supabase\bundle.sql
```

Copiá todo (Ctrl+A, Ctrl+C), y en Supabase andá a **SQL Editor → New query**,
pegalo y apretá **Run**.

> **Por qué `--from` y no el bundle entero.** Las migraciones no se pueden
> volver a aplicar: `CREATE TABLE profiles` falla con *"already exists"* si esa
> tabla ya está. El bundle completo es para una base vacía; sobre una base a
> medio camino hay que mandar solo el tramo que falta.
>
> Si te equivocás y mandás de más, no rompés nada: va todo en una sola
> transacción, así que al fallar revierte sola y la base queda como estaba.

> **`--pending` no te sirve si aplicás por el dashboard.** Esa opción le
> pregunta a la base qué le falta, y para eso necesita `DATABASE_URL` — la
> cadena de conexión con la contraseña. Si pegás el SQL a mano en el SQL
> Editor, no la tenés configurada y no hace falta que la configures: usá
> `--from`. La opción existe para cuando uses el CLI de Supabase.

**Cómo saber desde cuál pedir el `--from`.** Desde ahora el bundle deja
anotado en la base qué se aplicó. Corré esto en el SQL Editor:

```sql
SELECT filename FROM app.schema_migrations ORDER BY filename;
```

Lo que **no** esté en esa lista es lo que te falta, y la primera de esas es la
que va en el `--from`. (Si la tabla no existe todavía, es porque nunca
aplicaste un bundle de los nuevos — en ese caso avisame y te digo yo.)

### La otra forma: el CLI

Si instalás el Supabase CLI (**<https://supabase.com/docs/guides/cli>**):

```bash
supabase link --project-ref xajnoqtxuzpgtlzbjkxo
supabase db push
```

`db push` mira qué migraciones faltan y aplica solo esas. Es más prolijo, y de
acá en adelante cada vez que yo agregue una, con ese comando alcanza.

---

## 7 · Levantar la app

```bash
npm run dev
```

Cuando diga `Ready`, abrí **<http://localhost:3000>** en el navegador.

> **Por qué antes te decía "no se puede acceder":** ese comando estaba
> corriendo en *mi* computadora, no en la tuya. `localhost` significa
> literalmente "esta máquina" — si el programa no corre acá, no hay nada que
> mostrar.

Para probar el registro: entrá a **Empezar**, poné tu email, y va a llegarte
un enlace. Al hacer clic, caés en el onboarding de 5 pasos.

**Para frenar la app:** Ctrl + C en la terminal.
**Para volver a arrancarla:** `npm run dev` otra vez.

---

## 8 · Traer los cambios que yo vaya haciendo

Cada vez que yo suba trabajo nuevo, en tu terminal:

```bash
git pull
```

```bash
npm install
```

> **Si el `git pull` dice "your local changes would be overwritten:
> package-lock.json"** — es porque `npm install` reescribe ese archivo, y git
> no quiere pisarlo. Se descarta sin problema, porque no lo escribiste vos:
>
> ```bash
> git checkout -- package-lock.json
> ```
>
> Y volvés a hacer el `git pull`. **El orden importa:** primero el pull, después
> el install. Al revés se repite el bloqueo.

Y si te aviso que hay una migración nueva, repetís el **paso 6**. Te voy a
decir yo desde cuál va el `--from`.

---

## Comandos, de un vistazo

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta la app en localhost:3000 |
| `git pull` | Trae los cambios nuevos |
| `npm install` | Actualiza las piezas necesarias |
| `npm run db:bundle -- --from <mig>` | Arma el SQL desde esa migración en adelante |
| `npm run check` | Revisa que no haya errores |
| `cd sidelinepadel` | Lo primero en cada ventana nueva de terminal |

---

## Si algo falla

**"no se reconoce el comando"** — falta instalar Node o Git, o hay que cerrar
y reabrir la terminal.

**"la ejecución de scripts está deshabilitada en este sistema"** (Windows) —
le pasa a casi todos la primera vez. `git` es un programa y pasa, pero `npm`
es un script y PowerShell lo bloquea. Se arregla una sola vez con:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Confirmás con **S**. Permite correr scripts que están en tu máquina, sigue
exigiendo firma a los bajados de internet, y solo afecta a tu usuario — no
hace falta ser administrador. Es lo que recomienda la documentación de Node.

> Si preferís no cambiar nada del sistema, la alternativa es escribir
> `npm.cmd` en lugar de `npm` en **todos** los comandos de esta guía.

**"Cannot find module"** — corré `npm install`.

**"not a git repository"** — la ventana está parada en la carpeta equivocada.
Fijate que el prompt termine en `\sidelinepadel`; si no, `cd sidelinepadel`.

**`relation "..." already exists` al pegar el SQL en Supabase** — mandaste más
migraciones de las que faltaban. No rompiste nada: la transacción revirtió
sola. Generá el bundle de nuevo con el `--from` correcto y pegá ese.

Si te pasa **dos veces seguidas**, fijate que el comando haya terminado bien
antes de abrir el archivo: si el script falla, borra `supabase/bundle.sql` a
propósito, y entonces `notepad` te va a decir que no existe. Si te muestra
contenido, es el bundle nuevo.

**La página tira error** — fijate en la terminal: ahí está el mensaje real.
Copialo y pasámelo.

**El enlace del mail no funciona** — casi siempre es el Redirect URL del
paso 5.

Ante cualquier cosa, copiame el texto de la terminal. Con eso alcanza.
