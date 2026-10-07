import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ErrorKind } from '../../../components/ErrorState'
import { HttpError, NetworkError } from '../../../lib/http'
import { fetchCurrentUser, loginUser, logoutUser } from '../api'
import type { LoginCredentials, User } from '../types'
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthContext'

type Session = { user: User | null; status: AuthStatus; errorKind?: ErrorKind }

const GUEST: Session = { user: null, status: 'guest' }

// Holds the session state for the whole app: who is logged in, or that nobody is.
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ user: null, status: 'loading' })

  const refresh = useCallback(async () => {
    try {
      setSession({ user: await fetchCurrentUser(), status: 'authenticated' })
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        setSession(GUEST)
      } else {
        // Keep the user behind the guards without mistaking an unavailable server for a logged-out session.
        setSession({ user: null, status: 'error', errorKind: error instanceof NetworkError ? 'network' : 'server' })
      }
    }
  }, [])

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      await loginUser(credentials)
      await refresh()
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    try {
      await logoutUser()
    } catch (error) {
      // A 401 means the session was already gone, so the client is a guest anyway.
      // Any other failure leaves the server session alive: surface it and stay authenticated.
      if (!(error instanceof HttpError && error.status === 401)) throw error
    }
    setSession(GUEST)
  }, [])

  useEffect(() => {
    // Initial load of the current user once the provider mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const value = useMemo<AuthContextValue>(
    () => ({ ...session, refresh, login, logout }),
    [session, refresh, login, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
