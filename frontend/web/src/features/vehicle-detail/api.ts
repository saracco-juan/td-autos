import { apiFetch } from '../../lib/http'
import type { VehicleDetailResponse } from './types'

export function fetchVehicleDetail(id: number): Promise<VehicleDetailResponse> {
  return apiFetch<VehicleDetailResponse>(`/api/vehiculos/${id}`)
}

export function contactVehicle(id: number): Promise<{ url: string }> {
  return apiFetch(`/api/vehiculos/${id}/contacto`, { method: 'POST' })
}
