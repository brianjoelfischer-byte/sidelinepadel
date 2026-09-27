import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Cabeceras de seguridad · §8.6 del BLUEPRINT.
 *
 * Las que están acá son las que no dependen de nonce por request. La CSP
 * completa con nonce va en el middleware cuando entre auth (bloque 3):
 * necesita un valor distinto por respuesta y no se puede fijar acá.
 */
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(self), camera=(), microphone=(), payment=()',
  },
  // frame-ancestors 'none' se refuerza en la CSP; X-Frame-Options cubre
  // navegadores viejos que no la interpretan.
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Regla 27: TS estricto de verdad. Un error de tipos NO puede pasar a build.
  // (Next 16 sacó el lint del build; lo corre CI como paso propio.)
  typescript: { ignoreBuildErrors: false },

  // No filtrar la versión del framework.
  poweredByHeader: false,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
