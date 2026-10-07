import { createContext } from 'react'
import type { ErrorKind } from '../../../components/ErrorState'
import type { LoginCredentials, User } from '../types'

export type AuthStatus = 'loading' | 'authenticated' | 'guest' | 'error'

export type AuthContextValue = {
  user: User | null
  status: AuthStatus
  errorKind?: ErrorKind
  refresh: () => Promise<void>
  login: (credentials: LoginCredentials) => Promise<void>
  /** Becomes guest on success or 401 (session already gone); rejects with the original error otherwise, staying authenticated. */
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
