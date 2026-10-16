import type { ReactNode } from 'react'
import barStyles from './checklist/pinnedBar.module.css'
import styles from './FlowLayout.module.css'

type Props = {
  children: ReactNode
  // Buttons of the screen. They sit in a bar pinned to the bottom of the content area; null shows no bar.
  actions: ReactNode
}

// Frame of the flow and form screens: fills the free height between the header and the footer, with the content
// on top and the action bar at the bottom. A taller content scrolls the page and the bar stays visible.
export default function FlowLayout({ children, actions }: Props) {
  return (
    <div className={styles.flow}>
      <div className={styles.body}>{children}</div>
      {actions ? (
        <div role="group" aria-label="Acciones" className={barStyles.bar}>
          {actions}
        </div>
      ) : null}
    </div>
  )
}
