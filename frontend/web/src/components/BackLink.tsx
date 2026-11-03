import { Link, type LinkProps } from 'react-router'
import styles from './BackLink.module.css'

export default function BackLink({ children, ...props }: Pick<LinkProps, 'to' | 'state' | 'children'>) {
  return <Link {...props} className={styles.link}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="m14 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    {children}
  </Link>
}
