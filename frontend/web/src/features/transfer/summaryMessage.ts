import type { ChecklistSummary } from '@shared/checklist/progress'

export type SummaryMessage = { tone: 'success' | 'warning'; text: string }

// The box under the header of the summary (Figma 2319:5308, 2319:5429 and 2319:5545).
export function summaryMessage(progress: ChecklistSummary): SummaryMessage {
  const pending = progress.pending.length
  const mandatory = progress.pendingFlagged

  if (pending === 0) {
    return { tone: 'success', text: `Trámite completo: completaste los ${progress.total} pasos.` }
  }

  const left = pending === 1 ? 'te queda 1 paso sin completar' : `te quedan ${pending} pasos sin completar`
  const prefix = 'Trámite incompleto:'
  if (mandatory === 0) return { tone: 'warning', text: `${prefix} ${left}.` }
  // The only pending step is mandatory: say so instead of "1 de ellos obligatorio".
  if (pending === 1) return { tone: 'warning', text: `${prefix} ${left}, y es obligatorio.` }

  const ofThem = mandatory === 1 ? '1 de ellos obligatorio' : `${mandatory} de ellos obligatorios`
  return { tone: 'warning', text: `${prefix} ${left}, ${ofThem}.` }
}
