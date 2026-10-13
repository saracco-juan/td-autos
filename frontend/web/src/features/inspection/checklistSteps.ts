import type { ChecklistStep } from '../../components/checklist/types'
import type { InspectionStep } from './types'

// The API marks the items that weigh most as `critico`; the checklist kit calls that flag `flagged`.
export function toChecklistSteps(steps: InspectionStep[]): ChecklistStep[] {
  return steps.map((step) => ({
    ...step,
    items: step.items.map(({ codigo, texto, critico }) => ({ codigo, texto, flagged: critico })),
  }))
}
