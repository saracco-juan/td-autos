import type { ChecklistStep } from './types'

// A small catalog in the neutral shape: five steps, some flagged items, hints on the first steps.
export const STEPS: ChecklistStep[] = [
  {
    numero: 1,
    titulo: 'Papeles del auto',
    ayuda: 'Pedile al vendedor la cédula y el título del auto.',
    items: [
      { codigo: 'papeles_titular', texto: 'El titular coincide con el vendedor', flagged: true },
      { codigo: 'papeles_vtv', texto: 'La VTV está vigente', flagged: false },
    ],
  },
  {
    numero: 2,
    titulo: 'Exterior',
    ayuda: 'Mirá el auto a la luz del día, en un piso parejo.',
    items: [
      { codigo: 'exterior_pintura', texto: 'La pintura es pareja', flagged: true },
      { codigo: 'exterior_luces', texto: 'Las luces funcionan', flagged: false },
    ],
  },
  {
    numero: 3,
    titulo: 'Motor',
    ayuda: 'Con el motor frío, fijate si hay manchas debajo del auto.',
    items: [
      { codigo: 'motor_perdidas', texto: 'No hay pérdidas de líquidos', flagged: true },
      { codigo: 'motor_aceite', texto: 'El aceite se ve limpio', flagged: false },
    ],
  },
  {
    numero: 4,
    titulo: 'Interior',
    ayuda: null,
    items: [
      { codigo: 'interior_testigos', texto: 'No hay testigos encendidos', flagged: false },
      { codigo: 'interior_kilometraje', texto: 'El kilometraje es coherente', flagged: false },
    ],
  },
  {
    numero: 5,
    titulo: 'Prueba de manejo',
    ayuda: null,
    items: [
      { codigo: 'manejo_frenos', texto: 'Los frenos responden bien', flagged: true },
      { codigo: 'manejo_caja', texto: 'La caja cambia sin tirones', flagged: false },
    ],
  },
]
