import type { ReactNode } from 'react'
import styles from './ChecklistSummaryCards.module.css'

type Props = {
  // One card only: it takes the full width instead of half of it.
  single: boolean
  children: ReactNode
}

// Two equal summary cards side by side (one column on narrow screens).
export default function ChecklistCardGrid({ single, children }: Props) {
  return <div className={`${styles.cards} ${single ? styles.single : ''}`}>{children}</div>
}
