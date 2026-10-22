import { Link, Outlet } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import { DEALER_STATE_PENDING, isActiveDealer } from '../auth/roles'
import { useAuth } from '../auth/session/useAuth'
import styles from './ActiveDealerRoute.module.css'

// Same messages as the backend dealer.active middleware (EnsureDealerIsActive).
const MESSAGE_PENDING = 'Tu cuenta está pendiente de aprobación. Todavía no podés gestionar el inventario.'
const MESSAGE_FORBIDDEN = 'No tenés permiso para realizar esta acción.'

// Layout route for the dealer screens that need an approved dealer (HU17 scenario 3, TC-45):
// anyone else gets the denial in place of the route content, so the URL stays put.
export default function ActiveDealerRoute() {
  const { user } = useAuth()

  if (isActiveDealer(user)) return <Outlet />

  const pending = user?.concesionaria?.estado_alta === DEALER_STATE_PENDING

  return (
    <div className={styles.denied}>
      <p role="alert" className={pending ? alertStyles.warning : alertStyles.alert}>
        {pending ? MESSAGE_PENDING : MESSAGE_FORBIDDEN}
      </p>
      <Link to="/concesionaria" className={styles.back}>
        Volver a verificación
      </Link>
    </div>
  )
}
