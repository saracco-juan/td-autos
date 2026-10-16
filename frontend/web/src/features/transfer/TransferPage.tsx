import { useEffect, useRef, useState } from 'react'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import ChecklistActionBar from '../../components/checklist/ChecklistActionBar'
import ChecklistColumns from '../../components/checklist/ChecklistColumns'
import ChecklistStepList from '../../components/checklist/ChecklistStepList'
import ChecklistStepPanel from '../../components/checklist/ChecklistStepPanel'
import ChecklistWarning from '../../components/checklist/ChecklistWarning'
import { firstPendingStep, pendingFlaggedByStep, summarizeChecklist } from '../../components/checklist/progress'
import { useChecklistAutosave, withCode } from '../../components/checklist/useChecklistAutosave'
import FlowLayout from '../../components/FlowLayout'
import { NetworkError } from '../../lib/http'
import { useMediaQuery } from '../../lib/useMediaQuery'
import SessionLoading from '../auth/session/SessionLoading'
import AdvisorCard from './AdvisorCard'
import { fetchTransfer, finishTransfer, setItemCompleted } from './api'
import {
  ACTION_LABELS,
  FLAG_LABEL,
  SAVE_ERROR,
  SOURCE_NOTE,
  mandatoryWarning,
  pendingMarkerLabel,
} from './checklistCopy'
import { toChecklistSteps } from './checklistSteps'
import styles from './TransferPage.module.css'
import TransferHeader from './TransferHeader'
import TransferSummary from './TransferSummary'
import type { TransferStage } from './types'

type LoadState = 'loading' | 'ready' | { error: ErrorKind }
type View = 'checklist' | 'summary'
type Content = { stages: TransferStage[]; advisor: string | null }

export default function TransferPage() {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [content, setContent] = useState<Content | null>(null)
  // Local UI state, not saved: the stage shown in the panel. It survives a trip to the summary.
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
  const steps = toChecklistSteps(content?.stages ?? [])
  const { completed, failedSteps, load, toggle, settle } = useChecklistAutosave({
    steps,
    save: setItemCompleted,
    // The stage whose save failed is shown, so the reverted item and the error are visible.
    onSaveFailed: setSelected,
  })

  useEffect(() => {
    let cancelled = false
    fetchTransfer()
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
  }, [load])

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

  // After ETAPA ANTERIOR / ETAPA SIGUIENTE the panel heading takes the focus, so the new stage is announced.
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
      // A save failed meanwhile: its stage shows the error and the user stays on the checklist.
      if (!(await settle())) return
      await finishTransfer()
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

  // The loader is a direct child of the content area so it is centered there, not inside the page column.
  if (loadState === 'loading') return <SessionLoading />
  if (typeof loadState === 'object') return <ErrorState kind={loadState.error} />
  if (!content) return <SessionLoading />

  if (view === 'summary') {
    return (
      <TransferSummary
        stages={content.stages}
        completedCodes={completed}
        onKeepCompleting={() => changeView('checklist')}
        titleRef={titleRef}
      />
    )
  }

  const completedCodes = new Set(completed)
  // While the warning is open, the stages that still have mandatory items pending get a marker in the list.
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
      <TransferHeader completed={progress.completed} total={progress.total} titleRef={titleRef} />

      {showWarning ? (
        <ChecklistWarning warningRef={warningRef}>{mandatoryWarning(progress.pendingFlagged)}</ChecklistWarning>
      ) : null}

      <ChecklistColumns
        steps={steps}
        list={
          <ChecklistStepList
            idPrefix="transfer"
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
            idPrefix="transfer"
            step={step}
            completedCodes={completedCodes}
            saveFailed={failedSteps.has(step.numero)}
            saveError={SAVE_ERROR}
            flagLabel={FLAG_LABEL}
            headingRef={panelHeadingRef}
            onToggle={handleToggle}
          >
            <p className={styles.source}>{SOURCE_NOTE}</p>
          </ChecklistStepPanel>
        }
        aside={content.advisor !== null ? <AdvisorCard whatsapp={content.advisor} /> : undefined}
      />
    </FlowLayout>
  )
}
