import ProtectedRoute from '../auth/session/components/ProtectedRoute'
import { useAuth } from '../auth/session/hooks/useAuth'
import HomePage from './HomePage'

// Only the landing is public. Existing guards still own signed-in routing.
export default function PublicHomeRoute() {
  const { status } = useAuth()
  return status === 'authenticated' ? <ProtectedRoute /> : <HomePage />
}
