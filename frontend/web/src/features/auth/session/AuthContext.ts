import { createContext } from 'react'
import type { ErrorKind } from '../../../components/ErrorState'
import type { LoginCredentials, User } from '../types'

// 'error': the server could not tell whether there is a session (unreachable or failing), unlike 'guest' (401).
export type AuthStatus = 'loading' | 'authenticated' | 'guest' | 'error'

export type AuthContextValue = {
  user: User | null
  status: AuthStatus
  /** Why the session could not be read; set only while the status is 'error'. */
  errorKind?: ErrorKind
  /** Never rejects. A failure other than 401 leaves an authenticated session as is; otherwise the status becomes 'error'. */
  refresh: () => Promise<void>
  login: (credentials: LoginCredentials) => Promise<void>
  /** Becomes guest on success or 401 (session already gone); rejects with the original error otherwise, staying authenticated. */
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
