import { Link, Outlet } from 'react-router'
import styles from './AppShell.module.css'

// Shared page frame: guest nav on top, routed content, footer.
// Pending: swap the guest nav for the Buyer nav (Figma Nav/Top · Buyer) once sessions drive it.
export default function AppShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.nav}>
        <Link to="/" className={styles.logo}>
          TD Autos
        </Link>
      </header>
      <main className={styles.content}>
        <Outlet />
      </main>
      <footer className={styles.footer}>© 2026 TD Autos. Todos los derechos reservados.</footer>
    </div>
  )
}
