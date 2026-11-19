import { Link } from 'react-router'
import styles from './BrandLink.module.css'

export default function BrandLink({ className = '' }: Readonly<{ className?: string }>) {
  return <Link to="/" className={`${styles.brand} ${className}`} aria-label="TD Autos"><span>TD</span> Autos</Link>
}
