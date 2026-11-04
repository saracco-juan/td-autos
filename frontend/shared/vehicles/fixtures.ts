import type { DetailVehicle } from './detail'

export const vehicle: DetailVehicle = {
  id: 7, marca: 'Toyota', modelo: 'Corolla', version: 'XEI', anio: 2021,
  kilometraje: 62000, precio: 28900000, moneda: 'ARS', ubicacion: 'CABA',
  transmision: 'automatica', combustible: 'nafta', carroceria: 'Sedán',
  descripcion: 'Único dueño', motor: '2.0', potencia: 170, potencia_unidad: 'CV',
  plazas: 5, turbo: false, consumo_urbano: 8.5, consumo_ruta: 6,
  fotos: [{ id: 1, url: 'https://example.test/car.jpg', orden: 1 }],
}
