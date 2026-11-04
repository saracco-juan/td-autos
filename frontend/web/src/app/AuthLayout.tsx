import { Link, Outlet, useLocation } from 'react-router'
import BackLink from '../components/Buttons/BackLink'
import AuthSwitchPanel from '../features/auth/shared/components/AuthSwitchPanel'
import styles from './AuthLayout.module.css'

export default function AuthLayout() {
  const location = useLocation()
  const mode = location.pathname === '/login' ? 'login' : location.pathname === '/registro' ? 'register' : null

  if (mode) {
    return (
      <main className={styles.accessLayout}>
        <div className={styles.frame}>
          <nav className={styles.topbar} aria-label="Navegación de acceso">
            <Link to="/" className={styles.brand} aria-label="TD Autos"><span>TD</span> Autos</Link>
            <BackLink to="/">Volver al inicio</BackLink>
          </nav>
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
