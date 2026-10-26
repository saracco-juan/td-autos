export type RecommendationFilters = {
  maxPrice?: number
  minYear?: number
  maxKilometers?: number
  transmission?: 'manual' | 'automatica'
}

type FilterableRecommendation = {
  price_ars?: number | null
  vehicle: {
    anio?: number | null
    kilometraje?: number | null
    transmision?: string | null
  }
}

const knownNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** Refine the supplied recommendations, retaining their order, scores and quote. */
export function filterRecommendations<T extends FilterableRecommendation>(
  results: readonly T[], filters: RecommendationFilters,
): T[] {
  return results.filter(({ price_ars, vehicle }) =>
    (filters.maxPrice === undefined || (knownNumber(price_ars) && price_ars <= filters.maxPrice)) &&
    (filters.minYear === undefined || (knownNumber(vehicle.anio) && vehicle.anio >= filters.minYear)) &&
    (filters.maxKilometers === undefined || (knownNumber(vehicle.kilometraje) && vehicle.kilometraje <= filters.maxKilometers)) &&
    (filters.transmission === undefined || vehicle.transmision === filters.transmission),
  )
}
