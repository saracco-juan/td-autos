import alertStyles from '../alert.module.css'
import buttonStyles from '../button.module.css'
import styles from './ChecklistActionBar.module.css'
import barStyles from './pinnedBar.module.css'

export type ChecklistActionLabels = {
  previous: string
  next: string
  finish: string
  finishAnyway: string
  keepWorking: string
  // Alert shown above the buttons when finishing failed.
  finishError: string
}

type Props = {
  labels: ChecklistActionLabels
  // The flagged-pending warning is open: the bar offers finishAnyway / keepWorking.
  warning: boolean
  finishing: boolean
  finishFailed: boolean
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onFinish: () => void
  onFinishAnyway: () => void
  onKeepWorking: () => void
}

const secondary = `${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.soft} ${barStyles.action}`
const primary = `${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.soft} ${barStyles.action}`

// Content of the pinned bar (FlowLayout draws the bar). The primary button is always the right-most one, so it never moves
// when previous or next come and go.
export default function ChecklistActionBar({
  labels,
  warning,
  finishing,
  finishFailed,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onFinish,
  onFinishAnyway,
  onKeepWorking,
}: Props) {
  return (
    <>
      <div className={styles.message}>
        {finishFailed ? (
          <p role="alert" className={`${alertStyles.alert} ${styles.alert}`}>
            {labels.finishError}
          </p>
        ) : null}
      </div>
      <div className={barStyles.actions}>
        {warning ? (
          <>
            <button
              type="button"
              disabled={finishing}
              aria-busy={finishing}
              className={secondary}
              onClick={onFinishAnyway}
            >
              {finishing ? 'FINALIZANDO…' : labels.finishAnyway}
            </button>
            <button type="button" disabled={finishing} className={primary} onClick={onKeepWorking}>
              {labels.keepWorking}
            </button>
          </>
        ) : (
          <>
            {hasPrevious ? (
              <button type="button" disabled={finishing} className={secondary} onClick={onPrevious}>
                {labels.previous}
              </button>
            ) : null}
            {hasNext ? (
              <button type="button" disabled={finishing} className={secondary} onClick={onNext}>
                {labels.next}
              </button>
            ) : null}
            <button
              type="button"
              disabled={finishing}
              aria-busy={finishing}
              className={primary}
              onClick={onFinish}
            >
              {finishing ? 'FINALIZANDO…' : labels.finish}
            </button>
          </>
        )}
      </div>
    </>
  )
}
