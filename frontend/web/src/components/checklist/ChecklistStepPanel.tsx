import type { ReactNode, Ref } from 'react'
import alertStyles from '../alert.module.css'
import { stepPanelId, stepTabId } from './ids'
import styles from './ChecklistStepPanel.module.css'
import type { ChecklistStep } from '@shared/checklist/types'

type Props = {
  // Prefix of the tab and panel ids; must match the one given to the step list.
  idPrefix: string
  step: ChecklistStep
  completedCodes: ReadonlySet<string>
  saveFailed: boolean
  // Shown as an alert while `saveFailed`.
  saveError: string
  // Badge text of the flagged items.
  flagLabel: string
  // Previous/next move the focus here, so the new step is announced.
  headingRef: Ref<HTMLHeadingElement>
  onToggle: (code: string, completed: boolean) => void
  // Optional content under the rows (for example a source note).
  children?: ReactNode
}

// Right card: the selected step, labelled by its tab. The hint and error slots keep their space
// (see the min-height in the CSS) so the card does not change height from one step to another.
export default function ChecklistStepPanel({
  idPrefix,
  step,
  completedCodes,
  saveFailed,
  saveError,
  flagLabel,
  headingRef,
  onToggle,
  children,
}: Props) {
  return (
    <div
      role="tabpanel"
      id={stepPanelId(idPrefix, step.numero)}
      aria-labelledby={stepTabId(idPrefix, step.numero)}
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
                {item.flagged ? <> <span className={styles.badge}>{flagLabel}</span></> : null}
              </label>
            </li>
          )
        })}
      </ul>

      {children}

      {saveFailed ? (
        <p role="alert" className={`${alertStyles.alert} ${styles.message}`}>
          {saveError}
        </p>
      ) : null}
    </div>
  )
}
