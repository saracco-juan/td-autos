import type { Ref } from 'react'
import { Link } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ChecklistCardGrid from '../../components/checklist/ChecklistCardGrid'
import ChecklistPendingCard from '../../components/checklist/ChecklistPendingCard'
import ChecklistProgressCard from '../../components/checklist/ChecklistProgressCard'
import barStyles from '../../components/checklist/pinnedBar.module.css'
import { summarizeChecklist } from '../../components/checklist/progress'
import FlowLayout from '../../components/FlowLayout'
import { toChecklistSteps } from './checklistSteps'
import { FLAG_LABEL } from './checklistCopy'
import InspectionHeader from './InspectionHeader'
import styles from './InspectionSummary.module.css'
import { vehicleTitle } from './progress'
import { summaryMessage } from './summaryMessage'
import type { InspectionStep, InspectionVehicle } from './types'

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
  const hasCritical = progress.pendingFlagged > 0
  const pendingItems = hasCritical ? progress.pendingFlaggedFirst.filter((item) => item.flagged) : progress.pending
  const showPending = pendingItems.length > 0

  return (
    <FlowLayout
      actions={
        <div className={barStyles.actions}>
          <Link
            to={`/vehiculos/${vehicle.id}`}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${barStyles.action}`}
          >
            VOLVER A LA FICHA
          </Link>
          <button
            type="button"
            className={`${buttonStyles.button} ${buttonStyles.primary} ${barStyles.action}`}
            onClick={onKeepReviewing}
          >
            SEGUIR REVISANDO
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
          title="Avance por paso"
          steps={progress.steps}
          completed={progress.completed}
          total={progress.total}
        />

        {showPending ? (
          <ChecklistPendingCard
            title={hasCritical ? 'Puntos críticos pendientes' : 'Puntos pendientes'}
            subtitle={hasCritical ? 'Son los que más pesan a la hora de decidir.' : undefined}
            flagLabel={FLAG_LABEL}
            items={pendingItems}
          />
        ) : null}
      </ChecklistCardGrid>
    </FlowLayout>
  )
}
