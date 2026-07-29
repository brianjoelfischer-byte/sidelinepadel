/**
 * Verificación de edad · §02 del BLUEPRINT.
 *
 * La v1 exige 16 años o más. No es una cifra arbitraria: por debajo de esa edad
 * el GDPR pide consentimiento parental verificable, que es desproporcionado
 * para un MVP y se hace mal casi siempre.
 *
 * La fecha de nacimiento se guarda pero NUNCA se expone (§8.5): la API devuelve
 * como mucho un booleano derivado de acá.
 */

export const MINIMUM_AGE = 16;

/**
 * Años cumplidos a la fecha de referencia.
 *
 * Se compara por partes (año, mes, día) y no por milisegundos: restar fechas
 * introduce errores por husos horarios y por años bisiestos, y acá un error de
 * un día cambia si alguien puede o no crear una cuenta.
 */
export function ageAt(birthDate: Date, reference: Date = new Date()): number {
  let age = reference.getFullYear() - birthDate.getFullYear();

  const monthDiff = reference.getMonth() - birthDate.getMonth();
  const dayDiff = reference.getDate() - birthDate.getDate();

  // Todavía no cumplió años este año.
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
}

export function meetsMinimumAge(
  birthDate: Date,
  reference: Date = new Date(),
): boolean {
  return ageAt(birthDate, reference) >= MINIMUM_AGE;
}

/**
 * Parsea una fecha `YYYY-MM-DD` como fecha local, no UTC.
 *
 * `new Date('2010-03-15')` la interpreta como medianoche UTC, así que en
 * cualquier huso al oeste de Greenwich se convierte en el 14 de marzo. Para una
 * fecha de nacimiento eso corre el cumpleaños un día — suficiente para rechazar
 * a alguien que sí tiene la edad.
 */
export function parseBirthDate(input: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;

  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);

  const date = new Date(year, month - 1, day);

  // Rechaza fechas inexistentes como el 31 de febrero, que JS "corrige"
  // silenciosamente al 2 o 3 de marzo.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}
