import BrandLink from '../../../../components/BrandLink/BrandLink'
import BackLink from '../../../../components/Buttons/BackLink'
import styles from './AuthPageHeader.module.css'

export default function AuthPageHeader({ className = '' }: Readonly<{ className?: string }>) {
  return (
    <nav className={`${styles.header} ${className}`} aria-label="Navegación de acceso">
      <BrandLink />
      <BackLink to="/">Volver al inicio</BackLink>
    </nav>
  )
}
