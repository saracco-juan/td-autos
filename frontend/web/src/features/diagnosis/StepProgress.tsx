import styles from './StepProgress.module.css'
import VehicleSilhouette from './VehicleSilhouette'

type Props = {
  current: number
  total: number
}

export default function StepProgress({ current, total }: Props) {
  const label = `PASO ${current} DE ${total}`
  const progress = total > 1 ? (current - 1) / (total - 1) : 1

  return (
    <div className={styles.group}>
      <div
        role="progressbar"
        aria-label="Progreso del diagnóstico"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={label}
        className={styles.track}
      >
        <div className={styles.road} aria-hidden="true">
          <div className={styles.fill} style={{ transform: `scaleX(${progress})` }} />
        </div>
        <div className={styles.carPosition} style={{ transform: `translateX(${progress * 100}%)` }} aria-hidden="true">
          <VehicleSilhouette shape="sport" className={styles.car} />
        </div>
      </div>
      <div className={styles.caption}><p className={styles.label}>{label}</p><span>Tu diagnóstico</span></div>
    </div>
  )
}
