import '../app/globals.css';

/**
 * 404 para URLs que ni siquiera tienen un locale válido (ej. `/fr/algo`).
 * No puede usar traducciones: justamente no sabemos en qué idioma está el
 * usuario. Por eso es bilingüe y corto.
 */
export default function GlobalNotFound() {
  return (
    <html lang="es">
      <body>
        <main className="grid min-h-dvh place-items-center px-6">
          <div className="max-w-md text-center">
            <h1 className="text-3xl font-bold">404</h1>
            <p className="mt-3 text-fg-secondary">
              No encontramos esta página · Page not found
            </p>
            {/* <a> a propósito, no <Link>: queremos una carga completa para
                que el proxy vuelva a correr y detecte el idioma del usuario.
                Una navegación de cliente se saltearía esa detección. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/es"
              className="touch-target mt-8 inline-grid place-items-center rounded-pill bg-accent px-6 font-semibold text-accent-ink"
            >
              Sideline Padel
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
