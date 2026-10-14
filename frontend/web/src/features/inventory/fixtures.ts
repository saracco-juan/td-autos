import type { Vehiculo } from './types'

export function vehiculo(overrides: Partial<Vehiculo> = {}): Vehiculo {
  return {
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
