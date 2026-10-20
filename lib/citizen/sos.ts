import { z } from 'zod';

/** Demo SOS case lifecycle. Reports never leave the device. */
export const SOS_STATES = ['reported', 'reviewed', 'assigned', 'in_progress', 'resolved'] as const;
export type SosState = (typeof SOS_STATES)[number];

export const SOS_CATEGORIES = ['flood', 'medical', 'fire', 'building_collapse', 'trapped', 'landslide', 'other'] as const;
export const ASSISTANCE = ['evacuation', 'medical', 'rescue', 'food_water', 'shelter', 'information'] as const;

export const SosInput = z.object({
  category: z.enum(SOS_CATEGORIES),
  locationLabel: z.string().trim().min(2, 'Add a location').max(120),
  /** rounded to 0.01° (~1 km) unless the user opts in to precise location */
  coord: z.tuple([z.number().min(60).max(78), z.number().min(23).max(38)]).optional(),
  precise: z.boolean().default(false),
  people: z.coerce.number().int().min(1).max(500),
  assistance: z.array(z.enum(ASSISTANCE)).min(1, 'Choose at least one'),
  contact: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+\-\s]*$/, 'Digits only')
    .optional()
    .or(z.literal('')),
  notes: z.string().trim().max(400).optional().or(z.literal('')),
});
export type SosInputT = z.infer<typeof SosInput>;

export interface SosCase extends SosInputT {
  id: string;
  createdAt: string;
  state: SosState;
  history: { state: SosState; at: string; note: string }[];
  demo: true;
}

const NOTES: Record<SosState, string> = {
  reported: 'Report saved on this device (demo). Not sent to any authority.',
  reviewed: 'Simulated triage: category and people count reviewed.',
  assigned: 'Simulated: nearest suitable demo unit assigned.',
  in_progress: 'Simulated: demo unit en route / on scene.',
  resolved: 'Simulated: case closed.',
};

export function roundCoord(c: [number, number], precise: boolean): [number, number] {
  const d = precise ? 4 : 2;
  return [Number(c[0].toFixed(d)), Number(c[1].toFixed(d))];
}

export function createCase(input: SosInputT, now = new Date(), id = `SOS-${now.getTime().toString(36).toUpperCase()}`): SosCase {
  const parsed = SosInput.parse(input);
  return {
    ...parsed,
    coord: parsed.coord ? roundCoord(parsed.coord, parsed.precise) : undefined,
    id,
    createdAt: now.toISOString(),
    state: 'reported',
    history: [{ state: 'reported', at: now.toISOString(), note: NOTES.reported }],
    demo: true,
  };
}

export function canAdvance(c: SosCase): boolean {
  return c.state !== 'resolved';
}

/** Moves a case exactly one step forward; resolved cases are terminal. */
export function advance(c: SosCase, now = new Date()): SosCase {
  if (!canAdvance(c)) return c;
  const next = SOS_STATES[SOS_STATES.indexOf(c.state) + 1];
  return { ...c, state: next, history: [...c.history, { state: next, at: now.toISOString(), note: NOTES[next] }] };
}

/** Demo reports older than this are purged automatically. */
export const SOS_RETENTION_MS = 24 * 3600 * 1000;
export function purgeExpired(cases: SosCase[], now = Date.now()): SosCase[] {
  return cases.filter((c) => now - new Date(c.createdAt).getTime() < SOS_RETENTION_MS);
}
