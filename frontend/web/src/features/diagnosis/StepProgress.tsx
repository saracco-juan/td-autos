import styles from './StepProgress.module.css'

type Props = {
  current: number
  total: number
}

// "PASO N DE 7" with the 8 px bar; the bar exposes its value to assistive technology.
export default function StepProgress({ current, total }: Props) {
  const label = `PASO ${current} DE ${total}`

  return (
    <div className={styles.group}>
      <p className={styles.label}>{label}</p>
      <div
        role="progressbar"
        aria-label="Progreso del diagnóstico"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={label}
        className={styles.track}
      >
        <div className={styles.fill} style={{ width: `${(current / total) * 100}%` }} />
      </div>
    </div>
  )
}
