import alertStyles from '../../components/alert.module.css'
import styles from './InspectionStepCard.module.css'
import type { InspectionStep } from './types'

export const SAVE_ERROR = 'No pudimos guardar el cambio. Probá de nuevo.'

type Props = {
  step: InspectionStep
  completedCodes: ReadonlySet<string>
  open: boolean
  saveFailed: boolean
  onToggleOpen: () => void
  onToggle: (code: string, completed: boolean) => void
}

// One accordion panel: the header button shows the step and its progress; the hint, the items and the
// save error live in the collapsible region. A collapsed region is `hidden`, so Tab never reaches it.
export default function InspectionStepCard({
  step,
  completedCodes,
  open,
  saveFailed,
  onToggleOpen,
  onToggle,
}: Props) {
  const titleId = `inspection-step-${step.numero}-title`
  const panelId = `inspection-step-${step.numero}-panel`
  const done = step.items.filter((item) => completedCodes.has(item.codigo)).length

  return (
    <section aria-labelledby={titleId} className={styles.card}>
      <h2 className={styles.heading}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          className={styles.toggle}
          onClick={onToggleOpen}
        >
          <span id={titleId} className={styles.title}>
            {step.numero}. {step.titulo}
          </span>
          <span className={styles.progress}>
            {done} de {step.items.length}
          </span>
          <svg
            aria-hidden="true"
            className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h2>

      <div id={panelId} hidden={!open} className={styles.panel}>
        {step.ayuda ? <p className={styles.hint}>{step.ayuda}</p> : null}

        <ul className={styles.items}>
          {step.items.map((item) => {
            const checked = completedCodes.has(item.codigo)
            return (
              <li key={item.codigo}>
                <label className={`${styles.row} ${checked ? styles.checked : ''}`}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={checked}
                    onChange={() => onToggle(item.codigo, !checked)}
                  />
                  <span className={styles.text}>{item.texto}</span>
                  {/* The space keeps the badge a separate word in the accessible name. */}
                  {item.critico ? <> <span className={styles.badge}>CRÍTICO</span></> : null}
                </label>
              </li>
            )
          })}
        </ul>

        {saveFailed ? (
          <p role="alert" className={`${alertStyles.alert} ${styles.message}`}>
            {SAVE_ERROR}
          </p>
        ) : null}
      </div>
    </section>
  )
}
