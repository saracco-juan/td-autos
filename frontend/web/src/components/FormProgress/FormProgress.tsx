import accessibilityStyles from '../../styles/accessibility.module.css'
import styles from './FormProgress.module.css'

type Props = Readonly<{
  ariaLabel: string
  labels: readonly string[]
  step: number
  instant?: boolean
}>

export default function FormProgress({ ariaLabel, labels, step, instant = false }: Props) {
  const current = labels[step]
  if (!current) return null

  return (
    <div className={styles.root} data-instant={instant || undefined}>
      <progress
        className={accessibilityStyles.visuallyHidden}
        aria-label={ariaLabel}
        aria-valuemin={1}
        aria-valuemax={labels.length}
        aria-valuenow={step + 1}
        aria-valuetext={`Paso ${step + 1} de ${labels.length}: ${current}`}
        value={step + 1}
        max={labels.length}
      />
      <p className={styles.caption} aria-hidden="true">
        Paso {step + 1} de {labels.length}
        <span>{current}</span>
      </p>
      <ol className={styles.progress} aria-hidden="true" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
        {labels.map((label, index) => (
          <li key={label} className={styles.segment} data-current={index === step || undefined}>
            <span className={styles.label}>{label}</span>
            <span className={styles.track}>
              <span className={styles.fill} style={{ transform: `scaleX(${index <= step ? 1 : 0})` }} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
