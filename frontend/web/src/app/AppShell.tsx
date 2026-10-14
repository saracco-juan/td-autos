import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import alertStyles from '../components/alert.module.css'
import { isDealer } from '../features/auth/roles'
import { useAuth } from '../features/auth/session/useAuth'
import styles from './AppShell.module.css'

const LOGOUT_ERROR = 'No se pudo cerrar la sesión. Intentá nuevamente.'

// Shared page frame: nav on top (guest, or the Buyer or Dealer nav with logout once signed in), routed content, footer.
// Each nav shows only the links whose screens exist: diagnosis, recommendations, transfer and profile for buyers,
// the adhesion status for dealers.
export default function AppShell() {
  const navigate = useNavigate()
  const { user, status, logout } = useAuth()
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
          <div className={styles.navActions}>
            {isDealer(user) ? (
              <>
                <NavLink to="/concesionaria" end className={styles.navAction}>
                  Verificación
                </NavLink>
                {user?.concesionaria ? <span className={styles.navText}>{user.concesionaria.nombre}</span> : null}
              </>
            ) : (
              <>
                <NavLink to="/diagnostico" className={styles.navAction}>
                  Diagnóstico
                </NavLink>
                <NavLink to="/recomendaciones" className={styles.navAction}>
                  Recomendados
                </NavLink>
                <NavLink to="/transferencia" className={styles.navAction}>
                  Transferencia
                </NavLink>
                <NavLink to="/perfil" className={styles.navAction}>
                  Perfil
                </NavLink>
              </>
            )}
            <button
              type="button"
              className={styles.navAction}
              disabled={loggingOut}
              aria-busy={loggingOut}
              onClick={handleLogout}
            >
              Cerrar sesión
            </button>
          </div>
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
