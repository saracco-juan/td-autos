import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

import { withCode, type ChecklistAutosaveInputs } from '@shared/checklist/autosave'
import { summarizeChecklist } from '@shared/checklist/progress'
import { useChecklistAutosave } from './useChecklistAutosave'

export type ChecklistView = 'checklist' | 'summary'

type Inputs = {
  steps: ChecklistAutosaveInputs['steps']
  save: ChecklistAutosaveInputs['save']
  // Marks the checklist as finished on the server.
  finish: () => Promise<unknown>
  // The warning shown while flagged items are pending, for that many items.
  warningFor: (pendingFlagged: number) => string
}

// The flow every checklist screen shares: autosave, selected step, checklist/summary view and the
// finish-with-pending-warning rules. The screens keep their loading and their own copy.
export function useChecklistFlow({ steps, save, finish, warningFor }: Inputs) {
  // Local UI state, not saved: the step shown in the panel. It survives a trip to the summary.
  const [selected, setSelected] = useState(1)
  const [view, setView] = useState<ChecklistView>('checklist')
  const [warningOpen, setWarningOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishFailed, setFinishFailed] = useState(false)
  const { completed, failedSteps, load, toggle, settle } = useChecklistAutosave({
    steps,
    save,
    // The step whose save failed is shown, so the reverted item and the error are visible.
    onSaveFailed: setSelected,
  })

  const progress = summarizeChecklist(steps, completed)
  const showWarning = warningOpen && progress.pendingFlagged > 0
  const warningText = showWarning ? warningFor(progress.pendingFlagged) : null

  // The warning appears above the pills, out of sight of a screen reader focused on the bar: announce it.
  useEffect(() => {
    if (warningText) AccessibilityInfo.announceForAccessibility(warningText)
  }, [warningText])

  const handleToggle = (code: string, value: boolean) => {
    if (summarizeChecklist(steps, withCode(completed, code, value)).pendingFlagged === 0) setWarningOpen(false)
    toggle(code, value)
  }

  const finishNow = async () => {
    if (finishing) return
    setFinishFailed(false)
    setFinishing(true)
    try {
      // A save failed meanwhile: its step shows the error and the user stays on the checklist.
      if (!(await settle())) return
      await finish()
      setWarningOpen(false)
      setView('summary')
    } catch {
      setFinishFailed(true)
    } finally {
      setFinishing(false)
    }
  }

  const requestFinish = () => {
    if (progress.pendingFlagged > 0) setWarningOpen(true)
    else void finishNow()
  }

  return {
    completed,
    failedSteps,
    load,
    selected,
    setSelected,
    view,
    setView,
    progress,
    showWarning,
    warningText,
    finishing,
    finishFailed,
    handleToggle,
    requestFinish,
    finishAnyway: () => void finishNow(),
    keepWorking: () => setWarningOpen(false),
  }
}

export type ChecklistFlow = ReturnType<typeof useChecklistFlow>
