import { Navigate, Outlet, createBrowserRouter, type RouteObject } from 'react-router'
import AdminDashboardPage from '../features/admin/AdminDashboardPage'
import DealersPage from '../features/admin/DealersPage'
import AuthProvider from '../features/auth/session/AuthProvider'
import GuestRoute from '../features/auth/session/GuestRoute'
import ProtectedRoute from '../features/auth/session/ProtectedRoute'
import RoleRoute from '../features/auth/session/RoleRoute'
import DealerRegisterPage from '../features/auth/dealer/DealerRegisterPage'
import LoginPage from '../features/auth/login/LoginPage'
import RegisterPage from '../features/auth/register/RegisterPage'
import RecoveryPage from '../features/auth/recovery/RecoveryPage'
import ResetPasswordPage from '../features/auth/recovery/ResetPasswordPage'
import ActiveDealerRoute from '../features/dealer/ActiveDealerRoute'
import DealerStatusPage from '../features/dealer/DealerStatusPage'
import DiagnosisPage from '../features/diagnosis/DiagnosisPage'
import HomeRoute from '../features/home/HomeRoute'
import InspectionPage from '../features/inspection/InspectionPage'
import EditVehiclePage from '../features/inventory/EditVehiclePage'
import InventoryPage from '../features/inventory/InventoryPage'
import NewVehiclePage from '../features/inventory/NewVehiclePage'
import ProfilePage from '../features/profile/ProfilePage'
import RecommendationsPage from '../features/recommendations/RecommendationsPage'
import SubscriptionPage from '../features/subscription/SubscriptionPage'
import TransferPage from '../features/transfer/TransferPage'
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
      // The layouts wrap the guards, so while the session is read only the content area shows the loader.
      {
        element: <AppShell />,
        children: [
          {
            element: <ProtectedRoute />,
            children: [
              {
                // Buyer screens: a dealer is sent to /concesionaria and an administrator to /admin,
                // so the home never sends either to the diagnosis.
                element: <RoleRoute allow="buyer" />,
                children: [
                  { path: '/', element: <HomeRoute /> },
                  { path: '/diagnostico', element: <DiagnosisPage /> },
                  { path: '/vehiculos/:id/inspeccion', element: <InspectionPage /> },
                  { path: '/recomendaciones', element: <RecommendationsPage /> },
                  { path: '/transferencia', element: <TransferPage /> },
                  { path: '/perfil', element: <ProfilePage /> },
                ],
              },
              {
                // Dealer screens: a buyer is sent to / and an administrator to /admin.
                element: <RoleRoute allow="dealer" />,
                children: [
                  { path: '/concesionaria', element: <DealerStatusPage /> },
                  // Outside ActiveDealerRoute: a pending dealer has to reach it to send the first payment.
                  { path: '/concesionaria/suscripcion', element: <SubscriptionPage /> },
                  {
                    element: <ActiveDealerRoute />,
                    children: [
                      { path: '/concesionaria/inventario', element: <InventoryPage /> },
                      { path: '/concesionaria/inventario/nuevo', element: <NewVehiclePage /> },
                      { path: '/concesionaria/inventario/:id/editar', element: <EditVehiclePage /> },
                    ],
                  },
                ],
              },
              {
                // Admin screens (UH19): buyers and dealers are sent to their own area.
                element: <RoleRoute allow="admin" />,
                children: [
                  { path: '/admin', element: <AdminDashboardPage /> },
                  { path: '/admin/concesionarias', element: <DealersPage /> },
                ],
              },
            ],
          },
        ],
      },
      {
        element: <AuthLayout />,
        children: [
          {
            element: <GuestRoute />,
            children: [
              { path: '/login', element: <LoginPage /> },
              { path: '/registro', element: <RegisterPage /> },
              { path: '/registro/concesionaria', element: <DealerRegisterPage /> },
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
