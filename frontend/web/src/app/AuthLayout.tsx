import { Outlet, useLocation } from 'react-router'
import AuthPageHeader from '../features/auth/shared/components/AuthPageHeader'
import AuthSwitchPanel from '../features/auth/shared/components/AuthSwitchPanel'
import styles from './AuthLayout.module.css'

export default function AuthLayout() {
  const location = useLocation()
  const mode = location.pathname === '/login' ? 'login' : location.pathname === '/registro' ? 'register' : null

  if (mode) {
    return (
      <main className={styles.accessLayout}>
        <div className={styles.frame}>
          <AuthPageHeader className={styles.topbar} />
          <div className={styles.stage} data-mode={mode} data-instant={location.state?.authMotion === 'reduced' || undefined}>
            <div className={styles.formSlot}><Outlet /></div>
            <AuthSwitchPanel mode={mode} className={styles.panel} />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.layout}>
      <Outlet />
    </main>
  )
}
