import { createContext } from 'react'
import type { LoginCredentials, User } from '../types'

export type AuthStatus = 'loading' | 'authenticated' | 'guest'

export type AuthContextValue = {
  user: User | null
  status: AuthStatus
  refresh: () => Promise<void>
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
