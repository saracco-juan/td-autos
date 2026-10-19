import type { ChecklistStep } from './types'

// What the screen may change between renders; the engine always uses the latest ones it was given.
export type ChecklistAutosaveInputs = {
  steps: ChecklistStep[]
  // Writes one item. A rejection means the server did not take the value.
  save: (code: string, completed: boolean) => Promise<unknown>
  // Called with the step number when a save failed for good (after the revert), so the screen can show that step.
  onSaveFailed?: (numero: number) => void
}

// Where the engine publishes its state (the screen's state setters).
export type ChecklistAutosaveListeners = {
  // The ticked codes changed (optimistic toggle, load, or revert after a failed save).
  onCompletedChange: (codes: string[]) => void
  // The steps whose last save failed changed.
  onFailedStepsChange: (steps: ReadonlySet<number>) => void
}

export type ChecklistAutosave = {
  // Hands over the latest inputs, so a drain loop that outlives a render never works with stale ones.
  update: (inputs: ChecklistAutosaveInputs) => void
  // Takes the codes the server holds when the screen opens.
  load: (codes: string[]) => void
  toggle: (code: string, value: boolean) => void
  // Waits until no item has a request in flight. Resolves false when a save failed meanwhile.
  settle: () => Promise<boolean>
}

export function withCode(codes: string[], code: string, completed: boolean): string[] {
  const rest = codes.filter((current) => current !== code)
  return completed ? [...rest, code] : rest
}

// Optimistic per-item autosave, framework-free so web and mobile wrap it in their own hook. The screen is the
// source of truth while it is open: responses never replace the list. Each item has at most one request in
// flight (`draining`); the value the user wants now is `desired`, and `confirmed` is the last value the server
// acknowledged for it.
export function createChecklistAutosave(
  listeners: ChecklistAutosaveListeners,
  initialInputs: ChecklistAutosaveInputs,
): ChecklistAutosave {
  let inputs = initialInputs
  let completed: string[] = []
  let failedSteps: ReadonlySet<number> = new Set()
  let confirmed = new Map<string, boolean>()
  const desired = new Map<string, boolean>()
  const draining = new Map<string, Promise<void>>()
  let failures = 0

  const setCompleted = (codes: string[]) => {
    completed = codes
    listeners.onCompletedChange(codes)
  }

  const setStepFailed = (code: string, failed: boolean) => {
    const numero = inputs.steps.find((step) => step.items.some((item) => item.codigo === code))?.numero
    if (numero === undefined) return
    if (failedSteps.has(numero) !== failed) {
      const next = new Set(failedSteps)
      if (failed) next.add(numero)
      else next.delete(numero)
      failedSteps = next
      listeners.onFailedStepsChange(next)
    }
    if (failed) inputs.onSaveFailed?.(numero)
  }

  // Sends the desired value of one item, then again if the user changed their mind meanwhile.
  // Never two requests of the same item at once, so the server sees its writes in order.
  const drain = async (code: string) => {
    let force = false
    for (;;) {
      const value = desired.get(code)
      if (value === undefined || (!force && value === (confirmed.get(code) ?? false))) return
      force = false
      try {
        await inputs.save(code, value)
        confirmed.set(code, value)
        setStepFailed(code, false)
      } catch {
        if (desired.get(code) !== value) {
          // The user wants something else now. A failed write leaves the server state unknown: send the new value.
          force = true
          continue
        }
        const last = confirmed.get(code) ?? false
        desired.set(code, last)
        failures += 1
        setCompleted(withCode(completed, code, last))
        setStepFailed(code, true)
        return
      }
    }
  }

  return {
    update: (next) => {
      inputs = next
    },
    load: (codes) => {
      confirmed = new Map(codes.map((code) => [code, true]))
      setCompleted(codes)
    },
    toggle: (code, value) => {
      setCompleted(withCode(completed, code, value))
      desired.set(code, value)
      if (draining.has(code)) return
      const run = drain(code).finally(() => draining.delete(code))
      draining.set(code, run)
    },
    // New requests may start while waiting; a failure meanwhile leaves its step showing the error.
    settle: async () => {
      const failuresBefore = failures
      while (draining.size > 0) await Promise.all(draining.values())
      return failures === failuresBefore
    },
  }
}
