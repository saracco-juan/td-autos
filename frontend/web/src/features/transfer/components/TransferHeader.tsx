import type { Ref } from 'react'
import { TITLE, completedCounter } from '@shared/checklist/transfer/copy'
import styles from '../../../components/checklist/ChecklistScreen.module.css'

type Props = {
  completed: number
  total: number
  titleRef: Ref<HTMLHeadingElement>
}

// Shared by the transfer checklist and its summary.
export default function TransferHeader({ completed, total, titleRef }: Props) {
  return (
    <div className={styles.titles}>
      <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
        {TITLE}
      </h1>
      <p aria-live="polite" className={styles.counter}>
        {completedCounter(completed, total)}
      </p>
    </div>
  )
}
