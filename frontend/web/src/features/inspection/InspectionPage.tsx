import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import screenStyles from '../../components/screen.module.css'
import { HttpError, NetworkError } from '../../lib/http'
import SessionLoading from '../auth/session/SessionLoading'
import { fetchInspection, finishInspection, setItemCompleted } from './api'
import InspectionHeader from './InspectionHeader'
import styles from './InspectionPage.module.css'
import InspectionStepCard from './InspectionStepCard'
import InspectionSummary from './InspectionSummary'
import { summarizeInspection, vehicleTitle } from './progress'
import type { InspectionStep, InspectionVehicle } from './types'
import VehicleNotFound from './VehicleNotFound'

const FINISH_ERROR = 'No pudimos finalizar la inspección. Probá de nuevo.'

type LoadState = 'loading' | 'ready' | 'not-found' | { error: ErrorKind }
type View = 'checklist' | 'summary'
type Content = { vehicle: InspectionVehicle; steps: InspectionStep[] }

// Only a positive integer can be a vehicle id; anything else never reaches the API.
function parseVehicleId(raw: string | undefined): number | null {
  return raw !== undefined && /^[1-9]\d*$/.test(raw) ? Number(raw) : null
}

function withCode(codes: string[], code: string, completed: boolean): string[] {
  const rest = codes.filter((current) => current !== code)
  return completed ? [...rest, code] : rest
}

// Only the first step that still has pending items starts open; with everything ticked all start closed.
function initialOpenSteps(steps: InspectionStep[], completedCodes: string[]): Set<number> {
  const ticked = new Set(completedCodes)
  const first = steps.find((step) => step.items.some((item) => !ticked.has(item.codigo)))
  return new Set(first ? [first.numero] : [])
}

function criticalWarning(count: number): string {
  return count === 1
    ? 'Te queda 1 punto crítico sin revisar. Es el que más pesa a la hora de decidir: revisalo antes de terminar.'
    : `Te quedan ${count} puntos críticos sin revisar. Son los que más pesan a la hora de decidir: revisalos antes de terminar.`
}

export default function InspectionPage() {
  const vehicleId = parseVehicleId(useParams().id)

  if (vehicleId === null) return <VehicleNotFound />

  // The key restarts the whole screen when the route points to another vehicle.
  return <InspectionScreen key={vehicleId} vehicleId={vehicleId} />
}

