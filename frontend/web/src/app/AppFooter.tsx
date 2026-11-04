import { Link } from 'react-router'
import styles from './AppFooter.module.css'
import ScrollCue from '../components/ScrollCue/ScrollCue'

export default function AppFooter({ home }: { home: boolean }) {
  return (
    <footer className={`${styles.footer} ${home ? styles.home : ''}`}>
      <div className={styles.information}>
        <nav aria-label="Pie de página" className={styles.links}>
          <Link to="/">Inicio</Link>
          {home ? (
            <>
              <Link to="#diagnostico">Cómo funciona</Link>
              <Link to="#concesionarias">Para concesionarias</Link>
            </>
          ) : null}
        </nav>
        <div className={styles.return}>
          <ScrollCue to="#root" direction="up">Volver arriba</ScrollCue>
        </div>
        <div className={styles.team}>
          <h2>Detrás de TD Autos</h2>
          <p>Un proyecto de</p>
          <ul>
            <li>Juan Saraco</li>
            <li>Mariano Giardina</li>
          </ul>
        </div>
      </div>
      <p className={styles.wordmark}>TD Autos</p>
      <p className={styles.copyright}>© {new Date().getFullYear()} TD Autos. Todos los derechos reservados.</p>
    </footer>
  )
}
