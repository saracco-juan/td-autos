import { Navigate, Outlet } from 'react-router'
import { isDealer } from '../roles'
import { useAuth } from './useAuth'

type Props = {
  allow: 'buyer' | 'dealer'
}

// Layout route under ProtectedRoute: keeps each role on its own screens.
// A dealer opening a buyer route goes to /concesionaria; anyone else opening a dealer route goes to /.
export default function RoleRoute({ allow }: Props) {
  const { user } = useAuth()
  const dealer = isDealer(user)

  if (allow === 'buyer' && dealer) return <Navigate to="/concesionaria" replace />
  if (allow === 'dealer' && !dealer) return <Navigate to="/" replace />
  return <Outlet />
}
