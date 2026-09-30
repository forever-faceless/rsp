/**
 * Feet and metres.
 *
 * Documents in India state measurements in metres, while sites are bought and sold in feet.
 * Everything is stored in feet and square feet; a figure typed in metres is converted on the
 * way in. A deed figure is usually a round number of feet written in metres, so a conversion
 * that lands within a hair of a whole number is taken to be that number: 9.14 m becomes 30 ft
 * and 111.48 sq m becomes 1,200 sq ft. Anything else keeps its exact value, so a road typed
 * as 9 m still reads 9 m when shown in metres again.
 */

export type LengthUnit = "ft" | "m";

export const M_PER_FT = 0.3048;
export const SQM_PER_SQFT = 0.09290304;

/** A length typed in the given unit, in feet. */
export function toFeet(value: number, unit: LengthUnit): number {
  if (unit !== "m") return value;
  const feet = value / M_PER_FT;
  const whole = Math.round(feet);
  return Math.abs(feet - whole) <= 0.04 ? whole : Math.round(feet * 100) / 100;
}

/** A length in feet, shown in the given unit. */
export function fromFeet(feet: number, unit: LengthUnit): number {
  return unit === "m" ? Math.round(feet * M_PER_FT * 100) / 100 : feet;
}

/** An area typed in square feet or square metres, in square feet. */
export function toSqft(value: number, unit: LengthUnit): number {
  if (unit !== "m") return value;
  const sqft = value / SQM_PER_SQFT;
  const whole = Math.round(sqft);
  return Math.abs(sqft - whole) <= 0.06 ? whole : Math.round(sqft * 10) / 10;
}

/** An area in square feet, shown in square feet or square metres. */
export function fromSqft(sqft: number, unit: LengthUnit): number {
  return unit === "m" ? Math.round(sqft * SQM_PER_SQFT * 100) / 100 : sqft;
}

/**
 * A distance held in feet, written in metres: "14.2 m", "210 m", "1.25 km". Distances
 * between places are always given in metres, unlike the sides of a plot, which the market
 * quotes in feet.
 */
export function formatMetres(feet: number): string {
  const metres = feet * M_PER_FT;
  if (metres >= 1000) return `${Number((metres / 1000).toFixed(2))} km`;
  return `${metres >= 100 ? Math.round(metres) : Math.round(metres * 10) / 10} m`;
}
