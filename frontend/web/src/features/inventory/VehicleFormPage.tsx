import type { ReactNode } from 'react'
import { Link } from 'react-router'
import FlowLayout from '../../components/FlowLayout'
import screenStyles from '../../components/screen.module.css'
import { INVENTORY_PATH } from './inventoryRoutes'
import styles from './VehicleFormPage.module.css'

type Props = {
  title: string
  subtitle: string
  children: ReactNode
  // Buttons of the screen, pinned to the bottom of the content area.
  actions?: ReactNode
}

// Frame of the load and edit screens (Figma 38:923 / 2119:1841): back link, eyebrow, title and subtitle, then the form.
export default function VehicleFormPage({ title, subtitle, children, actions = null }: Props) {
  return (
    <FlowLayout actions={actions}>
      <div className={styles.header}>
        <Link to={INVENTORY_PATH} className={styles.back}>
          <span aria-hidden="true" className={styles.arrow}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Volver al inventario
        </Link>
        <div className={styles.titles}>
          <p className={screenStyles.eyebrow}>INVENTARIO</p>
          <h1 className={screenStyles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </div>
      {children}
    </FlowLayout>
  )
}
