import { useId } from 'react'
import styles from './ChecklistSummaryCards.module.css'
import type { StepProgress } from '@shared/checklist/progress'

type Props = {
  title: string
  steps: StepProgress[]
  completed: number
  total: number
}

// Read-only card: one row per step with "X de Y", and the total in bold.
export default function ChecklistProgressCard({ title, steps, completed, total }: Props) {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className={styles.card}>
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <dl className={styles.progress}>
        {steps.map((step) => (
          <div key={step.numero} className={styles.progressRow}>
            <dt>
              {step.numero}. {step.titulo}
            </dt>
            <dd>
              {step.completed} de {step.total}
            </dd>
          </div>
        ))}
        <div className={`${styles.progressRow} ${styles.total}`}>
          <dt>Total</dt>
          <dd>
            {completed} de {total}
          </dd>
        </div>
      </dl>
    </section>
  )
}
