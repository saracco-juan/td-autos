import type { ChecklistStep } from '../types'
import type { TransferStage } from './types'

// The API marks the items the registry demands as `obligatorio`; the checklist kit calls that flag `flagged`.
export function toChecklistSteps(stages: TransferStage[]): ChecklistStep[] {
  return stages.map((stage) => ({
    ...stage,
    items: stage.items.map(({ codigo, texto, obligatorio }) => ({ codigo, texto, flagged: obligatorio })),
  }))
}
