import type { ReactNode, Ref } from 'react'
import alertStyles from '../alert.module.css'
import styles from './ChecklistWarning.module.css'

type Props = {
  // The page moves the focus here when the warning opens.
  warningRef: Ref<HTMLParagraphElement>
  children: ReactNode
}

// The flagged-pending warning box shown above the columns.
export default function ChecklistWarning({ warningRef, children }: Props) {
  return (
    <p ref={warningRef} tabIndex={-1} role="alert" className={`${alertStyles.warning} ${styles.warning}`}>
      {children}
    </p>
  )
}
