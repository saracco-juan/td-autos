import { apiFetch } from '../../lib/http'
import type { Vehiculo, VehiculosResponse } from './types'

export async function fetchVehicles(): Promise<Vehiculo[]> {
  const response = await apiFetch<VehiculosResponse>('/api/concesionaria/vehiculos')
  return response.vehiculos
}

// The API answers 204 with no body; a vehicle that is not the dealer's (or is gone) answers 404.
export function deleteVehicle(id: number): Promise<void> {
  return apiFetch<void>(`/api/concesionaria/vehiculos/${id}`, { method: 'DELETE' })
}
