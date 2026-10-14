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
  moneda: 'ARS'
  transmision: Transmision
  combustible: Combustible
  carroceria: { id: number; nombre: string }
  ubicacion: string
  descripcion: string | null
  fotos: FotoVehiculo[]
}

export type VehiculosResponse = { vehiculos: Vehiculo[] }
