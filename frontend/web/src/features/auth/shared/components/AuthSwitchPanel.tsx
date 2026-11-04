import AuthSwitchLink from './AuthSwitchLink'
import styles from './AuthSwitchPanel.module.css'

export type AuthAccessMode = 'login' | 'register'

export default function AuthSwitchPanel({ mode, className }: { mode: AuthAccessMode; className: string }) {
  const registering = mode === 'register'
  const destination = registering ? '/login' : '/registro'

  return (
    <aside className={`${styles.panel} ${className}`} aria-labelledby="auth-panel-title">
      <div className={styles.content}>
        <h2 id="auth-panel-title">{registering ? 'Tu búsqueda continúa acá.' : 'Tu próximo auto empieza por vos.'}</h2>
        <p>{registering
          ? 'Ingresá a tu cuenta para seguir explorando tus opciones.'
          : 'Creá tu cuenta para guardar tus favoritos y retomar tu búsqueda.'}</p>
        <AuthSwitchLink to={destination} button className={styles.action}>
          {registering ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}
        </AuthSwitchLink>
      </div>
    </aside>
  )
}
