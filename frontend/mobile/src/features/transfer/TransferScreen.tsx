import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native'

import { withCode } from '@shared/checklist/autosave'
import { firstPendingStep, pendingFlaggedByStep, summarizeChecklist } from '@shared/checklist/progress'
import {
  ACTION_LABELS,
  FLAG_LABEL,
  SAVE_ERROR,
  SOURCE_NOTE,
  SUMMARY_LABELS,
  mandatoryWarning,
  pendingMarkerLabel,
} from '@shared/checklist/transfer/copy'
import { toChecklistSteps } from '@shared/checklist/transfer/steps'
import type { TransferStage } from '@shared/checklist/transfer/types'
import Alert from '../../components/Alert'
import Button from '../../components/Button'
import ActionBar from '../../components/checklist/ActionBar'
import StepPanel from '../../components/checklist/StepPanel'
import StepPills from '../../components/checklist/StepPills'
import { useChecklistAutosave } from '../../components/checklist/useChecklistAutosave'
import Loader from '../../components/Loader'
import { NetworkError } from '../../lib/http'
import { colors } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'
import LoadError, { type LoadErrorKind } from '../diagnosis/LoadError'
import AdvisorCard from './AdvisorCard'
import { fetchTransfer, finishTransfer, setItemCompleted } from './api'
import TransferHeader from './TransferHeader'
import TransferSummary from './TransferSummary'

type LoadState = 'loading' | 'ready' | { error: LoadErrorKind }
type Mode = 'checklist' | 'summary'
type Content = { stages: TransferStage[]; advisor: string | null }

const NO_MARKERS: ReadonlyMap<number, number> = new Map()

// Transfer checklist (UH-13, RF12 + RF20): same behavior as the web page, mobile layout.
export default function TransferScreen() {
  const { authFetch } = useAuth()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [content, setContent] = useState<Content | null>(null)
  // Local UI state, not saved: the stage shown in the panel. It survives a trip to the summary.
  const [selected, setSelected] = useState(1)
  const [view, setView] = useState<Mode>('checklist')
  const [warningOpen, setWarningOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishFailed, setFinishFailed] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const steps = toChecklistSteps(content?.stages ?? [])
  const { completed, failedSteps, load, toggle, settle } = useChecklistAutosave({
    steps,
    save: (code, value) => setItemCompleted(authFetch, code, value),
    // The stage whose save failed is shown, so the reverted item and the error are visible.
    onSaveFailed: setSelected,
  })

  useEffect(() => {
    let cancelled = false
    fetchTransfer(authFetch)
      .then((transfer) => {
        if (cancelled) return
        setContent({ stages: transfer.etapas, advisor: transfer.asesor_whatsapp })
        load(transfer.items_completados)
        setSelected(firstPendingStep(toChecklistSteps(transfer.etapas), transfer.items_completados))
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadState({ error: error instanceof NetworkError ? 'network' : 'server' })
      })
    return () => {
      cancelled = true
    }
  }, [authFetch, load])

  const progress = summarizeChecklist(steps, completed)
  const showWarning = warningOpen && progress.pendingFlagged > 0
  const warningText = showWarning ? mandatoryWarning(progress.pendingFlagged) : null

  // The warning appears above the pills, out of sight of a screen reader focused on the bar: announce it.
  useEffect(() => {
    if (warningText) AccessibilityInfo.announceForAccessibility(warningText)
  }, [warningText])

  // A new stage or view starts at the top of the scroll.
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
      // A save failed meanwhile: its stage shows the error and the user stays on the checklist.
      if (!(await settle())) return
      await finishTransfer(authFetch)
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
  if (typeof loadState === 'object') return <LoadError kind={loadState.error} />
  if (!content) return <Loader />

  const header = <TransferHeader completed={progress.completed} total={progress.total} />

  if (view === 'summary') {
    const showPending = progress.pending.length > 0
    return (
      <View style={styles.screen}>
        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content}>
          {header}
          <TransferSummary progress={progress} />
        </ScrollView>
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button
              label={showPending ? SUMMARY_LABELS.keepCompleting : SUMMARY_LABELS.backToChecklist}
              variant="primary"
              onPress={() => setView('checklist')}
            />
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
          >
            <Text style={styles.source}>{SOURCE_NOTE}</Text>
          </StepPanel>
        ) : null}
        {content.advisor === null ? null : <AdvisorCard whatsapp={content.advisor} />}
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
  source: { color: colors.textSecondary, fontSize: 12 },
  // Pinned under the scrolling content, above the tab bar (DESIGN.md "Page layout").
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  action: { flex: 1 },
})
