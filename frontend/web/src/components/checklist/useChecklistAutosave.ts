import { useCallback, useRef, useState } from 'react'
import type { ChecklistStep } from './types'

type Options = {
  steps: ChecklistStep[]
  // Writes one item. A rejection means the server did not take the value.
  save: (code: string, completed: boolean) => Promise<unknown>
  // Called with the step number when a save failed for good (after the revert), so the page can show that step.
  onSaveFailed?: (numero: number) => void
}

export function withCode(codes: string[], code: string, completed: boolean): string[] {
  const rest = codes.filter((current) => current !== code)
  return completed ? [...rest, code] : rest
}

// Optimistic per-item autosave shared by the checklist pages. The page is the source of truth while it is
// open: responses never replace the list. Each item has at most one request in flight (`draining`); the value
// the user wants now is `desired`, and `confirmed` is the last value the server acknowledged for it.
export function useChecklistAutosave({ steps, save, onSaveFailed }: Options) {
  const [completed, setCompleted] = useState<string[]>([])
  const [failedSteps, setFailedSteps] = useState<ReadonlySet<number>>(new Set())
  const desired = useRef(new Map<string, boolean>())
  const confirmed = useRef(new Map<string, boolean>())
  const draining = useRef(new Map<string, Promise<void>>())
  const failures = useRef(0)
  // The latest inputs, so a drain loop that outlives a render never works with stale ones.
  const latest = useRef({ steps, save, onSaveFailed })
  latest.current = { steps, save, onSaveFailed }

  // Takes the codes the server holds when the page opens.
  const load = useCallback((codes: string[]) => {
    confirmed.current = new Map(codes.map((code) => [code, true]))
    setCompleted(codes)
  }, [])

  const setStepFailed = (code: string, failed: boolean) => {
    const numero = latest.current.steps.find((step) => step.items.some((item) => item.codigo === code))?.numero
    if (numero === undefined) return
    setFailedSteps((current) => {
      const next = new Set(current)
      if (failed) next.add(numero)
      else next.delete(numero)
      return next
    })
    if (failed) latest.current.onSaveFailed?.(numero)
  }

  // Sends the desired value of one item, then again if the user changed their mind meanwhile.
  // Never two requests of the same item at once, so the server sees its writes in order.
  const drain = async (code: string) => {
    let force = false
    for (;;) {
      const value = desired.current.get(code)
      if (value === undefined || (!force && value === (confirmed.current.get(code) ?? false))) return
      force = false
      try {
        await latest.current.save(code, value)
        confirmed.current.set(code, value)
        setStepFailed(code, false)
      } catch {
        if (desired.current.get(code) !== value) {
          // The user wants something else now. A failed write leaves the server state unknown: send the new value.
          force = true
          continue
        }
        const last = confirmed.current.get(code) ?? false
        desired.current.set(code, last)
        failures.current += 1
        setCompleted((current) => withCode(current, code, last))
        setStepFailed(code, true)
        return
      }
    }
  }

  const toggle = (code: string, value: boolean) => {
    setCompleted((current) => withCode(current, code, value))
    desired.current.set(code, value)
    if (draining.current.has(code)) return
    const run = drain(code).finally(() => draining.current.delete(code))
    draining.current.set(code, run)
  }

  // Waits until no item has a request in flight (new ones may start while waiting).
  // Resolves false when a save failed meanwhile: its step shows the error and the page must not go on.
  const settle = async (): Promise<boolean> => {
    const failuresBefore = failures.current
    while (draining.current.size > 0) await Promise.all(draining.current.values())
    return failures.current === failuresBefore
  }

  return { completed, failedSteps, load, toggle, settle }
}
