import type { Ref } from 'react'
import buttonStyles from '../../components/button.module.css'
import screenStyles from '../../components/screen.module.css'
import InspectionHeader from './InspectionHeader'
import styles from './InspectionSummary.module.css'
import { summarizeInspection, vehicleTitle } from './progress'
import type { InspectionStep, InspectionVehicle } from './types'

type Props = {
  vehicle: InspectionVehicle
  steps: InspectionStep[]
  completedCodes: string[]
  onKeepReviewing: () => void
  // The page moves the focus here when the view changes.
  titleRef?: Ref<HTMLHeadingElement>
}

// Shown after finishing. T5 adds the message boxes and the progress and pending-items cards (Figma 2287:4651).
export default function InspectionSummary({ vehicle, steps, completedCodes, onKeepReviewing, titleRef }: Props) {
  const progress = summarizeInspection(steps, completedCodes)

  return (
    <div className={screenStyles.page}>
      <InspectionHeader
        vehicleId={vehicle.id}
        title={vehicleTitle(vehicle)}
        completed={progress.completed}
        total={progress.total}
        titleRef={titleRef ?? null}
      />
      <div className={styles.actions}>
        <button
          type="button"
          className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.keepReviewing}`}
          onClick={onKeepReviewing}
        >
          SEGUIR REVISANDO
        </button>
      </div>
    </div>
  )
}
