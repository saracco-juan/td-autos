import type { AuthFetch } from '../../lib/http'
import type { CostsQuery, OwnershipCosts } from '@shared/costs/types'

// Without a query the backend uses the km range of the diagnosis and the default coverage.
// `request` is the session's authFetch (useAuth), so every call carries the bearer token.
export function fetchCosts(request: AuthFetch, vehicleId: number, query: CostsQuery = {}): Promise<OwnershipCosts> {
  const params = new URLSearchParams()
  if (query.km !== undefined) params.set('km', String(query.km))
  if (query.coverage !== undefined) params.set('cobertura', query.coverage)
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return request<OwnershipCosts>(`/api/vehiculos/${vehicleId}/costos${suffix}`)
}
