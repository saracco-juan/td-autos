import type { RecommendationFilters } from '@shared/recommendations/filters'
import { useSearchParams } from 'react-router'

const NUMERIC_KEYS = ['maxPrice', 'minYear', 'maxKilometers'] as const

/** Applied filters live in the current history entry so navigation/back restores them. */
export function useRecommendationFilters() {
  const [search, setSearch] = useSearchParams()
  const filters: RecommendationFilters = {}
  for (const key of NUMERIC_KEYS) {
    const raw = search.get(key)
    const value = raw === null || raw.trim() === '' ? NaN : Number(raw)
    if (Number.isFinite(value) && value >= (key === 'minYear' ? 1 : 0) &&
      (key === 'maxPrice' || Number.isSafeInteger(value))) filters[key] = value
  }
  const transmission = search.get('transmission')
  if (transmission === 'manual' || transmission === 'automatica') filters.transmission = transmission

  function applyFilters(next: RecommendationFilters) {
    setSearch((previous) => {
      const params = new URLSearchParams(previous)
      for (const key of [...NUMERIC_KEYS, 'transmission'] as const) {
        params.delete(key)
        if (next[key] !== undefined) params.set(key, String(next[key]))
      }
      return params
    }, { replace: true })
  }
  return { filters, applyFilters }
}
