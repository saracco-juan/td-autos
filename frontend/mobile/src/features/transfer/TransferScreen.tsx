import { useEffect, useState } from 'react'
import { StyleSheet, Text } from 'react-native'

import { firstPendingStep } from '@shared/checklist/progress'
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
import Button from '../../components/Button'
import ChecklistLayout, { type ChecklistCopy } from '../../components/checklist/ChecklistLayout'
import SummaryLayout from '../../components/checklist/SummaryLayout'
import { useChecklistFlow } from '../../components/checklist/useChecklistFlow'
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
type Content = { stages: TransferStage[]; advisor: string | null }

const COPY: ChecklistCopy = {
  actionLabels: ACTION_LABELS,
  flagLabel: FLAG_LABEL,
  saveError: SAVE_ERROR,
  pendingMarkerLabel,
}

// Transfer checklist (UH-13, RF12 + RF20): same behavior as the web page, mobile layout.
export default function TransferScreen() {
  const { authFetch } = useAuth()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [content, setContent] = useState<Content | null>(null)
  const steps = toChecklistSteps(content?.stages ?? [])
  const flow = useChecklistFlow({
    steps,
    save: (code, value) => setItemCompleted(authFetch, code, value),
    finish: () => finishTransfer(authFetch),
    warningFor: mandatoryWarning,
  })
  const { load, setSelected } = flow

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
  }, [authFetch, load, setSelected])

  if (loadState === 'loading') return <Loader />
  if (typeof loadState === 'object') return <LoadError kind={loadState.error} />
  if (!content) return <Loader />

  const { progress } = flow
  const header = <TransferHeader completed={progress.completed} total={progress.total} />

  if (flow.view === 'summary') {
    const showPending = progress.pending.length > 0
    return (
      <SummaryLayout header={header} summary={<TransferSummary progress={progress} />}>
        <Button
          label={showPending ? SUMMARY_LABELS.keepCompleting : SUMMARY_LABELS.backToChecklist}
          variant="primary"
          onPress={() => flow.setView('checklist')}
        />
      </SummaryLayout>
    )
  }

  return (
    <ChecklistLayout
      flow={flow}
      steps={steps}
      copy={COPY}
      header={header}
      panelFooter={<Text style={styles.source}>{SOURCE_NOTE}</Text>}
      after={content.advisor === null ? null : <AdvisorCard whatsapp={content.advisor} />}
    />
  )
}

const styles = StyleSheet.create({
  source: { color: colors.textSecondary, fontSize: 12 },
})
