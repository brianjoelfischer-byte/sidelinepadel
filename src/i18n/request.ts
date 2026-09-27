import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';

import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // La zona horaria real la define el perfil del usuario (§11). Este es el
    // fallback para visitantes sin sesión: UTC, explícito, nunca la del server.
    timeZone: 'UTC',
  };
});
