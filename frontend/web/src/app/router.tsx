import { Navigate, Outlet, createBrowserRouter, type RouteObject } from 'react-router'
import AuthProvider from '../features/auth/session/AuthProvider'
import GuestRoute from '../features/auth/session/GuestRoute'
import ProtectedRoute from '../features/auth/session/ProtectedRoute'
import LoginPage from '../features/auth/login/LoginPage'
import RegisterPage from '../features/auth/register/RegisterPage'
import RecoveryPage from '../features/auth/recovery/RecoveryPage'
import ResetPasswordPage from '../features/auth/recovery/ResetPasswordPage'
import HomePage from '../features/home/HomePage'
import AppShell from './AppShell'
import AuthLayout from './AuthLayout'

export const routes: RouteObject[] = [
  {
    // Pathless root: every route lives under the session provider.
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [{ path: '/', element: <HomePage /> }],
          },
        ],
      },
      {
        element: <GuestRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: '/login', element: <LoginPage /> },
              { path: '/registro', element: <RegisterPage /> },
              { path: '/recuperar', element: <RecoveryPage /> },
              { path: '/restablecer/:token', element: <ResetPasswordPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
