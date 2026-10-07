import { describe, expect, it } from 'vitest'
import {
  UNANSWERED_STEP_MESSAGE,
  buildAnswers,
  createEmptyDraft,
  draftFromAnswers,
  isStepAnswered,
  summaryValue,
  toggleBodyType,
} from './diagnosisDraft'
import { DIAGNOSIS_STEPS } from './steps'
import type { BodyType, DiagnosisAnswers, DiagnosisDraft } from './types'

const bodyTypes: BodyType[] = [
  { id: 1, nombre: 'Sedán' },
  { id: 3, nombre: 'SUV' },
  { id: 4, nombre: 'Pickup' },
]

const answers: DiagnosisAnswers = {
  presupuesto: '15m_25m',
  uso_principal: 'mixto',
  pasajeros: '5_mas',
  kilometros_mensuales: '500_1500',
  transmision: 'automatica',
  prioridad: 'consumo',
  carrocerias: [3, 4],
}

const BODY_STEP = 6

describe('DIAGNOSIS_STEPS', () => {
  it('lists the seven questions in order', () => {
    expect(DIAGNOSIS_STEPS.map((step) => step.field)).toEqual([
      'presupuesto',
      'uso_principal',
      'pasajeros',
      'kilometros_mensuales',
      'transmision',
      'prioridad',
      'carrocerias',
    ])
  })

  it('gives every single-choice step its options, no subtitle to transmission, and bounds to body types', () => {
    const single = DIAGNOSIS_STEPS.slice(0, BODY_STEP)
    expect(single.every((step) => step.kind === 'single' && step.options.length >= 3)).toBe(true)
    expect(DIAGNOSIS_STEPS[4].subtitle).toBeUndefined()
    expect(DIAGNOSIS_STEPS[BODY_STEP]).toMatchObject({ kind: 'multi', min: 1, max: 2 })
  })
})

describe('isStepAnswered', () => {
  // TC-13: a required answer left empty does not let the user advance
  it('is false for every step of an empty draft', () => {
    const draft = createEmptyDraft()
    for (let step = 0; step < DIAGNOSIS_STEPS.length; step++) {
      expect(isStepAnswered(draft, step)).toBe(false)
    }
  })

  it('is true once a code is chosen on a single-choice step', () => {
    const draft: DiagnosisDraft = { ...createEmptyDraft(), presupuesto: 'hasta_15m' }
    expect(isStepAnswered(draft, 0)).toBe(true)
    expect(isStepAnswered(draft, 1)).toBe(false)
  })

  it('accepts one or two body types and rejects none', () => {
    const draft = createEmptyDraft()
    expect(isStepAnswered({ ...draft, carrocerias: [] }, BODY_STEP)).toBe(false)
    expect(isStepAnswered({ ...draft, carrocerias: [1] }, BODY_STEP)).toBe(true)
    expect(isStepAnswered({ ...draft, carrocerias: [1, 3] }, BODY_STEP)).toBe(true)
  })

  it('exposes the pending-question message', () => {
    expect(UNANSWERED_STEP_MESSAGE).toBe('Elegí una opción para continuar.')
  })
})

describe('toggleBodyType', () => {
  it('selects and deselects a body type', () => {
    const selected = toggleBodyType(createEmptyDraft(), 3)
    expect(selected.carrocerias).toEqual([3])
    expect(toggleBodyType(selected, 3).carrocerias).toEqual([])
  })

  it('ignores a third selection while two are chosen', () => {
    const full: DiagnosisDraft = { ...createEmptyDraft(), carrocerias: [1, 3] }
    expect(toggleBodyType(full, 4)).toBe(full)
  })

  it('lets the user deselect when two are chosen, then pick another', () => {
    const full: DiagnosisDraft = { ...createEmptyDraft(), carrocerias: [1, 3] }
    const one = toggleBodyType(full, 1)
    expect(one.carrocerias).toEqual([3])
    expect(toggleBodyType(one, 4).carrocerias).toEqual([3, 4])
  })

  it('does not mutate the draft it receives', () => {
    const draft = createEmptyDraft()
    toggleBodyType(draft, 1)
    expect(draft.carrocerias).toEqual([])
  })
})

describe('buildAnswers', () => {
  it('returns the complete payload when the seven steps are answered', () => {
    expect(buildAnswers(draftFromAnswers(answers))).toEqual({ ok: true, answers })
  })

  // TC-13: the screen jumps back to the first unanswered step
  it('reports the first unanswered step', () => {
    const draft: DiagnosisDraft = { ...draftFromAnswers(answers), pasajeros: null, prioridad: null }
    expect(buildAnswers(draft)).toEqual({ ok: false, firstUnansweredStep: 2 })
  })

  it('reports the body-type step when only that one is missing', () => {
    expect(buildAnswers({ ...draftFromAnswers(answers), carrocerias: [] })).toEqual({
      ok: false,
      firstUnansweredStep: BODY_STEP,
    })
  })

  // TC-14: the answer changed by the user is the one sent
  it('keeps the changed answer', () => {
    const draft: DiagnosisDraft = { ...draftFromAnswers(answers), transmision: 'manual' }
    expect(buildAnswers(draft)).toEqual({ ok: true, answers: { ...answers, transmision: 'manual' } })
  })
})

describe('draftFromAnswers and createEmptyDraft', () => {
  it('creates a draft with nothing answered', () => {
    expect(createEmptyDraft()).toEqual({
      presupuesto: null,
      uso_principal: null,
      pasajeros: null,
      kilometros_mensuales: null,
      transmision: null,
      prioridad: null,
      carrocerias: [],
    })
  })

  it('pre-fills the draft from saved answers without sharing the array', () => {
    const draft = draftFromAnswers(answers)
    expect(draft).toEqual(answers)
    expect(draft.carrocerias).not.toBe(answers.carrocerias)
  })
})

describe('summaryValue', () => {
  it('shows a dash for an unanswered step that is not the current one', () => {
    expect(summaryValue(createEmptyDraft(), 3, 0, bodyTypes)).toBe('—')
  })

  it('shows "En curso" for the unanswered current step', () => {
    expect(summaryValue(createEmptyDraft(), 0, 0, bodyTypes)).toBe('En curso')
  })

  it('shows the chosen label, also on the current step', () => {
    const draft = draftFromAnswers(answers)
    expect(summaryValue(draft, 0, 4, bodyTypes)).toBe('$15.000.000 a $25.000.000')
    expect(summaryValue(draft, 4, 4, bodyTypes)).toBe('Automática')
  })

  it('joins the chosen body-type names in catalog order', () => {
    const draft: DiagnosisDraft = { ...createEmptyDraft(), carrocerias: [4, 3] }
    expect(summaryValue(draft, BODY_STEP, 0, bodyTypes)).toBe('SUV, Pickup')
  })

  it('shows "En curso" on the body-type step with none chosen', () => {
    expect(summaryValue(createEmptyDraft(), BODY_STEP, BODY_STEP, bodyTypes)).toBe('En curso')
  })
})
