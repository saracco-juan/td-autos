// The words of the inspection checklist, identical on web and mobile.
export const FLAG_LABEL = 'CRÍTICO'

export const EYEBROW = 'CHECKLIST DE INSPECCIÓN'

export const BACK_TO_SHEET = 'Volver a la ficha'

export const SAVE_ERROR = 'No pudimos guardar el cambio. Probá de nuevo.'

export const NOT_FOUND_TITLE = 'No encontramos este vehículo.'

export const NOT_FOUND_LINK = 'Volver al inicio'

// Button and alert texts of the checklist action bar (mobile has no PASO ANTERIOR).
export const ACTION_LABELS = {
  previous: 'PASO ANTERIOR',
  next: 'PASO SIGUIENTE',
  finish: 'FINALIZAR',
  finishAnyway: 'FINALIZAR IGUAL',
  keepWorking: 'SEGUIR REVISANDO',
  finishError: 'No pudimos finalizar la inspección. Probá de nuevo.',
}

// Buttons and card titles of the summary view.
export const SUMMARY_LABELS = {
  backToSheet: 'VOLVER A LA FICHA',
  keepReviewing: 'SEGUIR REVISANDO',
  progressTitle: 'Avance por paso',
  pendingCriticalTitle: 'Puntos críticos pendientes',
  pendingCriticalHint: 'Son los que más pesan a la hora de decidir.',
  pendingTitle: 'Puntos pendientes',
}

// `3 de 10 puntos revisados`, under the vehicle title.
export const reviewedCounter = (completed: number, total: number) => `${completed} de ${total} puntos revisados`

// Accessible text of the marker on a step with critical items pending.
export const pendingMarkerLabel = (count: number) =>
  count === 1 ? '1 crítico pendiente' : `${count} críticos pendientes`

// The alert shown when the user tries to finish with critical items pending.
export function criticalWarning(count: number): string {
  return count === 1
    ? 'Te queda 1 punto crítico sin revisar. Es el que más pesa a la hora de decidir: revisalo antes de terminar.'
    : `Te quedan ${count} puntos críticos sin revisar. Son los que más pesan a la hora de decidir: revisalos antes de terminar.`
}
