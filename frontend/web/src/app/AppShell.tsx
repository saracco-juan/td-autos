import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import alertStyles from '../components/alert.module.css'
import { isActiveDealer, isAdmin, isBuyer, isDealer } from '../features/auth/roles'
import { useAuth } from '../features/auth/session/useAuth'
import styles from './AppShell.module.css'

const LOGOUT_ERROR = 'No se pudo cerrar la sesión. Intentá nuevamente.'

// The receipt review lives inside the dealer list (Figma 38:1129 highlights Concesionarias).
const ADMIN_DEALER_PATHS = ['/admin/concesionarias', '/admin/comprobantes/']

// Shared page frame: nav on top (guest, or the Buyer, Dealer or Admin nav with logout once signed in), routed content, footer.
// Each nav shows only the links whose screens exist: diagnosis, recommendations, transfer and profile for buyers,
// the subscription and the adhesion status for dealers, plus the inventory once the dealer is active, and the dealer
// list and the dashboard for administrators. A signed-in user with any other role gets only the logout.
export default function AppShell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
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
                <NavLink to="/concesionaria/suscripcion" className={styles.navAction}>
                  Suscripción
                </NavLink>
                <NavLink to="/concesionaria" end className={styles.navAction}>
                  Verificación
                </NavLink>
                {isActiveDealer(user) ? (
                  <NavLink to="/concesionaria/inventario" className={styles.navAction}>
                    Inventario
                  </NavLink>
                ) : null}
                {user?.concesionaria ? <span className={styles.navText}>{user.concesionaria.nombre}</span> : null}
              </>
            ) : null}
            {isAdmin(user) ? (
              <>
                <Link
                  to="/admin/concesionarias"
                  className={styles.navAction}
                  aria-current={ADMIN_DEALER_PATHS.some((path) => pathname.startsWith(path)) ? 'page' : undefined}
                >
                  Concesionarias
                </Link>
                <NavLink to="/admin" end className={styles.navAction}>
                  Administración
                </NavLink>
              </>
            ) : null}
            {isBuyer(user) ? (
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
            ) : null}
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
