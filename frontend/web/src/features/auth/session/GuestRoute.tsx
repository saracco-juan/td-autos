import { Navigate, Outlet } from 'react-router'
import ErrorState from '../../../components/ErrorState'
import SessionLoading from './SessionLoading'
import { useAuth } from './useAuth'

// Layout route: screens for guests only (register, login, recovery); authenticated users go to /.
export default function GuestRoute() {
  const { status, errorKind } = useAuth()

  if (status === 'loading') return <SessionLoading />
  if (status === 'error' && errorKind) return <ErrorState kind={errorKind} />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
