import { Navigate, Outlet } from 'react-router'
import alertStyles from '../../../components/alert.module.css'
import { isBuyer, isDealer } from '../roles'
import styles from './RoleRoute.module.css'
import { useAuth } from './useAuth'

type Props = {
  allow: 'buyer' | 'dealer'
}

// Same message as the backend denial (EnsureDealerIsActive::MESSAGE_FORBIDDEN).
const MESSAGE_FORBIDDEN = 'No tenés permiso para realizar esta acción.'

// Layout route under ProtectedRoute: keeps each role on its own screens.
// A dealer opening a buyer route goes to /concesionaria; a buyer opening a dealer route goes to /.
// A user who is neither (another role, or none) has no screen to be sent to: the denial replaces
// the route content, so the URL stays put and nothing loops between / and /concesionaria.
export default function RoleRoute({ allow }: Props) {
  const { user } = useAuth()
  const buyer = isBuyer(user)
  const dealer = isDealer(user)

  if (!buyer && !dealer) {
    return (
      <div className={styles.denied}>
        <p role="alert" className={alertStyles.alert}>
          {MESSAGE_FORBIDDEN}
        </p>
      </div>
    )
  }
  if (allow === 'buyer' && dealer) return <Navigate to="/concesionaria" replace />
  if (allow === 'dealer' && buyer) return <Navigate to="/" replace />
  return <Outlet />
}
