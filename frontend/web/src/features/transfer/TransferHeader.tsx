import type { Ref } from 'react'
import screenStyles from '../../components/screen.module.css'
import styles from './TransferHeader.module.css'

type Props = {
  completed: number
  total: number
  titleRef: Ref<HTMLHeadingElement>
}

// Shared by the checklist and the summary view: eyebrow, title and counter.
export default function TransferHeader({ completed, total, titleRef }: Props) {
  return (
    <div className={styles.header}>
      <p className={screenStyles.eyebrow}>TRÁMITES</p>
      <h1 ref={titleRef} tabIndex={-1} className={screenStyles.title}>
        Checklist de transferencia
      </h1>
      <p aria-live="polite" className={styles.counter}>
        {completed} de {total} pasos completados
      </p>
    </div>
  )
}
