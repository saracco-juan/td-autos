import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import ChecklistActionBar from '../../components/checklist/ChecklistActionBar'
import ChecklistColumns from '../../components/checklist/ChecklistColumns'
import ChecklistStepList from '../../components/checklist/ChecklistStepList'
import ChecklistStepPanel from '../../components/checklist/ChecklistStepPanel'
import ChecklistWarning from '../../components/checklist/ChecklistWarning'
import { firstPendingStep, pendingFlaggedByStep, summarizeChecklist } from '../../components/checklist/progress'
import { useChecklistAutosave, withCode } from '../../components/checklist/useChecklistAutosave'
import FlowLayout from '../../components/FlowLayout'
import { HttpError, NetworkError } from '../../lib/http'
import { useMediaQuery } from '../../lib/useMediaQuery'
import SessionLoading from '../auth/session/SessionLoading'
import { fetchInspection, finishInspection, setItemCompleted } from './api'
import { ACTION_LABELS, FLAG_LABEL, SAVE_ERROR, pendingMarkerLabel } from './checklistCopy'
import { toChecklistSteps } from './checklistSteps'
import InspectionHeader from './InspectionHeader'
import InspectionSummary from './InspectionSummary'
import { vehicleTitle } from './progress'
import type { InspectionStep, InspectionVehicle } from './types'
import VehicleNotFound from './VehicleNotFound'

type LoadState = 'loading' | 'ready' | 'not-found' | { error: ErrorKind }
type View = 'checklist' | 'summary'
type Content = { vehicle: InspectionVehicle; steps: InspectionStep[] }

// Only a positive integer can be a vehicle id; anything else never reaches the API.
function parseVehicleId(raw: string | undefined): number | null {
  return raw !== undefined && /^[1-9]\d*$/.test(raw) ? Number(raw) : null
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
  // Local UI state, not saved: the step shown in the panel. It survives a trip to the summary.
  const [selected, setSelected] = useState(1)
  const [view, setView] = useState<View>('checklist')
  const [warningOpen, setWarningOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishFailed, setFinishFailed] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const warningRef = useRef<HTMLParagraphElement>(null)
  const panelHeadingRef = useRef<HTMLHeadingElement>(null)
  const viewChanged = useRef(false)
  const headingFocus = useRef(false)
  const narrow = useMediaQuery('(max-width: 767px)')
  const steps = toChecklistSteps(content?.steps ?? [])
  const { completed, failedSteps, load, toggle, settle } = useChecklistAutosave({
    steps,
    save: (code, value) => setItemCompleted(vehicleId, code, value),
    // The step whose save failed is shown, so the reverted item and the error are visible.
    onSaveFailed: setSelected,
  })

  useEffect(() => {
    let cancelled = false
    fetchInspection(vehicleId)
      .then((inspection) => {
        if (cancelled) return
        setContent({ vehicle: inspection.vehiculo, steps: inspection.pasos })
        load(inspection.items_completados)
        setSelected(firstPendingStep(toChecklistSteps(inspection.pasos), inspection.items_completados))
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
  }, [vehicleId, load])

  // After a view change the title takes the focus, so the new content is announced.
  useEffect(() => {
    if (!viewChanged.current) return
    viewChanged.current = false
    titleRef.current?.focus()
  }, [view])

  const progress = summarizeChecklist(steps, completed)
  const showWarning = warningOpen && progress.pendingFlagged > 0

  useEffect(() => {
    if (showWarning) warningRef.current?.focus()
  }, [showWarning])

  const changeView = (next: View) => {
    viewChanged.current = true
    setView(next)
  }

  // After PASO ANTERIOR / PASO SIGUIENTE the panel heading takes the focus, so the new step is announced.
  useEffect(() => {
    if (!headingFocus.current) return
    headingFocus.current = false
    panelHeadingRef.current?.focus({ preventScroll: true })
  }, [selected])

  const stepIndex = steps.findIndex((step) => step.numero === selected)

  const goToStep = (index: number) => {
    headingFocus.current = true
    setSelected(steps[index].numero)
  }

  const handleToggle = (code: string, value: boolean) => {
    if (summarizeChecklist(steps, withCode(completed, code, value)).pendingFlagged === 0) setWarningOpen(false)
    toggle(code, value)
  }

  const handleFinish = async () => {
    if (finishing) return
    setFinishFailed(false)
    setFinishing(true)
    try {
      // A save failed meanwhile: its step shows the error and the user stays on the checklist.
      if (!(await settle())) return
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
    if (progress.pendingFlagged > 0) setWarningOpen(true)
    else void handleFinish()
  }

  // While the warning is open, the steps that still have critical items pending get a marker in the list.

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
  const pendingFlagged = showWarning ? pendingFlaggedByStep(steps, completedCodes) : new Map<number, number>()
  const step = steps[stepIndex]

  return (
    <FlowLayout
      narrow
      actions={
        <ChecklistActionBar
          labels={ACTION_LABELS}
          warning={showWarning}
          finishing={finishing}
          finishFailed={finishFailed}
          hasPrevious={stepIndex > 0}
          hasNext={stepIndex < steps.length - 1}
          onPrevious={() => goToStep(stepIndex - 1)}
          onNext={() => goToStep(stepIndex + 1)}
          onFinish={handleFinishRequest}
          onFinishAnyway={() => void handleFinish()}
          onKeepWorking={() => setWarningOpen(false)}
        />
      }
    >
      <InspectionHeader
        vehicleId={vehicleId}
        title={vehicleTitle(content.vehicle)}
        completed={progress.completed}
        total={progress.total}
        titleRef={titleRef}
      />

      {showWarning ? (
        <ChecklistWarning warningRef={warningRef}>{criticalWarning(progress.pendingFlagged)}</ChecklistWarning>
      ) : null}

      <ChecklistColumns
        steps={steps}
        list={
          <ChecklistStepList
            idPrefix="inspection"
            steps={steps}
            completedCodes={completedCodes}
            selected={selected}
            orientation={narrow ? 'horizontal' : 'vertical'}
            pendingFlagged={pendingFlagged}
            pendingLabel={pendingMarkerLabel}
            onSelect={setSelected}
          />
        }
        panel={
          <ChecklistStepPanel
            idPrefix="inspection"
            step={step}
            completedCodes={completedCodes}
            saveFailed={failedSteps.has(step.numero)}
            saveError={SAVE_ERROR}
            flagLabel={FLAG_LABEL}
            headingRef={panelHeadingRef}
            onToggle={handleToggle}
          />
        }
      />
    </FlowLayout>
  )
}