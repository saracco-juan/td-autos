import type { ReactNode } from 'react'
import BackLink from '../../../components/Buttons/BackLink'
import FlowLayout from '../../../components/FlowLayout/FlowLayout'
import screenStyles from '../../../styles/screen.module.css'
import { INVENTORY_PATH } from '../model/inventoryRoutes'
import styles from './VehicleFormPage.module.css'

type Props = {
  title: string
  subtitle: string
  children: ReactNode
  beforeForm?: ReactNode
  // Buttons of the screen, pinned to the bottom of the content area.
  actions?: ReactNode
}

// Frame of the load and edit screens (Figma 38:923 / 2119:1841): back link, eyebrow, title and subtitle, then the form.
export default function VehicleFormPage({ title, subtitle, children, actions = null, beforeForm = null }: Props) {
  return (
    <FlowLayout actions={actions}>
      <div className={styles.header}>
        <BackLink to={INVENTORY_PATH}>
          Volver al inventario
        </BackLink>
        <div className={styles.titles}>
          <p className={screenStyles.eyebrow}>INVENTARIO</p>
          <h1 className={screenStyles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </div>
      {beforeForm}
      {children}
    </FlowLayout>
  )
}
