import type { MetadataRoute } from 'next';

/**
 * Lo que convierte la web en "app" al agregarla a la pantalla de inicio:
 * nombre, ícono, colores, y que abra sin la barra del navegador.
 *
 * Se sirve en /manifest.webmanifest. Lleva punto en el nombre a propósito: el
 * proxy de idiomas deja pasar todo lo que tiene punto, y un /manifest sin
 * punto lo redirigiría a /es/manifest, que no existe.
 *
 * Sin service worker todavía (bloque 11): se instala y abre como app, pero sin
 * conexión no carga. Eso viene con el modo offline del historial.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sideline Padel',
    short_name: 'Sideline',
    description: 'Registrá tus partidos de pádel, medí tu nivel y encontrá con quién jugar.',
    // Sin idioma en la ruta: el proxy elige /es o /en según el teléfono.
    start_url: '/panel',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#14161a',
    theme_color: '#14161a',
    categories: ['sports', 'health', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
