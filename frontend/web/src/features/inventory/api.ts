import { apiFetch } from '../../lib/http'
import { fetchDiagnosis } from '../diagnosis/api'
import type { BodyType } from '../diagnosis/types'
import type { ImportCounts, Vehiculo, VehiculoResponse, VehiculosResponse } from './types'
import { normalizePlate, type VehicleValues } from './vehicleFields'

export async function fetchVehicles(): Promise<Vehiculo[]> {
  const response = await apiFetch<VehiculosResponse>('/api/concesionaria/vehiculos')
  return response.vehiculos
}

// The API answers 204 with no body; a vehicle that is not the dealer's (or is gone) answers 404.
export function deleteVehicle(id: number): Promise<void> {
  return apiFetch<void>(`/api/concesionaria/vehiculos/${id}`, { method: 'DELETE' })
}

export type VehicleSubmission = {
  values: VehicleValues
  // Files picked in this session, in the order they were added.
  newPhotos: File[]
  // Ids of the saved photos the dealer removed (edit only).
  removedPhotoIds: number[]
}

export function buildVehicleFormData({ values, newPhotos, removedPhotoIds }: VehicleSubmission): FormData {
  const data = new FormData()
  // Every field goes out, empty optionals too: on an edit the empty string is how the dealer clears them.
  for (const [name, value] of Object.entries(values)) {
    const text = value.trim()
    if (name === 'patente') data.append(name, normalizePlate(text))
    else if (name === 'precio') data.append(name, text.replace(',', '.'))
    else data.append(name, text)
  }
  for (const file of newPhotos) data.append('fotos[]', file)
  for (const id of removedPhotoIds) data.append('fotos_eliminar[]', String(id))
  return data
}

export async function fetchVehicle(id: number): Promise<Vehiculo> {
  const response = await apiFetch<VehiculoResponse>(`/api/concesionaria/vehiculos/${id}`)
  return response.vehiculo
}

export async function createVehicle(submission: VehicleSubmission): Promise<Vehiculo> {
  const response = await apiFetch<VehiculoResponse>('/api/concesionaria/vehiculos', {
    method: 'POST',
    body: buildVehicleFormData(submission),
  })
  return response.vehiculo
}

// Multipart cannot travel in a PUT (PHP does not parse it), so the update is a POST (D12).
export async function updateVehicle(id: number, submission: VehicleSubmission): Promise<Vehiculo> {
  const response = await apiFetch<VehiculoResponse>(`/api/concesionaria/vehiculos/${id}`, {
    method: 'POST',
    body: buildVehicleFormData(submission),
  })
  return response.vehiculo
}

// The body-type catalog has no endpoint of its own: it comes with the diagnosis, the same source the questionnaire uses.
export async function fetchBodyTypes(): Promise<BodyType[]> {
  const { carrocerias } = await fetchDiagnosis()
  return carrocerias
}

function sendImport(path: string, file: File): Promise<ImportCounts> {
  const data = new FormData()
  data.append('archivo', file)
  return apiFetch<ImportCounts>(path, { method: 'POST', body: data })
}

// Dry run of the CSV import: validates the whole file and counts what it would do, changing nothing.
export function previewImport(file: File): Promise<ImportCounts> {
  return sendImport('/api/concesionaria/vehiculos/importar/vista-previa', file)
}

// Applies the same file in one transaction: every row or none.
export function confirmImport(file: File): Promise<ImportCounts> {
  return sendImport('/api/concesionaria/vehiculos/importar', file)
}
