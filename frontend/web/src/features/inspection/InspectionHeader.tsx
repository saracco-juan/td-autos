import type { Ref } from 'react'
import { BACK_TO_SHEET, reviewedCounter } from '@shared/checklist/inspection/copy'
import BackLink from '../../components/Buttons/BackLink'
import styles from '../../components/checklist/ChecklistScreen.module.css'

type Props = {
  vehicleId: number
  title: string
  completed: number
  total: number
  titleRef: Ref<HTMLHeadingElement>
}

// Shared by the inspection checklist and its summary.
export default function InspectionHeader({ vehicleId, title, completed, total, titleRef }: Props) {
  return (
    <div className={styles.header}>
      <BackLink to={`/vehiculos/${vehicleId}`}>{BACK_TO_SHEET}</BackLink>
      <div className={styles.titles}>
        <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
          {title}
        </h1>
        <p aria-live="polite" className={styles.counter}>
          {reviewedCounter(completed, total)}
        </p>
      </div>
    </div>
  )
}
