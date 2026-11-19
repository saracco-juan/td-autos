import { useEffect, useId, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import alertStyles from '../styles/alert.module.css'
import { isAdmin, isBuyer, isDealer } from '../features/auth/model/roles'
import { useAuth } from '../features/auth/session/hooks/useAuth'
import styles from './AppShell.module.css'
import AppFooter from './AppFooter'
import DealerShell from '../features/dealer/components/DealerShell'
import AdminShell from '../features/admin/components/AdminShell'
import { isAdminDealerSection } from '../features/admin/model/navigation'
import DealerNavigation from '../features/dealer/components/DealerNavigation'
import { LogoutIcon, MenuIcon } from '../components/NavigationIcons/NavigationIcons'

// Brand mark before the wordmark: the TD monogram of the favicon, in red on a white tile. Decorative; the link carries the name.
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

const LOGOUT_ERROR = 'No se pudo cerrar la sesión. Intentá nuevamente.'

const HOME_SECTIONS = [
  ['diagnostico', 'Diagnóstico'], ['busqueda', 'Búsqueda'], ['comparacion', 'Comparación'],
  ['costos', 'Costos'], ['checklists', 'Checklists'], ['concesionarias', 'Concesionarias'],
]

// Role workspaces reuse DashboardShell; public and buyer routes keep the top navigation and footer.
// Each nav shows only the links whose screens exist: diagnosis, recommendations, transfer and profile for buyers,
// the subscription and the adhesion status for dealers, plus the inventory once the dealer is active, and the dealer
// list and the dashboard for administrators. A signed-in user with any other role gets only the logout.
export default function AppShell() {
  const navigate = useNavigate()
  const { pathname, hash, key: locationKey } = useLocation()
  const { user, status, logout } = useAuth()
  const dealerWorkspace = status === 'authenticated' && isDealer(user) &&
    (pathname === '/concesionaria' || pathname.startsWith('/concesionaria/'))
  const adminWorkspace = status === 'authenticated' && isAdmin(user) &&
    (pathname === '/admin' || pathname.startsWith('/admin/'))
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)
  // The phone menu belongs to the navigation it was opened on: following any link (a new location key) closes it.
  const [menuOpenedAt, setMenuOpenedAt] = useState<string | null>(null)
  const menuOpen = menuOpenedAt === locationKey
  const setMenuOpen = (open: boolean) => setMenuOpenedAt(open ? locationKey : null)
  const menuId = useId()
  const [visibleSection, setVisibleSection] = useState<string | null>(null)

  useEffect(() => {
    if (pathname !== '/' || status === 'authenticated') return
    const sections = HOME_SECTIONS.map(([id]) => document.getElementById(id))
    let anchor = hash ? document.getElementById(hash.slice(1)) : null
    let frame = 0
    const updateSection = () => {
      frame = 0
      // Anchor navigation keeps its destination selected while passing other sections.
      if (anchor) {
        const top = anchor.getBoundingClientRect().top
    const margin = Number.parseFloat(getComputedStyle(anchor).scrollMarginTop) || 0
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight
        setVisibleSection(HOME_SECTIONS.some(([id]) => id === anchor?.id) ? anchor.id : null)
        if (Math.abs(top - margin) < 2 || (maxScroll > 0 && window.scrollY >= maxScroll - 2 && top >= margin)) {
          anchor = null
        }
        return
      }
      // Follow the reading area below the header, including upward and fast scrolling.
      const readingLine = Math.min(window.innerHeight / 3, 240)
      let current: string | null = null
      for (const section of sections) {
        if (section && section.getBoundingClientRect().top <= readingLine) current = section.id
      }
      setVisibleSection(current)
    }
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateSection)
    }
    const followManualScroll = () => {
      anchor = null
      scheduleUpdate()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) followManualScroll()
    }
    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    window.addEventListener('wheel', followManualScroll, { passive: true })
    window.addEventListener('touchstart', followManualScroll, { passive: true })
    window.addEventListener('pointerdown', followManualScroll, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('wheel', followManualScroll)
      window.removeEventListener('touchstart', followManualScroll)
      window.removeEventListener('pointerdown', followManualScroll)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [pathname, status, hash, locationKey])

  // Router anchors share one scroll path; native links would jump before this effect.
  useEffect(() => {
    if (!hash || (pathname !== '/' && hash !== '#root')) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.getElementById(hash.slice(1))?.scrollIntoView({
      block: 'start', behavior: reduceMotion ? 'instant' : 'smooth',
    })
  }, [pathname, hash, locationKey])

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

  // Escape closes the phone menu wherever the focus is.
  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpenedAt(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  if ((dealerWorkspace || adminWorkspace) && user) {
    const WorkspaceShell = adminWorkspace ? AdminShell : DealerShell
    return <WorkspaceShell user={user} menuOpen={menuOpen} menuId={menuId}
      onMenuToggle={() => setMenuOpen(!menuOpen)} loggingOut={loggingOut} onLogout={handleLogout}>
      {logoutFailed ? <p role="alert" className={`${alertStyles.alert} ${styles.alert}`}>{LOGOUT_ERROR}</p> : null}
      <Outlet />
    </WorkspaceShell>
  }

  return (
    <div className={`${styles.shell} ${pathname === '/' ? styles.homeShell : ''}`}>
      <header className={styles.nav}>
        {/* The TD monogram reads as "TD", so the wordmark only adds "Autos"; the link keeps the full brand name. */}
        <Link to="/" className={styles.logo} aria-label="TD Autos">
          <LogoMark />
          Autos
        </Link>
        {status === 'authenticated' ? (
          <>
            <button
              type="button"
              className={styles.menuToggle}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MenuIcon open={menuOpen} />
              Menú
            </button>
            <div
              id={menuId}
              className={`${styles.menuPanel} ${menuOpen ? styles.menuPanelOpen : ''}`}
            >
              <nav aria-label="Principal" className={styles.navLinks}>
                {isDealer(user) ? (
                  <DealerNavigation user={user} className={styles.navAction} />
                ) : null}
                {isAdmin(user) ? (
                  <Link
                    to="/admin/concesionarias"
                    className={styles.navAction}
                    aria-current={isAdminDealerSection(pathname) ? 'page' : undefined}
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
                    <NavLink to="/favoritos" className={styles.navAction}>
                      Favoritos
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
        ) : (
          <>
            <button type="button" className={styles.menuToggle} aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(!menuOpen)}>
              <MenuIcon open={menuOpen} />Menú
            </button>
            <div id={menuId} className={`${styles.menuPanel} ${menuOpen ? styles.menuPanelOpen : ''}`}>
              <nav aria-label="Principal" className={styles.navLinks}>
                {HOME_SECTIONS.map(([id, label]) => (
                  <Link key={id} to={`/#${id}`} className={styles.navAction}
                    aria-current={pathname === '/' && visibleSection === id ? 'location' : undefined}
                    onClick={() => setMenuOpen(false)}>{label}</Link>
                ))}
              </nav>
              <div className={styles.navActions}>
                <Link to="/login" className={styles.navAction}>Iniciar sesión</Link>
                <Link to="/registro" className={styles.logout}>Registrarse</Link>
              </div>
            </div>
          </>
        )}
      </header>
      <main className={styles.content}>
        {logoutFailed ? (
          <p role="alert" className={`${alertStyles.alert} ${styles.alert}`}>
            {LOGOUT_ERROR}
          </p>
        ) : null}
        <Outlet />
      </main>
      <AppFooter home={pathname === '/'} />
    </div>
  )
}
