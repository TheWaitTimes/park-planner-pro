// Shared wait-time / travel model used by both the Day Simulator and Day Optimizer
// so the two tools never disagree about how long things take.

export const PARK_HOP_TIMES: Record<string, Record<string, number>> = {
  "Magic Kingdom": { EPCOT: 25, "Hollywood Studios": 35, "Animal Kingdom": 45 },
  EPCOT: { "Magic Kingdom": 25, "Hollywood Studios": 15, "Animal Kingdom": 30 },
  "Hollywood Studios": { "Magic Kingdom": 35, EPCOT: 15, "Animal Kingdom": 25 },
  "Animal Kingdom": { "Magic Kingdom": 45, EPCOT: 30, "Hollywood Studios": 25 },
};

export function getHopTime(from: string, to: string): number {
  if (from === to) return 0;
  return PARK_HOP_TIMES[from]?.[to] ?? 30;
}

/** Walking minutes between two in-park areas (null = just entered the park). */
export function getWalkingTime(fromArea: string | null | undefined, toArea: string): number {
  if (!fromArea) return 5;
  return fromArea === toArea ? 3 : 7;
}

/**
 * Chance a weather-sensitive ride is actually down during a storm.
 * Not every outdoor attraction closes for every shower.
 */
export const RAIN_CLOSURE_CHANCE = 0.65;

/** Hard ceiling on any single modelled wait — keeps stacked multipliers realistic. */
export const MAX_WAIT_MINUTES = 150;

export function capWait(minutes: number): number {
  return Math.min(MAX_WAIT_MINUTES, Math.max(5, Math.round(minutes)));
}

/** Rope drop: the very first ride of the day walks on compared to later in the morning. */
export const ROPE_DROP_MULTIPLIER = 0.45;

/**
 * Expected crowd size → wait-time factor. Light days run shorter queues than the
 * modelled averages, busy days run longer ones. Shared so every tool scales waits
 * the same way.
 */
export const CROWD_SIZES = ["Light", "Moderate", "Busy"] as const;
export type CrowdSize = (typeof CROWD_SIZES)[number];

export const CROWD_SIZE_MULTIPLIER: Record<CrowdSize, number> = {
  Light: 0.75,
  Moderate: 1.0,
  Busy: 1.35,
};

/** Scale a modelled average wait for the chosen crowd size, keeping it inside sane bounds. */
export function crowdAdjustedWait(baseMinutes: number, crowd: CrowdSize): number {
  return capWait(baseMinutes * CROWD_SIZE_MULTIPLIER[crowd]);
}
