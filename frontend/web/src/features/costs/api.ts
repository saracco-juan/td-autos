import { apiFetch } from '../../lib/http'
import type { CostsQuery, OwnershipCosts } from '@shared/costs/types'

// Without a query the backend uses the km range of the diagnosis and the default coverage.
export function fetchCosts(vehicleId: number | string, query: CostsQuery = {}): Promise<OwnershipCosts> {
  const params = new URLSearchParams()
  if (query.km !== undefined) params.set('km', String(query.km))
  if (query.coverage !== undefined) params.set('cobertura', query.coverage)
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return apiFetch<OwnershipCosts>(`/api/vehiculos/${encodeURIComponent(String(vehicleId))}/costos${suffix}`)
}
