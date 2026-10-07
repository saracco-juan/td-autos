import { Navigate, Outlet } from 'react-router'
import ErrorState from '../../../components/ErrorState'
import SessionLoading from './SessionLoading'
import { useAuth } from './useAuth'

// Layout route: only authenticated users reach the nested routes; guests go to /login.
export default function ProtectedRoute() {
  const { status, errorKind } = useAuth()

  if (status === 'loading') return <SessionLoading />
  if (status === 'error' && errorKind) return <ErrorState kind={errorKind} />
  if (status === 'guest') return <Navigate to="/login" replace />
  return <Outlet />
}
