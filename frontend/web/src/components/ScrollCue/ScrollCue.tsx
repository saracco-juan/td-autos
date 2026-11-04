import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import styles from './ScrollCue.module.css'

export default function ScrollCue({ to, direction = 'down', children }: {
  to: string
  direction?: 'up' | 'down'
  children: ReactNode
}) {
  const { pathname, search, state } = useLocation()
  return (
    <Link to={{ pathname, search, hash: to }} state={state} className={styles.cue} data-direction={direction}>
      {children}
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d={direction === 'up' ? 'M12 20V4m-6 6 6-6 6 6' : 'M12 4v16m-6-6 6 6 6-6'} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}
