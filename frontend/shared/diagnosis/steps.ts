import type { DiagnosisAnswers, ScalarField } from './types'

export type StepOption<F extends ScalarField = ScalarField> = {
  code: DiagnosisAnswers[F]
  label: string
}

type StepBase = {
  title: string
  subtitle?: string
  summaryLabel: string
}

// One question with a single answer picked from fixed options.
export type SingleChoiceStep = {
  [F in ScalarField]: StepBase & {
    kind: 'single'
    field: F
    options: StepOption<F>[]
  }
}[ScalarField]

// The body-type question: options come from the server catalog, one or two may be chosen.
export type BodyTypeStep = StepBase & {
  kind: 'multi'
  field: 'carrocerias'
  min: number
  max: number
}

export type DiagnosisStep = SingleChoiceStep | BodyTypeStep

export const BODY_TYPE_MIN = 1
export const BODY_TYPE_MAX = 2

export const DIAGNOSIS_STEPS: readonly DiagnosisStep[] = [
  {
    kind: 'single',
    field: 'presupuesto',
    title: '¿Cuál es tu presupuesto máximo?',
    subtitle: 'Incluí solo el valor del vehículo. Los gastos de compra los calculamos después.',
    summaryLabel: 'Presupuesto',
    options: [
      { code: 'hasta_15m', label: 'Hasta $15.000.000' },
      { code: '15m_25m', label: '$15.000.000 a $25.000.000' },
      { code: '25m_40m', label: '$25.000.000 a $40.000.000' },
      { code: 'mas_40m', label: 'Más de $40.000.000' },
    ],
  },
  {
    kind: 'single',
    field: 'uso_principal',
    title: '¿Para qué vas a usar el auto principalmente?',
    subtitle: 'Elegí la opción que mejor describe tu uso habitual.',
    summaryLabel: 'Uso principal',
    options: [
      { code: 'ciudad', label: 'Ciudad y trayectos cortos' },
      { code: 'ruta', label: 'Viajes por ruta' },
      { code: 'mixto', label: 'Uso mixto' },
      { code: 'trabajo', label: 'Trabajo y carga' },
    ],
  },
  {
    kind: 'single',
    field: 'pasajeros',
    title: '¿Cuántas personas viajan habitualmente?',
    subtitle: 'Incluyendo al conductor.',
    summaryLabel: 'Pasajeros',
    options: [
      { code: '1_2', label: '1 o 2' },
      { code: '3_4', label: '3 o 4' },
      { code: '5_mas', label: '5 o más' },
    ],
  },
  {
    kind: 'single',
    field: 'kilometros_mensuales',
    title: '¿Cuántos kilómetros hacés por mes?',
    subtitle: 'Una estimación alcanza.',
    summaryLabel: 'Kilómetros mensuales',
    options: [
      { code: 'menos_500', label: 'Menos de 500 km' },
      { code: '500_1500', label: 'Entre 500 y 1.500 km' },
      { code: '1500_3000', label: 'Entre 1.500 y 3.000 km' },
      { code: 'mas_3000', label: 'Más de 3.000 km' },
      { code: 'no_sabe', label: 'No lo sé' },
    ],
  },
  {
    kind: 'single',
    field: 'transmision',
    title: '¿Qué transmisión preferís?',
    summaryLabel: 'Transmisión',
    options: [
      { code: 'manual', label: 'Manual' },
      { code: 'automatica', label: 'Automática' },
      { code: 'indiferente', label: 'Me da igual' },
    ],
  },
  {
    kind: 'single',
    field: 'prioridad',
    title: '¿Qué es lo más importante para vos?',
    subtitle: 'Elegí la prioridad que más pesa en tu decisión.',
    summaryLabel: 'Prioridad',
    options: [
      { code: 'consumo', label: 'Consumo bajo' },
      { code: 'seguridad', label: 'Seguridad' },
      { code: 'mantenimiento', label: 'Mantenimiento económico' },
      { code: 'reventa', label: 'Buena reventa' },
    ],
  },
  {
    kind: 'multi',
    field: 'carrocerias',
    title: '¿Qué tipo de carrocería preferís?',
    subtitle: 'Elegí una o dos opciones. Ambas pesan igual en la recomendación.',
    summaryLabel: 'Carrocería',
    min: BODY_TYPE_MIN,
    max: BODY_TYPE_MAX,
  },
]
