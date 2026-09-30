import { Outlet } from 'react-router'
import styles from './AuthLayout.module.css'

// Bare layout for auth screens (Figma "02 - Registro"): no nav, no footer, card centered.
export default function AuthLayout() {
  return (
    <main className={styles.layout}>
      <Outlet />
    </main>
  )
}
