import type { Ref } from 'react'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ChecklistCardGrid from '../../components/checklist/ChecklistCardGrid'
import ChecklistPendingCard from '../../components/checklist/ChecklistPendingCard'
import ChecklistProgressCard from '../../components/checklist/ChecklistProgressCard'
import barStyles from '../../components/checklist/pinnedBar.module.css'
import { summarizeChecklist } from '../../components/checklist/progress'
import screenStyles from '../../components/screen.module.css'
import { FLAG_LABEL } from './checklistCopy'
import { toChecklistSteps } from './checklistSteps'
import { summaryMessage } from './summaryMessage'
import styles from './TransferSummary.module.css'
import TransferHeader from './TransferHeader'
import type { TransferStage } from './types'

type Props = {
  stages: TransferStage[]
  completedCodes: string[]
  onKeepCompleting: () => void
  // The page moves the focus here when the view changes.
  titleRef?: Ref<HTMLHeadingElement>
}

// Shown after finishing (Figma 2319:5308, 2319:5429, 2319:5545): result message, progress per stage, and the
// pending items. Everything here is read-only; ticking happens in the checklist.
export default function TransferSummary({ stages, completedCodes, onKeepCompleting, titleRef }: Props) {
  const progress = summarizeChecklist(toChecklistSteps(stages), completedCodes)
  const message = summaryMessage(progress)
  // Mandatory items matter most: when any is pending only those are listed.
  const hasMandatory = progress.pendingFlagged > 0
  const pendingItems = hasMandatory ? progress.pending.filter((item) => item.flagged) : progress.pending
  const showPending = pendingItems.length > 0

  return (
    <div className={screenStyles.page}>
      <TransferHeader completed={progress.completed} total={progress.total} titleRef={titleRef ?? null} />

      <p
        role="status"
        className={`${message.tone === 'success' ? alertStyles.notice : alertStyles.warning} ${styles.message}`}
      >
        {message.text}
      </p>

      <ChecklistCardGrid single={!showPending}>
        <ChecklistProgressCard
          title="Avance por etapa"
          steps={progress.steps}
          completed={progress.completed}
          total={progress.total}
        />

        {showPending ? (
          <ChecklistPendingCard
            title={hasMandatory ? 'Pasos obligatorios pendientes' : 'Pasos pendientes'}
            subtitle={hasMandatory ? 'El registro los exige para hacer la transferencia.' : undefined}
            flagLabel={FLAG_LABEL}
            items={pendingItems}
          />
        ) : null}
      </ChecklistCardGrid>

      <div className={barStyles.bar}>
        <div className={barStyles.actions}>
          <button
            type="button"
            className={`${buttonStyles.button} ${buttonStyles.primary} ${barStyles.action}`}
            onClick={onKeepCompleting}
          >
            {showPending ? 'SEGUIR COMPLETANDO' : 'VOLVER AL CHECKLIST'}
          </button>
        </div>
      </div>
    </div>
  )
}
