import { createContext } from 'react'

import type { LoginCredentials, RegisterPayload, User } from './types'

export type AuthStatus = 'loading' | 'authenticated' | 'guest'

export type AuthContextValue = {
  status: AuthStatus
  user: User | null
  login: (credentials: LoginCredentials) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  completeGoogle: (code: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
