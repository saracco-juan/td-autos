import type { AuthFetch } from '../../lib/http'
import type { VehicleDetailResponse } from './types'

// `request` is the session's authFetch (useAuth), so every call carries the bearer token.
export function fetchVehicleDetail(request: AuthFetch, id: number): Promise<VehicleDetailResponse> {
  return request<VehicleDetailResponse>(`/api/vehiculos/${id}`)
}

export function contactVehicle(request: AuthFetch, id: number, attemptId: string): Promise<{ url: string }> {
  return request<{ url: string }>(`/api/vehiculos/${id}/contacto`, {
    method: 'POST', body: { attempt_id: attemptId },
  })
}
