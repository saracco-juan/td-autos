import { formatKilometers, formatPrice } from '@shared/recommendations/format'
import type { Vehiculo } from './types'

// Shared with the mobile app (frontend/shared).
export { formatKilometers, formatPrice, groupThousands } from '@shared/recommendations/format'

export function vehicleTitle({ marca, modelo, version, anio }: Vehiculo): string {
  return [marca, modelo, version, anio].filter((part) => part !== null && part !== '').join(' ')
}

// Second line of a row: Figma shows plate and image count; kilometres, price and location help tell units apart.
export function vehicleMeta(vehicle: Vehiculo): string {
  const count = vehicle.fotos.length
  return [
    vehicle.patente,
    `${count} ${count === 1 ? 'imagen' : 'imágenes'}`,
    formatKilometers(vehicle.kilometraje),
    formatPrice(vehicle.precio, vehicle.moneda),
    vehicle.ubicacion,
  ].join(' · ')
}
