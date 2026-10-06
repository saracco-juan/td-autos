import { DIAGNOSIS_STEPS } from './steps'
import { SUMMARY_IN_PROGRESS, summaryValue } from './diagnosisDraft'
import type { BodyType, DiagnosisDraft } from './types'
import styles from './DiagnosisSummary.module.css'

type Props = {
  draft: DiagnosisDraft
  currentStep: number
  bodyTypes: BodyType[]
}

// "TU DIAGNÓSTICO" card: one row per question with the chosen label, `En curso` or a dash.
export default function DiagnosisSummary({ draft, currentStep, bodyTypes }: Props) {
  return (
    <aside aria-labelledby="diagnosis-summary-title" className={styles.card}>
      <h2 id="diagnosis-summary-title" className={styles.title}>
        TU DIAGNÓSTICO
      </h2>
      <dl className={styles.rows}>
        {DIAGNOSIS_STEPS.map((step, index) => {
          const value = summaryValue(draft, index, currentStep, bodyTypes)
          return (
            <div key={step.field} className={styles.row}>
              <dt className={styles.label}>{step.summaryLabel}</dt>
              <dd className={value === SUMMARY_IN_PROGRESS ? styles.inProgress : styles.value}>{value}</dd>
            </div>
          )
        })}
      </dl>
    </aside>
  )
}
