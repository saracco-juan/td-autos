import { Navigate, createBrowserRouter, type RouteObject } from 'react-router'
import RegisterPage from '../features/auth/register/RegisterPage'
import HomePage from '../features/home/HomePage'
import AppShell from './AppShell'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/registro', element: <RegisterPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
