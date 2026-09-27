import { z } from 'zod';

import { LEVEL_MAX, LEVEL_MIN } from '@/lib/levels/scale';
import { MAX_SETS, isValidSet } from '@/lib/sessions/score';

/**
 * Validación de una sesión registrada · §05.
 *
 * El `result` NO está en el esquema de entrada: se deriva de los sets en el
 * servidor. Aceptarlo del cliente permitiría cargar "gané" con un 3-6 3-6.
 */

const setSchema = z
  .object({
    me: z.number().int().min(0).max(9),
    opp: z.number().int().min(0).max(9),
  })
  .refine(isValidSet, { message: 'invalid_set' });

const participantSchema = z
  .object({
    profileId: z.uuid().optional(),
    guestName: z.string().trim().min(1).max(60).optional(),
    team: z.enum(['mine', 'opponent']),
    perceivedLevel: z.number().min(LEVEL_MIN).max(LEVEL_MAX).optional(),
  })
  // O es un usuario registrado, o es un invitado suelto. Nunca los dos, nunca
  // ninguno — el mismo CHECK que tiene la tabla.
  .refine(
    (p) => (p.profileId === undefined) !== (p.guestName === undefined),
    { message: 'participant_identity' },
  );

const baseSchema = z.object({
  playedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'invalid_date' })
    // Un partido futuro no es un partido jugado. El límite es "hoy" en la zona
    // del jugador, así que se valida contra la fecha que manda el cliente y se
    // vuelve a chequear en el servidor con margen de un día por husos horarios.
    .refine((v) => v >= '2000-01-01', { message: 'date_too_old' }),
  venueId: z.uuid().optional(),
  venueFreetext: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(160).optional(),
  selfRating: z.number().int().min(1).max(10).optional(),
  sidePlayed: z.enum(['drive', 'reves']).optional(),
});

/** Partido: exige sets, y de ahí sale el resultado. */
export const matchSchema = baseSchema.extend({
  kind: z.literal('match'),
  sets: z.array(setSchema).min(1).max(MAX_SETS),
  // Un partido de pádel son 4: un compañero y dos rivales.
  participants: z.array(participantSchema).max(3),
});

/**
 * Partido rápido: sin marcador, solo quién ganó.
 *
 * Existe porque mucha gente no anota los sets y si la única opción fuera
 * cargarlos, no cargaría nada. Un dato incompleto vale más que ninguno.
 */
export const quickMatchSchema = baseSchema.extend({
  kind: z.literal('quick_match'),
  result: z.enum(['win', 'loss', 'draw']),
  participants: z.array(participantSchema).max(3),
});

/** Entrenamiento: no hay resultado ni rivales. */
export const trainingSchema = baseSchema.extend({
  kind: z.literal('training'),
  durationMin: z.number().int().min(15).max(300).optional(),
  participants: z.array(participantSchema).max(3),
});

export const sessionSchema = z.discriminatedUnion('kind', [
  matchSchema,
  quickMatchSchema,
  trainingSchema,
]);

export type SessionInput = z.infer<typeof sessionSchema>;
