import { useId, type Ref } from 'react'
import { Link } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import screenStyles from '../../components/screen.module.css'
import InspectionHeader from './InspectionHeader'
import rowStyles from './inspectionRow.module.css'
import styles from './InspectionSummary.module.css'
import barStyles from './pinnedBar.module.css'
import { summarizeInspection, vehicleTitle } from './progress'
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
  const progress = summarizeInspection(steps, completedCodes)
  const message = summaryMessage(progress)
  const progressTitleId = useId()
  const pendingTitleId = useId()
  // Critical items first matter most: when any is pending only those are listed (D6 lists the rest otherwise).
  const hasCritical = progress.pendingCritical > 0
  const pendingItems = hasCritical ? progress.pendingCriticalFirst.filter((item) => item.critico) : progress.pending
  const showPending = pendingItems.length > 0

  return (
    <div className={screenStyles.page}>
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

      <div className={`${styles.cards} ${showPending ? '' : styles.single}`}>
        <section aria-labelledby={progressTitleId} className={styles.card}>
          <h2 id={progressTitleId} className={styles.title}>
            Avance por paso
          </h2>
          <dl className={styles.progress}>
            {progress.steps.map((step) => (
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
                {progress.completed} de {progress.total}
              </dd>
            </div>
          </dl>
        </section>

        {showPending ? (
          <section aria-labelledby={pendingTitleId} className={styles.card}>
            <div className={styles.head}>
              <h2 id={pendingTitleId} className={styles.title}>
                {hasCritical ? 'Puntos críticos pendientes' : 'Puntos pendientes'}
              </h2>
              {hasCritical ? <p className={styles.subtitle}>Son los que más pesan a la hora de decidir.</p> : null}
            </div>
            <ul className={styles.items}>
              {pendingItems.map((item) => (
                <li key={item.codigo} className={rowStyles.row}>
                  <span className={rowStyles.text}>{item.texto}</span>
                  {item.critico ? <> <span className={rowStyles.badge}>CRÍTICO</span></> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className={barStyles.bar}>
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
      </div>
    </div>
  )
}
