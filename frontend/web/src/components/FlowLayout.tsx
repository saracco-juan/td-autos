import type { ReactNode } from 'react'
import barStyles from './checklist/pinnedBar.module.css'
import styles from './FlowLayout.module.css'

type Props = {
  children: ReactNode
  // Buttons of the screen. They sit in a bar pinned to the bottom of the content area; null shows no bar.
  actions: ReactNode
  // Content that does not need the full width (diagnosis, inspection, transfer, dealer verification): a centered column up to 1040 px.
  narrow?: boolean
  className?: string
}

// Frame of the flow and form screens: fills the free height between the header and the footer, with the content
// on top and the action bar at the bottom. A taller content scrolls the page and the bar stays visible.
export default function FlowLayout({ children, actions, narrow = false, className = '' }: Props) {
  return (
    <div className={`${styles.flow} ${narrow ? styles.narrow : ''} ${className}`}>
      <div className={styles.body}>{children}</div>
      {actions ? (
        <div role="group" aria-label="Acciones" className={barStyles.bar}>
          {actions}
        </div>
      ) : null}
    </div>
  )
}
