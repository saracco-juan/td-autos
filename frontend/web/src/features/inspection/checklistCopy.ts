import type { ChecklistActionLabels } from '../../components/checklist/ChecklistActionBar'

// The words the inspection puts on the shared checklist components.
export const FLAG_LABEL = 'CRÍTICO'

export const SAVE_ERROR = 'No pudimos guardar el cambio. Probá de nuevo.'

export const ACTION_LABELS: ChecklistActionLabels = {
  previous: 'PASO ANTERIOR',
  next: 'PASO SIGUIENTE',
  finish: 'FINALIZAR',
  finishAnyway: 'FINALIZAR IGUAL',
  keepWorking: 'SEGUIR REVISANDO',
  finishError: 'No pudimos finalizar la inspección. Probá de nuevo.',
}

// Accessible text of the marker on a step with critical items pending.
export const pendingMarkerLabel = (count: number) =>
  count === 1 ? '1 crítico pendiente' : `${count} críticos pendientes`
