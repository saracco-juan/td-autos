import type { ChecklistItem, ChecklistStep } from './types'

export type StepProgress = {
  numero: number
  titulo: string
  completed: number
  total: number
}

export type ChecklistSummary = {
  total: number
  completed: number
  // Every catalog item is ticked (false for an empty catalog).
  complete: boolean
  steps: StepProgress[]
  // Unticked items in catalog order.
  pending: ChecklistItem[]
  // Same items, flagged ones first; catalog order kept inside each group.
  pendingFlaggedFirst: ChecklistItem[]
  pendingFlagged: number
}

// Everything the counter, the step list and the summary cards render. Codes that are not in the
// catalog are ignored, so the counts never exceed the total.
export function summarizeChecklist(steps: ChecklistStep[], completedCodes: string[]): ChecklistSummary {
  const ticked = new Set(completedCodes)

  const stepProgress = steps.map((step) => ({
    numero: step.numero,
    titulo: step.titulo,
    completed: step.items.filter((item) => ticked.has(item.codigo)).length,
    total: step.items.length,
  }))
  const pending = steps.flatMap((step) => step.items).filter((item) => !ticked.has(item.codigo))
  const flagged = pending.filter((item) => item.flagged)

  const total = stepProgress.reduce((sum, step) => sum + step.total, 0)
  const completed = total - pending.length

  return {
    total,
    completed,
    complete: total > 0 && pending.length === 0,
    steps: stepProgress,
    pending,
    pendingFlaggedFirst: [...flagged, ...pending.filter((item) => !item.flagged)],
    pendingFlagged: flagged.length,
  }
}

// Flagged items still pending per step number; the steps with none are left out.
export function pendingFlaggedByStep(
  steps: ChecklistStep[],
  completedCodes: ReadonlySet<string>,
): Map<number, number> {
  const counts = new Map<number, number>()
  for (const step of steps) {
    const count = step.items.filter((item) => item.flagged && !completedCodes.has(item.codigo)).length
    if (count > 0) counts.set(step.numero, count)
  }
  return counts
}

// Items of the longest step (at least 1): the step panel is sized for it.
export const longestStepSize = (steps: ChecklistStep[]) => Math.max(1, ...steps.map((step) => step.items.length))
