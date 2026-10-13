import type { InspectionVehicle } from './types'

export const VEHICLE_FALLBACK_TITLE = 'Vehículo'

// `Toyota Corolla XEI 2021`; any part may be missing.
export function vehicleTitle(vehicle: Omit<InspectionVehicle, 'id'>): string {
  const title = [vehicle.marca, vehicle.modelo, vehicle.version, vehicle.anio]
    .map((part) => (part === null ? '' : String(part).trim()))
    .filter((part) => part !== '')
    .join(' ')

  return title === '' ? VEHICLE_FALLBACK_TITLE : title
}
