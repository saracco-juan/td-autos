import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import styles from './InspectionActionBar.module.css'

export const FINISH_ERROR = 'No pudimos finalizar la inspección. Probá de nuevo.'

type Props = {
  // The critical-pending warning is open: the bar offers FINALIZAR IGUAL / SEGUIR REVISANDO.
  warning: boolean
  finishing: boolean
  finishFailed: boolean
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onFinish: () => void
  onFinishAnyway: () => void
  onKeepReviewing: () => void
}

const secondary = `${buttonStyles.button} ${buttonStyles.secondary} ${styles.action}`
const primary = `${buttonStyles.button} ${buttonStyles.primary} ${styles.action}`

// Pinned to the bottom of the viewport. The primary button is always the right-most one, so it never moves
// when previous or next come and go.
export default function InspectionActionBar({
  warning,
  finishing,
  finishFailed,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onFinish,
  onFinishAnyway,
  onKeepReviewing,
}: Props) {
  return (
    <div className={styles.bar}>
      <div className={styles.message}>
        {finishFailed ? (
          <p role="alert" className={`${alertStyles.alert} ${styles.alert}`}>
            {FINISH_ERROR}
          </p>
        ) : null}
      </div>
      <div className={styles.actions}>
        {warning ? (
          <>
            <button
              type="button"
              disabled={finishing}
              aria-busy={finishing}
              className={secondary}
              onClick={onFinishAnyway}
            >
              {finishing ? 'FINALIZANDO…' : 'FINALIZAR IGUAL'}
            </button>
            <button type="button" disabled={finishing} className={primary} onClick={onKeepReviewing}>
              SEGUIR REVISANDO
            </button>
          </>
        ) : (
          <>
            {hasPrevious ? (
              <button type="button" disabled={finishing} className={secondary} onClick={onPrevious}>
                PASO ANTERIOR
              </button>
            ) : null}
            {hasNext ? (
              <button type="button" disabled={finishing} className={secondary} onClick={onNext}>
                PASO SIGUIENTE
              </button>
            ) : null}
            <button
              type="button"
              disabled={finishing}
              aria-busy={finishing}
              className={primary}
              onClick={onFinish}
            >
              {finishing ? 'FINALIZANDO…' : 'FINALIZAR'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
