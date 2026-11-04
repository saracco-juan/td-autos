import type { RecommendationFilters } from '@shared/recommendations/filters'

export type Transmission = NonNullable<RecommendationFilters['transmission']>
export type NumericFilter = 'maxPrice' | 'minYear' | 'maxKilometers'
export type FilterDraft = Record<NumericFilter, string> & { transmission: Transmission | null }

export const NUMBER_ERROR = 'Ingresá solo números.'
export const NUMERIC_FILTERS: readonly NumericFilter[] = ['maxPrice', 'minYear', 'maxKilometers']

export function draftFromFilters(filters: RecommendationFilters): FilterDraft {
  const text = (value: number | undefined) => (value === undefined ? '' : String(value))
  return {
    maxPrice: text(filters.maxPrice),
    minYear: text(filters.minYear),
    maxKilometers: text(filters.maxKilometers),
    transmission: filters.transmission ?? null,
  }
}

// Blank imposes no restriction. Dots are read as thousands separators ("23.000.000"), as the copy writes prices.
export function parseDraft(
  draft: FilterDraft,
): { ok: true; filters: RecommendationFilters } | { ok: false; errors: Partial<Record<NumericFilter, string>> } {
  const filters: RecommendationFilters = {}
  const errors: Partial<Record<NumericFilter, string>> = {}
  for (const key of NUMERIC_FILTERS) {
    const raw = draft[key].trim().replaceAll('.', '')
    if (raw === '') continue
    if (/^\d+$/.test(raw)) filters[key] = Number(raw)
    else errors[key] = NUMBER_ERROR
  }
  if (draft.transmission) filters.transmission = draft.transmission
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, filters }
}
