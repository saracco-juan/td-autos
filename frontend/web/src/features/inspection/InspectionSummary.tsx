import type { Ref } from 'react'
import { Link } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ChecklistCardGrid from '../../components/checklist/ChecklistCardGrid'
import ChecklistPendingCard from '../../components/checklist/ChecklistPendingCard'
import ChecklistProgressCard from '../../components/checklist/ChecklistProgressCard'
import barStyles from '../../components/checklist/pinnedBar.module.css'
import { summarizeChecklist } from '@shared/checklist/progress'
import FlowLayout from '../../components/FlowLayout'
import { toChecklistSteps } from '@shared/checklist/inspection/steps'
import { FLAG_LABEL, SUMMARY_LABELS } from '@shared/checklist/inspection/copy'
import InspectionHeader from './InspectionHeader'
import styles from './InspectionSummary.module.css'
import { vehicleTitle } from '@shared/checklist/inspection/vehicle'
import { summaryMessage, summaryPendingItems } from '@shared/checklist/inspection/summaryMessage'
import type { InspectionStep, InspectionVehicle } from '@shared/checklist/inspection/types'

type Props = {
  vehicle: InspectionVehicle
  steps: InspectionStep[]
  completedCodes: string[]
  onKeepReviewing: () => void
  // The page moves the focus here when the view changes.
  titleRef?: Ref<HTMLHeadingElement>
}

// Shown after finishing (Figma 2287:4651): result message, progress per step, and the pending items.
// Everything here is read-only; ticking happens in the checklist.
export default function InspectionSummary({ vehicle, steps, completedCodes, onKeepReviewing, titleRef }: Props) {
  const progress = summarizeChecklist(toChecklistSteps(steps), completedCodes)
  const message = summaryMessage(progress)
  // Critical items first matter most: when any is pending only those are listed (D6 lists the rest otherwise).
  const { critical: hasCritical, items: pendingItems } = summaryPendingItems(progress)
  const showPending = pendingItems.length > 0

  return (
    <FlowLayout
      narrow
      actions={
        <div className={barStyles.actions}>
          <Link
            to={`/vehiculos/${vehicle.id}`}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${barStyles.action}`}
          >
            {SUMMARY_LABELS.backToSheet}
          </Link>
          <button
            type="button"
            className={`${buttonStyles.button} ${buttonStyles.primary} ${barStyles.action}`}
            onClick={onKeepReviewing}
          >
            {SUMMARY_LABELS.keepReviewing}
          </button>
        </div>
      }
    >
      <InspectionHeader
        vehicleId={vehicle.id}
        title={vehicleTitle(vehicle)}
        completed={progress.completed}
        total={progress.total}
        titleRef={titleRef ?? null}
      />

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
            title={hasCritical ? SUMMARY_LABELS.pendingCriticalTitle : SUMMARY_LABELS.pendingTitle}
            subtitle={hasCritical ? SUMMARY_LABELS.pendingCriticalHint : undefined}
            flagLabel={FLAG_LABEL}
            items={pendingItems}
          />
        ) : null}
      </ChecklistCardGrid>
    </FlowLayout>
  )
}
