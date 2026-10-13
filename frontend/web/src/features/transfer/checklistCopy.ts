import type { ChecklistActionLabels } from '../../components/checklist/ChecklistActionBar'

// The words the transfer checklist puts on the shared checklist components.
export const FLAG_LABEL = 'OBLIGATORIO'

export const SAVE_ERROR = 'No pudimos guardar el cambio. Probá de nuevo.'

export const SOURCE_NOTE =
  'Guía orientativa. Fuente: Dirección Nacional de los Registros de la Propiedad del Automotor (DNRPA). Verificá los requisitos vigentes en tu registro antes de iniciar el trámite.'

export const ACTION_LABELS: ChecklistActionLabels = {
  previous: 'ETAPA ANTERIOR',
  next: 'ETAPA SIGUIENTE',
  finish: 'FINALIZAR',
  finishAnyway: 'FINALIZAR IGUAL',
  keepWorking: 'SEGUIR COMPLETANDO',
  finishError: 'No pudimos finalizar el checklist. Probá de nuevo.',
}

// Accessible text of the marker on a stage with mandatory items pending.
export const pendingMarkerLabel = (count: number) =>
  count === 1 ? '1 paso obligatorio pendiente' : `${count} pasos obligatorios pendientes`

export function mandatoryWarning(count: number): string {
  return count === 1
    ? 'Te queda 1 paso obligatorio sin completar. El registro lo exige para hacer la transferencia: completalo antes de terminar.'
    : `Te quedan ${count} pasos obligatorios sin completar. El registro los exige para hacer la transferencia: completalos antes de terminar.`
}
