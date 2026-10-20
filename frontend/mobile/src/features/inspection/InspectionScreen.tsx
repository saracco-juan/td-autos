import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, View } from 'react-native'

import Alert from '../../components/Alert'
import ActionBar from '../../components/checklist/ActionBar'
import StepPanel from '../../components/checklist/StepPanel'
import StepPills from '../../components/checklist/StepPills'
import { useChecklistAutosave } from '../../components/checklist/useChecklistAutosave'
import Button from '../../components/Button'
import Loader from '../../components/Loader'
import { HttpError, NetworkError } from '../../lib/http'
import { colors } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'
import LoadError, { type LoadErrorKind } from '../diagnosis/LoadError'
import { withCode } from '@shared/checklist/autosave'
import { firstPendingStep, pendingFlaggedByStep, summarizeChecklist } from '@shared/checklist/progress'
import {
  ACTION_LABELS,
  FLAG_LABEL,
  SAVE_ERROR,
  SUMMARY_LABELS,
  criticalWarning,
  pendingMarkerLabel,
} from '@shared/checklist/inspection/copy'
import { toChecklistSteps } from '@shared/checklist/inspection/steps'
import type { InspectionStep, InspectionVehicle } from '@shared/checklist/inspection/types'
import { parseVehicleId, vehicleTitle } from '@shared/checklist/inspection/vehicle'
import { fetchInspection, finishInspection, setItemCompleted } from './api'
import InspectionHeader, { useBackToSheet } from './InspectionHeader'
import InspectionSummary from './InspectionSummary'
import VehicleNotFound from './VehicleNotFound'

type LoadState = 'loading' | 'ready' | 'not-found' | { error: LoadErrorKind }
type Mode = 'checklist' | 'summary'
type Content = { vehicle: InspectionVehicle; steps: InspectionStep[] }

const NO_MARKERS: ReadonlyMap<number, number> = new Map()

// Inspection checklist (UH-12, RF11, CU of the inspection): same behavior as the web page, mobile layout.
export default function InspectionScreen({ rawId }: Readonly<{ rawId: string | undefined }>) {
  const vehicleId = parseVehicleId(rawId)

  if (vehicleId === null) return <VehicleNotFound />

  // The key restarts the whole screen when the route points to another vehicle.
  return <Checklist key={vehicleId} vehicleId={vehicleId} />
}

function Checklist({ vehicleId }: Readonly<{ vehicleId: number }>) {
  const { authFetch } = useAuth()
  const goBack = useBackToSheet()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [content, setContent] = useState<Content | null>(null)
  // Local UI state, not saved: the step shown in the panel. It survives a trip to the summary.
  const [selected, setSelected] = useState(1)
  const [view, setView] = useState<Mode>('checklist')
  const [warningOpen, setWarningOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishFailed, setFinishFailed] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const steps = toChecklistSteps(content?.steps ?? [])
  const { completed, failedSteps, load, toggle, settle } = useChecklistAutosave({
    steps,
    save: (code, value) => setItemCompleted(authFetch, vehicleId, code, value),
    // The step whose save failed is shown, so the reverted item and the error are visible.
    onSaveFailed: setSelected,
  })

  useEffect(() => {
    let cancelled = false
    fetchInspection(authFetch, vehicleId)
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
  }, [authFetch, vehicleId, load])

  const progress = summarizeChecklist(steps, completed)
  const showWarning = warningOpen && progress.pendingFlagged > 0
  const warningText = showWarning ? criticalWarning(progress.pendingFlagged) : null

  // The warning appears above the pills, out of sight of a screen reader focused on the bar: announce it.
  useEffect(() => {
    if (warningText) AccessibilityInfo.announceForAccessibility(warningText)
  }, [warningText])

  // A new step or view starts at the top of the scroll.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [selected, view])

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
      await finishInspection(authFetch, vehicleId)
      setWarningOpen(false)
      setView('summary')
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

  if (loadState === 'loading') return <Loader />
  if (loadState === 'not-found') return <VehicleNotFound />
  if (typeof loadState === 'object') return <LoadError kind={loadState.error} />
  if (!content) return <Loader />

  const header = (
    <InspectionHeader title={vehicleTitle(content.vehicle)} completed={progress.completed} total={progress.total} />
  )

  if (view === 'summary') {
    return (
      <View style={styles.screen}>
        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content}>
          {header}
          <InspectionSummary progress={progress} />
        </ScrollView>
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button label={SUMMARY_LABELS.backToSheet} onPress={goBack} />
          </View>
          <View style={styles.action}>
            <Button label={SUMMARY_LABELS.keepReviewing} variant="primary" onPress={() => setView('checklist')} />
          </View>
        </View>
      </View>
    )
  }

  const completedCodes = new Set(completed)
  const stepIndex = steps.findIndex((step) => step.numero === selected)
  const step = steps[stepIndex]

  return (
    <View style={styles.screen}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content}>
        {header}
        {warningText ? <Alert variant="warning">{warningText}</Alert> : null}
        <StepPills
          steps={progress.steps}
          selected={selected}
          pendingFlagged={showWarning ? pendingFlaggedByStep(steps, completedCodes) : NO_MARKERS}
          pendingLabel={pendingMarkerLabel}
          onSelect={setSelected}
        />
        {step ? (
          <StepPanel
            step={step}
            completedCodes={completedCodes}
            saveFailed={failedSteps.has(step.numero)}
            flagLabel={FLAG_LABEL}
            saveError={SAVE_ERROR}
            onToggle={handleToggle}
          />
        ) : null}
      </ScrollView>
      <ActionBar
        labels={ACTION_LABELS}
        warning={showWarning}
        finishing={finishing}
        finishFailed={finishFailed}
        hasNext={stepIndex < steps.length - 1}
        onNext={() => setSelected(steps[stepIndex + 1].numero)}
        onFinish={handleFinishRequest}
        onFinishAnyway={() => void handleFinish()}
        onKeepWorking={() => setWarningOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 20 },
  // Pinned under the scrolling content, above the tab bar (DESIGN.md "Page layout").
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  action: { flex: 1 },
})
