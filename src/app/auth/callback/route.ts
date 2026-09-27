import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { defaultLocale, locales } from '@/i18n/routing';

/**
 * Callback de autenticación · magic link y OAuth.
 *
 * Supabase manda acá con un `code` de un solo uso que se canjea por la sesión.
 * Fuera del árbol de `[locale]` a propósito: la URL la arma el proveedor de
 * auth, no nuestra navegación, así que el idioma viaja como parámetro.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  const localeParam = searchParams.get('locale');
  const locale = locales.includes(localeParam as never)
    ? localeParam
    : defaultLocale;

  /**
   * `next` decide a dónde va el usuario después de entrar, y viene de la URL,
   * así que es entrada no confiable. Solo se aceptan rutas internas: sin `//`
   * ni esquema, o alguien podría mandar un link de login que termina en otro
   * dominio con la sesión ya iniciada.
   */
  const requested = searchParams.get('next') ?? '/panel';
  const next =
    requested.startsWith('/') && !requested.startsWith('//') ? requested : '/panel';

  if (!code) {
    return NextResponse.redirect(`${origin}/${locale}/entrar?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Sin detalle en la URL: el mensaje del proveedor puede filtrar si el
    // email existe o no, que es enumeración de cuentas.
    return NextResponse.redirect(`${origin}/${locale}/entrar?error=invalid_code`);
  }

  return NextResponse.redirect(`${origin}/${locale}${next}`);
}
