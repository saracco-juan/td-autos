import { apiFetch } from '../../lib/http'
import type { InspectionProgress, InspectionResponse } from './types'

export function fetchInspection(vehicleId: number): Promise<InspectionResponse> {
  return apiFetch<InspectionResponse>(`/api/vehiculos/${vehicleId}/inspeccion`)
}

export function setItemCompleted(
  vehicleId: number,
  code: string,
  completed: boolean,
): Promise<InspectionProgress> {
  return apiFetch<InspectionProgress>(
    `/api/vehiculos/${vehicleId}/inspeccion/items/${encodeURIComponent(code)}`,
    { method: 'PUT', body: { completado: completed } },
  )
}

export function finishInspection(vehicleId: number): Promise<InspectionProgress> {
  return apiFetch<InspectionProgress>(`/api/vehiculos/${vehicleId}/inspeccion/finalizar`, {
    method: 'POST',
  })
}
