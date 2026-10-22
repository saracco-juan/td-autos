import type { Ref } from 'react'
import { EYEBROW, TITLE, completedCounter } from '@shared/checklist/transfer/copy'
import screenStyles from '../../components/screen.module.css'
import styles from './TransferHeader.module.css'

type Props = {
  completed: number
  total: number
  titleRef: Ref<HTMLHeadingElement>
}

// Shared by the checklist and the summary view: eyebrow, title and counter.
export default function TransferHeader({ completed, total, titleRef }: Props) {
  return (
    <div className={styles.header}>
      <p className={screenStyles.eyebrow}>{EYEBROW}</p>
      <h1 ref={titleRef} tabIndex={-1} className={screenStyles.title}>
        {TITLE}
      </h1>
      <p aria-live="polite" className={styles.counter}>
        {completedCounter(completed, total)}
      </p>
    </div>
  )
}
