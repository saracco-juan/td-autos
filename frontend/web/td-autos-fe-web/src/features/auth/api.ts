import { API_URL } from '../../lib/config'
import { apiFetch } from '../../lib/http'
import type { RegisterPayload, User } from './types'

export const GOOGLE_REDIRECT_URL = `${API_URL}/auth/google/redirect`

export function registerUser(payload: RegisterPayload): Promise<User> {
  return apiFetch<User>('/register', { method: 'POST', body: payload })
}

export function fetchCurrentUser(): Promise<User> {
  return apiFetch<User>('/api/user')
}
