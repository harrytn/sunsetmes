/**
 * lib/haversine.ts
 *
 * Pure Haversine formula for great-circle distance calculation,
 * flight duration estimation, and the chance of an on-time flight.
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

  const c = 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculate the base pigeon flight duration in seconds given a distance in km.
 * Assumes PIGEON_SPEED_KMH = 80 km/h.
 */
export function flightDurationSeconds(distanceKm: number): number {
  return Math.max(60, Math.ceil((distanceKm / PIGEON_SPEED_KMH) * 3600));
}

/**
 * The percentage shown before dispatch is the exact probability used by
 * the server. Longer routes are less likely to arrive on time.
 */
export function pigeonOnTimeRate(distanceKm: number): number {
  return Math.max(60, Math.round(95 - distanceKm / 200)) / 100;
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
 * One roll decides whether weather adds 25% to the journey.
 */
export function calculatePigeonFlight(distanceKm: number): {
  finalDurationSec: number;
  isDelayed: boolean;
  pigeonNote: string | null;
  successRate: number;
} {
  const standardDurationSec = flightDurationSeconds(distanceKm);
  const successRate = pigeonOnTimeRate(distanceKm);
  const isDelayed = Math.random() >= successRate;
  const finalDurationSec = Math.round(standardDurationSec * (isDelayed ? 1.25 : 1));
  const pigeonNote = isDelayed ? pigeonDelayNote() : null;

  return {
    finalDurationSec,
    isDelayed,
    pigeonNote,
    successRate,
  };
}
