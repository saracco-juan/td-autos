import type { ReactNode } from 'react'
import styles from './ListFooter.module.css'

type ListFooterProps = {
  /** List actions (for example CARGAR VEHÍCULO), on the left. */
  actions?: ReactNode
  /** The pager, on the right. */
  children?: ReactNode
}

// Row under a list: the actions on the left and the pager on the right, on one line; on phones the pager wraps under the actions.
export default function ListFooter({ actions, children }: ListFooterProps) {
  return (
    <div className={styles.footer}>
      <div className={styles.actions}>{actions}</div>
      <div className={styles.pager}>{children}</div>
    </div>
  )
}
