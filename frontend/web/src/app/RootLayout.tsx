import { Outlet, useLocation } from 'react-router'
import Scrollbar from '../components/Scrollbar'
import AuthProvider from '../features/auth/session/AuthProvider'

export default function RootLayout() {
  const { pathname } = useLocation()
  return <AuthProvider>
    <Outlet />
    <Scrollbar contentKey={pathname} label="Desplazar página" />
  </AuthProvider>
}
