import { z } from 'zod';

import { LEVEL_MAX, LEVEL_MIN } from '@/lib/levels/scale';
import { locales } from '@/i18n/routing';
import { meetsMinimumAge, parseBirthDate } from '@/lib/auth/age';

/**
 * Esquemas de validación del perfil.
 *
 * Se usan en el cliente y en el servidor. Los del servidor son los que mandan:
 * la validación del cliente es comodidad, no seguridad.
 */

/**
 * Caracteres invisibles que no pueden aparecer en un nombre visible.
 *
 * Se comprueba por code point en vez de con un regex: las marcas de dirección
 * son literalmente invisibles en el código fuente, así que un rango escrito a
 * mano es imposible de revisar y fácil de romper al editar.
 *
 * Qué bloquea y por qué: los controles C0/C1 rompen el renderizado, y los
 * marcadores bidireccionales permiten que un nombre se muestre en pantalla
 * igual que el de otra persona — suplantación pura.
 */
function hasInvisibleCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;

    const isC0 = code <= 0x1f;
    const isC1 = code >= 0x7f && code <= 0x9f;
    const isZeroWidthOrBidi = code >= 0x200b && code <= 0x200f;
    const isBidiOverride = code >= 0x202a && code <= 0x202e;
    const isInvisibleFormat = code >= 0x2060 && code <= 0x2064;

    if (isC0 || isC1 || isZeroWidthOrBidi || isBidiOverride || isInvisibleFormat) {
      return true;
    }
  }
  return false;
}

export const displayNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .refine((v) => !hasInvisibleCharacters(v), { message: 'invalid_characters' });

export const countryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Za-z]{2}$/)
  .transform((v) => v.toUpperCase());

/**
 * Zona horaria IANA. Se valida contra el runtime en vez de una lista propia:
 * una lista quedaría desactualizada, y las zonas cambian más de lo que parece.
 */
export const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'invalid_timezone' },
  );

export const levelSchema = z
  .number()
  .min(LEVEL_MIN)
  .max(LEVEL_MAX)
  .transform((v) => Math.round(v * 10) / 10);

export const birthDateSchema = z
  .string()
  .refine((v) => parseBirthDate(v) !== null, { message: 'invalid_date' })
  .refine(
    (v) => {
      const date = parseBirthDate(v);
      return date !== null && meetsMinimumAge(date);
    },
    { message: 'under_minimum_age' },
  );

export const onboardingSchema = z.object({
  displayName: displayNameSchema,
  birthDate: birthDateSchema,
  countryCode: countryCodeSchema,
  timezone: timezoneSchema,
  locale: z.enum(locales),
  declaredLevel: levelSchema,
  preferredHand: z.enum(['left', 'right']),
  preferredSide: z.enum(['drive', 'reves', 'indistinto']),
  racket: z.string().trim().max(80).optional(),
  isPublic: z.boolean().default(true),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/**
 * Slug para la URL pública del perfil.
 *
 * Se normaliza a ASCII: "Martín Ñuñez" → "martin-nunez". Sin eso, dos nombres
 * que se ven distintos pero normalizan igual en Unicode podrían chocar, y una
 * URL con caracteres no ASCII se comparte mal.
 *
 * `\p{M}` son las marcas combinantes que deja NFD al separar los acentos.
 */
export function slugify(displayName: string): string {
  return displayName
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}
