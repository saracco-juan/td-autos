import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router'
import ButtonLink from '../../../../components/Buttons/ButtonLink'
import styles from './AuthSwitchPanel.module.css'

export type AuthAccessMode = 'login' | 'register'

export default function AuthSwitchPanel({ mode, className }: { mode: AuthAccessMode; className: string }) {
  const navigate = useNavigate()
  const registering = mode === 'register'
  const destination = registering ? '/login' : '/registro'

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.detail === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      navigate(destination, { state: { authMotion: 'reduced' } })
    }
  }

  return (
    <aside className={`${styles.panel} ${className}`} aria-labelledby="auth-panel-title">
      <div className={styles.content}>
        <h2 id="auth-panel-title">{registering ? 'Tu búsqueda continúa acá.' : 'Tu próximo auto empieza por vos.'}</h2>
        <p>{registering
          ? 'Ingresá a tu cuenta para seguir explorando tus opciones.'
          : 'Creá tu cuenta para guardar tus favoritos y retomar tu búsqueda.'}</p>
        <ButtonLink to={destination} onClick={handleClick} variant="secondary" className={styles.action}>
          {registering ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}
        </ButtonLink>
      </div>
    </aside>
  )
}
