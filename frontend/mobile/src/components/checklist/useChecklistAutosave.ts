import { useEffect, useState } from 'react'
import { createChecklistAutosave, type ChecklistAutosaveInputs } from '@shared/checklist/autosave'

// React state around the shared autosave engine (frontend/shared/checklist/autosave.ts): optimistic per-item
// saves, one request per item at a time, revert and failed step on error, settle() before finishing.
export function useChecklistAutosave(inputs: ChecklistAutosaveInputs) {
  const [completed, setCompleted] = useState<string[]>([])
  const [failedSteps, setFailedSteps] = useState<ReadonlySet<number>>(new Set())
  // Created once per mounted screen: the engine owns the requests in flight.
  const [engine] = useState(() =>
    createChecklistAutosave({ onCompletedChange: setCompleted, onFailedStepsChange: setFailedSteps }, inputs),
  )

  // The engine always works with the catalog and callbacks of the last render.
  useEffect(() => {
    engine.update(inputs)
  })

  return { completed, failedSteps, load: engine.load, toggle: engine.toggle, settle: engine.settle }
}
