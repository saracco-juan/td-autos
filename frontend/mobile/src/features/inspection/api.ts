import type { AuthFetch } from '../../lib/http'
import type { InspectionProgress, InspectionResponse } from '@shared/checklist/inspection/types'

// `request` is the session's authFetch (useAuth), so every call carries the bearer token.
export function fetchInspection(request: AuthFetch, vehicleId: number): Promise<InspectionResponse> {
  return request<InspectionResponse>(`/api/vehiculos/${vehicleId}/inspeccion`)
}

export function setItemCompleted(
  request: AuthFetch,
  vehicleId: number,
  code: string,
  completed: boolean,
): Promise<InspectionProgress> {
  return request<InspectionProgress>(`/api/vehiculos/${vehicleId}/inspeccion/items/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: { completado: completed },
  })
}

export function finishInspection(request: AuthFetch, vehicleId: number): Promise<InspectionProgress> {
  return request<InspectionProgress>(`/api/vehiculos/${vehicleId}/inspeccion/finalizar`, { method: 'POST' })
}
