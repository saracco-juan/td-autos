import { useEffect, useState } from 'react'
import { createChecklistAutosave } from '@shared/checklist/autosave'
import type { ChecklistStep } from '@shared/checklist/types'

type Options = {
  steps: ChecklistStep[]
  // Writes one item. A rejection means the server did not take the value.
  save: (code: string, completed: boolean) => Promise<unknown>
  // Called with the step number when a save failed for good (after the revert), so the page can show that step.
  onSaveFailed?: (numero: number) => void
}

// React state around the shared autosave engine (frontend/shared/checklist/autosave.ts), used by the checklist pages.
export function useChecklistAutosave({ steps, save, onSaveFailed }: Options) {
  const [completed, setCompleted] = useState<string[]>([])
  const [failedSteps, setFailedSteps] = useState<ReadonlySet<number>>(new Set())
  // One engine per mounted page: it holds the requests in flight.
  const [engine] = useState(() =>
    createChecklistAutosave(
      { onCompletedChange: setCompleted, onFailedStepsChange: setFailedSteps },
      { steps, save, onSaveFailed },
    ),
  )

  useEffect(() => {
    engine.update({ steps, save, onSaveFailed })
  })

  return { completed, failedSteps, load: engine.load, toggle: engine.toggle, settle: engine.settle }
}
