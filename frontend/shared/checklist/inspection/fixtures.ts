import type { InspectionResponse, InspectionStep, InspectionVehicle } from './types'

// A small catalog with the shape of the real one: five steps, some critical items, hints on the first steps.
export const STEPS: InspectionStep[] = [
  {
    numero: 1,
    titulo: 'Papeles del auto',
    ayuda: 'Pedile al vendedor la cédula y el título del auto.',
    items: [
      { codigo: 'papeles_titular', texto: 'El titular coincide con el vendedor', critico: true },
      { codigo: 'papeles_vtv', texto: 'La VTV está vigente', critico: false },
    ],
  },
  {
    numero: 2,
    titulo: 'Exterior',
    ayuda: 'Mirá el auto a la luz del día, en un piso parejo.',
    items: [
      { codigo: 'exterior_pintura', texto: 'La pintura es pareja', critico: true },
      { codigo: 'exterior_luces', texto: 'Las luces funcionan', critico: false },
    ],
  },
  {
    numero: 3,
    titulo: 'Motor',
    ayuda: 'Con el motor frío, fijate si hay manchas debajo del auto.',
    items: [
      { codigo: 'motor_perdidas', texto: 'No hay pérdidas de líquidos', critico: true },
      { codigo: 'motor_aceite', texto: 'El aceite se ve limpio', critico: false },
    ],
  },
  {
    numero: 4,
    titulo: 'Interior',
    ayuda: null,
    items: [
      { codigo: 'interior_testigos', texto: 'No hay testigos encendidos', critico: false },
      { codigo: 'interior_kilometraje', texto: 'El kilometraje es coherente', critico: false },
    ],
  },
  {
    numero: 5,
    titulo: 'Prueba de manejo',
    ayuda: null,
    items: [
      { codigo: 'manejo_frenos', texto: 'Los frenos responden bien', critico: true },
      { codigo: 'manejo_caja', texto: 'La caja cambia sin tirones', critico: false },
    ],
  },
]

export const CRITICAL_CODES = ['papeles_titular', 'exterior_pintura', 'motor_perdidas', 'manejo_frenos']

export const VEHICLE: InspectionVehicle = {
  id: 7,
  marca: 'Toyota',
  modelo: 'Corolla',
  version: 'XEI',
  anio: 2021,
}

export function inspectionResponse(overrides: Partial<InspectionResponse> = {}): InspectionResponse {
  return {
    vehiculo: VEHICLE,
    estado: null,
    pasos: STEPS,
    items_completados: [],
    ...overrides,
  }
}
