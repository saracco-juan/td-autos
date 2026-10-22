import type { Ref } from 'react'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ChecklistCardGrid from '../../components/checklist/ChecklistCardGrid'
import ChecklistPendingCard from '../../components/checklist/ChecklistPendingCard'
import ChecklistProgressCard from '../../components/checklist/ChecklistProgressCard'
import barStyles from '../../components/checklist/pinnedBar.module.css'
import { summarizeChecklist } from '@shared/checklist/progress'
import FlowLayout from '../../components/FlowLayout'
import { FLAG_LABEL, SUMMARY_LABELS } from '@shared/checklist/transfer/copy'
import { toChecklistSteps } from '@shared/checklist/transfer/steps'
import { summaryMessage, summaryPendingItems } from '@shared/checklist/transfer/summaryMessage'
import styles from './TransferSummary.module.css'
import TransferHeader from './TransferHeader'
import type { TransferStage } from '@shared/checklist/transfer/types'

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
  const { mandatory: hasMandatory, items: pendingItems } = summaryPendingItems(progress)
  const showPending = pendingItems.length > 0

  return (
    <FlowLayout
      narrow
      actions={
        <div className={barStyles.actions}>
          <button
            type="button"
            className={`${buttonStyles.button} ${buttonStyles.primary} ${barStyles.action}`}
            onClick={onKeepCompleting}
          >
            {showPending ? SUMMARY_LABELS.keepCompleting : SUMMARY_LABELS.backToChecklist}
          </button>
        </div>
      }
    >
      <TransferHeader completed={progress.completed} total={progress.total} titleRef={titleRef ?? null} />

      <p
        role="status"
        className={`${message.tone === 'success' ? alertStyles.notice : alertStyles.warning} ${styles.message}`}
      >
        {message.text}
      </p>

      <ChecklistCardGrid single={!showPending}>
        <ChecklistProgressCard
          title={SUMMARY_LABELS.progressTitle}
          steps={progress.steps}
          completed={progress.completed}
          total={progress.total}
        />

        {showPending ? (
          <ChecklistPendingCard
            title={hasMandatory ? SUMMARY_LABELS.pendingMandatoryTitle : SUMMARY_LABELS.pendingTitle}
            subtitle={hasMandatory ? SUMMARY_LABELS.pendingMandatoryHint : undefined}
            flagLabel={FLAG_LABEL}
            items={pendingItems}
          />
        ) : null}
      </ChecklistCardGrid>
    </FlowLayout>
  )
}
