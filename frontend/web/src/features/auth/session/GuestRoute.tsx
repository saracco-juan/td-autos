import { Navigate, Outlet } from 'react-router'
import SessionLoading from './SessionLoading'
import { useAuth } from './useAuth'

// Layout route: screens for guests only (register, login, recovery); authenticated users go to /.
export default function GuestRoute() {
  const { status } = useAuth()

  if (status === 'loading') return <SessionLoading />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
