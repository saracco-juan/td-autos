import type { Ref } from 'react'
import alertStyles from '../../components/alert.module.css'
import { stepPanelId, stepTabId } from './stepIds'
import styles from './InspectionStepPanel.module.css'
import type { InspectionStep } from './types'

export const SAVE_ERROR = 'No pudimos guardar el cambio. Probá de nuevo.'

type Props = {
  step: InspectionStep
  completedCodes: ReadonlySet<string>
  saveFailed: boolean
  // Previous/next move the focus here, so the new step is announced.
  headingRef: Ref<HTMLHeadingElement>
  onToggle: (code: string, completed: boolean) => void
}

// Right card: the selected step, labelled by its tab. The hint and error slots keep their space
// (see the min-height in the CSS) so the card does not change height from one step to another.
export default function InspectionStepPanel({ step, completedCodes, saveFailed, headingRef, onToggle }: Props) {
  return (
    <div
      role="tabpanel"
      id={stepPanelId(step.numero)}
      aria-labelledby={stepTabId(step.numero)}
      className={styles.panel}
    >
      <div className={styles.head}>
        <h2 ref={headingRef} tabIndex={-1} className={styles.title}>
          {step.numero}. {step.titulo}
        </h2>
        {step.ayuda ? <p className={styles.hint}>{step.ayuda}</p> : null}
      </div>

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
  )
}
