import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router'
import alertStyles from '../components/alert.module.css'
import { useAuth } from '../features/auth/session/useAuth'
import styles from './AppShell.module.css'

const LOGOUT_ERROR = 'No se pudo cerrar la sesión. Intentá nuevamente.'

// Shared page frame: nav on top (guest, or Buyer with logout once signed in), routed content, footer.
// The Buyer nav shows only the logo and logout until the screens behind its other links exist.
export default function AppShell() {
  const navigate = useNavigate()
  const { status, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)

  const handleLogout = async () => {
    setLogoutFailed(false)
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      setLogoutFailed(true)
      setLoggingOut(false)
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.nav}>
        <Link to="/" className={styles.logo}>
          TD Autos
        </Link>
        {status === 'authenticated' ? (
          <button
            type="button"
            className={styles.navAction}
            disabled={loggingOut}
            aria-busy={loggingOut}
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        ) : null}
      </header>
      <main className={styles.content}>
        {logoutFailed ? (
          <p role="alert" className={`${alertStyles.alert} ${styles.alert}`}>
            {LOGOUT_ERROR}
          </p>
        ) : null}
        <Outlet />
      </main>
      <footer className={styles.footer}>© 2026 TD Autos. Todos los derechos reservados.</footer>
    </div>
  )
}
