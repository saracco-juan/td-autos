import styles from './StepProgress.module.css'

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
          {Array.from({ length: total }, (_, index) => (
            <span key={index} className={styles.milestone} data-reached={index < current}
              style={{ left: `${total > 1 ? index / (total - 1) * 100 : 100}%` }} />
          ))}
        </div>
        <div className={styles.carPosition} style={{ transform: `translateX(${progress * 100}%)` }} aria-hidden="true">
          <svg className={styles.car} viewBox="0 0 120 44" fill="none" focusable="false">
            <path d="m5 27 4-9 23-2C42 16 45 7 57 7h14c9 0 16 9 24 12l16 4 6 7-2 5H6Z" fill="currentColor" />
            <path d="M40 17c6-2 9-7 18-7h11c5 0 11 4 16 9Z" fill="#231f1c" />
            <path d="m65 8 4 9M35 19l52 2M47 23l-4 10" stroke="#8c1306" strokeWidth="1.5" />
            <path d="m87 22 21 3 3 3-16-2Z" fill="#f5f5f5" />
            <path d="m7 23 10-2-1 4H6Z" fill="#8c1306" />
            <path d="M6 33h109l-2 4H8Z" fill="#231f1c" />
            <circle cx="28" cy="33" r="10" fill="#231f1c" />
            <circle cx="96" cy="33" r="10" fill="#231f1c" />
            <circle cx="28" cy="33" r="5" fill="#c9c7c5" />
            <circle cx="96" cy="33" r="5" fill="#c9c7c5" />
            <circle cx="28" cy="33" r="2" fill="#231f1c" />
            <circle cx="96" cy="33" r="2" fill="#231f1c" />
          </svg>
        </div>
      </div>
      <div className={styles.caption}><p className={styles.label}>{label}</p><span>Tu diagnóstico</span></div>
    </div>
  )
}
