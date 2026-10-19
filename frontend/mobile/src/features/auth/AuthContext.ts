import { createContext } from 'react'

import type { AuthFetch } from '../../lib/http'
import type { ProfileValues } from '../profile/types'
import type { LoginCredentials, RegisterPayload, User } from './types'

export type AuthStatus = 'loading' | 'authenticated' | 'guest'

export type AuthContextValue = {
  status: AuthStatus
  user: User | null
  login: (credentials: LoginCredentials) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  completeGoogle: (code: string) => Promise<void>
  logout: () => Promise<void>
  // API call with the session token, for feature screens.
  authFetch: AuthFetch
  // Reloads GET /api/user into the session (e.g. after saving data that changes its flags). Never rejects.
  refreshUser: () => Promise<void>
  // Saves nombre/apellido and replaces `user` with the server's copy.
  // Rejects with HttpError (a 422 carries the field errors).
  updateProfile: (values: ProfileValues) => Promise<User>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
