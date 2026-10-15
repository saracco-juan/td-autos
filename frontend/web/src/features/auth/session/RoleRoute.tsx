import { Navigate, Outlet } from 'react-router'
import alertStyles from '../../../components/alert.module.css'
import type { User } from '../types'
import { isAdmin, isBuyer, isDealer } from '../roles'
import styles from './RoleRoute.module.css'
import { useAuth } from './useAuth'

type Area = 'buyer' | 'dealer' | 'admin'

type Props = {
  allow: Area
}

// Where each role's screens start.
const HOME: Record<Area, string> = {
  buyer: '/',
  dealer: '/concesionaria',
  admin: '/admin',
}

// Same message as the backend denial (EnsureDealerIsActive::MESSAGE_FORBIDDEN).
const MESSAGE_FORBIDDEN = 'No tenés permiso para realizar esta acción.'

function areaOf(user: User | null): Area | null {
  if (isBuyer(user)) return 'buyer'
  if (isDealer(user)) return 'dealer'
  if (isAdmin(user)) return 'admin'
  return null
}

// Layout route under ProtectedRoute: keeps each role on its own screens.
// A user opening another role's route is sent to the start of their own area: a dealer to /concesionaria,
// a buyer to /, an administrator to /admin (so logging in, which goes to /, lands an administrator on /admin).
// A user with no known role has no screen to be sent to: the denial replaces the route content,
// so the URL stays put and nothing loops between areas.
export default function RoleRoute({ allow }: Props) {
  const { user } = useAuth()
  const area = areaOf(user)

  if (area === null) {
    return (
      <div className={styles.denied}>
        <p role="alert" className={alertStyles.alert}>
          {MESSAGE_FORBIDDEN}
        </p>
      </div>
    )
  }
  if (area !== allow) return <Navigate to={HOME[area]} replace />
  return <Outlet />
}
