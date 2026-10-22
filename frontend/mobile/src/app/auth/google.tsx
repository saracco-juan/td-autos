import { Redirect } from 'expo-router'

import { useAuth } from '../../features/auth/useAuth'

// The OS may open the app on `auth/google` (the return URL of the Google flow). The result is read by the
// login screen from the auth session itself, so this route only sends the user where they belong.
export default function GoogleReturn() {
  const { status } = useAuth()
  return <Redirect href={status === 'authenticated' ? '/' : '/login'} />
}
