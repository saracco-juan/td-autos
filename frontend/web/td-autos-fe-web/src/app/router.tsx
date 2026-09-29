import { Navigate, createBrowserRouter, type RouteObject } from 'react-router'
import RegisterPage from '../features/auth/register/RegisterPage'
import HomePage from '../features/home/HomePage'

export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/registro', element: <RegisterPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
