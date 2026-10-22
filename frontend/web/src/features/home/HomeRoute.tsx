import { Navigate } from 'react-router'
import { useAuth } from '../auth/session/useAuth'
import HomePage from './HomePage'

// Route element for /: a user with no saved diagnosis is sent to the questionnaire first (D6).
// It is not a lock: every other route stays reachable, and /diagnostico itself never redirects.
export default function HomeRoute() {
  const { user } = useAuth()

  if (user && !user.tiene_diagnostico) return <Navigate to="/diagnostico" replace />
  return <HomePage />
}
