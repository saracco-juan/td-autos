import { Navigate, Outlet, createBrowserRouter, type RouteObject } from 'react-router'
import AuthProvider from '../features/auth/session/AuthProvider'
import GuestRoute from '../features/auth/session/GuestRoute'
import RegisterPage from '../features/auth/register/RegisterPage'
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
        element: <AppShell />,
        children: [
          { path: '/', element: <HomePage /> },
        ],
      },
      {
        element: <GuestRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [{ path: '/registro', element: <RegisterPage /> }],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
