import type { CSSProperties, ReactNode } from 'react'
import styles from './ChecklistColumns.module.css'
import { longestStepSize } from './progress'
import type { ChecklistStep } from './types'

type Props = {
  steps: ChecklistStep[]
  list: ReactNode
  panel: ReactNode
  // Optional card under the list (below the panel on narrow screens).
  aside?: ReactNode
}

// The step list and the selected step side by side. --max-items sizes the panel for the longest step.
export default function ChecklistColumns({ steps, list, panel, aside }: Props) {
  return (
    <div
      className={`${styles.columns} ${aside ? styles.withAside : ''}`}
      style={{ '--max-items': longestStepSize(steps) } as CSSProperties}
    >
      <div className={styles.list}>{list}</div>
      <div className={styles.panel}>{panel}</div>
      {aside ? <div className={styles.aside}>{aside}</div> : null}
    </div>
  )
}
