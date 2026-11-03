import { Link } from 'react-router'
import styles from './AppFooter.module.css'

export default function AppFooter({ home }: { home: boolean }) {
  return (
    <footer className={`${styles.footer} ${home ? styles.home : ''}`}>
      <div className={styles.panel}>
        <div className={styles.information}>
          <nav aria-label="Pie de página" className={styles.links}>
            <Link to="/">Inicio</Link>
            {home ? (
              <>
                <a href="#diagnostico">Cómo funciona</a>
                <a href="#concesionarias">Para concesionarias</a>
              </>
            ) : null}
            <a href="#root">
              Volver arriba
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M12 20V4m-6 6 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </nav>
          <div className={styles.team}>
            <h2>Detrás de TD Autos</h2>
            <p>Un proyecto de</p>
            <ul>
              <li>Juan Zaracco</li>
              <li>Mariano Giardina</li>
            </ul>
          </div>
        </div>
        <p className={styles.wordmark}>TD Autos</p>
      </div>
      <p className={styles.copyright}>© {new Date().getFullYear()} TD Autos. Todos los derechos reservados.</p>
    </footer>
  )
}