function InspectionScreen({ vehicleId }: { vehicleId: number }) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [content, setContent] = useState<Content | null>(null)
  // The page is the source of truth while it is open: responses never replace this list.
  const [completed, setCompleted] = useState<string[]>([])
  const [failedSteps, setFailedSteps] = useState<ReadonlySet<number>>(new Set())
  const [openSteps, setOpenSteps] = useState<ReadonlySet<number>>(new Set())
  const [view, setView] = useState<View>('checklist')
  const [warningOpen, setWarningOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishFailed, setFinishFailed] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const warningRef = useRef<HTMLParagraphElement>(null)
  const viewChanged = useRef(false)
  // Per-item sync state. Each item has at most one request in flight (`draining`); the value the user
  // wants now is `desired`, and `confirmed` is the last value the server acknowledged for it.
  const desired = useRef(new Map<string, boolean>())
  const confirmed = useRef(new Map<string, boolean>())
  const draining = useRef(new Map<string, Promise<void>>())
  const failures = useRef(0)

  useEffect(() => {
    let cancelled = false
    fetchInspection(vehicleId)
      .then((inspection) => {
        if (cancelled) return
        confirmed.current = new Map(inspection.items_completados.map((code) => [code, true]))
        setContent({ vehicle: inspection.vehiculo, steps: inspection.pasos })
        setCompleted(inspection.items_completados)
        setOpenSteps(initialOpenSteps(inspection.pasos, inspection.items_completados))
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof HttpError && error.status === 404) setLoadState('not-found')
        else setLoadState({ error: error instanceof NetworkError ? 'network' : 'server' })
      })
    return () => {
      cancelled = true
    }
  }, [vehicleId])

  // After a view change the title takes the focus, so the new content is announced.
  useEffect(() => {
    if (!viewChanged.current) return
    viewChanged.current = false
    titleRef.current?.focus()
  }, [view])

  const steps = content?.steps ?? []
  const progress = summarizeInspection(steps, completed)
  const showWarning = warningOpen && progress.pendingCritical > 0

  useEffect(() => {
    if (showWarning) warningRef.current?.focus()
  }, [showWarning])

  const changeView = (next: View) => {
    viewChanged.current = true
    setView(next)
  }

  const setStepOpen = (numero: number, open: boolean) =>
    setOpenSteps((current) => {
      const next = new Set(current)
      if (open) next.add(numero)
      else next.delete(numero)
      return next
    })

  const setStepFailed = (code: string, failed: boolean) => {
    const numero = steps.find((step) => step.items.some((item) => item.codigo === code))?.numero
    if (numero === undefined) return
    setFailedSteps((current) => {
      const next = new Set(current)
      if (failed) next.add(numero)
      else next.delete(numero)
      return next
    })
    // A step whose save failed must show its error.
    if (failed) setStepOpen(numero, true)
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
        await setItemCompleted(vehicleId, code, value)
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

  const handleToggle = (code: string, value: boolean) => {
    if (summarizeInspection(steps, withCode(completed, code, value)).pendingCritical === 0) setWarningOpen(false)
    setCompleted((current) => withCode(current, code, value))
    desired.current.set(code, value)
    if (draining.current.has(code)) return
    const run = drain(code).finally(() => draining.current.delete(code))
    draining.current.set(code, run)
  }

  // Waits until no item has a request in flight (new ones may start while waiting).
  const settleSaves = async () => {
    while (draining.current.size > 0) await Promise.all(draining.current.values())
  }

  const handleFinish = async () => {
    if (finishing) return
    setFinishFailed(false)
    setFinishing(true)
    try {
      const failuresBefore = failures.current
      await settleSaves()
      // A save failed meanwhile: its step shows the error and the user stays on the checklist.
      if (failures.current !== failuresBefore) return
      await finishInspection(vehicleId)
      setWarningOpen(false)
      changeView('summary')
    } catch {
      setFinishFailed(true)
    } finally {
      setFinishing(false)
    }
  }

  const handleFinishRequest = () => {
    if (progress.pendingCritical > 0) {
      setWarningOpen(true)
      // Open every step that still has a critical item pending, so the user sees what is missing.
      const ticked = new Set(completed)
      setOpenSteps(
        (current) =>
          new Set([
            ...current,
            ...steps
              .filter((step) => step.items.some((item) => item.critico && !ticked.has(item.codigo)))
              .map((step) => step.numero),
          ]),
      )
    } else void handleFinish()
  }

  // The loader is a direct child of the content area so it is centered there, not inside the page column.
  if (loadState === 'loading') return <SessionLoading />
  if (loadState === 'not-found') return <VehicleNotFound />
  if (typeof loadState === 'object') return <ErrorState kind={loadState.error} />
  if (!content) return <SessionLoading />

  if (view === 'summary') {
    return (
      <InspectionSummary
        vehicle={content.vehicle}
        steps={content.steps}
        completedCodes={completed}
        onKeepReviewing={() => changeView('checklist')}
        titleRef={titleRef}
      />
    )
  }

  const completedCodes = new Set(completed)

  return (
    <div className={screenStyles.page}>
      <InspectionHeader
        vehicleId={vehicleId}
        title={vehicleTitle(content.vehicle)}
        completed={progress.completed}
        total={progress.total}
        titleRef={titleRef}
      />

      {showWarning ? (
        <p ref={warningRef} tabIndex={-1} role="alert" className={`${alertStyles.warning} ${styles.warning}`}>
          {criticalWarning(progress.pendingCritical)}
        </p>
      ) : null}

      <div className={styles.grid}>
        {content.steps.map((step) => (
          <InspectionStepCard
            key={step.numero}
            step={step}
            completedCodes={completedCodes}
            open={openSteps.has(step.numero)}
            saveFailed={failedSteps.has(step.numero)}
            onToggleOpen={() => setStepOpen(step.numero, !openSteps.has(step.numero))}
            onToggle={handleToggle}
          />
        ))}
      </div>

      <div className={styles.footer}>
        {finishFailed ? (
          <p role="alert" className={`${alertStyles.alert} ${styles.footerMessage}`}>
            {FINISH_ERROR}
          </p>
        ) : null}
        <div className={styles.actions}>
          {showWarning ? (
            <>
              <button
                type="button"
                disabled={finishing}
                aria-busy={finishing}
                className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.action}`}
                onClick={() => void handleFinish()}
              >
                {finishing ? 'FINALIZANDO…' : 'FINALIZAR IGUAL'}
              </button>
              <button
                type="button"
                disabled={finishing}
                className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.action}`}
                onClick={() => setWarningOpen(false)}
              >
                SEGUIR REVISANDO
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={finishing}
              aria-busy={finishing}
              className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.action}`}
              onClick={handleFinishRequest}
            >
              {finishing ? 'FINALIZANDO…' : 'FINALIZAR'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
