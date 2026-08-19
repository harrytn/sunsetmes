/**
 * lib/haversine.ts
 * Pure Haversine formula for great-circle distance calculation.
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
 * Calculate the pigeon flight duration in seconds given a distance in km.
 * Assumes PIGEON_SPEED_KMH = 80 km/h.
 */
export function flightDurationSeconds(distanceKm: number): number {
  return Math.round((distanceKm / PIGEON_SPEED_KMH) * 3600);
}

/**
 * Calculate the survival probability for a given distance.
 *
 * Formula: survivalRate = max(0.60, 0.95 − (distance / 200) / 100)
 *
 * Calibration:
 *   • At   0 km → 95 % survival
 *   • At 200 km → 94 %
 *   • At 1600 km (Aachen → Tunis) → 87 %
 *   • At 7000 km → 60 % (floor)
 *
 * @returns Survival probability in [0.60, 0.95].
 */
export function pigeonSurvivalRate(distanceKm: number): number {
  const rate = 0.95 - distanceKm / 200 / 100;
  return Math.max(0.6, rate);
}

/**
 * Roll the survival die.
 * Returns true if the pigeon survives.
 */
export function rollSurvival(distanceKm: number): { survived: boolean; rate: number } {
  const rate = pigeonSurvivalRate(distanceKm);
  const survived = Math.random() < rate;
  return { survived, rate };
}

/**
 * Select a random pigeon-loss flavour message.
 */
export function lostPigeonNote(destAddress: string): string {
  const notes = [
    `Your pigeon spotted a freshly baked baguette near a market in Lyon and hasn't been seen since.`,
    `Strong Mediterranean headwinds forced your pigeon to take a detour via Corsica. It is now living its best life.`,
    `A particularly friendly cat in Marseille adopted your pigeon. The letter was politely declined.`,
    `Your pigeon got distracted by a flock of seagulls over the Strait of Gibraltar and turned back.`,
    `Radar suggests your pigeon reached ${destAddress}, but then immediately retired and settled down.`,
    `Your pigeon made it halfway, took a long nap on a chimney in Genoa, and forgot the rest of the journey.`,
    `Authorities at a bird sanctuary near ${destAddress} report a pigeon matching the description arrived, but refused to release the letter.`,
    `Your pigeon met a romantic interest over the Tyrrhenian Sea. The letter was used as nest lining.`,
    `A brief electrical storm over the Alps disoriented your pigeon. It landed safely in Austria and is happily confused.`,
    `Your pigeon staged a protest against the working conditions and is currently on strike somewhere near Palermo.`,
  ];

  return notes[Math.floor(Math.random() * notes.length)];
}
