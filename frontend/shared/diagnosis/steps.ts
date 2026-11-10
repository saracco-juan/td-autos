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

type StepText = Pick<StepBase, 'title' | 'subtitle' | 'summaryLabel'>

// Options are written as [code, label] pairs: the catalog stays compact and each step reads as one block.
function singleChoice<F extends ScalarField>(
  field: F,
  text: StepText,
  options: readonly (readonly [DiagnosisAnswers[F], string])[],
): SingleChoiceStep {
  const step = { kind: 'single' as const, field, ...text, options: options.map(([code, label]) => ({ code, label })) }
  // TS cannot match a generic F against the per-field union; the shape is the same.
  return step as SingleChoiceStep
}

export const DIAGNOSIS_STEPS: readonly DiagnosisStep[] = [
  singleChoice(
    'presupuesto',
    {
      title: '¿Cuál es tu presupuesto máximo?',
      subtitle: 'Incluí solo el valor del vehículo. Los gastos de compra los calculamos después.',
      summaryLabel: 'Presupuesto',
    },
    [
      ['hasta_15m', 'Hasta $15.000.000'],
      ['15m_25m', '$15.000.000 a $25.000.000'],
      ['25m_40m', '$25.000.000 a $40.000.000'],
      ['mas_40m', 'Más de $40.000.000'],
    ],
  ),
  singleChoice(
    'uso_principal',
    {
      title: '¿Para qué vas a usar el auto principalmente?',
      subtitle: 'Elegí la opción que mejor describe tu uso habitual.',
      summaryLabel: 'Uso principal',
    },
    [
      ['ciudad', 'Ciudad y trayectos cortos'],
      ['ruta', 'Viajes por ruta'],
      ['mixto', 'Uso mixto'],
      ['trabajo', 'Trabajo y carga'],
    ],
  ),
  singleChoice(
    'pasajeros',
    { title: '¿Cuántas personas viajan habitualmente?', subtitle: 'Incluyendo al conductor.', summaryLabel: 'Pasajeros' },
    [
      ['1_2', '1 o 2'],
      ['3_4', '3 o 4'],
      ['5', '5'],
      ['mas_5', 'Más de 5'],
    ],
  ),
  singleChoice(
    'kilometros_mensuales',
    {
      title: '¿Cuántos kilómetros hacés por mes?',
      subtitle: 'Una estimación alcanza.',
      summaryLabel: 'Kilómetros mensuales',
    },
    [
      ['menos_500', 'Menos de 500 km'],
      ['500_1500', 'Entre 500 y 1.500 km'],
      ['1500_3000', 'Entre 1.500 y 3.000 km'],
      ['mas_3000', 'Más de 3.000 km'],
      ['no_sabe', 'No lo sé'],
    ],
  ),
  singleChoice('transmision', { title: '¿Qué transmisión preferís?', summaryLabel: 'Transmisión' }, [
    ['manual', 'Manual'],
    ['automatica', 'Automática'],
    ['indiferente', 'Me da igual'],
  ]),
  singleChoice(
    'prioridad',
    {
      title: '¿Qué es lo más importante para vos?',
      subtitle: 'Elegí la prioridad que más pesa en tu decisión.',
      summaryLabel: 'Prioridad',
    },
    [
      ['consumo', 'Consumo bajo'],
      ['seguridad', 'Seguridad'],
      ['mantenimiento', 'Mantenimiento económico'],
      ['reventa', 'Buena reventa'],
    ],
  ),
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
