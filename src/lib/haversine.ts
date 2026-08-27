/**
 * lib/haversine.ts
 *
 * Pure Haversine formula for great-circle distance calculation,
 * flight duration estimation, and random weather delay calculations.
 * Used by the Pigeon Post delivery method.
 */

const EARTH_RADIUS_KM = 6371;
const PIGEON_SPEED_KMH = 80;

/**
 * Convert degrees to radians.
 */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate the great-circle distance between two coordinates using
 * the Haversine formula.
 *
 * @returns Distance in kilometres.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.asin(Math.sqrt(a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculate the base pigeon flight duration in seconds given a distance in km.
 * Assumes PIGEON_SPEED_KMH = 80 km/h.
 */
export function flightDurationSeconds(distanceKm: number): number {
  return Math.round((distanceKm / PIGEON_SPEED_KMH) * 3600);
}

/**
 * Check if the pigeon encounters weather/wind delays.
 * 30% chance of a 25% time penalty.
 */
export function rollPigeonDelay(): { isDelayed: boolean; delayMultiplier: number } {
  const isDelayed = Math.random() < 0.30;
  const delayMultiplier = isDelayed ? 1.25 : 1.0;
  return { isDelayed, delayMultiplier };
}

/**
 * Flavour note for weather/wind delays.
 */
export function pigeonDelayNote(): string {
  const notes = [
    'Encountered strong headwinds over the valley, adding a brief detour.',
    'Paused under the eaves of a rustic church to wait out a sudden rain shower.',
    'Navigated thick clouds over the hills, taking a scenic detour.',
    'Stopped for a quick water break near a quiet mountain stream.',
    'Circled a flock of playful sparrows before catching the jet stream.',
    'Rested atop a vintage clock tower while a coastal fog rolled past.',
  ];

  return notes[Math.floor(Math.random() * notes.length)];
}

/**
 * Calculate pigeon flight duration in seconds with potential 25% delay penalty.
 */
export function calculatePigeonFlight(distanceKm: number): {
  standardDurationSec: number;
  finalDurationSec: number;
  isDelayed: boolean;
  pigeonNote: string | null;
} {
  const standardDurationSec = flightDurationSeconds(distanceKm);
  const { isDelayed, delayMultiplier } = rollPigeonDelay();
  const finalDurationSec = Math.round(standardDurationSec * delayMultiplier);
  const pigeonNote = isDelayed ? pigeonDelayNote() : null;

  return {
    standardDurationSec,
    finalDurationSec,
    isDelayed,
    pigeonNote,
  };
}
