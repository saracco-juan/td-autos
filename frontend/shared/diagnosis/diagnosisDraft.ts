import { BODY_TYPE_MAX, DIAGNOSIS_STEPS } from './steps'
import type { BodyType, DiagnosisAnswers, DiagnosisDraft } from './types'

// Shown under the options when the user tries to continue without answering (TC-13).
export const UNANSWERED_STEP_MESSAGE = 'Elegí una opción para continuar.'

export const SUMMARY_UNANSWERED = '—'
export const SUMMARY_IN_PROGRESS = 'En curso'

export type BuildAnswersResult =
  { ok: true; answers: DiagnosisAnswers } | { ok: false; firstUnansweredStep: number }

export function createEmptyDraft(): DiagnosisDraft {
  return {
    presupuesto: null,
    uso_principal: null,
    pasajeros: null,
    kilometros_mensuales: null,
    transmision: null,
    prioridad: null,
    carrocerias: [],
  }
}

// Pre-fills the questionnaire with the saved answers (re-entry).
export function draftFromAnswers(answers: DiagnosisAnswers): DiagnosisDraft {
  return { ...answers, carrocerias: [...answers.carrocerias] }
}

export function isStepAnswered(draft: DiagnosisDraft, stepIndex: number): boolean {
  const step = DIAGNOSIS_STEPS[stepIndex]
  if (step.kind === 'multi') {
    return draft.carrocerias.length >= step.min && draft.carrocerias.length <= step.max
  }
  return draft[step.field] !== null
}

// Selects or deselects a body type. A third selection is ignored while two are chosen
// (the same draft is returned); deselecting always works.
export function toggleBodyType(draft: DiagnosisDraft, id: number): DiagnosisDraft {
  if (draft.carrocerias.includes(id)) {
    return { ...draft, carrocerias: draft.carrocerias.filter((chosen) => chosen !== id) }
  }
  if (draft.carrocerias.length >= BODY_TYPE_MAX) return draft
  return { ...draft, carrocerias: [...draft.carrocerias, id] }
}

// Turns the draft into the payload only when the seven steps are valid; otherwise
// reports the first unanswered step so the screen can jump back to it.
export function buildAnswers(draft: DiagnosisDraft): BuildAnswersResult {
  const firstUnansweredStep = DIAGNOSIS_STEPS.findIndex((_, index) => !isStepAnswered(draft, index))
  if (firstUnansweredStep !== -1) return { ok: false, firstUnansweredStep }

  return {
    ok: true,
    answers: {
      presupuesto: draft.presupuesto!,
      uso_principal: draft.uso_principal!,
      pasajeros: draft.pasajeros!,
      kilometros_mensuales: draft.kilometros_mensuales!,
      transmision: draft.transmision!,
      prioridad: draft.prioridad!,
      carrocerias: [...draft.carrocerias],
    },
  }
}

// Value of one row of the summary card: the chosen label (also on the current step),
// `En curso` when the current step is still unanswered, `—` for any other unanswered step.
export function summaryValue(
  draft: DiagnosisDraft,
  stepIndex: number,
  currentStep: number,
  bodyTypes: BodyType[],
): string {
  if (!isStepAnswered(draft, stepIndex)) {
    return stepIndex === currentStep ? SUMMARY_IN_PROGRESS : SUMMARY_UNANSWERED
  }

  const step = DIAGNOSIS_STEPS[stepIndex]
  if (step.kind === 'multi') {
    return bodyTypes
      .filter((bodyType) => draft.carrocerias.includes(bodyType.id))
      .map((bodyType) => bodyType.nombre)
      .join(', ')
  }

  const code = draft[step.field]
  return step.options.find((option) => option.code === code)?.label ?? SUMMARY_UNANSWERED
}
