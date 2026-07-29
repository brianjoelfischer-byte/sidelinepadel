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

## 3 · Bajar el proyecto (una sola vez)

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
| **Redirect URLs** | `http://localhost:3000/auth/callback` ← con **Add URL** |

En tu captura el segundo estaba vacío. Sin eso, el enlace de acceso que llega
por mail no te trae de vuelta a la app.

---

## 6 · Aplicar las migraciones

Hay **10 archivos** en `supabase/migrations/`. Ya aplicaste los 8 primeros
—las tablas que viste con RLS activado—, pero faltan dos nuevos: el límite de
±2,5 en las valoraciones y la confianza del nivel.

### La forma simple: copiar y pegar

En la terminal, dentro de la carpeta del proyecto:

```bash
npm run db:bundle
```

Eso crea `supabase/bundle.sql`, un archivo con **todas** las migraciones
juntas. Abrilo con el Bloc de notas, copiá todo, y en Supabase andá a
**SQL Editor → New query**, pegalo y apretá **Run**.

Es seguro correrlo aunque ya hayas aplicado parte: va todo en una sola
operación, y si algo falla no queda nada a medias.

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

Y si te aviso que hay una migración nueva, repetís el **paso 6**.

---

## Comandos, de un vistazo

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta la app en localhost:3000 |
| `git pull` | Trae los cambios nuevos |
| `npm install` | Actualiza las piezas necesarias |
| `npm run db:bundle` | Arma el archivo SQL para pegar en Supabase |
| `npm run check` | Revisa que no haya errores |

---

## Si algo falla

**"no se reconoce el comando"** — falta instalar Node o Git, o hay que cerrar
y reabrir la terminal.

**"Cannot find module"** — corré `npm install`.

**La página tira error** — fijate en la terminal: ahí está el mensaje real.
Copialo y pasámelo.

**El enlace del mail no funciona** — casi siempre es el Redirect URL del
paso 5.

Ante cualquier cosa, copiame el texto de la terminal. Con eso alcanza.
