import type { Vehiculo } from './types'

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function searchInventory(vehicles: Vehiculo[], query: string): Vehiculo[] {
  const term = normalize(query.trim())
  if (!term) return vehicles

  return vehicles.filter((vehicle) =>
    [vehicle.marca, vehicle.modelo, vehicle.version ?? '', String(vehicle.anio), vehicle.patente]
      .some((value) => normalize(value).includes(term)),
  )
}
