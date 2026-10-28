import { formatKilometers, formatPrice } from './format'

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

export type FilterChip = { key: keyof RecommendationFilters; label: string }

/** One removable chip per applied criterion, in the order of the form. */
export function appliedFilterChips(filters: RecommendationFilters): FilterChip[] {
  const chips: FilterChip[] = []
  if (filters.maxPrice !== undefined) chips.push({ key: 'maxPrice', label: `Hasta ${formatPrice(filters.maxPrice)}` })
  if (filters.minYear !== undefined) chips.push({ key: 'minYear', label: `Desde ${filters.minYear}` })
  if (filters.maxKilometers !== undefined) {
    chips.push({ key: 'maxKilometers', label: `Hasta ${formatKilometers(filters.maxKilometers)}` })
  }
  if (filters.transmission) {
    chips.push({ key: 'transmission', label: filters.transmission === 'manual' ? 'Manual' : 'Automática' })
  }
  return chips
}
