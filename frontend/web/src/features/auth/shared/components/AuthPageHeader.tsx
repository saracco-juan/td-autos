import { Link } from 'react-router'
import BackLink from '../../../../components/Buttons/BackLink'
import styles from './AuthPageHeader.module.css'

export default function AuthPageHeader({ className = '' }: { className?: string }) {
  return (
    <nav className={`${styles.header} ${className}`} aria-label="Navegación de acceso">
      <Link to="/" className={styles.brand} aria-label="TD Autos"><span>TD</span> Autos</Link>
      <BackLink to="/">Volver al inicio</BackLink>
    </nav>
  )
}
