import { createContext } from 'react'
import type { LoginCredentials, User } from '../types'

export type AuthStatus = 'loading' | 'authenticated' | 'guest'

export type AuthContextValue = {
  user: User | null
  status: AuthStatus
  refresh: () => Promise<void>
  login: (credentials: LoginCredentials) => Promise<void>
  /** Becomes guest on success or 401 (session already gone); rejects with the original error otherwise, staying authenticated. */
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
