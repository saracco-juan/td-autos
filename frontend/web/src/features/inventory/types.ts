import type { MatchingFacts } from './matchingFields'

export type Transmision = 'manual' | 'automatica'
export type Combustible = 'nafta' | 'diesel' | 'gnc' | 'hibrido' | 'electrico'

export type FotoVehiculo = { id: number; url: string; orden: number }

// A vehicle of the signed-in dealer, as GET /api/concesionaria/vehiculos sends it.
export type Vehiculo = {
  id: number
  patente: string
  marca: string
  modelo: string
  version: string | null
  anio: number
  kilometraje: number
  precio: number
  moneda: 'ARS' | 'USD'
  transmision: Transmision
  combustible: Combustible
  carroceria: { id: number; nombre: string } | null
  ubicacion: string
  descripcion: string | null
  fotos: FotoVehiculo[]
} & Partial<MatchingFacts>

export type VehiculosResponse = { vehiculos: Vehiculo[] }
export type VehiculoResponse = { vehiculo: Vehiculo }

// What both CSV import endpoints answer: how many vehicles the file creates and how many it updates.
export type ImportCounts = { nuevos: number; actualizaciones: number }
