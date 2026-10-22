import { useId } from 'react'
import rowStyles from './checklistRow.module.css'
import styles from './ChecklistSummaryCards.module.css'
import type { ChecklistItem } from '@shared/checklist/types'

type Props = {
  title: string
  // Helper text under the title.
  subtitle?: string
  // Badge text of the flagged items.
  flagLabel: string
  items: ChecklistItem[]
}

// Read-only card: the items still pending, flagged ones with their badge.
export default function ChecklistPendingCard({ title, subtitle, flagLabel, items }: Props) {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className={styles.card}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      <ul className={styles.items}>
        {items.map((item) => (
          <li key={item.codigo} className={rowStyles.row}>
            <span className={rowStyles.text}>{item.texto}</span>
            {item.flagged ? <> <span className={rowStyles.badge}>{flagLabel}</span></> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
