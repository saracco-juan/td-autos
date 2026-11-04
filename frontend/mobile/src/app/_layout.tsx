import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

import Loader from '../components/Loader'
import AuthProvider from '../features/auth/AuthProvider'
import { useAuth } from '../features/auth/useAuth'

function RootNavigator() {
  const { status } = useAuth()

  // Only the initial session check blocks the app; every later wait is shown on the control that causes it.
  if (status === 'loading') return <Loader />

  return (
    // A failed guard redirects (Expo Router 58): guests go to the login, signed-in users to the tabs.
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'guest'} redirectTo="/">
        <Stack.Screen name="(guest)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'authenticated'} redirectTo="/login">
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Screen name="auth/google" />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  )
}
