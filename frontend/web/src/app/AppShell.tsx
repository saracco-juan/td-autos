import { useId, useState, type MouseEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import alertStyles from '../components/alert.module.css'
import { isActiveDealer, isAdmin, isBuyer, isDealer } from '../features/auth/roles'
import { useAuth } from '../features/auth/session/useAuth'
import styles from './AppShell.module.css'

// Brand mark beside the wordmark: the TD monogram of the favicon, in red on a white tile. Decorative; the link is named by its text.
function LogoMark() {
  return (
    <span className={styles.logoMark} aria-hidden="true">
      <svg viewBox="8 18 48 28" width="20" height="12" focusable="false">
        <g fill="currentColor" fillRule="evenodd">
          <path d="M8 18H30V25H22.5V46H15.5V25H8Z" />
          <path d="M34 18H42A14 14 0 0 1 42 46H34ZM41 25V39H42A7 7 0 0 0 42 25Z" />
        </g>
      </svg>
    </span>
  )
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const LOGOUT_ERROR = 'No se pudo cerrar la sesión. Intentá nuevamente.'

// The receipt review lives inside the dealer list (Figma 38:1129 highlights Concesionarias).
const ADMIN_DEALER_PATHS = ['/admin/concesionarias', '/admin/comprobantes/']

// Shared page frame: nav on top (role links beside the logo; Perfil or Administración, the dealer name and the logout on the right) (guest, or the Buyer, Dealer or Admin nav with logout once signed in), routed content, footer.
// Each nav shows only the links whose screens exist: diagnosis, recommendations, transfer and profile for buyers,
// the subscription and the adhesion status for dealers, plus the inventory once the dealer is active, and the dealer
// list and the dashboard for administrators. A signed-in user with any other role gets only the logout.
export default function AppShell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, status, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()

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

  // A followed link closes the phone menu; the logout keeps it open so its busy state stays visible.
  const handleMenuClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('a')) setMenuOpen(false)
  }

  return (
    <div className={styles.shell}>
      <header
        className={styles.nav}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setMenuOpen(false)
        }}
      >
        <Link to="/" className={styles.logo}>
          <LogoMark />
          TD Autos
        </Link>
        {status === 'authenticated' ? (
          <>
            <button
              type="button"
              className={styles.menuToggle}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MenuIcon open={menuOpen} />
              Menú
            </button>
            <div
              id={menuId}
              className={`${styles.menuPanel} ${menuOpen ? styles.menuPanelOpen : ''}`}
              onClick={handleMenuClick}
            >
              <nav aria-label="Principal" className={styles.navLinks}>
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
                  </>
                ) : null}
                {isAdmin(user) ? (
                  <Link
                    to="/admin/concesionarias"
                    className={styles.navAction}
                    aria-current={ADMIN_DEALER_PATHS.some((path) => pathname.startsWith(path)) ? 'page' : undefined}
                  >
                    Concesionarias
                  </Link>
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
                  </>
                ) : null}
              </nav>
              <div className={styles.navActions}>
                {isDealer(user) && user?.concesionaria ? (
                  <span className={styles.navChip}>{user.concesionaria.nombre}</span>
                ) : null}
                {isBuyer(user) ? (
                  <NavLink to="/perfil" className={styles.navAction}>
                    Perfil
                  </NavLink>
                ) : null}
                {isAdmin(user) ? (
                  <NavLink to="/admin" end className={styles.navAction}>
                    Administración
                  </NavLink>
                ) : null}
                <button
                  type="button"
                  className={styles.logout}
                  disabled={loggingOut}
                  aria-busy={loggingOut}
                  onClick={handleLogout}
                >
                  <LogoutIcon />
                  Cerrar sesión
                </button>
              </div>
            </div>
          </>
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
