import type { Vehiculo, VehicleCatalog } from './types'
import { EQUIPMENT_FIELDS } from './matchingFields'

export const VEHICLE_CATALOG: VehicleCatalog = {
  snapshot_id: 'test', source_date: '2026-10-24', stale: false, warning: null,
  entries: [
    { id: 'selected-corolla', marca: 'Toyota', modelo: 'Corolla', version: 'XEI' },
    { id: 'selected-civic', marca: 'Honda', modelo: 'Civic', version: 'EX' },
  ],
}

// Synthetic, explicitly declared test facts; never inferred from the example model.
export const MATCHING_FACTS = {
  moneda: 'ARS' as const, plazas: 5, motor: '1.8', turbo: false, potencia: 140, potencia_unidad: 'CV' as const,
  consumo_urbano: 8, consumo_ruta: 6,
  ...Object.fromEntries(EQUIPMENT_FIELDS.map(([key]) => [key, false])),
}

export function vehiculo(overrides: Partial<Vehiculo> = {}): Vehiculo {
  return {
    ...MATCHING_FACTS,
    id: 1,
    patente: 'AB123CD',
    marca: 'Toyota',
    modelo: 'Corolla',
    version: 'XEI',
    anio: 2021,
    kilometraje: 60000,
    precio: 18500000,
    moneda: 'ARS',
    transmision: 'automatica',
    combustible: 'nafta',
    carroceria: { id: 2, nombre: 'Sedán' },
    ubicacion: 'Córdoba',
    descripcion: null,
    fotos: Array.from({ length: 7 }, (_, index) => ({
      id: index + 1,
      url: `http://localhost/storage/vehiculos/1/${index + 1}.jpg`,
      orden: index + 1,
    })),
    ...overrides,
  }
}

export const VEHICULOS: Vehiculo[] = [
  vehiculo(),
  vehiculo({
    id: 2,
    patente: 'AC456EF',
    marca: 'Fiat',
    modelo: 'Cronos',
    version: 'Drive',
    anio: 2022,
    kilometraje: 35000,
    precio: 14200000,
    ubicacion: 'Rosario',
  }),
]

// Body of the 403 that blocks the inventory of an inactive subscription (RF21).
export const INACTIVE_MESSAGE = 'Tu suscripción está inactiva. Subí el comprobante de renovación para volver a gestionar tu inventario.'

export function inactiveBody(overrides: Record<string, unknown> = {}) {
  return {
    message: INACTIVE_MESSAGE,
    code: 'subscription_inactive',
    suscripcion: { vigente_hasta: '2026-10-10', retencion_hasta: '2026-11-13' },
    vehiculos_conservados: 2,
    ...overrides,
  }
}

export const PAUSED_TEXT =
  'Tu suscripción venció el 10/10/2026 y terminó el período de gracia. Tus 2 vehículos no se publican, pero los conservamos hasta el 13/11/2026; después se eliminan definitivamente.'
export const PAUSED_HINT = 'Subí el comprobante de renovación: cuando se apruebe, vas a poder volver a gestionar tu inventario.'
