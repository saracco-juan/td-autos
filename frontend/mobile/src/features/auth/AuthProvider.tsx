import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { apiFetch, HttpError, type AuthFetch } from '../../lib/http'
import { clearToken, readToken, saveToken } from '../../lib/tokenStorage'
import { exchangeGoogleCode, fetchCurrentUser, loginWithPassword, logoutRequest, registerWithPassword } from './api'
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthContext'
import type { TokenResponse, User } from './types'

type Session = { status: AuthStatus; user: User | null }

// Holds the session for the whole app: who is signed in (token kept in the secure store), or that nobody is.
export default function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<Session>({ status: 'loading', user: null })
  const tokenRef = useRef<string | null>(null)

  const start = useCallback(async ({ token, user }: TokenResponse) => {
    await saveToken(token)
    tokenRef.current = token
    setSession({ status: 'authenticated', user })
  }, [])

  const login = useCallback<AuthContextValue['login']>(
    async (credentials) => start(await loginWithPassword(credentials)),
    [start],
  )
  const register = useCallback<AuthContextValue['register']>(
    async (payload) => start(await registerWithPassword(payload)),
    [start],
  )
  const completeGoogle = useCallback<AuthContextValue['completeGoogle']>(
    async (code) => start(await exchangeGoogleCode(code)),
    [start],
  )

  const logout = useCallback(async () => {
    const token = tokenRef.current
    if (token) {
      try {
        await logoutRequest(token)
      } catch (error) {
        // A 401 means the token was already gone. Any other failure leaves it alive on the server:
        // surface it and keep the session so the user can try again.
        if (!(error instanceof HttpError && error.status === 401)) throw error
      }
    }
    await clearToken()
    tokenRef.current = null
    setSession({ status: 'guest', user: null })
  }, [])

  const authFetch = useCallback<AuthFetch>(
    (path, options) => apiFetch(path, { ...options, token: tokenRef.current }),
    [],
  )

  const refreshUser = useCallback(async () => {
    const token = tokenRef.current
    if (!token) return
    try {
      const user = await fetchCurrentUser(token)
      // Ignore a reload that lands after a logout.
      if (tokenRef.current === token) setSession({ status: 'authenticated', user })
    } catch {
      // The session stays as it was: the flags refresh on the next launch.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const restore = async () => {
      const token = await readToken()
      if (token === null) return { status: 'guest', user: null } satisfies Session
      try {
        const user = await fetchCurrentUser(token)
        tokenRef.current = token
        return { status: 'authenticated', user } satisfies Session
      } catch (error) {
        // Only a 401 proves the token is dead. If the API is unreachable the token stays for the next launch.
        if (error instanceof HttpError && error.status === 401) await clearToken()
        return { status: 'guest', user: null } satisfies Session
      }
    }
    void restore().then((restored) => {
      if (!cancelled) setSession(restored)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ ...session, login, register, completeGoogle, logout, authFetch, refreshUser }),
    [session, login, register, completeGoogle, logout, authFetch, refreshUser],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
