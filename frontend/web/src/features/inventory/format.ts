import type { Vehiculo } from './types'

// Thousands with a dot (Argentine style); done by hand so it does not depend on the ICU data of the runtime.
export function groupThousands(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function vehicleTitle({ marca, modelo, version, anio }: Vehiculo): string {
  return [marca, modelo, version, anio].filter((part) => part !== null && part !== '').join(' ')
}

export function formatKilometers(value: number): string {
  return `${groupThousands(value)} km`
}

export function formatPrice(value: number, currency: Vehiculo['moneda'] = 'ARS'): string {
  return `${currency === 'USD' ? 'US$' : '$'} ${groupThousands(value)}`
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
