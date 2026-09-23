/**
 * Reference: docs/FLEET_DOMAIN_RULES.md - Rule 1 (PMS Due Mileage Calculation)
 * PMS due = last completed PMS KM + manufacturer interval (default 5,000 km unless overridden per vehicle).
 */

export const DEFAULT_MANUFACTURER_PMS_INTERVAL_KM = 5000;

export interface PmsCalculationInput {
  currentKm: number;
  lastCompletedPmsKm: number;
  intervalKm?: number;
}

export function calculateNextPmsDueKm(
  lastCompletedPmsKm: number,
  intervalKm: number = DEFAULT_MANUFACTURER_PMS_INTERVAL_KM,
): number {
  return lastCompletedPmsKm + intervalKm;
}

export function isPmsOverdue(input: PmsCalculationInput): boolean {
  const interval = input.intervalKm ?? DEFAULT_MANUFACTURER_PMS_INTERVAL_KM;
  const dueKm = calculateNextPmsDueKm(input.lastCompletedPmsKm, interval);
  return input.currentKm >= dueKm;
}
